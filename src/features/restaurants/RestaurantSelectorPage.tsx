import {Link,useSearchParams} from 'react-router-dom';
import {useAccountBootstrap} from '@/features/auth/use-account-bootstrap';
import {Button} from '@/components/ui/button';
import {useSwitchRestaurant} from './use-switch-restaurant';

export default function RestaurantSelectorPage(){
  const account=useAccountBootstrap(null),selection=useSwitchRestaurant();
  const [query]=useSearchParams(),billingOrganizationId=query.get('billingOrganizationId');
  if(account.isPending)return <p role='status' className='p-6'>Carregando restaurantes…</p>;
  if(account.isError)return <div className='p-6'><p role='alert'>Não foi possível carregar seus restaurantes.</p><Button onClick={()=>void account.refetch()}>Tentar novamente</Button></div>;
  return <main className='mx-auto max-w-2xl space-y-6 px-4 py-12'>
    <header className='space-y-2'><h1 className='text-2xl font-semibold tracking-tight'>Seus restaurantes</h1>
      <p className='text-sm text-muted-foreground'>Escolha onde você vai trabalhar.</p></header>
    {selection.error&&<p role='alert' className='text-sm text-destructive'>Não foi possível salvar a seleção.</p>}
    <ul className='divide-y divide-border border-y border-border'>
      {account.data.restaurants.filter(value=>billingOrganizationId===null||value.organizationId===billingOrganizationId).map(restaurant=><li key={restaurant.id} className='flex items-center justify-between gap-4 py-4'>
        <div className='min-w-0'><p className='truncate font-medium'>{restaurant.name}</p>
          <p className='text-xs text-muted-foreground'>{account.data.organizations.find(value=>value.id===restaurant.organizationId)?.name}
            {restaurant.onboardingStatus==='draft'?' · Configuração incompleta':''}</p></div>
        <Button variant='outline' disabled={selection.isPending} onClick={()=>selection.mutate(restaurant.id)}>
          {restaurant.onboardingStatus==='draft'?'Continuar configuração':'Abrir'}</Button>
      </li>)}
    </ul>
    {account.data.restaurants.length===0&&<p>Você ainda não tem um restaurante. Comece pela configuração inicial.</p>}
    <Button asChild variant='outline'><Link to={account.data.organizations.length?'/restaurants/new':'/onboarding'}>Novo restaurante</Link></Button>
  </main>;
}
