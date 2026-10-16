import { VaptApiClientError, vaptApiRequest } from "@/lib/vapt-api-client";
import { ENV } from "@/lib/env";
import { optimizeMenuImage } from "@/lib/menu-image-optimization";

type MenuImageContentType = "image/jpeg" | "image/png" | "image/webp";

type MenuImageCoordinates = {
  restaurantId: string;
  itemId: string;
  imageUrl?: string;
};

type UploadMenuImageInput = MenuImageCoordinates & {
  image: Blob;
  operationId?: string;
};

type UploadDescriptor = {
  state?: "upload_required";
  method: "PUT";
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
  headers: { "Content-Type": MenuImageContentType; "If-Match"?: string };
  expiresInSeconds: number;
} | { state: "uploaded"; publicUrl: string; objectKey: string };

const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function imageKey(value: string | undefined, restaurantId: string, itemId: string): string {
  try {
    const url = new URL(value ?? "");
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    const parts = url.pathname.split("/").filter(Boolean).slice(-3).map(decodeURIComponent);
    if (parts.length !== 3 || !parts.every(part => uuidPattern.test(part)) || parts[0] !== restaurantId || parts[1] !== itemId) throw new Error();
    return parts.join("/");
  } catch { throw new VaptApiClientError("invalid_image_key", "A imagem anterior não pode ser limpa automaticamente. Sua cópia será mantida.", 409); }
}

const supportedContentTypes = new Set<MenuImageContentType>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function requireSupportedContentType(value: string): MenuImageContentType {
  if (!supportedContentTypes.has(value as MenuImageContentType)) {
    throw new VaptApiClientError(
      "invalid_image_type",
      "Formato de imagem inválido. Use JPG, PNG ou WebP.",
      400,
    );
  }
  return value as MenuImageContentType;
}

function requireR2Cutover(): void {
  if (ENV.menuImageStorageMode !== "r2") {
    throw new VaptApiClientError(
      "storage_not_configured",
      "O envio de imagens está temporariamente indisponível.",
      503,
    );
  }
}

export async function uploadMenuImage({
  restaurantId,
  itemId,
  image,
  operationId,
}: UploadMenuImageInput): Promise<string> {
  requireR2Cutover();
  const optimized = await optimizeMenuImage(image);
  const contentType = requireSupportedContentType(optimized.type);
  const key = operationId ?? (ENV.publicCatalogEventsEnabled ? crypto.randomUUID() : undefined);
  if (key && !uuidPattern.test(key)) throw new VaptApiClientError("invalid_operation_id", "Operação de imagem inválida.", 400);
  const descriptor = await vaptApiRequest<UploadDescriptor>({
    method: "POST",
    route: `/restaurants/${restaurantId}/menu-items/${itemId}/image/upload`,
    ...(ENV.publicCatalogEventsEnabled ? { headers: { "X-Vapt-Catalog-Protocol": "1", "Idempotency-Key": key! } } : {}),
    body: {
      contentType,
      contentLength: optimized.size,
    },
  });

  if (ENV.publicCatalogEventsEnabled && imageKey(descriptor.publicUrl, restaurantId, itemId) !== descriptor.objectKey) {
    throw new VaptApiClientError("invalid_image_key", "O envio não corresponde a esta imagem.", 502);
  }
  if (descriptor.state === "uploaded") return descriptor.publicUrl;
  if (ENV.publicCatalogEventsEnabled && (descriptor.state !== "upload_required" || !descriptor.headers["If-Match"] || descriptor.headers["Content-Type"] !== contentType)) {
    throw new VaptApiClientError("invalid_image_descriptor", "Não foi possível reservar um envio seguro da imagem.", 502);
  }

  const response = await fetch(descriptor.uploadUrl, {
    method: descriptor.method,
    headers: descriptor.headers,
    body: optimized,
    ...(ENV.publicCatalogEventsEnabled ? { credentials: "omit" as const } : {}),
  });
  if (!response.ok) {
    throw new VaptApiClientError(
      "storage_upload_failed",
      "Não foi possível enviar a imagem. Tente novamente.",
      response.status,
    );
  }

  return descriptor.publicUrl;
}

export async function deleteMenuImage({
  restaurantId,
  itemId,
  imageUrl,
}: MenuImageCoordinates): Promise<void> {
  requireR2Cutover();
  await vaptApiRequest<null>({
    method: "DELETE",
    route: `/restaurants/${restaurantId}/menu-items/${itemId}/image`,
    ...(ENV.publicCatalogEventsEnabled ? { query: { objectKey: imageKey(imageUrl, restaurantId, itemId) } } : {}),
  });
}
