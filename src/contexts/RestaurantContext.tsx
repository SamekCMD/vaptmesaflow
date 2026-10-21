/* eslint-disable react-refresh/only-export-components */
import {createContext,useContext,useMemo,type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useLocation} from 'react-router-dom';
import {useAuth} from '@/contexts/AuthContext';
import {useAccountBootstrap} from '@/features/auth/use-account-bootstrap';
import {restaurantQueryKey} from '@/features/auth/account-bootstrap-query';
import {fetchRestaurant} from '@/lib/restaurants';
import type {RestaurantDto,RestaurantScope} from '@/lib/business-api.types';
export type CurrentRestaurant={scope:RestaurantScope|null;organizationId:string|null;restaurant:RestaurantDto|null;loading:boolean;error:Error|null};
const RestaurantContext=createContext<CurrentRestaurant|undefined>(undefined);
export function RestaurantProvider({children}:{children:ReactNode}){
  const {user,loading:authLoading}=useAuth(),location=useLocation();
  const privateRoute=/^\/(?:dashboard|onboarding|select-restaurant)(?:\/|$)/.test(location.pathname);
  const requested=new URLSearchParams(location.search).get('restaurantId');
  // Anonymous/public catalog traffic never fetches this private account/bootstrap.
  const bootstrap=useAccountBootstrap(requested,{enabled:privateRoute});
  const account=privateRoute&&user&&!authLoading&&!bootstrap.isError?bootstrap.data:undefined;
  const restaurantId=account?.currentRestaurantId??null,organizationId=account?.currentOrganizationId??null;
  const selected=!!user&&!!restaurantId&&!!organizationId;
  const query=useQuery({queryKey:restaurantQueryKey(user?.id??'signed-out',organizationId??'',restaurantId??''),
    queryFn:({signal})=>fetchRestaurant(restaurantId!,signal),enabled:privateRoute&&selected&&!bootstrap.isPending,
    staleTime:60_000,refetchOnWindowFocus:false,refetchInterval:false,retry:false});
  const loading=privateRoute&&(authLoading||!!user&&(bootstrap.isPending||selected&&query.isPending));
  const error=privateRoute?(bootstrap.error??query.error):null;
  const restaurant=!loading&&!error&&selected&&query.data?.id===restaurantId?query.data:null;
  const value=useMemo<CurrentRestaurant>(()=>({
    scope:restaurant&&user?{userId:user.id,restaurantId:restaurant.id}:null,
    organizationId:restaurant?organizationId:null,restaurant,loading,error:error instanceof Error?error:error?new Error('Não foi possível carregar o restaurante.'):null,
  }),[restaurant,user,organizationId,loading,error]);
  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>;
}
export function useRestaurant(){
  const value=useContext(RestaurantContext);if(!value)throw new Error('useRestaurant must be used within RestaurantProvider');return value;
}
