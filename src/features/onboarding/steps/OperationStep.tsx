import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import type {OnboardingForm} from '../onboarding-form';
export function OperationStep({form,onChange,disabled}:{form:OnboardingForm;onChange:(value:Partial<OnboardingForm>)=>void;disabled:boolean}){
  const mode=form.localEnabled?(form.deliveryEnabled?'both':'local'):form.deliveryEnabled?'delivery':'';
  return <fieldset disabled={disabled} className='space-y-5'>
    <legend className='mb-3 text-sm font-medium'>Como você recebe pedidos?</legend>
    <div className='space-y-2'>{[{id:'local',label:'Salão'},{id:'delivery',label:'Delivery'},{id:'both',label:'Salão e delivery'}].map(option=>
      <label key={option.id} className='flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-input px-3 text-sm'>
        <input type='radio' name='operation-mode' value={option.id} checked={mode===option.id} onChange={()=>onChange({localEnabled:option.id!=='delivery',deliveryEnabled:option.id!=='local'})}/>{option.label}
      </label>)}</div>
    {form.localEnabled&&<div className='space-y-2'><Label htmlFor='restaurant-tables'>Número de mesas</Label>
      <Input id='restaurant-tables' type='number' min={1} max={1000} value={form.totalTables} onChange={event=>onChange({totalTables:Number(event.target.value)})}/></div>}
  </fieldset>;
}
