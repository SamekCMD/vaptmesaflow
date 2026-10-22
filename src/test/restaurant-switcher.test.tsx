import {cleanup,fireEvent,render,screen,waitFor,act,renderHook} from '@testing-library/react';
import {useLocation,useNavigate} from 'react-router-dom';
import {useCurrentRestaurant} from '@/features/restaurants/current-restaurant';
import {afterEach,expect,it,vi} from 'vitest';
import {RestaurantSwitcher} from '@/features/restaurants/RestaurantSwitcher';
import NewRestaurantPage from '@/features/restaurants/NewRestaurantPage';
import {tenantAccount,tenantIds,tenantJson,tenantWrapper} from './tenant-frontend-fixture';
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'10000000-0000-4000-8000-000000000001'},loading:false})}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function Location(){return <output>{useLocation().search}</output>;}
it('two independent tabs retain explicit restaurants after another tab changes the preference',async()=>{
  let preference=tenantIds.a;
  const fetcher=vi.fn().mockImplementation(async(url:string)=>{
    const target=new URL(url),account=tenantAccount();
    if(target.pathname==='/account/bootstrap'){
      account.currentRestaurantId=target.searchParams.get('restaurantId')??preference;return tenantJson(account);
    }
    return tenantJson({id:target.pathname.split('/')[2]});
  });vi.stubGlobal('fetch',fetcher);
  const tabA=tenantWrapper('/dashboard/kitchen?restaurantId='+tenantIds.a),tabB=tenantWrapper('/dashboard/kitchen?restaurantId='+tenantIds.b);
  const a=renderHook(()=>({current:useCurrentRestaurant(),navigate:useNavigate(),location:useLocation()}),{wrapper:tabA.wrapper});
  const b=renderHook(()=>useCurrentRestaurant(),{wrapper:tabB.wrapper});
  await waitFor(()=>expect(a.result.current.current.scope?.restaurantId).toBe(tenantIds.a));
  await waitFor(()=>expect(b.result.current.scope?.restaurantId).toBe(tenantIds.b));
  preference=tenantIds.b;
  act(()=>a.result.current.navigate('/dashboard/kitchen?guide=1'));
  await act(async()=>{await tabA.client.invalidateQueries({queryKey:['vapt-private',tenantIds.user,'account-bootstrap']});});
  await waitFor(()=>expect(a.result.current.location.search).toContain('restaurantId='+tenantIds.a));
  expect(a.result.current.current.scope?.restaurantId).toBe(tenantIds.a);expect(b.result.current.scope?.restaurantId).toBe(tenantIds.b);
  a.unmount();b.unmount();tabA.client.clear();tabB.client.clear();
});
it('an unmounted switch cannot clear private caches or navigate after a late preference response',async()=>{
  let finish!:(response:Response)=>void;
  vi.stubGlobal('fetch',vi.fn().mockImplementation((url:string)=>url.includes('/account/preference')?new Promise<Response>(resolve=>{finish=resolve;}):
    Promise.resolve(tenantJson(url.includes('/account/bootstrap')?tenantAccount():{id:tenantIds.a}))));
  const {wrapper,client}=tenantWrapper('/dashboard/kitchen?restaurantId='+tenantIds.a);
  const view=render(<RestaurantSwitcher/>,{wrapper});
  const select=await screen.findByLabelText('Restaurante atual');await waitFor(()=>expect(select).not.toBeDisabled());
  fireEvent.change(select,{target:{value:tenantIds.b}});await waitFor(()=>expect(finish).toBeDefined());
  view.unmount();const key=['vapt-private',tenantIds.user,'late-cache-sentinel'];client.setQueryData(key,'keep');
  await act(async()=>{finish(tenantJson({}));await Promise.resolve();});
  expect(client.getQueryData(key)).toBe('keep');client.clear();
});
it('switch replaces an old explicit restaurant URL only after validated preference succeeds',async()=>{
  const fetcher=vi.fn().mockImplementation(async(url:string)=>{
    const target=new URL(url),account=tenantAccount();
    if(target.searchParams.get('restaurantId')===tenantIds.b)account.currentRestaurantId=tenantIds.b;
    return tenantJson(target.pathname==='/account/bootstrap'?account:target.pathname==='/account/preference'?{}:{id:target.pathname.split('/')[2]});
  });vi.stubGlobal('fetch',fetcher);const {wrapper,client}=tenantWrapper('/dashboard/kitchen?restaurantId='+tenantIds.a+'&guide=1');
  render(<><RestaurantSwitcher/><Location/></>,{wrapper});
  const select=await screen.findByLabelText('Restaurante atual');
  await waitFor(()=>expect(select).not.toBeDisabled());
  fireEvent.change(select,{target:{value:tenantIds.b}});
  await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('restaurantId='+tenantIds.b));
  const save=fetcher.mock.calls.find(([url])=>url.includes('/account/preference'))!;
  expect(JSON.parse((save[1] as RequestInit).body as string)).toEqual({organizationId:tenantIds.org,restaurantId:tenantIds.b});client.clear();
});
it('server entitlement denial disables restaurant creation regardless of apparent role',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async(url:string)=>tenantJson(url.includes('/account/bootstrap')?tenantAccount():
    url.includes('/restaurant-entitlement')?{canCreate:false,reason:'permission',count:1,limit:25}:{id:tenantIds.a})));
  const {wrapper,client}=tenantWrapper('/restaurants/new');render(<NewRestaurantPage/>,{wrapper});
  await screen.findByText(/Sem permissão para criar/i);
  expect(screen.getByRole('button',{name:'Continuar configuração'})).toBeDisabled();client.clear();
});
