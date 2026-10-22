import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {Route,Routes} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import OnboardingPage from '@/pages/onboarding/OnboardingPage';
import CashierPage from '@/pages/dashboard/CashierPage';
import MenuManagement from '@/pages/dashboard/MenuManagement';
import ProtectedRoute from '@/components/ProtectedRoute';
import {RestaurantSwitcher} from '@/features/restaurants/RestaurantSwitcher';
import {useCurrentRestaurant} from '@/features/restaurants/current-restaurant';
import {tenantAccount,tenantIds,tenantJson,tenantRestaurant,tenantWrapper} from './tenant-frontend-fixture';
import {onboardingTestServer} from './onboarding-test-server';
const auth=vi.hoisted(()=>({user:{id:'10000000-0000-4000-8000-000000000001'} as {id:string}|null}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({...auth,loading:false})}));
vi.mock('@/hooks/useSubscription',()=>({useSubscription:()=>({loading:false,canAccess:()=>true})}));
vi.mock('@/lib/env',async original=>({ENV:{...(await original<typeof import('@/lib/env')>()).ENV,realtimeEnabled:false}}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();auth.user={id:tenantIds.user};});
function Selection(){const current=useCurrentRestaurant();return <><RestaurantSwitcher/><output aria-label='Restaurante selecionado'>{current.restaurant?.name}</output></>;}
it('resumable setup leads into persisted activation and an explicit restaurant switch without inheriting guide progress',async()=>{
  const fake=onboardingTestServer();let preferred=tenantIds.a;
  const progressB={cashier:false,menu:false,kitchen:false,settings:false,overview:false};
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async(url:string,init:RequestInit)=>{
    const target=new URL(url),path=target.pathname;
    if(path==='/account/bootstrap'){
      const account=tenantAccount(),id=target.searchParams.get('restaurantId')??preferred;
      account.restaurants[0].onboardingStatus=fake.state.complete?'complete':'draft';
      account.currentRestaurantId=id;account.destination=id===tenantIds.a&&!fake.state.complete?'onboarding':'dashboard';return tenantJson(account);
    }
    if(path==='/account/preference'){preferred=JSON.parse(init.body as string).restaurantId;return new Response(null,{status:204});}
    if(path.endsWith('/table-sessions')||path.endsWith('/menu-items'))return tenantJson([]);
    if(path==='/restaurants/'+tenantIds.b)return tenantJson(tenantRestaurant(tenantIds.b));
    if(path==='/restaurants/'+tenantIds.b+'/activation')return tenantJson(progressB);
    return fake.fetcher(url,init);
  }));
  const {wrapper,client}=tenantWrapper('/onboarding?restaurantId='+tenantIds.a);
  const App=()=> <Routes><Route path='/onboarding' element={<ProtectedRoute><OnboardingPage/></ProtectedRoute>}/>
    <Route path='/dashboard/cashier' element={<ProtectedRoute><Selection/><CashierPage/></ProtectedRoute>}/>
    <Route path='/dashboard/menu' element={<ProtectedRoute><Selection/><MenuManagement/></ProtectedRoute>}/>
    <Route path='/login' element={<p>Sessão encerrada</p>}/></Routes>;
  const view=render(<App/>,{wrapper});await screen.findByDisplayValue('Nome salvo no servidor');
  fireEvent.click(screen.getByRole('button',{name:'Próximo'}));await screen.findByRole('radio',{name:'Salão'});fireEvent.click(screen.getByRole('button',{name:'Próximo'}));
  fireEvent.click(await screen.findByRole('button',{name:'Finalizar'}));fireEvent.click(await screen.findByRole('link',{name:'Continuar guia'}));
  fireEvent.click(await screen.findByRole('button',{name:'Concluir e continuar'}));await screen.findByText('Guia: ajuste seu cardápio');
  expect(fake.state.progress.cashier).toBe(true);expect(fake.state.progress.menu).toBe(false);
  fireEvent.change(screen.getByRole('combobox',{name:'Restaurante atual'}),{target:{value:tenantIds.b}});
  await waitFor(()=>expect(screen.getByLabelText('Restaurante selecionado')).toHaveTextContent('Restaurante B'));
  expect(progressB.cashier).toBe(false);expect(fake.state.trialStarts).toBe(1);expect(fake.state.finalKeys).toHaveLength(1);
  auth.user=null;view.rerender(<App/>);expect(await screen.findByText('Sessão encerrada')).toBeVisible();
  expect(screen.queryByRole('button',{name:'Concluir e continuar'})).not.toBeInTheDocument();client.clear();
});
