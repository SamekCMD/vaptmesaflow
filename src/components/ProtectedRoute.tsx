import {Navigate,useLocation} from 'react-router-dom';
import {useAuth} from '@/contexts/AuthContext';
import {useAccountBootstrap} from '@/features/auth/use-account-bootstrap';
import {Loader2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import type {ReactNode} from 'react';

const ProtectedRoute=({children,mode='restaurant'}:{children:ReactNode;mode?:'restaurant'|'account'})=>{
  const {user,loading}=useAuth(),location=useLocation(),account=useAccountBootstrap();
  if(loading||user&&account.isPending)return <div className='min-h-screen flex items-center justify-center bg-background'><Loader2 aria-label='Carregando conta' className='h-8 w-8 animate-spin text-primary'/></div>;
  if(!user)return <Navigate to='/login' replace/>;
  if(account.isError)return <div className='p-6 space-y-3'><p role='alert'>Não foi possível carregar sua conta.</p><Button onClick={()=>void account.refetch()}>Tentar novamente</Button></div>;
  if(mode==='account')return <>{children}</>;
  const data=account.data;
  if(!data)return null;
  const query=new URLSearchParams(location.search),onboarding=location.pathname==='/onboarding';
  if(data.destination==='select-restaurant'&&!onboarding)return <Navigate to='/restaurants/select' replace/>;
  if(data.destination==='onboarding'&&!onboarding){
    return <Navigate to={'/onboarding'+(data.currentRestaurantId?'?restaurantId='+data.currentRestaurantId:'')} replace/>;
  }
  if(onboarding&&data.destination==='dashboard'&&!query.has('organizationId')){
    return <Navigate to={'/dashboard?restaurantId='+data.currentRestaurantId} replace/>;
  }
  if(location.pathname==='/dashboard/subscription'&&!data.organizations.find(value=>value.id===data.currentOrganizationId)?.capabilities.includes('billing.read')){
    return <p role='alert' className='p-6'>Sem permissão para acessar a cobrança desta organização.</p>;
  }
  const organization=data.organizations.find(value=>value.id===data.currentOrganizationId);
  if(location.pathname.startsWith('/dashboard')&&!location.pathname.includes('/settings')&&!location.pathname.includes('/subscription')
    &&organization&&!organization.operationActive&&!organization.capabilities.includes('billing.read')){
    return <p role='alert' className='p-6'>A operação desta organização está suspensa. Peça ao responsável para revisar a assinatura.</p>;
  }
  return <>{children}</>;
};
export default ProtectedRoute;
