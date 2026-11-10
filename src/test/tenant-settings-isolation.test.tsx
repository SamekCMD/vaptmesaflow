import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import AppearancePage from '@/pages/dashboard/AppearancePage';
import SettingsPage from '@/pages/dashboard/SettingsPage';
import {tenantIds,tenantJson,tenantRestaurant} from './tenant-frontend-fixture';
import {toast} from '@/hooks/use-toast';
const selected=vi.hoisted(()=>({id:'30000000-0000-4000-8000-000000000001',manage:true,
  user:{id:'10000000-0000-4000-8000-000000000001',name:'Gestor',email:'gestor@synthetic.test'},updateName:vi.fn(),changePassword:vi.fn()}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:selected.user,updateName:selected.updateName,changePassword:selected.changePassword})}));
vi.mock('@/features/restaurants/current-restaurant',()=>({useCurrentRestaurant:()=>({scope:{userId:tenantIds.user,restaurantId:selected.id},organizationId:tenantIds.org,
  restaurant:tenantRestaurant(selected.id),loading:false,error:null,capabilities:selected.manage?['restaurant.read','restaurant.operate','restaurant.manage','billing.read','billing.manage']:['restaurant.read','restaurant.operate']})}));
vi.mock('@/hooks/use-toast',()=>({toast:vi.fn()}));
vi.mock('@/components/payments/MercadoPagoSettingsCard',()=>({default:()=>null}));
beforeEach(()=>{selected.id=tenantIds.a;selected.manage=true;vi.clearAllMocks();});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it.each(['name','password'])('late %s account feedback cannot change the newly selected settings view',async kind=>{
  let finish!:(result:{error:null})=>void;
  const action=kind==='name'?selected.updateName:selected.changePassword;action.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async(url:string)=>tenantJson(tenantRestaurant(url.includes(tenantIds.a)?tenantIds.a:tenantIds.b))));
  const element=<MemoryRouter initialEntries={['/dashboard/settings?tab=account']}><SettingsPage/></MemoryRouter>;
  const view=render(element);await screen.findByLabelText('Nome do titular');
  if(kind==='name')fireEvent.change(screen.getByLabelText('Nome do titular'),{target:{value:'Nome anterior'}});
  else{fireEvent.change(screen.getByLabelText('Senha atual'),{target:{value:'senha-anterior'}});
    fireEvent.change(screen.getByLabelText('Nova senha'),{target:{value:'senha-nova-segura'}});
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'),{target:{value:'senha-nova-segura'}});}
  fireEvent.click(screen.getByRole('button',{name:kind==='name'?'Salvar nome':'Alterar Senha'}));
  await waitFor(()=>expect(finish).toBeDefined());selected.id=tenantIds.b;view.rerender(<MemoryRouter><SettingsPage/></MemoryRouter>);
  await screen.findByLabelText('Nome do titular');vi.mocked(toast).mockClear();
  await act(async()=>{finish({error:null});});expect(toast).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Nome do titular')).toHaveValue('Gestor');
});
it.each(['appearance','settings'])('a delayed restaurantA response cannot populate or save the restaurantB %s form',async kind=>{
  let finishA!:(response:Response)=>void;
  const fetcher=vi.fn().mockImplementation((url:string,init:RequestInit)=>{
    if(init.method==='GET'&&new URL(url).pathname==='/restaurants/'+tenantIds.a)return new Promise<Response>(resolve=>{finishA=resolve;});
    return Promise.resolve(tenantJson(tenantRestaurant(tenantIds.b)));
  });vi.stubGlobal('fetch',fetcher);
  const Page=kind==='appearance'?AppearancePage:SettingsPage;
  const view=render(<MemoryRouter><Page/></MemoryRouter>);
  await waitFor(()=>expect(finishA).toBeDefined());selected.id=tenantIds.b;view.rerender(<MemoryRouter><Page/></MemoryRouter>);
  await screen.findByDisplayValue('Restaurante B');
  await act(async()=>{finishA(tenantJson(tenantRestaurant(tenantIds.a)));await Promise.resolve();});
  expect(screen.queryByDisplayValue('Restaurante A')).not.toBeInTheDocument();
  if(kind==='appearance')expect(screen.getByRole('link',{name:'Ver Menu publico'})).toHaveAttribute('href','/menu/restaurante-b');
  fireEvent.click(screen.getByRole('button',{name:kind==='appearance'?'Salvar alteracoes':'Salvar Alterações'}));
  await waitFor(()=>expect(fetcher.mock.calls.some(([,init])=>init.method==='PATCH')).toBe(true));
  const patch=fetcher.mock.calls.find(([,init])=>init.method==='PATCH')!;
  expect(new URL(patch[0]).pathname).toBe('/restaurants/'+tenantIds.b);expect(JSON.parse(patch[1].body as string).name).toBe('Restaurante B');
});
it('already loaded A values disappear immediately while the B form is still loading',async()=>{
  let finishB!:(response:Response)=>void;
  vi.stubGlobal('fetch',vi.fn().mockImplementation((url:string)=>url.includes(tenantIds.b)?new Promise<Response>(resolve=>{finishB=resolve;}):Promise.resolve(tenantJson(tenantRestaurant(tenantIds.a)))));
  const view=render(<MemoryRouter><SettingsPage/></MemoryRouter>);await screen.findByDisplayValue('Restaurante A');
  selected.id=tenantIds.b;view.rerender(<MemoryRouter><SettingsPage/></MemoryRouter>);
  expect(screen.queryByDisplayValue('Restaurante A')).not.toBeInTheDocument();
  await act(async()=>{finishB(tenantJson(tenantRestaurant(tenantIds.b)));});await screen.findByDisplayValue('Restaurante B');
});
it('a save captured for A cannot report success or change the B form after it finishes late',async()=>{
  let finishSave!:(response:Response)=>void;
  const fetcher=vi.fn().mockImplementation((url:string,init:RequestInit)=>init.method==='PATCH'?new Promise<Response>(resolve=>{finishSave=resolve;}):
    Promise.resolve(tenantJson(tenantRestaurant(url.includes(tenantIds.a)?tenantIds.a:tenantIds.b))));vi.stubGlobal('fetch',fetcher);
  const view=render(<MemoryRouter><SettingsPage/></MemoryRouter>);await screen.findByDisplayValue('Restaurante A');
  fireEvent.click(screen.getByRole('button',{name:'Salvar Alterações'}));await waitFor(()=>expect(finishSave).toBeDefined());
  selected.id=tenantIds.b;view.rerender(<MemoryRouter><SettingsPage/></MemoryRouter>);await screen.findByDisplayValue('Restaurante B');vi.mocked(toast).mockClear();
  await act(async()=>{finishSave(tenantJson(tenantRestaurant(tenantIds.a)));});
  expect(screen.getByDisplayValue('Restaurante B')).toBeInTheDocument();expect(toast).not.toHaveBeenCalled();
  expect(new URL(fetcher.mock.calls.find(([,init])=>init.method==='PATCH')![0]).pathname).toBe('/restaurants/'+tenantIds.a);
});
it.each(['404','wrong-id','rejected'])('a %s load never leaves a blank editable settings form',async failure=>{
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>{if(failure==='rejected')throw new Error('synthetic transport failure');
    return failure==='404'?tenantJson({error:{code:'restaurant_not_found',message:'Indisponível'}},404):tenantJson(tenantRestaurant(tenantIds.b));}));
  render(<MemoryRouter><SettingsPage/></MemoryRouter>);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  const save=screen.queryByRole('button',{name:'Salvar Alterações'});if(save)expect(save).toBeDisabled();
});
it('staff can read settings but cannot submit restaurant or payment-flow edits',async()=>{
  selected.manage=false;const fetcher=vi.fn().mockResolvedValue(tenantJson(tenantRestaurant(tenantIds.a)));vi.stubGlobal('fetch',fetcher);
  render(<MemoryRouter><SettingsPage/></MemoryRouter>);await screen.findByDisplayValue('Restaurante A');
  expect(screen.getByRole('button',{name:'Salvar Alterações'})).toBeDisabled();
  expect(screen.getByRole('button',{name:'Salvar fluxo do pedido'})).toBeDisabled();
  expect(fetcher.mock.calls.some(([,init])=>(init as RequestInit)?.method==='PATCH')).toBe(false);
});
