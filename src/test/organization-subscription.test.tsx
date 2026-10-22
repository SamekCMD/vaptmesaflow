import {cleanup,renderHook,waitFor,render,screen} from '@testing-library/react';
import {Routes,Route,useLocation} from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import {afterEach,expect,it,vi} from 'vitest';
import {useSubscription} from '@/hooks/useSubscription';
import {usePlan} from '@/hooks/use-plan';
import {billingClient} from '@/lib/billing-client';
import {tenantAccount,tenantIds,tenantJson,tenantWrapper} from './tenant-frontend-fixture';
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'10000000-0000-4000-8000-000000000001'},loading:false})}));
vi.mock('@/lib/push-notifications',()=>({registerServiceWorker:vi.fn()}));
vi.mock('@/components/dashboard/PushNotificationBanner',()=>({default:()=>null}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const status={planType:'business',planStatus:'active',trialEndsAt:null,currentPeriodEnd:null,cancelAtPeriodEnd:false,
  subscriptionCanceledAt:null,canManageBilling:true,canStartCheckout:false,requiresBillingAction:false};
const RouteProbe=()=> <output data-testid='route-selection'>{useLocation().search}</output>;
it('expired staff operation remains blocked without querying private billing',async()=>{
  const account=tenantAccount('staff');account.organizations[0].operationActive=false;
  const fetcher=vi.fn().mockImplementation(async(url:string)=>tenantJson(url.includes('/account/bootstrap')?account:{id:tenantIds.a}));
  vi.stubGlobal('fetch',fetcher);const {wrapper,client}=tenantWrapper();
  render(<Routes><Route path='/dashboard' element={<ProtectedRoute><DashboardLayout/></ProtectedRoute>}>
    <Route path='kitchen' element={<p>Expired kitchen mounted</p>}/></Route></Routes>,{wrapper});
  expect(await screen.findByText(/A operação desta organização está suspensa/i)).toBeInTheDocument();
  expect(screen.queryByText('Expired kitchen mounted')).not.toBeInTheDocument();
  expect(fetcher.mock.calls.some(([url])=>url.includes('/billing/'))).toBe(false);client.clear();
});
it('staff dashboard keeps kitchen mounted without commercial redirect or private billing reads',async()=>{
  const fetcher=vi.fn().mockImplementation(async(url:string)=>tenantJson(url.includes('/account/bootstrap')?tenantAccount('staff'):{id:tenantIds.a,slug:'restaurante-a'}));
  vi.stubGlobal('fetch',fetcher);const {wrapper,client}=tenantWrapper();
  render(<Routes><Route path='/dashboard' element={<ProtectedRoute><DashboardLayout/></ProtectedRoute>}>
    <Route path='kitchen' element={<><p>Kitchen operational</p><RouteProbe/></>}/><Route path='subscription' element={<p>Private billing screen</p>}/>
  </Route></Routes>,{wrapper});
  expect(await screen.findByText('Kitchen operational')).toBeInTheDocument();
  expect(screen.queryByText('Private billing screen')).not.toBeInTheDocument();
  await waitFor(()=>expect(screen.getByTestId('route-selection')).toHaveTextContent('restaurantId='+tenantIds.a));
  expect(fetcher.mock.calls.some(([url])=>url.includes('/billing/'))).toBe(false);client.clear();
});
it('manager reads the organization subscription but never gains mutation actions from provider flags',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async(url:string)=>tenantJson(url.includes('/account/bootstrap')?tenantAccount('manager'):
    url.includes('/restaurants/')?{id:tenantIds.a}:{...status,canManageBilling:true,canStartCheckout:true})));
  const {wrapper,client}=tenantWrapper(),{result}=renderHook(useSubscription,{wrapper});
  await waitFor(()=>expect(result.current.loading).toBe(false));
  expect(result.current.canReadBilling).toBe(true);expect(result.current.canManageBilling).toBe(false);
  expect(result.current.canStartCheckout).toBe(false);client.clear();
});
it('staff can open kitchen without requesting private subscription status',async()=>{
  const fetcher=vi.fn().mockImplementation(async(url:string)=>{
    const path=new URL(url).pathname;
    return tenantJson(path==='/account/bootstrap'?tenantAccount('staff'):path.startsWith('/restaurants/')?{id:tenantIds.a}:status);
  });vi.stubGlobal('fetch',fetcher);
  const {wrapper,client}=tenantWrapper(),{result}=renderHook(()=>({subscription:useSubscription(),plan:usePlan()}),{wrapper});
  await waitFor(()=>expect(result.current.subscription.loading).toBe(false));
  expect(result.current.subscription.canAccess('cashier')).toBe(true);expect(result.current.plan.canAccess('open_tab')).toBe(true);
  expect(fetcher.mock.calls.some(([url])=>url.includes('/billing/'))).toBe(false);
  expect(fetcher.mock.calls.filter(([url])=>url.includes('/account/bootstrap'))).toHaveLength(1);client.clear();
});
it('two consumers share one organization subscription and checkout sends no restaurant authority',async()=>{
  const fetcher=vi.fn().mockImplementation(async(url:string)=>tenantJson(new URL(url).pathname==='/account/bootstrap'?tenantAccount():
    new URL(url).pathname.startsWith('/restaurants/')?{id:tenantIds.a}:url.includes('/checkout')?{checkoutSessionId:'cs_test',url:'https://checkout.stripe.com/c/test'}:status));
  vi.stubGlobal('fetch',fetcher);const {wrapper,client}=tenantWrapper();
  const {result}=renderHook(()=>({a:useSubscription(),b:usePlan()}),{wrapper});
  await waitFor(()=>expect(result.current.a.loading).toBe(false));
  expect(fetcher.mock.calls.filter(([url])=>url.includes('/billing/stripe/subscription'))).toHaveLength(1);
  await billingClient.createCheckout({organizationId:tenantIds.org,planType:'pro'});
  const checkout=fetcher.mock.calls.find(([url])=>url.includes('/checkout'))!;
  expect(JSON.parse((checkout[1] as RequestInit).body as string)).toEqual({organizationId:tenantIds.org,planType:'pro'});client.clear();
});
