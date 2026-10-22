import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,expect,it,vi} from 'vitest';
import CashierPage from '@/pages/dashboard/CashierPage';
import {tenantIds,tenantJson,tenantRestaurant} from './tenant-frontend-fixture';
const selected=vi.hoisted(()=>({id:'30000000-0000-4000-8000-000000000001'}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:tenantIds.user},loading:false})}));
vi.mock('@/features/restaurants/current-restaurant',()=>({useCurrentRestaurant:()=>({scope:{userId:tenantIds.user,restaurantId:selected.id},organizationId:tenantIds.org,
  restaurant:tenantRestaurant(selected.id),loading:false,error:null,capabilities:['restaurant.read','restaurant.operate','restaurant.manage']})}));
vi.mock('@/hooks/useSubscription',()=>({useSubscription:()=>({loading:false,canAccess:()=>true})}));
vi.mock('@/lib/env',async original=>({ENV:{...(await original<typeof import('@/lib/env')>()).ENV,realtimeEnabled:false}}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();selected.id=tenantIds.a;localStorage.clear();});
const Location=()=>{const location=useLocation();return <output aria-label='Endereço'>{location.pathname+location.search}</output>;};
it('the guide waits for server confirmation before navigating and retains the restaurant in its links',async()=>{
  let finish!:(response:Response)=>void;
  const fetcher=vi.fn().mockImplementation(async(url:string,init:RequestInit)=>{
    if(new URL(url).pathname.endsWith('/activation/cashier'))return new Promise<Response>(resolve=>{finish=resolve;});
    return tenantJson(url.includes('/activation')?{cashier:false,menu:false,kitchen:false,settings:false,overview:false}:[]);
  });vi.stubGlobal('fetch',fetcher);const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard/cashier?guide=1&restaurantId='+tenantIds.a]}><CashierPage/><Location/></MemoryRouter></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button',{name:'Concluir e continuar'}));
  await waitFor(()=>expect(finish).toBeDefined());expect(screen.getByLabelText('Endereço')).toHaveTextContent('/dashboard/cashier?');
  expect(screen.getByRole('button',{name:/Salvando/})).toBeDisabled();
  await act(async()=>{finish(tenantJson({error:{code:'temporary_failure',message:'Tente novamente.'}},503));});
  expect(await screen.findByRole('alert')).toHaveTextContent('salvar');expect(screen.getByLabelText('Endereço')).toHaveTextContent('/dashboard/cashier?');
  fireEvent.click(screen.getByRole('button',{name:'Concluir e continuar'}));
  await waitFor(()=>expect(fetcher.mock.calls.filter(([url])=>new URL(url).pathname.endsWith('/activation/cashier'))).toHaveLength(2));
  await act(async()=>{finish(new Response(null,{status:204}));});
  await waitFor(()=>expect(screen.getByLabelText('Endereço')).toHaveTextContent('/dashboard/menu?guide=1&restaurantId='+tenantIds.a));
  expect(localStorage.getItem('onboarding-guide-progress')).toBeNull();client.clear();
});
