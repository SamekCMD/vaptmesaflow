import {beforeEach,describe,it,expect,vi} from 'vitest';
import {listOwnedMenuItems,createMenuItem,updateMenuItem,deleteMenuItem} from '@/lib/menu-items';
import {listKitchenOrders,updateKitchenOrderStatus} from '@/lib/kitchen';
import {fetchOwnedOverview} from '@/lib/overview';
import {listTableSessions,getTableSession,closeTableSession,transferTableSession} from '@/lib/table-sessions';
import {fetchRestaurant,updateRestaurant} from '@/lib/restaurants';
import {vaptApiRequest} from '@/lib/vapt-api-client';
vi.mock('@/lib/vapt-api-client',async original=>({...await original<typeof import('@/lib/vapt-api-client')>(),vaptApiRequest:vi.fn()}));
const request=vi.mocked(vaptApiRequest),restA='30000000-0000-4000-8000-000000000001',restB='30000000-0000-4000-8000-000000000002';
beforeEach(()=>{request.mockReset();request.mockResolvedValue([]);});
describe('explicit tenant clients',()=>{
  it('operational reads and mutations always address the captured restaurant path',async()=>{
    await listOwnedMenuItems(restA);expect(request.mock.lastCall?.[0].route).toBe('/restaurants/'+restA+'/menu-items');
    await listKitchenOrders(restB);expect(request.mock.lastCall?.[0].route).toBe('/restaurants/'+restB+'/kitchen/orders');
    await updateKitchenOrderStatus(restA,'order-1','ready');expect(request.mock.lastCall?.[0].route).toBe('/restaurants/'+restA+'/kitchen/orders/order-1/status');
    await fetchOwnedOverview(restB,'week');expect(request.mock.lastCall?.[0].route).toBe('/restaurants/'+restB+'/overview');
    await listTableSessions(restA);expect(request.mock.lastCall?.[0].route).toBe('/restaurants/'+restA+'/table-sessions');
    await getTableSession(restB,'session-1');expect(request.mock.lastCall?.[0].route).toBe('/restaurants/'+restB+'/table-sessions/session-1');
    await closeTableSession(restA,'session-1');expect(request.mock.lastCall?.[0].route).toBe('/restaurants/'+restA+'/table-sessions/session-1/close');
    await transferTableSession(restB,'session-1','2');expect(request.mock.lastCall?.[0].route).toBe('/restaurants/'+restB+'/table-sessions/session-1/transfer');
    await deleteMenuItem(restA,'item-1');expect(request.mock.lastCall?.[0].route).toBe('/restaurants/'+restA+'/menu-items/item-1');
    await updateMenuItem(restB,'item-1',{name:'Changed'});expect(request.mock.lastCall?.[0].route).toBe('/restaurants/'+restB+'/menu-items/item-1');
  });
  it('publication reload retains restaurantA after the current UI scope changes toB',async()=>{
    let reload:(()=>Promise<unknown>)|undefined,current=restA;
    const publication={run:vi.fn(async(_input:unknown,read?:()=>Promise<unknown>)=>{reload=read;return {} as never;})};
    await updateRestaurant(current,{name:'A changed'},publication);current=restB;
    expect(publication.run.mock.calls[0][0]).toEqual({method:'PATCH',route:'/restaurants/'+restA,body:{name:'A changed'}});
    request.mockResolvedValue({id:restA});await reload?.();
    expect(request.mock.lastCall?.[0].route).toBe('/restaurants/'+restA);expect(current).toBe(restB);
  });
  it('canonical restaurant clients refuse ambiguous legacy or malformed restaurant IDs before transport',async()=>{
    await expect(fetchRestaurant('me')).rejects.toBeDefined();
    await expect(fetchRestaurant('../other')).rejects.toBeDefined();
    expect(request).not.toHaveBeenCalled();
  });
});
