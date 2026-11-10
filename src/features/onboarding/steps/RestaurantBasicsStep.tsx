import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import type {OnboardingForm} from '../onboarding-form';
export function RestaurantBasicsStep({form,onName,onSlug,onContact,disabled}:{form:OnboardingForm;onName:(value:string)=>void;onSlug:(value:string)=>void;onContact:(value:string)=>void;disabled:boolean}){
  return <fieldset disabled={disabled} className='space-y-5'>
    <div className='space-y-2'><Label htmlFor='restaurant-name'>Nome do Restaurante</Label><Input id='restaurant-name' value={form.name} maxLength={80} onChange={event=>onName(event.target.value)} placeholder='Ex: Bistrô da Praça'/></div>
    <div className='space-y-2'><Label htmlFor='restaurant-slug'>URL do Cardápio</Label><Input id='restaurant-slug' value={form.slug} maxLength={60} onChange={event=>onSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))}/>
      <p className='text-xs text-muted-foreground'>Seu endereço será vapt.app.br/menu/{form.slug||'seu-restaurante'}.</p></div>
    <div className='space-y-2'><Label htmlFor='restaurant-contact'>WhatsApp (opcional)</Label><Input id='restaurant-contact' type='tel' value={form.whatsapp} maxLength={32} onChange={event=>onContact(event.target.value)}/></div>
  </fieldset>;
}
