import {Link} from 'react-router-dom';
import {Button} from '@/components/ui/button';
import type {OnboardingForm} from '../onboarding-form';
export function ReadyStep({form,complete=false,restaurantId}:{form?:OnboardingForm;complete?:boolean;restaurantId?:string}){
  if(complete&&restaurantId)return <div className='space-y-5'>
    <h1 className='text-xl font-semibold tracking-tight'>Operação pronta</h1>
    <p className='text-sm text-muted-foreground'>Seu restaurante está configurado. Adicione os primeiros itens quando quiser.</p>
    <div className='flex flex-wrap gap-3'><Button asChild><Link to={'/dashboard/cashier?restaurantId='+restaurantId}>Ir para o Caixa</Link></Button>
      <Button asChild variant='outline'><Link to={'/dashboard/cashier?guide=1&restaurantId='+restaurantId}>Continuar guia</Link></Button></div>
    <div className='flex flex-wrap gap-x-5 gap-y-3 text-sm'><Link className='underline underline-offset-2' to={'/dashboard/menu?restaurantId='+restaurantId}>Adicionar primeiro prato</Link>
      <Link className='underline underline-offset-2' to={'/dashboard/appearance?restaurantId='+restaurantId}>Personalizar marca</Link></div>
  </div>;
  return <div className='space-y-4'><p className='text-sm text-muted-foreground'>Confira os dados antes de concluir. Cardápio e marca podem ser ajustados depois.</p>
    <dl className='divide-y divide-border text-sm'>{[
      ['Restaurante',form?.name],['Endereço do cardápio','/menu/'+form?.slug],['Contato',form?.whatsapp||'Não informado'],
      ['Operação',form?.localEnabled?(form.deliveryEnabled?'Salão e delivery':'Salão'):'Delivery'],
      ...(form?.localEnabled?[['Mesas',String(form.totalTables)]]:[]),
    ].map(([label,value])=><div key={label} className='flex justify-between gap-5 py-3'><dt className='text-muted-foreground'>{label}</dt><dd className='min-w-0 break-words text-right font-medium'>{value}</dd></div>)}</dl>
  </div>;
}
