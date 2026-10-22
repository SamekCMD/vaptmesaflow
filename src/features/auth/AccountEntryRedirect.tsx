import {Navigate} from 'react-router-dom';
import {useAccountBootstrap} from './use-account-bootstrap';
import {Button} from '@/components/ui/button';

export function AccountEntryRedirect(){
  const account=useAccountBootstrap(null);
  if(account.isPending)return <p role='status' className='p-6'>Carregando conta…</p>;
  if(account.isError)return <div className='p-6 space-y-3'><p role='alert'>Não foi possível carregar sua conta.</p><Button onClick={()=>void account.refetch()}>Tentar novamente</Button></div>;
  const path=account.data.destination==='select-restaurant'?'/restaurants/select':account.data.destination==='onboarding'?'/onboarding':'/dashboard';
  return <Navigate to={path+(account.data.currentRestaurantId?'?restaurantId='+account.data.currentRestaurantId:'')} replace/>;
}
