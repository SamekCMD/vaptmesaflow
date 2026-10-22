import {useAccountBootstrap} from '@/features/auth/use-account-bootstrap';
import {useSwitchRestaurant} from './use-switch-restaurant';
import {Link} from 'react-router-dom';

export function RestaurantSwitcher(){
  const account=useAccountBootstrap(),selection=useSwitchRestaurant();
  return <div className='min-w-0 space-y-1'>
    <label htmlFor='current-restaurant' className='sr-only'>Restaurante atual</label>
    <select id='current-restaurant' value={account.data?.currentRestaurantId??''}
      disabled={account.isPending||account.isError||selection.isPending}
      onChange={event=>selection.mutate(event.target.value)}
      className='min-h-11 w-full max-w-[240px] truncate rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
      <option value='' disabled>Selecionar restaurante</option>
      {account.data?.restaurants.map(restaurant=><option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
    </select>
    {selection.error&&<p role='alert' className='text-xs text-destructive'>Não foi possível trocar de restaurante. Tente novamente.</p>}
    <Link to='/restaurants/select' className='block text-xs text-muted-foreground underline underline-offset-2'>Gerenciar seleção</Link>
  </div>;
}
