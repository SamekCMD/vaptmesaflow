export type DecodedMenuImage = {
  width: number; height: number;
  encode(width: number, height: number, type: string, quality?: number): Promise<Blob>;
  close(): void;
};
export type MenuImageDecoder = (source: Blob) => Promise<DecodedMenuImage>;

export const MENU_IMAGE_INPUT_MAX_BYTES = 5 * 1024 * 1024;
export const MENU_IMAGE_OUTPUT_MAX_BYTES = 1024 * 1024;
const targetBytes = 300 * 1024;
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

async function decodeBrowserImage(source: Blob): Promise<DecodedMenuImage> {
  const url = URL.createObjectURL(source);
  const image = new Image();
  const canvas = document.createElement("canvas");
  canvas.width = 0; canvas.height = 0; // Force the first draw even for a 300×150 source.
  const close = () => {
    image.onload = null; image.onerror = null; image.src = "";
    URL.revokeObjectURL(url); canvas.width = 0; canvas.height = 0;
  };
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("A imagem demorou demais para abrir. Tente outra foto.")), 15_000);
      image.onload = () => { clearTimeout(timer); resolve(); };
      image.onerror = () => { clearTimeout(timer); reject(new Error("Não foi possível abrir a imagem. Escolha outro arquivo.")); };
      image.decoding = "async"; image.src = url;
    });
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Seu navegador não conseguiu processar a imagem. Tente outro navegador atualizado.");
    return {
      width: image.naturalWidth, height: image.naturalHeight, close,
      async encode(width, height, type, quality) {
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width; canvas.height = height;
          context.drawImage(image, 0, 0, width, height);
        }
        return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error("Não foi possível comprimir a imagem. Tente outra foto."));
        }, type, quality));
      },
    };
  } catch (error) { close(); throw error; }
}

// Conversion happens once, on upload, in the owner's browser. No original file
// or per-view transformation is sent to a paid image processing service.
export async function optimizeMenuImage(source: Blob, decode: MenuImageDecoder = decodeBrowserImage): Promise<Blob> {
  if (!supportedTypes.has(source.type)) throw new Error("Formato inválido. Escolha uma imagem JPG, PNG ou WebP.");
  if (source.size < 1 || source.size > MENU_IMAGE_INPUT_MAX_BYTES) throw new Error("Escolha uma imagem de até 5 MiB.");
  const image = await decode(source);
  try {
    if (![image.width, image.height].every(value => Number.isSafeInteger(value) && value > 0)
      || image.width * image.height > 40_000_000) throw new Error("Imagem inválida ou muito grande. Use uma foto de até 40 megapixels.");
    const initialScale = Math.min(1, 1200 / image.width, 1200 / image.height);
    let format = "image/webp";
    let best: Blob | undefined;
    for (const factor of [1, 0.8, 0.64]) {
      const width = Math.max(1, Math.round(image.width * initialScale * factor));
      const height = Math.max(1, Math.round(image.height * initialScale * factor));
      for (const quality of [0.82, 0.72, 0.62]) {
        let blob = await image.encode(width, height, format, quality);
        if (format === "image/webp" && blob.type !== "image/webp") {
          // Canvas falls back to PNG when the requested encoder is unavailable.
          // Never flatten alpha in a PNG/WebP source into an opaque JPEG.
          format = source.type === "image/jpeg" ? "image/jpeg" : "image/png";
          blob = await image.encode(width, height, format, quality);
        }
        if (!blob.size || !supportedTypes.has(blob.type) || blob.type !== format) {
          throw new Error("Não foi possível comprimir a imagem neste navegador. Tente outro navegador atualizado.");
        }
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= targetBytes) return blob;
        if (format === "image/png") break; // PNG ignores the lossy quality setting.
      }
    }
    if (best && best.size <= MENU_IMAGE_OUTPUT_MAX_BYTES) return best;
    throw new Error("Não foi possível comprimir a imagem para até 1 MiB. Escolha outra foto ou recorte a imagem.");
  } finally { image.close(); }
}
