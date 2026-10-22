import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {optimizeMenuImage} from '@/lib/menu-image-optimization';
import AppearancePage from '@/pages/dashboard/AppearancePage';
import {tenantIds,tenantJson,tenantRestaurant} from './tenant-frontend-fixture';
const selected=vi.hoisted(()=>({id:'30000000-0000-4000-8000-000000000001',user:{id:'10000000-0000-4000-8000-000000000001'}}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:selected.user})}));
vi.mock('@/features/restaurants/current-restaurant',()=>({useCurrentRestaurant:()=>({scope:{userId:tenantIds.user,restaurantId:selected.id},organizationId:tenantIds.org,
  restaurant:tenantRestaurant(selected.id),loading:false,error:null,capabilities:['restaurant.read','restaurant.manage']})}));
vi.mock('@/lib/env',async original=>({ENV:{...(await original<typeof import('@/lib/env')>()).ENV,menuImageStorageMode:'r2',publicCatalogWriterEnabled:true}}));
vi.mock('@/lib/menu-image-optimization',()=>({optimizeMenuImage:vi.fn(async()=>new Blob(['compressed-webp'],{type:'image/webp'}))}));
vi.mock('@/hooks/use-toast',()=>({toast:vi.fn()}));
const objectId='40000000-0000-4000-8000-000000000001';
function server(uncertain=false,pending=false){
  let uploaded=false,operationId="";const keys:string[]=[],saved:Record<string,unknown>[]=[],retired:string[]=[];
  const fetcher=vi.fn().mockImplementation(async(url:string,init:RequestInit)=>{
    if(url==='https://signed.synthetic.test/logo'){uploaded=true;return new Response(null,{status:uncertain?503:204});}
    const path=new URL(url).pathname;
    if(path.endsWith('/branding/image/upload')){
      keys.push((init.headers as Record<string,string>)['Idempotency-Key']);
      expect(JSON.parse(init.body as string)).toEqual({contentType:'image/webp',contentLength:15});
      const objectKey=selected.id+'/branding/'+objectId,publicUrl='https://assets.synthetic.test/'+objectKey;
      return tenantJson(uploaded?{state:'uploaded',objectKey,publicUrl}:{state:'upload_required',method:'PUT',objectKey,publicUrl,uploadUrl:'https://signed.synthetic.test/logo',headers:{'Content-Type':'image/webp','If-Match':'"fence"'},expiresInSeconds:300});
    }
    if(path.includes('/catalog-operations/'))return tenantJson({operationId,restaurantId:selected.id,phase:'ready',version:'12',committed:true,retryable:false});
    if(init.method==='DELETE'){retired.push(new URL(url).searchParams.get('objectKey')!);return new Response(null,{status:204});}
    if(init.method==='PATCH'){
      const patch=JSON.parse(init.body as string);saved.push(patch);operationId=(init.headers as Record<string,string>)['Idempotency-Key'];
      return tenantJson({receipt:{operationId:(init.headers as Record<string,string>)['Idempotency-Key'],restaurantId:selected.id,phase:pending?'committed':'ready',version:'12',committed:true,retryable:pending},result:{...tenantRestaurant(selected.id),...patch}});
    }
    return tenantJson({...tenantRestaurant(selected.id),...(pending?{logoUrl:saved.at(-1)?.logoUrl??'https://assets.synthetic.test/'+selected.id+'/branding/40000000-0000-4000-8000-000000000099'}:{})});
  });return {fetcher,keys,saved,retired};
}
beforeEach(()=>{selected.id=tenantIds.a;vi.stubGlobal('URL',class extends URL{static createObjectURL=vi.fn(()=> 'blob:local-logo');static revokeObjectURL=vi.fn();});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();vi.mocked(optimizeMenuImage).mockReset().mockImplementation(async()=>new Blob(['compressed-webp'],{type:'image/webp'}));});
const selectLogo=(container:HTMLElement)=>fireEvent.change(container.querySelector('input[type="file"]')!,{target:{files:[new File(['original-png'],'logo.png',{type:'image/png'})]}});
it('stores only the verified R2 logo URL and revokes the local preview',async()=>{
  const fake=server();vi.stubGlobal('fetch',fake.fetcher);const view=render(<AppearancePage/>);await screen.findByDisplayValue('Restaurante A');
  selectLogo(view.container);fireEvent.click(screen.getByRole('button',{name:'Salvar alteracoes'}));
  await waitFor(()=>expect(fake.saved).toHaveLength(1));expect(fake.saved[0].logoUrl).toBe('https://assets.synthetic.test/'+tenantIds.a+'/branding/'+objectId);
  expect(fake.keys).toHaveLength(2);expect(fake.keys[0]).toBe(fake.keys[1]);
  expect(fake.fetcher.mock.calls.find(([url])=>url==='https://signed.synthetic.test/logo')?.[1]).toMatchObject({credentials:'omit',method:'PUT',body:expect.any(Blob)});
  view.unmount();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-logo');
});
it('a pending publication retains the old logo until ready then releases the preview without another upload',async()=>{
  const fake=server(false,true);vi.stubGlobal('fetch',fake.fetcher);const view=render(<AppearancePage/>);await screen.findByDisplayValue('Restaurante A');
  selectLogo(view.container);fireEvent.click(screen.getByRole('button',{name:'Salvar alteracoes'}));await screen.findByText('Gravada; publicação pendente');
  expect(fake.retired).toHaveLength(0);expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Verificar publicação'}));
  await waitFor(()=>expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-logo'));
  expect(fake.retired).toEqual([tenantIds.a+'/branding/40000000-0000-4000-8000-000000000099']);
  expect(fake.keys).toHaveLength(2);
});

it('an uncertain upload is retried with the same lease and never persists a blob URL',async()=>{
  vi.mocked(optimizeMenuImage).mockResolvedValueOnce(new Blob(['compressed-webp'],{type:'image/webp'})).mockResolvedValueOnce(new Blob(['different-encoded-bytes'],{type:'image/webp'}));
  const fake=server(true);vi.stubGlobal('fetch',fake.fetcher);const view=render(<AppearancePage/>);await screen.findByDisplayValue('Restaurante A');
  selectLogo(view.container);fireEvent.click(screen.getByRole('button',{name:'Salvar alteracoes'}));
  await waitFor(()=>expect(fake.fetcher.mock.calls.some(([url])=>url==='https://signed.synthetic.test/logo')).toBe(true));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Salvar alteracoes'})).toBeEnabled());expect(fake.saved).toHaveLength(0);
  fireEvent.click(screen.getByRole('button',{name:'Salvar alteracoes'}));await waitFor(()=>expect(fake.saved).toHaveLength(1));
  expect(optimizeMenuImage).toHaveBeenCalledTimes(1);
  expect(new Set(fake.keys).size).toBe(1);expect(fake.fetcher.mock.calls.filter(([url])=>url==='https://signed.synthetic.test/logo')).toHaveLength(1);
});
it('switching restaurants while the logo upload is pending cannot start a later attachment',async()=>{
  let finish!:(response:Response)=>void;const fake=server();
  vi.stubGlobal('fetch',vi.fn().mockImplementation((url:string,init:RequestInit)=>url.endsWith('/branding/image/upload')?new Promise<Response>(resolve=>{finish=resolve;}):fake.fetcher(url,init)));
  const view=render(<AppearancePage/>);await screen.findByDisplayValue('Restaurante A');selectLogo(view.container);fireEvent.click(screen.getByRole('button',{name:'Salvar alteracoes'}));
  await waitFor(()=>expect(finish).toBeDefined());selected.id=tenantIds.b;view.rerender(<AppearancePage/>);await screen.findByDisplayValue('Restaurante B');
  const objectKey=tenantIds.a+'/branding/'+objectId;
  await act(async()=>{finish(tenantJson({state:'uploaded',objectKey,publicUrl:'https://assets.synthetic.test/'+objectKey}));});
  expect(fake.saved).toHaveLength(0);expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-logo');
});
