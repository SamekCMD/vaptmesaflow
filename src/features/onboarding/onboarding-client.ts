import {z} from 'zod';
import {accountUuid} from '@/features/auth/account-client';
import {restaurantRoute,fetchRestaurant} from '@/lib/restaurants';
import {VaptApiClientError,vaptApiRequest} from '@/lib/vapt-api-client';
import type {CatalogMutationExecutor} from '@/lib/catalog-mutations';
export const basicsSchema=z.object({name:z.string().trim().min(2).max(80),slug:z.string().trim().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  whatsapp:z.string().trim().max(32).nullable().optional()}).strict();
export const patchSchema=basicsSchema.partial().extend({localEnabled:z.boolean().optional(),deliveryEnabled:z.boolean().optional(),
  totalTables:z.number().int().min(1).max(1000).optional(),onboardingStep:z.union([z.literal(0),z.literal(1),z.literal(2)]).optional()}).strict();
const draftSchema=z.object({id:accountUuid,organizationId:accountUuid,name:z.string(),slug:z.string(),whatsapp:z.string(),
  localEnabled:z.boolean(),deliveryEnabled:z.boolean(),totalTables:z.number().int().min(1).max(1000),onboardingStep:z.union([z.literal(0),z.literal(1),z.literal(2)])});
export type DraftBasics=z.infer<typeof basicsSchema>;
export type DraftPatch=z.infer<typeof patchSchema>;
export type OnboardingDraft=z.infer<typeof draftSchema>;
export type OnboardingCompletion={id:string;onboardingCompleted:true};
function invalid():never{throw new VaptApiClientError('invalid_onboarding_response','Não foi possível confirmar a configuração.',502);}
function draft(value:unknown,restaurantId?:string,organizationId?:string|null):OnboardingDraft{
  const parsed=draftSchema.safeParse(value);if(!parsed.success)invalid();
  if(restaurantId&&parsed.data.id!==accountUuid.parse(restaurantId)||organizationId&&parsed.data.organizationId!==accountUuid.parse(organizationId))invalid();
  return parsed.data;
}
export function confirmOnboardingCompletion(value:unknown,restaurantId:string):OnboardingCompletion{
  const parsed=z.object({id:accountUuid,onboardingCompleted:z.literal(true)}).safeParse(value);
  if(!parsed.success||parsed.data.id!==accountUuid.parse(restaurantId))invalid();return parsed.data;
}
export async function createOnboardingDraft(input:DraftBasics,operationId:string,organizationId:string|null=null):Promise<OnboardingDraft>{
  const route=organizationId?`/organizations/${accountUuid.parse(organizationId)}/restaurants/drafts`:'/account/onboarding-draft';
  return draft(await vaptApiRequest({method:'POST',route,body:basicsSchema.parse(input),requireAuth:true,
    headers:{'Idempotency-Key':accountUuid.parse(operationId)}}),undefined,organizationId);
}
export async function getOnboardingDraft(restaurantId:string,organizationId:string|null,signal?:AbortSignal):Promise<OnboardingDraft>{
  return draft(await vaptApiRequest({method:'GET',route:restaurantRoute(restaurantId)+'/onboarding',requireAuth:true,...(signal?{signal}:{})}),restaurantId,organizationId);
}
export async function saveOnboardingDraft(restaurantId:string,input:DraftPatch,organizationId:string|null=null):Promise<OnboardingDraft>{
  return draft(await vaptApiRequest({method:'PATCH',route:restaurantRoute(restaurantId)+'/onboarding',body:patchSchema.parse(input),requireAuth:true}),restaurantId,organizationId);
}
export async function finalizeOnboardingDraft(restaurantId:string,operationId:string,publication?:CatalogMutationExecutor):Promise<OnboardingCompletion>{
  const route=restaurantRoute(restaurantId)+'/onboarding/finalize';
  const response=publication?await publication.run({method:'POST',route,body:{}},async()=>confirmOnboardingCompletion(await fetchRestaurant(restaurantId),restaurantId)):
    await vaptApiRequest({method:'POST',route,body:{},requireAuth:true,headers:{'Idempotency-Key':accountUuid.parse(operationId)}});
  return confirmOnboardingCompletion(response,restaurantId);
}
