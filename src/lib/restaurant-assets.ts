import {uploadRestaurantImage} from '@/lib/menu-image-storage';
import {catalogWriterEnabled} from '@/lib/catalog/flags';
import {restaurantRoute} from '@/lib/restaurants';
import {VaptApiClientError,vaptApiRequest} from '@/lib/vapt-api-client';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function enabled(){if(!catalogWriterEnabled())throw new VaptApiClientError('catalog_writer_disabled','Envio de logo indisponível neste ambiente.',503);}
export function restaurantBrandingKey(imageUrl:string,restaurantId:string):string|null{
  try{const url=new URL(imageUrl),parts=url.pathname.split('/').filter(Boolean).slice(-3);
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||parts[0]!==restaurantId||parts[1]!=='branding'||!uuid.test(parts[2]))return null;
    return parts.join('/');
  }catch{return null;}
}
export async function uploadRestaurantLogo(input:{restaurantId:string;image:Blob;operationId:string;optimizedImage?:Blob}):Promise<string>{
  enabled();restaurantRoute(input.restaurantId);
  return uploadRestaurantImage({...input,itemId:'branding'});
}
export async function retireRestaurantAsset({restaurantId,objectKey}:{restaurantId:string;objectKey:string}):Promise<void>{
  enabled();const parts=objectKey.split('/');
  if(parts.length!==3||parts[0]!==restaurantId||parts[1]!=='branding'||!uuid.test(parts[2]))throw new VaptApiClientError('invalid_image_key','Imagem inválida.',400);
  await vaptApiRequest({method:'DELETE',route:restaurantRoute(restaurantId)+'/branding/image',query:{objectKey},requireAuth:true});
}
