import {vi} from 'vitest';
import {tenantAccount,tenantIds,tenantJson,tenantRestaurant} from './tenant-frontend-fixture';
export function onboardingTestServer(fresh=false){
  const saved={id:tenantIds.a,organizationId:tenantIds.org,name:'Nome salvo no servidor',slug:'nome-salvo',whatsapp:'61999999999',
    localEnabled:true,deliveryEnabled:false,totalTables:4,onboardingStep:0 as 0|1|2};
  const state={draft:fresh?null:{...saved},complete:false,failSave:false,loseFinalResponse:false,trialStarts:0,
    createKeys:[] as string[],finalKeys:[] as string[],progress:{cashier:false,menu:false,kitchen:false,settings:false,overview:false}};
  const fetcher=vi.fn().mockImplementation(async(url:string,init:RequestInit={})=>{
    const target=new URL(url),path=target.pathname,method=init.method??'GET';
    if(path==='/account/bootstrap'){
      const account=tenantAccount();account.restaurants=state.draft?[{id:tenantIds.a,organizationId:tenantIds.org,name:state.draft.name,slug:state.draft.slug,onboardingStatus:state.complete?'complete':'draft'}]:[];
      account.organizations=state.draft?account.organizations:[];account.currentRestaurantId=state.draft?tenantIds.a:null;account.currentOrganizationId=state.draft?tenantIds.org:null;
      account.destination=state.complete?'dashboard':'onboarding';return tenantJson(account);
    }
    if(path==='/account/onboarding-draft'&&method==='POST'){
      const key=(init.headers as Record<string,string>)['Idempotency-Key'];state.createKeys.push(key);
      if(!state.draft)state.draft={...saved,...JSON.parse(init.body as string)};
      return tenantJson(state.draft,201);
    }
    if(path==='/restaurants/'+tenantIds.a+'/onboarding'){
      if(method==='PATCH'){
        if(state.failSave){state.failSave=false;return tenantJson({error:{code:'temporary_failure',message:'Tente novamente.'}},503);}
        state.draft={...state.draft!,...JSON.parse(init.body as string)};
      }
      return tenantJson(state.draft);
    }
    if(path==='/restaurants/'+tenantIds.a+'/onboarding/finalize'&&method==='POST'){
      state.finalKeys.push((init.headers as Record<string,string>)['Idempotency-Key']);
      if(!state.complete){state.complete=true;state.trialStarts++;}
      if(state.loseFinalResponse){state.loseFinalResponse=false;return tenantJson({error:{code:'unconfirmed_response',message:'Tente novamente.'}},503);}
      return tenantJson({...tenantRestaurant(tenantIds.a,state.draft!.name),slug:state.draft!.slug});
    }
    if(path==='/restaurants/'+tenantIds.a)return tenantJson({...tenantRestaurant(tenantIds.a,state.draft?.name),onboardingCompleted:state.complete});
    if(path==='/restaurants/'+tenantIds.a+'/activation')return tenantJson(state.progress);
    if(path.startsWith('/restaurants/'+tenantIds.a+'/activation/')&&method==='POST'){
      state.progress[path.split('/').at(-1)! as keyof typeof state.progress]=true;return new Response(null,{status:204});
    }
    throw new Error('Unexpected synthetic onboarding route: '+method+' '+path);
  });
  return {state,fetcher};
}
