import {useSubscription} from './useSubscription';
export type PlanType='starter'|'pro'|'business';
export type PlanStatus=import('./useSubscription').PlanStatus;
export const PLAN_LABELS:Record<PlanType,string>={starter:'Starter',pro:'Pro',business:'Business'};
type Feature='cashier'|'open_tab'|'multi_users';
export function usePlan(){
  const subscription=useSubscription();
  const days=subscription.trialDaysLeft;
  return {...subscription,planType:subscription.planType==='trial'?'starter' as const:subscription.planType,
    trialLabel:subscription.planStatus==='trialing'?(days>1?`${days} dias restantes de teste`:days===1?'Seu teste expira amanhã!':'Seu teste expirou'):'',
    canAccess:(feature:Feature)=>subscription.canAccess(feature==='multi_users'?'multi_user':feature)};
}
