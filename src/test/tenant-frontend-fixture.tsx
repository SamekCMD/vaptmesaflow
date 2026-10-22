import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import type {ReactNode} from 'react';
import {RestaurantProvider} from '@/contexts/RestaurantContext';
import type {AccountBootstrap} from '@/features/auth/account-client';
import type {RestaurantDto} from '@/lib/business-api.types';
export const tenantIds={user:'10000000-0000-4000-8000-000000000001',org:'20000000-0000-4000-8000-000000000001',
  a:'30000000-0000-4000-8000-000000000001',b:'30000000-0000-4000-8000-000000000002'};
export function tenantAccount(role:'owner'|'manager'|'staff'='owner'):AccountBootstrap{
  return {userId:tenantIds.user,organizations:[{id:tenantIds.org,name:'Grupo Teste',role,
    capabilities:role==='owner'?['restaurant.read','restaurant.operate','restaurant.manage','restaurant.create','billing.read','billing.manage']:
      role==='manager'?['restaurant.read','restaurant.operate','restaurant.manage','billing.read']:['restaurant.read','restaurant.operate'],
    operationActive:true,features:{cashier:true,open_tab:true,metrics:true,multi_user:true,advanced_reports:true}}],
    restaurants:[{id:tenantIds.a,organizationId:tenantIds.org,name:'Restaurante A',slug:'restaurante-a',onboardingStatus:'complete'},
      {id:tenantIds.b,organizationId:tenantIds.org,name:'Restaurante B',slug:'restaurante-b',onboardingStatus:'complete'}],
    currentOrganizationId:tenantIds.org,currentRestaurantId:tenantIds.a,destination:'dashboard'};
}
export const tenantJson=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
export function tenantRestaurant(id:string,name='Restaurante '+(id===tenantIds.a?'A':'B')):RestaurantDto{
  return {id,name,slug:id===tenantIds.a?'restaurante-a':'restaurante-b',cnpj:null,whatsapp:null,address:null,phone:null,hours:null,description:null,
    primaryColor:'#0ea573',secondaryColor:'#1e293b',fontFamily:'modern',logoUrl:null,planType:'business',planStatus:'active',trialEndsAt:null,
    totalTables:2,maxTables:2,paymentMode:'open_tab',maxPendingOrders:3,localEnabled:true,deliveryEnabled:false,onboardingCompleted:true,updatedAt:new Date().toISOString()};
}
export function tenantWrapper(path='/dashboard/kitchen'){
  const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  const wrapper=({children}:{children:ReactNode})=><QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>
    <RestaurantProvider>{children}</RestaurantProvider></MemoryRouter></QueryClientProvider>;
  return {client,wrapper};
}
