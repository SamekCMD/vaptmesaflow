import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import MenuManagement from '@/pages/dashboard/MenuManagement';
import MercadoPagoSettingsCard from '@/components/payments/MercadoPagoSettingsCard';
import KitchenMonitor from '@/pages/dashboard/KitchenMonitor';
import ManualPaymentDialog from '@/components/payments/ManualPaymentDialog';
import SubscriptionPage from '@/pages/dashboard/SubscriptionPage';
import {redirectToBilling} from '@/lib/billing-client';
import {toast} from '@/hooks/use-toast';
import {tenantIds,tenantJson,tenantRestaurant} from './tenant-frontend-fixture';
import {uploadMenuImage} from '@/lib/menu-image-storage';
const selected=vi.hoisted(()=>({id:'30000000-0000-4000-8000-000000000001',organizationId:'20000000-0000-4000-8000-000000000001'}));
const realtime=vi.hoisted(()=>({records:[] as {scope:{restaurantId:string};closed:boolean}[]}));
vi.mock('@/lib/env',async original=>({ENV:{...(await original<typeof import('@/lib/env')>()).ENV,realtimeEnabled:true}}));
vi.mock('@/lib/realtime/client',()=>({subscribeRealtime:(scope,_message,state)=>{
  const record={scope,closed:false};realtime.records.push(record);state('connected');return()=>{record.closed=true;};
}}));
vi.mock('@/hooks/useSubscription',()=>({useSubscription:()=>({organizationId:selected.organizationId,planStatus:'expired',planType:'starter',
  loading:false,canManageBilling:false,canStartCheckout:true,isTrialing:false,trialDaysLeft:0,refetch:vi.fn()})}));
vi.mock('@/lib/billing-client',async original=>({...await original<typeof import('@/lib/billing-client')>(),redirectToBilling:vi.fn()}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'10000000-0000-4000-8000-000000000001'}})}));
vi.mock('@/features/restaurants/current-restaurant',()=>({useCurrentRestaurant:()=>({scope:{userId:tenantIds.user,restaurantId:selected.id},organizationId:tenantIds.org,
  restaurant:tenantRestaurant(selected.id),loading:false,error:null,capabilities:['restaurant.read','restaurant.operate','restaurant.manage','billing.read','billing.manage']})}));
vi.mock('@/lib/menu-image-storage',()=>({uploadMenuImage:vi.fn().mockResolvedValue('https://assets.synthetic.test/image.webp'),deleteMenuImage:vi.fn(),reconcileMenuImages:vi.fn()}));
vi.mock('@/hooks/use-toast',()=>({toast:vi.fn()}));
beforeEach(()=>{selected.id=tenantIds.a;selected.organizationId=tenantIds.org;realtime.records=[];vi.clearAllMocks();});afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('provider status is hidden immediately on scope change and manager controls remain read-only',async()=>{
  let finishB!:(response:Response)=>void;
  const fetcher=vi.fn().mockImplementation((url:string)=>url.includes(tenantIds.b)?new Promise<Response>(resolve=>{finishB=resolve;}):
    Promise.resolve(tenantJson({connected:true,status:'active'})));vi.stubGlobal('fetch',fetcher);
  const view=render(<MercadoPagoSettingsCard restaurantId={tenantIds.a} canRead canManage={false} environment='sandbox'/>);
  await screen.findByText('Mercado Pago conectado');expect(screen.getByRole('button',{name:'Desconectar'})).toBeDisabled();
  selected.id=tenantIds.b;view.rerender(<MercadoPagoSettingsCard restaurantId={tenantIds.b} canRead canManage={false} environment='sandbox'/>);
  expect(screen.queryByText('Mercado Pago conectado')).not.toBeInTheDocument();
  await waitFor(()=>expect(finishB).toBeDefined());await act(async()=>{finishB(tenantJson({connected:false,status:'disconnected'}));});
  expect(await screen.findByRole('button',{name:'Conectar Mercado Pago'})).toBeDisabled();
  expect(fetcher.mock.calls.every(([url])=>url.endsWith('/status?environment=sandbox'))).toBe(true);
});
it('provider status performs no private request without the server capability',()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  render(<MercadoPagoSettingsCard restaurantId={tenantIds.a} canRead={false} canManage={false} environment='sandbox'/>);
  expect(fetcher).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Conectar Mercado Pago'})).not.toBeInTheDocument();
});
it('old kitchen transition feedback is discarded and the private realtime scope closes before B opens',async()=>{
  let finish!:(response:Response)=>void;
  const order=(id:string)=>({id:id===tenantIds.a?'40000000-0000-4000-8000-000000000001':'40000000-0000-4000-8000-000000000002',restaurantId:id,
    displayId:id===tenantIds.a?'11':'22',status:'pending',channel:'local',paymentStatus:'paid',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),items:[]});
  vi.stubGlobal('fetch',vi.fn().mockImplementation((url:string,init:RequestInit)=>init.method==='PATCH'?new Promise<Response>(resolve=>{finish=resolve;}):
    Promise.resolve(tenantJson([order(url.includes(tenantIds.a)?tenantIds.a:tenantIds.b)]))));
  localStorage.setItem('vapt_kds_sound_enabled','false');
  const view=render(<MemoryRouter><KitchenMonitor/></MemoryRouter>);fireEvent.click(await screen.findByRole('button',{name:/#11/}));
  await waitFor(()=>expect(finish).toBeDefined());selected.id=tenantIds.b;view.rerender(<MemoryRouter><KitchenMonitor/></MemoryRouter>);
  await screen.findByText('#22');vi.mocked(toast).mockClear();
  await act(async()=>{finish(tenantJson({...order(tenantIds.a),status:'preparing'}));});
  expect(screen.queryByText('#11')).not.toBeInTheDocument();expect(toast).not.toHaveBeenCalled();
  expect(realtime.records.find(record=>record.scope.restaurantId===tenantIds.a)?.closed).toBe(true);
  expect(realtime.records.some(record=>record.scope.restaurantId===tenantIds.b&&!record.closed)).toBe(true);
});
it('manual confirmation captures the restaurant path and stops the remaining A batch after selection changes',async()=>{
  let finish!:(response:Response)=>void;const confirmed=vi.fn();
  const orders=[1,2].map(index=>({id:'40000000-0000-4000-8000-00000000000'+index,displayId:index,totalPrice:'10.00',paymentStatus:null,paymentConfirmedAt:null}));
  const fetcher=vi.fn().mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve;}));vi.stubGlobal('fetch',fetcher);
  const view=render(<ManualPaymentDialog sessionId="synthetic-session" restaurantId={tenantIds.a} canOperate open orders={orders} onConfirmed={confirmed} onOpenChange={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Confirmar recebimento'}));await waitFor(()=>expect(finish).toBeDefined());
  view.rerender(<ManualPaymentDialog sessionId="synthetic-session" restaurantId={tenantIds.b} canOperate open orders={[{...orders[0],id:'40000000-0000-4000-8000-000000000099'}]} onConfirmed={confirmed} onOpenChange={vi.fn()}/>);
  await act(async()=>{finish(tenantJson({status:'paid'}));});
  expect(fetcher).toHaveBeenCalledOnce();expect(new URL(fetcher.mock.calls[0][0]).pathname).toBe('/restaurants/'+tenantIds.a+'/orders/'+orders[0].id+'/payments/manual-confirmation');
  expect(confirmed).not.toHaveBeenCalled();
});
it('a late hosted billing response for organizationA cannot redirect after organizationB becomes current',async()=>{
  let finish!:(response:Response)=>void;vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve;})));
  const view=render(<SubscriptionPage/>);fireEvent.click(screen.getByRole('button',{name:'Assinar Pro'}));
  await waitFor(()=>expect(finish).toBeDefined());selected.organizationId='20000000-0000-4000-8000-000000000002';view.rerender(<SubscriptionPage/>);
  await act(async()=>{finish(tenantJson({checkoutSessionId:'cs_test_synthetic',url:'https://checkout.stripe.com/c/synthetic'}));});
  expect(redirectToBilling).not.toHaveBeenCalled();
});
it('an A image chosen before switching never starts an upload or second mutation in B',async()=>{
  let finishPatch!:(response:Response)=>void;
  const item=(id:string)=>({id:'40000000-0000-4000-8000-000000000001',restaurantId:id,name:id===tenantIds.a?'Prato A':'Prato B',price:'10.00',category:'Pratos',description:null,
    available:true,imageUrl:null,availableFrom:null,availableUntil:null,badge:null,isChefSuggestion:false,prepTimeMinutes:null,variations:[]});
  const fetcher=vi.fn().mockImplementation((url:string,init:RequestInit)=>init.method==='PATCH'?new Promise<Response>(resolve=>{finishPatch=resolve;}):
    Promise.resolve(tenantJson([item(url.includes(tenantIds.a)?tenantIds.a:tenantIds.b)])));vi.stubGlobal('fetch',fetcher);
  vi.stubGlobal('URL',class extends URL{static createObjectURL(){return 'blob:synthetic-a';}});
  const view=render(<MemoryRouter><MenuManagement/></MemoryRouter>);await screen.findByText('Prato A');
  fireEvent.click(screen.getByRole('button',{name:'Editar Prato A'}));
  fireEvent.change(view.container.ownerDocument.querySelector('input[type="file"]')!,{target:{files:[new File(['image'],'a.png',{type:'image/png'})]}});
  fireEvent.click(screen.getByRole('button',{name:'Salvar'}));await waitFor(()=>expect(finishPatch).toBeDefined());
  selected.id=tenantIds.b;view.rerender(<MemoryRouter><MenuManagement/></MemoryRouter>);await screen.findByText('Prato B');
  await act(async()=>{finishPatch(tenantJson(item(tenantIds.a)));});
  expect(uploadMenuImage).not.toHaveBeenCalled();expect(screen.queryByText('Prato A')).not.toBeInTheDocument();
  expect(fetcher.mock.calls.filter(([,init])=>init.method==='PATCH')).toHaveLength(1);
});
it('an A provider authorization response cannot redirect after switching the card to B',async()=>{
  let finish!:(response:Response)=>void;const redirect=vi.fn();
  vi.stubGlobal('fetch',vi.fn().mockImplementation((url:string)=>url.endsWith('/connect')?new Promise<Response>(resolve=>{finish=resolve;}):Promise.resolve(tenantJson({connected:false,status:'disconnected'}))));
  const view=render(<MercadoPagoSettingsCard canRead canManage restaurantId={tenantIds.a} environment='sandbox' onAuthorizationUrl={redirect}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Conectar Mercado Pago'}));await waitFor(()=>expect(finish).toBeDefined());
  selected.id=tenantIds.b;view.rerender(<MercadoPagoSettingsCard canRead canManage restaurantId={tenantIds.b} environment='sandbox' onAuthorizationUrl={redirect}/>);
  await act(async()=>{finish(tenantJson({authorizationUrl:'https://auth.mercadopago.com/authorization?state=synthetic'}));});
  expect(redirect).not.toHaveBeenCalled();
});
