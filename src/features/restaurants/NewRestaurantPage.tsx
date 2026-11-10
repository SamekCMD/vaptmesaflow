import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAccountBootstrap} from '@/features/auth/use-account-bootstrap';
import {useRestaurantCreationEntitlement} from './restaurant-entitlement';
import {Button} from '@/components/ui/button';

export default function NewRestaurantPage(){
  const account=useAccountBootstrap(null),navigate=useNavigate();
  const [selected,setSelected]=useState<string|null>(null);
  const organizationId=selected??account.data?.currentOrganizationId??account.data?.organizations[0]?.id??null;
  const entitlement=useRestaurantCreationEntitlement(organizationId);
  return <main className='mx-auto max-w-xl space-y-6 px-4 py-12'>
    <h1 className='text-2xl font-semibold tracking-tight'>Novo restaurante</h1>
    <div className='space-y-2'><label htmlFor='new-restaurant-org' className='text-sm font-medium'>Organização</label>
      <select id='new-restaurant-org' value={organizationId??''} onChange={event=>setSelected(event.target.value)}
        disabled={account.isPending||account.isError} className='min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm'>
        {account.data?.organizations.map(organization=><option key={organization.id} value={organization.id}>{organization.name}</option>)}
      </select></div>
    {entitlement.data&&<p className='text-sm text-muted-foreground'>{entitlement.data.count} de {entitlement.data.limit} restaurantes utilizados.</p>}
    {entitlement.data?.reason==='permission'&&<p role='status'>Sem permissão para criar restaurantes nesta organização.</p>}
    {entitlement.data?.reason==='limit'&&<p role='status'>O limite de restaurantes desta organização foi atingido.</p>}
    {(entitlement.isError||account.isError)&&<p role='alert'>Não foi possível verificar sua permissão. Tente novamente.</p>}
    <Button disabled={!organizationId||!entitlement.data?.canCreate||entitlement.isFetching||account.isPending||account.isError||entitlement.isError}
      onClick={()=>navigate('/onboarding?organizationId='+organizationId)}>Continuar configuração</Button>
  </main>;
}
