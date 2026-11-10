import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import AppearancePage from '@/pages/dashboard/AppearancePage';
import {useCurrentRestaurant} from '@/features/restaurants/current-restaurant';
import {tenantAccount,tenantIds,tenantJson,tenantRestaurant,tenantWrapper} from './tenant-frontend-fixture';
const auth=vi.hoisted(()=>({user:{id:'10000000-0000-4000-8000-000000000001'}}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({...auth,loading:false})}));
vi.mock('@/hooks/use-toast',()=>({toast:vi.fn()}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function HeaderMenu(){const current=useCurrentRestaurant();return <a href={'/menu/'+current.restaurant?.slug}>Cardápio atual</a>;}
it('confirmed rename updates the shared restaurant context and selector without polling bootstrap again',async()=>{
  let finish!:(response:Response)=>void;
  const fetcher=vi.fn().mockImplementation(async(url:string,init:RequestInit)=>{
    const path=new URL(url).pathname;if(path==='/account/bootstrap')return tenantJson(tenantAccount());
    if(path.endsWith('/slug-availability'))return tenantJson({available:true});
    if(init.method==='PATCH')return new Promise<Response>(resolve=>{finish=resolve;});
    return tenantJson(tenantRestaurant(tenantIds.a));
  });vi.stubGlobal('fetch',fetcher);const {wrapper,client}=tenantWrapper('/dashboard/appearance?restaurantId='+tenantIds.a);
  render(<><HeaderMenu/><AppearancePage/></>,{wrapper});fireEvent.change(await screen.findByLabelText('Slug da URL'),{target:{value:'novo-cardapio'}});
  fireEvent.click(screen.getByRole('button',{name:'Salvar alteracoes'}));await waitFor(()=>expect(finish).toBeDefined());
  expect(screen.getByRole('link',{name:'Cardápio atual'})).toHaveAttribute('href','/menu/restaurante-a');
  await act(async()=>{finish(tenantJson({...tenantRestaurant(tenantIds.a),slug:'novo-cardapio'}));});
  await waitFor(()=>expect(screen.getByRole('link',{name:'Cardápio atual'})).toHaveAttribute('href','/menu/novo-cardapio'));
  const accounts=client.getQueriesData({queryKey:['vapt-private',tenantIds.user,'account-bootstrap']});
  expect(accounts.every(([,data])=>(data as ReturnType<typeof tenantAccount>).restaurants.find(r=>r.id===tenantIds.a)?.slug==='novo-cardapio')).toBe(true);
  expect(fetcher.mock.calls.filter(([url])=>new URL(url).pathname==='/account/bootstrap')).toHaveLength(1);client.clear();
});
