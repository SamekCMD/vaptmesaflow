import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';
import {useAuth} from '@/contexts/AuthContext';
import {accountUuid} from '@/features/auth/account-client';
import {privateAccountKey} from '@/features/auth/account-bootstrap-query';
import {vaptApiRequest} from '@/lib/vapt-api-client';
const entitlementSchema=z.object({canCreate:z.boolean(),reason:z.enum(['allowed','permission','limit']),count:z.number().int().nonnegative(),limit:z.number().int().positive()});
export async function fetchRestaurantCreationEntitlement(organizationId:string,signal?:AbortSignal){
  const id=accountUuid.parse(organizationId);
  return entitlementSchema.parse(await vaptApiRequest<unknown>({method:'GET',route:`/organizations/${id}/restaurant-entitlement`,requireAuth:true,...(signal?{signal}:{})}));
}
export function useRestaurantCreationEntitlement(organizationId:string|null){
  const {user,loading}=useAuth();
  return useQuery({queryKey:[...privateAccountKey(user?.id??'signed-out'),'restaurant-entitlement',organizationId],
    queryFn:({signal})=>fetchRestaurantCreationEntitlement(organizationId!,signal),enabled:!!user&&!loading&&!!organizationId,
    staleTime:60_000,refetchOnWindowFocus:false,refetchInterval:false,retry:false});
}
