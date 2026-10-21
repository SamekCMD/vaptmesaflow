import {queryOptions,type QueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {VaptApiClientError} from '@/lib/vapt-api-client';
import {accountUuid,organizationSummarySchema,restaurantSummarySchema,fetchAccountBootstrap,type AccountBootstrap} from './account-client';
export type AccountBootstrapInput=Pick<AccountBootstrap,'userId'|'organizations'|'restaurants'>&{
  preferredOrganizationId:string|null;preferredRestaurantId:string|null;routeRestaurantId:string|null};
const inputSchema=z.object({userId:accountUuid,organizations:z.array(organizationSummarySchema),restaurants:z.array(restaurantSummarySchema),
  preferredOrganizationId:accountUuid.nullable(),preferredRestaurantId:accountUuid.nullable(),routeRestaurantId:accountUuid.nullable()});
export function deriveAccountBootstrap(input:AccountBootstrapInput):AccountBootstrap{
  const checked=inputSchema.safeParse(input);if(!checked.success)throw new VaptApiClientError('invalid_account_scope','Seleção de restaurante inválida.',400);
  const data=checked.data,organizations=data.organizations,allowed=new Set(organizations.map(value=>value.id));
  const restaurants=data.restaurants.filter(value=>allowed.has(value.organizationId));
  let current=data.routeRestaurantId===null?undefined:restaurants.find(value=>value.id===data.routeRestaurantId);
  if(data.routeRestaurantId!==null&&!current)throw new VaptApiClientError('forbidden','Restaurante indisponível para esta conta.',403);
  if(!current&&data.preferredRestaurantId)current=restaurants.find(value=>value.id===data.preferredRestaurantId&&value.organizationId===data.preferredOrganizationId);
  if(!current&&restaurants.length===1)current=restaurants[0];
  return {userId:data.userId,organizations,restaurants,currentRestaurantId:current?.id??null,
    currentOrganizationId:current?.organizationId??(organizations.length===1?organizations[0].id:null),
    destination:current?(current.onboardingStatus==='complete'?'dashboard':'onboarding'):restaurants.length>1?'select-restaurant':'onboarding'};
}
export const privateAccountKey=(userId:string)=>['vapt-private',userId] as const;
export const accountBootstrapQueryKey=(userId:string,routeRestaurantId:string|null=null)=>[...privateAccountKey(userId),'account-bootstrap',routeRestaurantId] as const;
export const restaurantQueryKey=(userId:string,organizationId:string,restaurantId:string)=>[...privateAccountKey(userId),'restaurant',organizationId,restaurantId] as const;
export function accountBootstrapQueryOptions(userId:string,routeRestaurantId:string|null=null){
  return queryOptions({queryKey:accountBootstrapQueryKey(userId,routeRestaurantId),queryFn:({signal})=>fetchAccountBootstrap(userId,routeRestaurantId,signal),
    staleTime:60_000,refetchInterval:false,refetchOnWindowFocus:false,retry:false});
}
export function clearPrivateAccountQueries(client:QueryClient|undefined,userId?:string){
  if(!client)return;const queryKey=userId?privateAccountKey(userId):['vapt-private'];
  void client.cancelQueries({queryKey});client.removeQueries({queryKey});
}
