import {render,screen,fireEvent,renderHook,waitFor,cleanup} from '@testing-library/react';
import {Routes,Route} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import {useCurrentRestaurant} from '@/features/restaurants/current-restaurant';
import {useSubscription} from '@/hooks/useSubscription';
import {tenantAccount,tenantIds,tenantJson,tenantRestaurant,tenantWrapper} from './tenant-frontend-fixture';
import ProtectedRoute from '@/components/ProtectedRoute';
import RestaurantSelectorPage from '@/features/restaurants/RestaurantSelectorPage';
const auth=vi.hoisted(()=>({user:{id:'10000000-0000-4000-8000-000000000001'},loading:false}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>auth}));
const otherOrg='20000000-0000-4000-8000-000000000002';
const status={planType:'business',planStatus:'active',trialEndsAt:null,currentPeriodEnd:null,cancelAtPeriodEnd:false,
  subscriptionCanceledAt:null,canManageBilling:true,canStartCheckout:false,requiresBillingAction:false};
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it.each(['checkout=returned','checkout=cancelled','portal-return','mercado-pago'])('fresh provider return %s selects its organization despite another tab preference',async result=>{
  const account=tenantAccount();account.organizations.push({...account.organizations[0],id:otherOrg,name:'Grupo B'});
  account.restaurants[1].organizationId=otherOrg;account.currentOrganizationId=otherOrg;account.currentRestaurantId=tenantIds.b;
  const fetcher=vi.fn().mockImplementation(async(input:string)=>{
    const url=new URL(input);
    if(url.pathname==='/account/bootstrap')return tenantJson(url.searchParams.get('restaurantId')===tenantIds.a
      ?{...account,currentOrganizationId:tenantIds.org,currentRestaurantId:tenantIds.a}:account);
    if(url.pathname==='/billing/stripe/subscription')return tenantJson(status);
    return tenantJson(tenantRestaurant(url.pathname.split('/')[2]));
  });vi.stubGlobal('fetch',fetcher);
  const {wrapper,client}=tenantWrapper(result==='mercado-pago'
    ?'/dashboard/settings?payment_provider=mercado_pago&connection=connected&restaurantId='+tenantIds.a
    :'/dashboard/subscription?billingOrganizationId='+tenantIds.org+'&'+result);
  const {result:hook,unmount}=renderHook(()=>({restaurant:useCurrentRestaurant(),subscription:useSubscription()}),{wrapper});
  await waitFor(()=>expect(hook.current.restaurant.restaurant?.id).toBe(tenantIds.a));
  await waitFor(()=>expect(hook.current.subscription.loading).toBe(false));
  expect(hook.current.subscription.organizationId).toBe(tenantIds.org);
  const reads=fetcher.mock.calls.map(([url])=>new URL(url)).filter(url=>url.pathname==='/billing/stripe/subscription');
  expect(reads.length).toBeGreaterThan(0);expect(reads.every(url=>url.searchParams.get('organizationId')===tenantIds.org)).toBe(true);
  unmount();client.clear();
});
it('billing return with several restaurants in its organization requires selection there, never in the other tab organization',async()=>{
  const account=tenantAccount(),third='30000000-0000-4000-8000-000000000003';
  account.organizations.push({...account.organizations[0],id:otherOrg,name:'Grupo B'});
  account.restaurants[1].organizationId=otherOrg;account.restaurants.push({...account.restaurants[0],id:third,name:'Restaurante C'});
  account.currentOrganizationId=otherOrg;account.currentRestaurantId=tenantIds.b;
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async(input:string,init:RequestInit)=>{
    const url=new URL(input);if(init?.method==='PATCH')return new Response(null,{status:204});
    if(url.pathname==='/account/bootstrap')return tenantJson(url.searchParams.get('restaurantId')===tenantIds.a
      ?{...account,currentOrganizationId:tenantIds.org,currentRestaurantId:tenantIds.a}:account);
    return tenantJson(tenantRestaurant(url.pathname.split('/')[2]));
  }));
  const {wrapper,client}=tenantWrapper('/dashboard/subscription?billingOrganizationId='+tenantIds.org);
  render(<Routes><Route path='/dashboard/subscription' element={<ProtectedRoute><p>Cobrança do grupo A</p></ProtectedRoute>}/>
    <Route path='/restaurants/select' element={<ProtectedRoute mode='account'><RestaurantSelectorPage/></ProtectedRoute>}/></Routes>,{wrapper});
  expect(await screen.findByText('Restaurante A')).toBeInTheDocument();expect(screen.getByText('Restaurante C')).toBeInTheDocument();
  expect(screen.queryByText('Restaurante B')).not.toBeInTheDocument();expect(screen.queryByText('Cobrança do grupo A')).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button',{name:'Abrir'})[0]);
  expect(await screen.findByText('Cobrança do grupo A')).toBeInTheDocument();client.clear();
});
it.each(['20000000-0000-4000-8000-000000000099','not-an-id'])('unavailable return organization %s fails closed instead of using preference B',async organizationId=>{
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>tenantJson(tenantAccount())));
  const {wrapper,client}=tenantWrapper('/dashboard/subscription?billingOrganizationId='+organizationId);
  const {result,unmount}=renderHook(()=>useCurrentRestaurant(),{wrapper});
  await waitFor(()=>expect(result.current.error).not.toBeNull());expect(result.current.scope).toBeNull();
  unmount();client.clear();
});
