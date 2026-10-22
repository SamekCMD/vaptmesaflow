import {basicsSchema} from './onboarding-client';
export type OnboardingForm={name:string;slug:string;whatsapp:string;localEnabled:boolean;deliveryEnabled:boolean;totalTables:number};
export const emptyOnboardingForm:OnboardingForm={name:'',slug:'',whatsapp:'',localEnabled:true,deliveryEnabled:false,totalTables:1};
export function slugFromName(name:string){return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);}
export function validBasics(form:OnboardingForm){return basicsSchema.safeParse({name:form.name,slug:form.slug,whatsapp:form.whatsapp}).success;}
export function validOperation(form:OnboardingForm){return (form.localEnabled||form.deliveryEnabled)&&(!form.localEnabled||Number.isInteger(form.totalTables)&&form.totalTables>=1&&form.totalTables<=1000);}
