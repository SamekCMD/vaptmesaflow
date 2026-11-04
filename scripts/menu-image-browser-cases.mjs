// Native-browser verification only. Synthetic images, no files or cloud APIs.
export async function runMenuImageBrowserCases(optimize){
  const active=new Set(),create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),cases=[];
  URL.createObjectURL=blob=>{const url=create(blob);active.add(url);return url;};
  URL.revokeObjectURL=url=>{active.delete(url);return revoke(url);};
  async function encode(canvas,type){return new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('encode')),type,0.88));}
  async function fixture(type,width,height,transparent){
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    try{
      const context=canvas.getContext('2d');if(!context)throw Error('canvas');
      if(type==='image/jpeg'){
        const image=context.createImageData(width,height);let seed=123456789;
        for(let i=0;i<image.data.length;i+=4){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;image.data[i]=seed&255;image.data[i+1]=(seed>>>8)&255;image.data[i+2]=(seed>>>16)&255;image.data[i+3]=255;}
        context.putImageData(image,0,0);
      }else if(!transparent){context.fillStyle='rgb(240,220,180)';context.fillRect(0,0,width,height);}
      context.fillStyle='rgb(20,160,220)';context.fillRect(width/4,height/4,width/2,height/2);
      const blob=await encode(canvas,type);if(blob.type!==type)throw Error('source encoder');return blob;
    }finally{canvas.width=0;canvas.height=0;}
  }
  try{
    for(const [id,inputType,width,height,alpha]of [['jpeg','image/jpeg',2400,1600,false],['png_alpha_300x150','image/png',300,150,true],['webp','image/webp',640,480,false]]){
      try{
        const source=await fixture(inputType,width,height,alpha),output=await optimize(source),bitmap=await createImageBitmap(output);
        const canvas=document.createElement('canvas');
        try{
          canvas.width=bitmap.width;canvas.height=bitmap.height;const context=canvas.getContext('2d');if(!context)throw Error('canvas');context.drawImage(bitmap,0,0);
          const center=Array.from(context.getImageData(Math.floor(bitmap.width/2),Math.floor(bitmap.height/2),1,1).data),cornerAlpha=context.getImageData(0,0,1,1).data[3];
          const row={id,passed:true,inputType,inputBytes:source.size,outputType:output.type,outputBytes:output.size,width:bitmap.width,height:bitmap.height,center,cornerAlpha,urlsReleased:active.size===0};
          if(output.type!=='image/webp'||output.size<1||output.size>1048576||source.size>5242880||bitmap.width!==Math.min(width,1200)||bitmap.height!==(id==='jpeg'?800:height)||center[3]!==255||center.slice(0,3).some((v,i)=>Math.abs(v-[20,160,220][i])>35)||cornerAlpha!==(alpha?0:255)||!row.urlsReleased||id==='jpeg'&&output.size>=source.size)throw Error('codec invariant');
          cases.push(row);
        }finally{bitmap.close();canvas.width=0;canvas.height=0;}
      }catch{cases.push({id,passed:false});}
    }
    for(const [id,source]of [['unsupported',new Blob(['<svg/>'],{type:'image/svg+xml'})],['oversized',new Blob([new Uint8Array(5242881)],{type:'image/jpeg'})],['corrupt',new Blob([new Uint8Array([1,2,3])],{type:'image/png'})],['empty',new Blob([],{type:'image/png'})]]){
      let rejected=false;try{await optimize(source);}catch{rejected=true;}cases.push({id,passed:rejected&&active.size===0});
    }
    return cases;
  }finally{for(const url of active)revoke(url);URL.createObjectURL=create;URL.revokeObjectURL=revoke;}
}
