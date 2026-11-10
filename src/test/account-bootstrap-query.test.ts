import {describe,it,expect,vi,afterEach} from 'vitest';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {createElement,type ReactNode} from 'react';
import {renderHook,cleanup,act,waitFor} from '@testing-library/react';
import {MemoryRouter,useNavigate} from 'react-router-dom';
import {RestaurantProvider} from '@/contexts/RestaurantContext';
import {useCurrentRestaurant} from '@/features/restaurants/current-restaurant';
import {deriveAccountBootstrap,accountBootstrapQueryOptions,accountBootstrapQueryKey} from '@/features/auth/account-bootstrap-query';
import {parseAccountBootstrap} from '@/features/auth/account-client';
const userId='10000000-0000-4000-8000-000000000001',organizationId='20000000-0000-4000-8000-000000000001';
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'10000000-0000-4000-8000-000000000001'},loading:false})}));
const restA='30000000-0000-4000-8000-000000000001',restB='30000000-0000-4000-8000-000000000002';
const organization={id:organizationId,name:'Grupo Teste',role:'staff' as const,capabilities:['restaurant.read','restaurant.operate'] as ('restaurant.read'|'restaurant.operate')[],
  operationActive:true,features:{cashier:true,open_tab:true,metrics:true,multi_user:true,advanced_reports:true}};
const restaurant={id:restA,organizationId,name:'A',slug:'a-test',onboardingStatus:'complete' as 'complete'|'draft'};
const multipleWithoutPreference={userId,organizations:[organization],restaurants:[restaurant,{...restaurant,id:restB,name:'B',slug:'b-test'}],
  preferredOrganizationId:null,preferredRestaurantId:null,routeRestaurantId:null};
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('canonical account bootstrap',()=>{
  it('selection changes and bootstrap errors never expose a late restaurant response from the previous selection',async()=>{
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
    let finishA!:(response:Response)=>void;
    const wire=(id:string)=>({userId,organizations:[organization],restaurants:multipleWithoutPreference.restaurants,
      currentOrganizationId:organizationId,currentRestaurantId:id,destination:'dashboard'});
    const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
    const fetcher=vi.fn().mockImplementation((url:string)=>{
      const target=new URL(url);
      if(target.pathname==='/account/bootstrap'){
        if(target.searchParams.get('restaurantId')==='30000000-0000-4000-8000-000000000099')return Promise.resolve(json({error:{code:'forbidden'}}));
        return Promise.resolve(json(wire(target.searchParams.get('restaurantId')??restA)));
      }
      if(target.pathname==='/restaurants/'+restA)return new Promise<Response>(resolve=>{finishA=resolve;});
      return Promise.resolve(json({id:restB,name:'B'}));
    });vi.stubGlobal('fetch',fetcher);
    const wrapper=({children}:{children:ReactNode})=>createElement(QueryClientProvider,{client},
      createElement(MemoryRouter,{initialEntries:['/dashboard?restaurantId='+restA]},createElement(RestaurantProvider,null,children)));
    const {result,unmount}=renderHook(()=>({current:useCurrentRestaurant(),navigate:useNavigate()}),{wrapper});
    await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
    act(()=>result.current.navigate('/dashboard?restaurantId='+restB));
    expect(result.current.current.restaurant).toBeNull();
    await waitFor(()=>expect(result.current.current.restaurant?.id).toBe(restB));
    await act(async()=>{finishA(json({id:restA,name:'A'}));await Promise.resolve();});
    expect(result.current.current.restaurant?.id).toBe(restB);
    act(()=>result.current.navigate('/dashboard?restaurantId=30000000-0000-4000-8000-000000000099'));
    await waitFor(()=>expect(result.current.current.error).not.toBeNull());
    expect(result.current.current.scope).toBeNull();expect(result.current.current.restaurant).toBeNull();
    unmount();client.clear();
  });
  it('public routes never initialize private account or restaurant queries, even for a signed-in user',()=>{
    const client=new QueryClient(),fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    const wrapper=({children}:{children:ReactNode})=>createElement(QueryClientProvider,{client},
      createElement(MemoryRouter,{initialEntries:['/menu/public-slug']},createElement(RestaurantProvider,null,children)));
    const {result,unmount}=renderHook(()=>useCurrentRestaurant(),{wrapper});
    expect(result.current.scope).toBeNull();expect(result.current.restaurant).toBeNull();expect(result.current.loading).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();unmount();client.clear();
  });
  it('multiple ready restaurants without a valid preference require explicit selection',()=>{
    expect(deriveAccountBootstrap(multipleWithoutPreference).destination).toBe('select-restaurant');
    expect(deriveAccountBootstrap(multipleWithoutPreference).currentRestaurantId).toBeNull();
    expect(deriveAccountBootstrap({...multipleWithoutPreference,preferredOrganizationId:organizationId,
      preferredRestaurantId:'30000000-0000-4000-8000-000000000099'}).currentRestaurantId).toBeNull();
  });
  it('selects only a unique accessible restaurant, matching preference or explicit allowed route',()=>{
    expect(deriveAccountBootstrap({...multipleWithoutPreference,restaurants:[restaurant]}).currentRestaurantId).toBe(restA);
    const preferred={...multipleWithoutPreference,preferredOrganizationId:organizationId,preferredRestaurantId:restA};
    expect(deriveAccountBootstrap(preferred).currentRestaurantId).toBe(restA);
    expect(deriveAccountBootstrap({...preferred,routeRestaurantId:restB}).currentRestaurantId).toBe(restB);
    expect(()=>deriveAccountBootstrap({...preferred,routeRestaurantId:'30000000-0000-4000-8000-000000000099'})).toThrow();
    expect(()=>deriveAccountBootstrap({...preferred,routeRestaurantId:'invalid'})).toThrow();
    expect(deriveAccountBootstrap({...multipleWithoutPreference,restaurants:[{...restaurant,onboardingStatus:'draft'}]}).destination).toBe('onboarding');
    expect(deriveAccountBootstrap({...multipleWithoutPreference,organizations:[],restaurants:[]}).destination).toBe('onboarding');
  });
  it('parses only the safe DTO and rejects a selected restaurant outside the returned account',()=>{
    const wire={userId,organizations:[{...organization,stripeCustomerId:'cus_private'}],restaurants:[restaurant],
      currentOrganizationId:organizationId,currentRestaurantId:restA,destination:'dashboard',sessionId:'private-session'};
    expect(JSON.stringify(parseAccountBootstrap(wire))).not.toMatch(/cus_private|private-session|stripeCustomerId|sessionId/);
    expect(()=>parseAccountBootstrap({...wire,currentRestaurantId:restB})).toThrow();
  });
  it('cancellation and identity-keyed queries cannot deliver an old account into the new identity',async()=>{
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
    let resolveOld:(value:Response)=>void=()=>{};
    const fetcher=vi.fn().mockImplementationOnce(()=>new Promise<Response>(resolve=>{resolveOld=resolve;}));
    vi.stubGlobal('fetch',fetcher);
    const query=accountBootstrapQueryOptions(userId),old=client.fetchQuery(query);
    await client.cancelQueries({queryKey:accountBootstrapQueryKey(userId)});
    await expect(old).rejects.toBeDefined();
    resolveOld(new Response(JSON.stringify({userId,organizations:[organization],restaurants:[restaurant],currentOrganizationId:organizationId,currentRestaurantId:restA,destination:'dashboard'})));
    await Promise.resolve();expect(client.getQueryData(accountBootstrapQueryKey(userId))).toBeUndefined();
    const other='10000000-0000-4000-8000-000000000002';
    fetcher.mockResolvedValue(new Response(JSON.stringify({userId:other,organizations:[],restaurants:[],currentOrganizationId:null,currentRestaurantId:null,destination:'onboarding'})));
    expect((await client.fetchQuery(accountBootstrapQueryOptions(other))).userId).toBe(other);
    expect(client.getQueryData(accountBootstrapQueryKey(userId))).toBeUndefined();client.clear();
  });
});
