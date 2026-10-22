import {z} from 'zod';
import {VaptApiClientError,vaptApiRequest} from '@/lib/vapt-api-client';
export const accountUuid=z.string().uuid().transform(value=>value.toLowerCase());
export const capabilitySchema=z.enum(['restaurant.read','restaurant.operate','restaurant.manage','restaurant.create','billing.read','billing.manage']);
export const organizationSummarySchema=z.object({id:accountUuid,name:z.string().min(1),role:z.enum(['owner','admin','manager','staff']),
  capabilities:z.array(capabilitySchema),operationActive:z.boolean(),features:z.object({cashier:z.boolean(),open_tab:z.boolean(),metrics:z.boolean(),multi_user:z.boolean(),advanced_reports:z.boolean()})});
export const restaurantSummarySchema=z.object({id:accountUuid,organizationId:accountUuid,name:z.string(),slug:z.string(),onboardingStatus:z.enum(['draft','complete'])});
const bootstrapSchema=z.object({userId:accountUuid,organizations:z.array(organizationSummarySchema),restaurants:z.array(restaurantSummarySchema),
  currentOrganizationId:accountUuid.nullable(),currentRestaurantId:accountUuid.nullable(),destination:z.enum(['onboarding','select-restaurant','dashboard'])});
export type AccountBootstrap=z.infer<typeof bootstrapSchema>;
export type OrganizationSummary=z.infer<typeof organizationSummarySchema>;
export type RestaurantSummary=z.infer<typeof restaurantSummarySchema>;
export type AccountSelection={organizationId:string;restaurantId:string};
export function accountResponseError():never{throw new VaptApiClientError('invalid_account_response','Não foi possível validar os dados da conta.',502);}
export function parseAccountBootstrap(input:unknown):AccountBootstrap{
  const parsed=bootstrapSchema.safeParse(input);if(!parsed.success)accountResponseError();
  const data=parsed.data,organizations=new Set(data.organizations.map(value=>value.id));
  if(organizations.size!==data.organizations.length||new Set(data.restaurants.map(value=>value.id)).size!==data.restaurants.length
    ||data.restaurants.some(value=>!organizations.has(value.organizationId)))accountResponseError();
  if(data.currentRestaurantId!==null){
    const selected=data.restaurants.find(value=>value.id===data.currentRestaurantId);
    if(!selected||selected.organizationId!==data.currentOrganizationId)accountResponseError();
  }else if(data.currentOrganizationId!==null&&!organizations.has(data.currentOrganizationId))accountResponseError();
  return data;
}
export async function fetchAccountBootstrap(userId:string,routeRestaurantId:string|null=null,signal?:AbortSignal):Promise<AccountBootstrap>{
  const expected=accountUuid.parse(userId);
  const raw=await vaptApiRequest<unknown>({method:'GET',route:'/account/bootstrap',requireAuth:true,
    ...(routeRestaurantId===null?{}:{query:{restaurantId:accountUuid.parse(routeRestaurantId)}}),...(signal?{signal}:{})});
  const data=parseAccountBootstrap(raw);if(data.userId!==expected)accountResponseError();return data;
}
export async function saveAccountPreference(selection:AccountSelection):Promise<void>{
  const input=z.object({organizationId:accountUuid,restaurantId:accountUuid}).strict().parse(selection);
  await vaptApiRequest<void>({method:'PATCH',route:'/account/preference',body:input,requireAuth:true});
}
