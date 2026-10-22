import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import AppearancePage from '@/pages/dashboard/AppearancePage';
import {tenantIds,tenantJson,tenantRestaurant} from './tenant-frontend-fixture';
const selected=vi.hoisted(()=>({id:'30000000-0000-4000-8000-000000000001',user:{id:'10000000-0000-4000-8000-000000000001'}}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:selected.user})}));
vi.mock('@/features/restaurants/current-restaurant',()=>({useCurrentRestaurant:()=>({scope:{userId:tenantIds.user,restaurantId:selected.id},organizationId:tenantIds.org,
  restaurant:tenantRestaurant(selected.id),loading:false,error:null,capabilities:['restaurant.read','restaurant.manage']})}));
vi.mock('@/hooks/use-toast',()=>({toast:vi.fn()}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});beforeEach(()=>{selected.id=tenantIds.a;});
const conflict='Este endereço já está em uso. Escolha outro.';
it('checks only on blur and shows a duplicate slug inline without erasing edits',async()=>{
  const fetcher=vi.fn().mockImplementation(async(url:string)=>tenantJson(url.includes('/slug-availability')?{available:false}:tenantRestaurant(selected.id)));
  vi.stubGlobal('fetch',fetcher);render(<AppearancePage/>);const field=await screen.findByDisplayValue('restaurante-a');
  fireEvent.change(field,{target:{value:'outro-restaurante'}});expect(fetcher.mock.calls.filter(([url])=>url.includes('/slug-availability'))).toHaveLength(0);
  fireEvent.blur(field);expect(await screen.findByText(conflict)).toBeVisible();expect(field).toHaveValue('outro-restaurante');
  fireEvent.change(field,{target:{value:'-invalido'}});fireEvent.blur(field);fireEvent.click(screen.getByRole('button',{name:'Salvar alteracoes'}));
  expect(await screen.findByText(/Use de 2 a 60/)).toBeVisible();expect(fetcher.mock.calls.filter(([url])=>url.includes('/slug-availability'))).toHaveLength(1);
});
it('an obsolete slug availability response cannot validate a new slug or tenant',async()=>{
  let finish!:(response:Response)=>void;
  vi.stubGlobal('fetch',vi.fn().mockImplementation((url:string)=>url.includes('/slug-availability')?new Promise<Response>(resolve=>{finish=resolve;}):Promise.resolve(tenantJson(tenantRestaurant(selected.id)))));
  const view=render(<AppearancePage/>);const field=await screen.findByDisplayValue('restaurante-a');fireEvent.change(field,{target:{value:'consulta-antiga'}});fireEvent.blur(field);
  await waitFor(()=>expect(finish).toBeDefined());fireEvent.change(field,{target:{value:'novo-valor'}});
  await act(async()=>{finish(tenantJson({available:false}));});expect(screen.queryByText(conflict)).not.toBeInTheDocument();
  fireEvent.blur(field);await act(async()=>{await Promise.resolve();});selected.id=tenantIds.b;view.rerender(<AppearancePage/>);await screen.findByDisplayValue('restaurante-b');
  await act(async()=>{finish(tenantJson({available:false}));});expect(screen.queryByText(conflict)).not.toBeInTheDocument();
});
it('a concurrent save conflict is inline even after a positive availability check',async()=>{
  const fetcher=vi.fn().mockImplementation(async(url:string,init:RequestInit)=>init.method==='PATCH'?tenantJson({error:{code:'slug_conflict',message:'Slug conflict'}},409):tenantJson(url.includes('/slug-availability')?{available:true}:tenantRestaurant(selected.id)));
  vi.stubGlobal('fetch',fetcher);render(<AppearancePage/>);const field=await screen.findByDisplayValue('restaurante-a');fireEvent.change(field,{target:{value:'livre-antes'}});
  fireEvent.click(screen.getByRole('button',{name:'Salvar alteracoes'}));expect(await screen.findByText(conflict)).toBeVisible();expect(field).toHaveValue('livre-antes');
  expect(fetcher.mock.calls.filter(([url])=>url.includes('/slug-availability'))).toHaveLength(1);
});
it('public links keep the confirmed slug until the rename commits',async()=>{
  let finish!:(response:Response)=>void;
  vi.stubGlobal('fetch',vi.fn().mockImplementation((url:string,init:RequestInit)=>init.method==='PATCH'?new Promise<Response>(resolve=>{finish=resolve;}):Promise.resolve(tenantJson(url.includes('/slug-availability')?{available:true}:tenantRestaurant(selected.id)))));
  render(<AppearancePage/>);const field=await screen.findByDisplayValue('restaurante-a');fireEvent.change(field,{target:{value:'slug-confirmado'}});
  expect(screen.getByRole('link',{name:'Ver Menu publico'})).toHaveAttribute('href','/menu/restaurante-a');fireEvent.click(screen.getByRole('button',{name:'Salvar alteracoes'}));
  await waitFor(()=>expect(finish).toBeDefined());expect(screen.getByRole('link',{name:'Ver Menu publico'})).toHaveAttribute('href','/menu/restaurante-a');
  await act(async()=>{finish(tenantJson({...tenantRestaurant(tenantIds.a),slug:'slug-confirmado'}));});
  await waitFor(()=>expect(screen.getByRole('link',{name:'Ver Menu publico'})).toHaveAttribute('href','/menu/slug-confirmado'));
});
