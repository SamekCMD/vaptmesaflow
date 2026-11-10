import {z} from 'zod';
import {restaurantRoute} from '@/lib/restaurants';
import {vaptApiRequest,VaptApiClientError} from '@/lib/vapt-api-client';
import type {GuideModule,OnboardingGuideProgress} from '@/lib/onboarding';
const moduleSchema=z.enum(['cashier','menu','kitchen','settings','overview']);
const progressSchema=z.object({cashier:z.boolean(),menu:z.boolean(),kitchen:z.boolean(),settings:z.boolean(),overview:z.boolean()});
export async function fetchActivationProgress(restaurantId:string,signal?:AbortSignal):Promise<OnboardingGuideProgress>{
  const parsed=progressSchema.safeParse(await vaptApiRequest({method:'GET',route:restaurantRoute(restaurantId)+'/activation',requireAuth:true,...(signal?{signal}:{})}));
  if(!parsed.success)throw new VaptApiClientError('invalid_activation_response','Não foi possível carregar o progresso.',502);return parsed.data;
}
export async function completeActivationModule(restaurantId:string,module:GuideModule):Promise<void>{
  await vaptApiRequest({method:'POST',route:restaurantRoute(restaurantId)+'/activation/'+moduleSchema.parse(module),body:{},requireAuth:true});
}
