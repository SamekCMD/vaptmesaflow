import type {ComponentType} from 'react';
import type {OrganizationSummary} from '@/features/auth/account-client';
import {useCurrentRestaurant} from './current-restaurant';
import {useBoundContinuation} from './tenant-continuation';
type Capability=OrganizationSummary['capabilities'][number];

export function useTenantContinuation(){
  const current=useCurrentRestaurant();
  return useBoundContinuation([current.scope?.userId,current.organizationId,current.scope?.restaurantId,
    current.capabilities?.join(',')].join(':'));
}
export function withRestaurantScope<P extends object>(Component:ComponentType<P>,capability:Capability='restaurant.read'){
  return function RestaurantScopeBoundary(props:P){
    const current=useCurrentRestaurant();
    if(current.loading)return <p role='status' className='p-6 text-sm text-muted-foreground'>Carregando restaurante…</p>;
    if(current.error)return <p role='alert' className='p-6 text-sm text-destructive'>Não foi possível carregar o restaurante. Tente novamente.</p>;
    if(!current.scope||!current.organizationId||current.restaurant?.id!==current.scope.restaurantId){
      return <p role='alert' className='p-6 text-sm'>Selecione um restaurante para continuar.</p>;
    }
    if(!current.capabilities?.includes(capability))return <p role='alert' className='p-6 text-sm'>Você não tem permissão para acessar esta operação.</p>;
    // Remount all local form, file, optimistic and bill state on identity/scope/capability changes.
    const key=[current.scope.userId,current.organizationId,current.scope.restaurantId,current.capabilities.join(',')].join(':');
    return <Component key={key} {...props}/>;
  };
}
