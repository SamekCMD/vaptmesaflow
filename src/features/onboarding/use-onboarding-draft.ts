import {useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/contexts/AuthContext';
import {privateAccountKey} from '@/features/auth/account-bootstrap-query';
import {useBoundContinuation} from '@/features/restaurants/tenant-continuation';
import {VaptApiClientError} from '@/lib/vapt-api-client';
import {createOnboardingDraft,getOnboardingDraft,saveOnboardingDraft,type DraftBasics,type DraftPatch,type OnboardingDraft} from './onboarding-client';
export const onboardingDraftKey=(userId:string,restaurantId:string|null)=>[...privateAccountKey(userId),'onboarding-draft',restaurantId] as const;
export function useOnboardingDraft(restaurantId:string|null,organizationId:string|null){
  const {user}=useAuth(),client=useQueryClient(),userId=user?.id;
  const [created,setCreated]=useState<OnboardingDraft|null>(null);
  const createdRef=useRef<OnboardingDraft|null>(null),intent=useRef<{key:string;input:DraftBasics}|null>(null);
  const capture=useBoundContinuation([userId,organizationId,restaurantId].join(':'));
  const activeId=restaurantId??created?.id??null;
  const query=useQuery({queryKey:onboardingDraftKey(userId??'signed-out',activeId),queryFn:({signal})=>getOnboardingDraft(activeId!,organizationId,signal),
    enabled:!!userId&&!!activeId,staleTime:60_000,refetchOnWindowFocus:false,refetchInterval:false,retry:false});
  async function create(input:DraftBasics){
    if(createdRef.current)return createdRef.current;
    if(!userId)throw new Error('Entre novamente.');const isCurrent=capture();
    intent.current??={key:crypto.randomUUID(),input:structuredClone(input)};
    try{
      const result=await createOnboardingDraft(intent.current.input,intent.current.key,organizationId);
      if(!isCurrent())throw new Error('Seleção alterada.');
      client.setQueryData(onboardingDraftKey(userId,result.id),result);createdRef.current=result;setCreated(result);return result;
    }catch(error){if(isCurrent()&&error instanceof VaptApiClientError&&error.status>=400&&error.status<500&&error.status!==408)intent.current=null;throw error;}
  }
  async function save(id:string,input:DraftPatch){
    if(!userId)throw new Error('Entre novamente.');const isCurrent=capture();
    const result=await saveOnboardingDraft(id,input,organizationId??createdRef.current?.organizationId??null);
    if(!isCurrent())throw new Error('Seleção alterada.');client.setQueryData(onboardingDraftKey(userId,id),result);return result;
  }
  return {data:query.isError?undefined:query.data,loading:!!activeId&&query.isPending,error:query.error,refetch:query.refetch,create,save};
}
