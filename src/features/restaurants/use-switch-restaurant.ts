import {useRef,useEffect} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {useLocation,useNavigate} from 'react-router-dom';
import {useAuth} from '@/contexts/AuthContext';
import {useAccountBootstrap} from '@/features/auth/use-account-bootstrap';
import {saveAccountPreference} from '@/features/auth/account-client';
import {clearPrivateAccountQueries} from '@/features/auth/account-bootstrap-query';
import {VaptApiClientError} from '@/lib/vapt-api-client';

export function useSwitchRestaurant(){
  const {user}=useAuth(),account=useAccountBootstrap(),client=useQueryClient();
  const location=useLocation(),navigate=useNavigate();
  const current=useRef(user?.id);current.current=user?.id;
  const sequence=useRef(0);
  const mounted=useRef(true);
  useEffect(()=>{sequence.current++;mounted.current=true;return()=>{mounted.current=false;};},[user?.id]);
  return useMutation({mutationFn:async(restaurantId:string)=>{
    const userId=user?.id,selection=account.data?.restaurants.find(value=>value.id===restaurantId);
    if(!userId||!selection||account.isError)throw new VaptApiClientError('forbidden','Restaurante indisponível para esta conta.',403);
    const generation=++sequence.current;
    await saveAccountPreference({organizationId:selection.organizationId,restaurantId:selection.id});
    if(!mounted.current||current.current!==userId||sequence.current!==generation)return;
    clearPrivateAccountQueries(client,userId);
    const query=new URLSearchParams(location.search);query.set('restaurantId',selection.id);
    const path=selection.onboardingStatus==='draft'?'/onboarding':location.pathname.startsWith('/dashboard')?location.pathname:'/dashboard';
    navigate({pathname:path,search:'?'+query.toString()},{replace:true});
  },retry:false});
}
