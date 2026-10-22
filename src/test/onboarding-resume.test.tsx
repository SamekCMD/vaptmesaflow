import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import OnboardingPage from '@/pages/onboarding/OnboardingPage';
import {tenantIds,tenantWrapper,tenantAccount,tenantJson} from './tenant-frontend-fixture';
import {onboardingTestServer} from './onboarding-test-server';
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'10000000-0000-4000-8000-000000000001'},loading:false})}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('a fresh query client resumes the saved draft without requiring a first dish',async()=>{
  const server=onboardingTestServer();vi.stubGlobal('fetch',server.fetcher);
  const first=tenantWrapper('/onboarding?restaurantId='+tenantIds.a),view=render(<OnboardingPage/>,{wrapper:first.wrapper});
  expect(await screen.findByDisplayValue('Nome salvo no servidor')).toBeVisible();
  expect(screen.queryByLabelText('Nome do Prato')).not.toBeInTheDocument();
  view.unmount();first.client.clear();const second=tenantWrapper('/onboarding?restaurantId='+tenantIds.a);
  render(<OnboardingPage/>,{wrapper:second.wrapper});expect(await screen.findByDisplayValue('Nome salvo no servidor')).toBeVisible();
  expect(server.state.createKeys).toHaveLength(0);second.client.clear();
});
it('staff cannot edit a draft even through a direct onboarding URL',async()=>{
  const server=onboardingTestServer(),fetcher=server.fetcher;
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async(url:string,init:RequestInit)=>{
    if(new URL(url).pathname==='/account/bootstrap'){
      const account=tenantAccount('staff');account.restaurants=account.restaurants.slice(0,1);account.restaurants[0].onboardingStatus='draft';account.destination='onboarding';return tenantJson(account);
    }return fetcher(url,init);
  }));
  const {wrapper,client}=tenantWrapper('/onboarding?restaurantId='+tenantIds.a);render(<OnboardingPage/>,{wrapper});
  expect(await screen.findByRole('alert')).toHaveTextContent('responsável');
  expect(screen.queryByRole('button',{name:'Próximo'})).not.toBeInTheDocument();
  expect(fetcher.mock.calls.some(([,init])=>init?.method==='PATCH'||init?.method==='POST')).toBe(false);client.clear();
});

it('failed save cannot advance, delivery hides tables, and finalization retry retains the original key',async()=>{
  const server=onboardingTestServer();vi.stubGlobal('fetch',server.fetcher);const {wrapper,client}=tenantWrapper('/onboarding?restaurantId='+tenantIds.a);
  render(<OnboardingPage/>,{wrapper});await screen.findByDisplayValue('Nome salvo no servidor');server.state.failSave=true;
  fireEvent.click(screen.getByRole('button',{name:'Próximo'}));await screen.findByRole('alert');
  expect(screen.getByLabelText('Nome do Restaurante')).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Finalizar'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Próximo'}));fireEvent.click(await screen.findByRole('radio',{name:'Delivery'}));
  expect(screen.queryByLabelText('Número de mesas')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Próximo'}));
  const finalize=await screen.findByRole('button',{name:'Finalizar'});server.state.loseFinalResponse=true;fireEvent.click(finalize);
  await screen.findByRole('alert');expect(screen.queryByRole('heading',{name:'Operação pronta'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Finalizar'}));expect(await screen.findByRole('heading',{name:'Operação pronta'})).toBeInTheDocument();
  expect(server.state.finalKeys).toHaveLength(2);expect(server.state.finalKeys[0]).toBe(server.state.finalKeys[1]);
  expect(server.state.trialStarts).toBe(1);expect(server.state.progress.overview).toBe(false);client.clear();
});
it('the first draft is created once and no menu item or activation completion is required',async()=>{
  const server=onboardingTestServer(true);vi.stubGlobal('fetch',server.fetcher);const {wrapper,client}=tenantWrapper('/onboarding');
  render(<OnboardingPage/>,{wrapper});fireEvent.change(await screen.findByLabelText('Nome do Restaurante'),{target:{value:'Primeiro restaurante'}});
  fireEvent.click(screen.getByRole('button',{name:'Próximo'}));await screen.findByRole('radio',{name:'Salão'});
  expect(server.state.trialStarts).toBe(0);fireEvent.click(screen.getByRole('button',{name:'Próximo'}));
  fireEvent.click(await screen.findByRole('button',{name:'Finalizar'}));await screen.findByRole('heading',{name:'Operação pronta'});
  expect(server.state.createKeys).toHaveLength(1);expect(server.state.trialStarts).toBe(1);
  const created=server.fetcher.mock.calls.find(([url])=>new URL(url).pathname==='/account/onboarding-draft')!;
  expect(JSON.parse(created[1].body as string)).toEqual({name:'Primeiro restaurante',slug:'primeiro-restaurante',whatsapp:''});
  expect(server.fetcher.mock.calls.some(([url])=>url.includes('/menu-items')||url.includes('/activation/'))).toBe(false);client.clear();
});
