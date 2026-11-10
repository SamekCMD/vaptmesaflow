import {useEffect,useRef,useState} from 'react';
import {Link,Navigate,useNavigate,useSearchParams} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/contexts/AuthContext';
import {useAccountBootstrap} from '@/features/auth/use-account-bootstrap';
import {privateAccountKey} from '@/features/auth/account-bootstrap-query';
import {useBoundContinuation} from '@/features/restaurants/tenant-continuation';
import {useRestaurantCreationEntitlement} from '@/features/restaurants/restaurant-entitlement';
import {useOnboardingDraft} from '@/features/onboarding/use-onboarding-draft';
import {emptyOnboardingForm,slugFromName,validBasics,validOperation,type OnboardingForm} from '@/features/onboarding/onboarding-form';
import {confirmOnboardingCompletion,finalizeOnboardingDraft} from '@/features/onboarding/onboarding-client';
import {RestaurantBasicsStep} from '@/features/onboarding/steps/RestaurantBasicsStep';
import {OperationStep} from '@/features/onboarding/steps/OperationStep';
import {ReadyStep} from '@/features/onboarding/steps/ReadyStep';
import {useCatalogPublication,isCatalogPublicationDeferred} from '@/hooks/use-catalog-publication';
import {CatalogPublicationFeedback} from '@/components/menu/CatalogPublicationStatus';
import {catalogWriterEnabled} from '@/lib/catalog/flags';
import {fetchRestaurant} from '@/lib/restaurants';
import {Button} from '@/components/ui/button';
import {Card,CardContent,CardFooter,CardHeader,CardTitle} from '@/components/ui/card';
import {Progress} from '@/components/ui/progress';

const titles=['Dados do restaurante','Operação','Revise e finalize'];
function OnboardingFlow({userId,restaurantId,organizationId}:{userId:string;restaurantId:string|null;organizationId:string|null}){
  const draft=useOnboardingDraft(restaurantId,organizationId),navigate=useNavigate(),client=useQueryClient();
  const entitlement=useRestaurantCreationEntitlement(!restaurantId?organizationId:null);
  const [form,setForm]=useState<OnboardingForm>({...emptyOnboardingForm}),[step,setStep]=useState(0),[busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null),[done,setDone]=useState(false),[slugTouched,setSlugTouched]=useState(false);
  const finalKey=useRef<string|null>(null);
  const capture=useBoundContinuation([userId,organizationId,restaurantId].join(':'));
  const activeId=draft.data?.id??restaurantId;
  useEffect(()=>{if(!draft.data)return;setForm({...draft.data});setStep(draft.data.onboardingStep);setSlugTouched(true);},[draft.data]);
  const finish=async(id:string,isCurrent:()=>boolean)=>{
    if(!isCurrent())return;setDone(true);
    navigate({pathname:'/onboarding',search:'?restaurantId='+id+'&setup=complete'},{replace:true});
    await client.invalidateQueries({queryKey:[...privateAccountKey(userId),'account-bootstrap']});
    await client.invalidateQueries({queryKey:[...privateAccountKey(userId),'restaurant']});
  };
  const publication=useCatalogPublication(activeId?{userId,restaurantId:activeId}:null,async isCurrent=>{
    if(!activeId)return;confirmOnboardingCompletion(await fetchRestaurant(activeId),activeId);
    if(isCurrent())await finish(activeId,isCurrent);
  });
  const next=async()=>{
    if(busy||publication.blocked)return;const isCurrent=capture();if(!isCurrent())return;
    setBusy(true);setError(null);
    try{
      const basics={name:form.name.trim(),slug:form.slug.trim(),whatsapp:form.whatsapp.trim()};
      const target=draft.data??await draft.create(basics);if(!isCurrent())return;
      if(step===0){
        await draft.save(target.id,{...basics,onboardingStep:1});if(!isCurrent())return;
        if(!restaurantId)navigate({pathname:'/onboarding',search:'?restaurantId='+target.id},{replace:true});
      }else if(step===1){
        await draft.save(target.id,{localEnabled:form.localEnabled,deliveryEnabled:form.deliveryEnabled,totalTables:form.localEnabled?form.totalTables:1,onboardingStep:2});
      }else{
        finalKey.current??=crypto.randomUUID();
        const result=await finalizeOnboardingDraft(target.id,finalKey.current,catalogWriterEnabled()?publication:undefined);
        if(isCurrent())await finish(result.id,isCurrent);
      }
    }catch(failure){
      if(!isCurrent()||isCatalogPublicationDeferred(failure))return;
      setError('Não foi possível salvar a configuração. Tente novamente.');
    }finally{if(isCurrent())setBusy(false);}
  };
  if(done&&activeId)return <ReadyStep complete restaurantId={activeId}/>;
  if(draft.loading)return <p role='status'>Carregando configuração salva…</p>;
  if(draft.error)return <div className='space-y-3'><p role='alert'>Não foi possível carregar sua configuração.</p><Button onClick={()=>void draft.refetch()}>Tentar novamente</Button></div>;
  const creationAllowed=!!restaurantId||!organizationId||entitlement.data?.canCreate===true&&!entitlement.isError;
  const valid=step===0?validBasics(form):step===1?validOperation(form):validBasics(form)&&validOperation(form);
  return <>
    <div className='mb-6 space-y-3'><p className='text-xs font-medium text-muted-foreground'>Etapa {step+1} de 3</p><Progress value={(step+1)/3*100}/></div>
    <Card><CardHeader><CardTitle className='text-xl font-semibold tracking-tight'>{titles[step]}</CardTitle></CardHeader>
      <CardContent className='space-y-5'>
        {error&&<p role='alert' className='text-sm text-destructive'>{error}</p>}
        {!creationAllowed&&<p role='alert' className='text-sm text-destructive'>Não é possível criar outro restaurante nesta organização.</p>}
        {step===0?<RestaurantBasicsStep form={form} disabled={busy} onName={name=>setForm(value=>({...value,name,...(!slugTouched?{slug:slugFromName(name)}:{})}))}
          onSlug={slug=>{setSlugTouched(true);setForm(value=>({...value,slug}));}} onContact={whatsapp=>setForm(value=>({...value,whatsapp}))}/>:
          step===1?<OperationStep form={form} disabled={busy} onChange={partial=>setForm(value=>({...value,...partial}))}/>:<ReadyStep form={form}/>}
        <CatalogPublicationFeedback publication={publication} authenticated/>
      </CardContent>
      <CardFooter className='flex justify-between gap-3'>
        {step>0?<Button variant='outline' disabled={busy||publication.blocked} onClick={()=>{setError(null);setStep(value=>value-1);}}>Voltar</Button>:<Link to='/restaurants/select' className='text-sm underline underline-offset-2'>Seus restaurantes</Link>}
        <Button disabled={busy||publication.blocked||!valid||!creationAllowed} onClick={()=>void next()}>{busy?'Salvando…':step===2?'Finalizar':'Próximo'}</Button>
      </CardFooter>
    </Card>
  </>;
}
export default function OnboardingPage(){
  const {user}=useAuth(),account=useAccountBootstrap(),[params]=useSearchParams();
  if(!user)return <Navigate to='/login' replace/>;
  if(account.isPending)return <p role='status' className='p-6'>Carregando conta…</p>;
  if(account.isError)return <p role='alert' className='p-6'>Não foi possível carregar sua conta.</p>;
  const requested=params.get('restaurantId'),newOrganization=params.get('organizationId');
  const restaurantId=requested??(!newOrganization?account.data.currentRestaurantId:null);
  const selected=account.data.restaurants.find(value=>value.id===restaurantId);
  const organizationId=newOrganization??selected?.organizationId??account.data.currentOrganizationId;
  if(restaurantId&&!selected||organizationId&&!account.data.organizations.some(value=>value.id===organizationId))return <p role='alert'>Configuração indisponível para esta conta.</p>;
  if(selected&&newOrganization&&selected.organizationId!==newOrganization)return <p role='alert'>Configuração indisponível para esta conta.</p>;
  if(selected?.onboardingStatus==='draft'&&!account.data.organizations.find(value=>value.id===selected.organizationId)?.capabilities.includes('restaurant.manage'))return <p role='alert' className='p-6'>Peça ao responsável pelo restaurante para concluir a configuração.</p>;
  if(!restaurantId&&!organizationId&&account.data.organizations.length)return <Navigate to='/restaurants/new' replace/>;
  return <main className='mx-auto w-full max-w-xl px-4 py-10'>
    {selected?.onboardingStatus==='complete'&&!catalogWriterEnabled()?<ReadyStep complete restaurantId={selected.id}/>:
      <OnboardingFlow key={[user.id,organizationId,restaurantId].join(':')} userId={user.id} restaurantId={restaurantId} organizationId={organizationId}/>}
  </main>;
}
