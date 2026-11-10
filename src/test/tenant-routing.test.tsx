import {cleanup,render,screen} from '@testing-library/react';
import {Routes,Route} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginPage from '@/pages/auth/LoginPage';
import SignupPage from '@/pages/auth/SignupPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import {tenantAccount,tenantIds,tenantJson,tenantWrapper} from './tenant-frontend-fixture';
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'10000000-0000-4000-8000-000000000001'},loading:false})}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it.each(['login','signup'])('authenticated %s enters the account destination instead of an unconditional dashboard',async page=>{
  const account=tenantAccount();account.currentRestaurantId=null;account.destination='select-restaurant';
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>tenantJson(account)));
  const {wrapper,client}=tenantWrapper('/'+page);
  render(<Routes><Route path={'/'+page} element={page==='login'?<LoginPage/>:<SignupPage/>}/>
    <Route path='/restaurants/select' element={<p>Account selection destination</p>}/></Routes>,{wrapper});
  expect(await screen.findByText('Account selection destination')).toBeInTheDocument();client.clear();
});
it('an authenticated password recovery route never requests bootstrap or redirects into the dashboard',()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const {wrapper,client}=tenantWrapper('/reset-password?token=synthetic');
  render(<ResetPasswordPage/>,{wrapper});expect(screen.getByLabelText('Nova senha')).toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();client.clear();
});
it('staff cannot mount the private subscription page through a manual URL',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async(url:string)=>tenantJson(url.includes('/account/bootstrap')?tenantAccount('staff'):{id:tenantIds.a})));
  const {wrapper,client}=tenantWrapper('/dashboard/subscription?restaurantId='+tenantIds.a);
  render(<ProtectedRoute><p>Private subscription mounted</p></ProtectedRoute>,{wrapper});
  expect(await screen.findByText(/Sem permissão para acessar a cobrança/i)).toBeInTheDocument();
  expect(screen.queryByText('Private subscription mounted')).not.toBeInTheDocument();client.clear();
});
it.each(['empty','multiple','draft','empty-subscription'])('routes %s account before rendering commercial or operational dashboard',async kind=>{
  const account=tenantAccount();
  if(kind.startsWith('empty')){account.organizations=[];account.restaurants=[];account.currentOrganizationId=null;account.currentRestaurantId=null;account.destination='onboarding';}
  if(kind==='multiple'){account.currentRestaurantId=null;account.destination='select-restaurant';}
  if(kind==='draft'){account.restaurants[0].onboardingStatus='draft';account.destination='onboarding';}
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async(url:string)=>tenantJson(url.includes('/account/bootstrap')?account:{id:tenantIds.a})));
  const path=kind==='empty-subscription'?'/dashboard/subscription':'/dashboard/kitchen';
  const {wrapper,client}=tenantWrapper(path);
  render(<Routes><Route path={path} element={<ProtectedRoute><div>Operational screen</div></ProtectedRoute>}/>
    <Route path='/onboarding' element={<div>Resume onboarding</div>}/><Route path='/restaurants/select' element={<div>Select restaurant</div>}/></Routes>,{wrapper});
  expect(await screen.findByText(kind==='multiple'?'Select restaurant':'Resume onboarding')).toBeInTheDocument();
  expect(screen.queryByText('Operational screen')).not.toBeInTheDocument();client.clear();
});
