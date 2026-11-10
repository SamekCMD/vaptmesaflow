import {useCallback,useEffect} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/contexts/AuthContext';
import {useAccountBootstrap} from '@/features/auth/use-account-bootstrap';
import {privateAccountKey} from '@/features/auth/account-bootstrap-query';
import {billingClient,type BillingPlanStatus} from '@/lib/billing-client';

export type PlanType='starter'|'pro'|'business'|'trial';
export type PlanStatus=BillingPlanStatus;
export interface SubscriptionData{
  planType:PlanType;planStatus:PlanStatus;trialEndsAt:Date|null;trialDaysLeft:number;isTrialing:boolean;isActive:boolean;
  restaurantId:string|null;organizationId:string|null;currentPeriodEnd:Date|null;cancelAtPeriodEnd:boolean;subscriptionCanceledAt:Date|null;
  canReadBilling:boolean;canManageBilling:boolean;canStartCheckout:boolean;requiresBillingAction:boolean;billingError:string|null;
  canAccess:(feature:string)=>boolean;loading:boolean;refetch:()=>Promise<void>;
}
export function useSubscription():SubscriptionData{
  const {user}=useAuth(),account=useAccountBootstrap(),client=useQueryClient();
  const userId=user?.id,organizationId=account.isError?null:account.data?.currentOrganizationId??null;
  const organization=account.data?.organizations.find(value=>value.id===organizationId);
  const canReadBilling=!!organization?.capabilities.includes('billing.read');
  const canWriteBilling=!!organization?.capabilities.includes('billing.manage');
  const key=[...privateAccountKey(userId??'signed-out'),'subscription',organizationId];
  const query=useQuery({queryKey:key,queryFn:({signal})=>billingClient.getSubscriptionStatus(organizationId!,signal),
    enabled:!!userId&&canReadBilling&&!account.isPending&&!account.isError,
    staleTime:60_000,refetchInterval:false,refetchOnWindowFocus:false,retry:false});
  const billing=canReadBilling&&!query.isError?query.data:undefined;
  const refetch=useCallback(async()=>{
    if(!userId)return;
    await Promise.all([
      client.invalidateQueries({queryKey:[...privateAccountKey(userId),'account-bootstrap']},{cancelRefetch:false}),
      ...(canReadBilling?[client.invalidateQueries({queryKey:[...privateAccountKey(userId),'subscription',organizationId],exact:true},{cancelRefetch:false})]:[]),
    ]);
  },[client,userId,canReadBilling,organizationId]);
  useEffect(()=>{
    const refresh=()=>{void refetch();};window.addEventListener('vapt:subscription-updated',refresh);
    return()=>window.removeEventListener('vapt:subscription-updated',refresh);
  },[refetch]);
  const trialEndsAt=billing?.trialEndsAt?new Date(billing.trialEndsAt):null;
  const isTrialing=billing?.planStatus==='trialing'&&!!trialEndsAt&&trialEndsAt.getTime()>Date.now();
  const isActive=canReadBilling?(billing?.planStatus==='active'||isTrialing):(organization?.operationActive??false);
  const canAccess=useCallback((feature:string)=>{
    if(!organization||!organization.operationActive||account.isError||canReadBilling&&(!billing||!isActive))return false;
    return Object.prototype.hasOwnProperty.call(organization.features,feature)
      ?organization.features[feature as keyof typeof organization.features]:false;
  },[organization,account.isError,canReadBilling,billing,isActive]);
  return {organizationId,restaurantId:account.data?.currentRestaurantId??null,canReadBilling,
    planType:isTrialing?'trial':billing?.planType??'starter',planStatus:billing?.planStatus??'expired',trialEndsAt,
    trialDaysLeft:trialEndsAt?Math.max(0,Math.ceil((trialEndsAt.getTime()-Date.now())/86_400_000)):0,isTrialing,isActive,
    currentPeriodEnd:billing?.currentPeriodEnd?new Date(billing.currentPeriodEnd):null,cancelAtPeriodEnd:billing?.cancelAtPeriodEnd??false,
    subscriptionCanceledAt:billing?.subscriptionCanceledAt?new Date(billing.subscriptionCanceledAt):null,
    canManageBilling:canWriteBilling&&(billing?.canManageBilling??false),canStartCheckout:canWriteBilling&&(billing?.canStartCheckout??false),
    requiresBillingAction:billing?.requiresBillingAction??false,
    billingError:account.isError||canReadBilling&&query.isError?'Não foi possível carregar sua assinatura. Tente novamente.':null,
    loading:!!userId&&(account.isPending||canReadBilling&&query.isPending),canAccess,refetch};
}
