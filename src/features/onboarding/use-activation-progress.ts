import {useCallback} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/contexts/AuthContext';
import {privateAccountKey} from '@/features/auth/account-bootstrap-query';
import type {GuideModule} from '@/lib/onboarding';
import {fetchActivationProgress,completeActivationModule} from './activation-progress-service';
export const activationProgressKey=(userId:string,restaurantId:string|null)=>[...privateAccountKey(userId),'activation',restaurantId] as const;
export function useActivationProgress(restaurantId:string|null){
  const {user,loading}=useAuth(),client=useQueryClient(),userId=user?.id;
  const query=useQuery({queryKey:activationProgressKey(userId??'signed-out',restaurantId),
    queryFn:({signal})=>fetchActivationProgress(restaurantId!,signal),enabled:!!userId&&!loading&&!!restaurantId,
    staleTime:60_000,refetchInterval:false,refetchOnWindowFocus:false,retry:false});
  const mutation=useMutation({mutationFn:async(input:{userId:string;restaurantId:string;module:GuideModule})=>completeActivationModule(input.restaurantId,input.module),
    onSuccess:async(_data,input)=>{await client.invalidateQueries({queryKey:activationProgressKey(input.userId,input.restaurantId),exact:true});},retry:false});
  const run=mutation.mutateAsync;
  const complete=useCallback(async(module:GuideModule)=>{
    if(!userId||!restaurantId)throw new Error('Selecione um restaurante.');await run({userId,restaurantId,module});
  },[userId,restaurantId,run]);
  const current=!!mutation.variables&&mutation.variables.userId===userId&&mutation.variables.restaurantId===restaurantId;
  return {...query,data:query.isError?undefined:query.data,complete,completing:current&&mutation.isPending,completionError:current?mutation.error:null};
}
