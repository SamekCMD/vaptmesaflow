import { cleanup, renderHook, waitFor,act } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {createElement,useState,type ReactNode} from "react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {tenantAccount,tenantIds} from "./tenant-frontend-fixture";
import { useSubscription } from "@/hooks/useSubscription";
const auth = vi.hoisted(() => ({ user: { id: "owner-1" } }));
const getStatus = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/features/auth/use-account-bootstrap",()=>({useAccountBootstrap:()=>({data:{...tenantAccount(),userId:auth.user.id},isPending:false,isError:false})}));
const Wrapper=({children}:{children:ReactNode})=>{
  const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:false}}}));
  return createElement(QueryClientProvider,{client},children);
};
vi.mock("@/lib/billing-client", () => ({ billingClient: { getSubscriptionStatus: getStatus } }));
beforeEach(() => { auth.user = { id: crypto.randomUUID() }; getStatus.mockReset(); });
afterEach(cleanup);
it("uses safe billing snapshot instead of restaurant fallback entitlement", async () => {
  getStatus.mockResolvedValue({ planType: "pro", planStatus: "past_due", trialEndsAt: null,
    currentPeriodEnd: "2030-01-01T00:00:00.000Z", cancelAtPeriodEnd: false,
    subscriptionCanceledAt: null, canManageBilling: true, canStartCheckout: false, requiresBillingAction: true });
  const { result } = renderHook(useSubscription,{wrapper:Wrapper});
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(getStatus).toHaveBeenCalledWith(tenantIds.org,expect.any(AbortSignal));
  expect(result.current.planType).toBe("pro"); expect(result.current.planStatus).toBe("past_due");
  expect(result.current.canManageBilling).toBe(true); expect(result.current.requiresBillingAction).toBe(true);
  expect(result.current.isActive).toBe(false); expect(result.current.canAccess("metrics")).toBe(false);
});
it("logout and a different login cannot receive the previous identity's late billing snapshot",async()=>{
  let finishOld!:(value:unknown)=>void;
  getStatus.mockImplementationOnce(()=>new Promise(resolve=>{finishOld=resolve;})).mockResolvedValue({
    planType:"starter",planStatus:"expired",trialEndsAt:null,currentPeriodEnd:null,cancelAtPeriodEnd:false,
    subscriptionCanceledAt:null,canManageBilling:false,canStartCheckout:true,requiresBillingAction:false
  });
  const {result,rerender}=renderHook(useSubscription,{wrapper:Wrapper});
  await waitFor(()=>expect(getStatus).toHaveBeenCalledOnce());
  const oldSignal=getStatus.mock.calls[0][1] as AbortSignal;
  auth.user={id:crypto.randomUUID()};rerender();
  await waitFor(()=>expect(getStatus).toHaveBeenCalledTimes(2));
  await act(async()=>{finishOld({planType:"business",planStatus:"active",trialEndsAt:null,currentPeriodEnd:null,
    cancelAtPeriodEnd:false,subscriptionCanceledAt:null,canManageBilling:true,canStartCheckout:false,requiresBillingAction:false});});
  await waitFor(()=>expect(result.current.loading).toBe(false));
  expect(result.current.planStatus).toBe("expired");expect(result.current.isActive).toBe(false);
  expect(result.current.canManageBilling).toBe(false);expect(oldSignal.aborted).toBe(true);
});

it("keeps a local trial usable without claiming a Stripe billing Customer", async () => {
  getStatus.mockResolvedValue({ planType: "starter", planStatus: "trialing", trialEndsAt: "2030-01-01T00:00:00.000Z",
    currentPeriodEnd: null, cancelAtPeriodEnd: false, subscriptionCanceledAt: null,
    canManageBilling: false, canStartCheckout: true, requiresBillingAction: false });
  const { result } = renderHook(useSubscription,{wrapper:Wrapper});
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.isTrialing).toBe(true); expect(result.current.canManageBilling).toBe(false);
});
it("fails closed on billing read failure and never reuses active cached entitlements", async () => {
  getStatus.mockRejectedValue(new Error("provider unavailable"));
  const { result } = renderHook(useSubscription,{wrapper:Wrapper});
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.isActive).toBe(false); expect(result.current.canManageBilling).toBe(false);
});
