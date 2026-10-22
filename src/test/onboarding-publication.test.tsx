import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import OnboardingPage from '@/pages/onboarding/OnboardingPage';
import {tenantIds,tenantJson,tenantWrapper} from './tenant-frontend-fixture';
import {onboardingTestServer} from './onboarding-test-server';
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'10000000-0000-4000-8000-000000000001'},loading:false})}));
vi.mock('@/lib/env',async original=>({ENV:{...(await original<typeof import('@/lib/env')>()).ENV,publicCatalogWriterEnabled:true}}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('a committed finalization stays pending until an explicit ready receipt and never creates another restaurant',async()=>{
  const server=onboardingTestServer();server.state.draft!.onboardingStep=2;
  let operationId='';const fetcher=vi.fn().mockImplementation(async(url:string,init:RequestInit)=>{
    const path=new URL(url).pathname;
    if(path.endsWith('/onboarding/finalize')){
      expect((init.headers as Record<string,string>)['X-Vapt-Catalog-Protocol']).toBe('1');
      operationId=(init.headers as Record<string,string>)['Idempotency-Key'];
      server.state.complete=true;return tenantJson({receipt:{operationId,restaurantId:tenantIds.a,phase:'committed',version:'12',committed:true,retryable:true}},202);
    }
    if(path.includes('/catalog-operations/'))return tenantJson({operationId,restaurantId:tenantIds.a,phase:'ready',version:'12',committed:true,retryable:false});
    return server.fetcher(url,init);
  });vi.stubGlobal('fetch',fetcher);const {wrapper,client}=tenantWrapper('/onboarding?restaurantId='+tenantIds.a);
  render(<OnboardingPage/>,{wrapper});fireEvent.click(await screen.findByRole('button',{name:'Finalizar'}));
  await screen.findByText('Gravada; publicação pendente');expect(screen.queryByRole('heading',{name:'Operação pronta'})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Finalizar'})).toBeDisabled();
  expect(fetcher.mock.calls.filter(([url])=>url.includes('/catalog-operations/'))).toHaveLength(0);
  fireEvent.click(screen.getByRole('button',{name:'Verificar publicação'}));
  expect(await screen.findByRole('heading',{name:'Operação pronta'})).toBeInTheDocument();
  await waitFor(()=>expect(fetcher.mock.calls.filter(([url])=>url.endsWith('/onboarding/finalize'))).toHaveLength(1));
  expect(server.state.createKeys).toHaveLength(0);expect(server.state.progress.menu).toBe(false);client.clear();
});
it('refresh after a committed but pending finalization cannot claim publication from bootstrap or a URL flag',async()=>{
  const server=onboardingTestServer();server.state.draft!.onboardingStep=2;server.state.complete=true;
  vi.stubGlobal('fetch',server.fetcher);const {wrapper,client}=tenantWrapper('/onboarding?restaurantId='+tenantIds.a+'&setup=complete');
  render(<OnboardingPage/>,{wrapper});expect(await screen.findByRole('button',{name:'Finalizar'})).toBeEnabled();
  expect(screen.queryByRole('heading',{name:'Operação pronta'})).not.toBeInTheDocument();
  expect(server.state.finalKeys).toHaveLength(0);client.clear();
});
