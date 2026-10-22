import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useContext} from 'react';
import {UNSAFE_LocationContext} from 'react-router-dom';
import {useAuth} from '@/contexts/AuthContext';
import {accountBootstrapQueryOptions,tabRestaurantKey} from './account-bootstrap-query';
export function useAccountBootstrap(routeRestaurantId?:string|null,options:{enabled?:boolean}={}){
  const {user,loading}=useAuth();
  const client=useQueryClient();
  const location=useContext(UNSAFE_LocationContext)?.location;
  // An in-memory per-tab selection is only a hint for a fresh authorized read,
  // never an entitlement or a cross-tab replacement of the server preference.
  const hint=user&&/^\/(dashboard|pricing)(\/|$)/.test(location?.pathname??'')?client.getQueryData<string>(tabRestaurantKey(user.id)):null;
  const requested=routeRestaurantId===undefined?new URLSearchParams(location?.search??'').get('restaurantId')??hint:routeRestaurantId;
  return useQuery({...accountBootstrapQueryOptions(user?.id??'signed-out',requested??null),enabled:!!user&&!loading&&options.enabled!==false});
}
