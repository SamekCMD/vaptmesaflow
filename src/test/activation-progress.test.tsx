import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {useActivationProgress} from '@/features/onboarding/use-activation-progress';
import {tenantIds,tenantJson,tenantWrapper} from './tenant-frontend-fixture';
const auth=vi.hoisted(()=>({user:{id:'10000000-0000-4000-8000-000000000001'} as {id:string}|null}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({...auth,loading:false})}));
afterEach(()=>{auth.user={id:tenantIds.user};cleanup();vi.unstubAllGlobals();localStorage.clear();});
it('completing overviewA never completes restaurantB or imports the legacy global guide flags',async()=>{
  const a={cashier:false,menu:false,kitchen:false,settings:false,overview:false},b={...a};
  localStorage.setItem('onboarding-guide-progress',JSON.stringify({cashier:true,menu:true,kitchen:true,settings:true,overview:true}));
  const fetcher=vi.fn().mockImplementation(async(url:string,init:RequestInit)=>{
    const target=url.includes(tenantIds.a)?a:b;if(init.method==='POST'){target.overview=true;return new Response(null,{status:204});}return tenantJson(target);
  });vi.stubGlobal('fetch',fetcher);const {wrapper,client}=tenantWrapper('/menu/public-slug');
  const {result,unmount}=renderHook(()=>({a:useActivationProgress(tenantIds.a),b:useActivationProgress(tenantIds.b)}),{wrapper});
  await waitFor(()=>expect(result.current.a.data?.overview).toBe(false));await waitFor(()=>expect(result.current.b.data?.overview).toBe(false));
  await act(async()=>{await result.current.a.complete('overview');});
  await waitFor(()=>expect(result.current.a.data?.overview).toBe(true));expect(result.current.b.data?.overview).toBe(false);
  const request=fetcher.mock.calls.find(([,init])=>init.method==='POST')!;
  expect(new URL(request[0]).pathname).toBe('/restaurants/'+tenantIds.a+'/activation/overview');expect(JSON.parse(request[1].body as string)).toEqual({});
  unmount();client.clear();const fresh=tenantWrapper('/menu/public-slug'),reopened=renderHook(()=>useActivationProgress(tenantIds.a),{wrapper:fresh.wrapper});
  await waitFor(()=>expect(reopened.result.current.data?.overview).toBe(true));fresh.client.clear();
});
it('signed-out activation stays disabled without a request or render error',()=>{
  auth.user=null;const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  const {wrapper,client}=tenantWrapper('/menu/public-slug');
  const {result}=renderHook(()=>useActivationProgress(null),{wrapper});
  expect(result.current.data).toBeUndefined();expect(result.current.completing).toBe(false);expect(fetcher).not.toHaveBeenCalled();client.clear();
});

it('a failed completion does not optimistically mark an activation module complete',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async(_url:string,init:RequestInit)=>init.method==='POST'?tenantJson({error:{code:'temporary_failure',message:'Tente novamente.'}},503):
    tenantJson({cashier:false,menu:false,kitchen:false,settings:false,overview:false})));
  const {wrapper,client}=tenantWrapper('/menu/public-slug'),{result}=renderHook(()=>useActivationProgress(tenantIds.a),{wrapper});
  await waitFor(()=>expect(result.current.data?.menu).toBe(false));await act(async()=>{await expect(result.current.complete('menu')).rejects.toBeDefined();});
  expect(result.current.data?.menu).toBe(false);client.clear();
});
