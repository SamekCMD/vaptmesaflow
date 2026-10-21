import {useQuery} from '@tanstack/react-query';
import {useAuth} from '@/contexts/AuthContext';
import {accountBootstrapQueryOptions} from './account-bootstrap-query';
export function useAccountBootstrap(routeRestaurantId?:string|null,options:{enabled?:boolean}={}){
  const {user,loading}=useAuth();
  return useQuery({...accountBootstrapQueryOptions(user?.id??'signed-out',routeRestaurantId??null),enabled:!!user&&!loading&&options.enabled!==false});
}
