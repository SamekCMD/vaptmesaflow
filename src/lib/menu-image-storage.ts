import { VaptApiClientError, vaptApiRequest } from "@/lib/vapt-api-client";
import { ENV } from "@/lib/env";

type MenuImageContentType = "image/jpeg" | "image/png" | "image/webp";

type MenuImageCoordinates = {
  restaurantId: string;
  itemId: string;
};

type UploadMenuImageInput = MenuImageCoordinates & {
  image: Blob;
};

type UploadDescriptor = {
  method: "PUT";
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
  headers: { "Content-Type": MenuImageContentType };
  expiresInSeconds: number;
};

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
}: UploadMenuImageInput): Promise<string> {
  requireR2Cutover();
  const contentType = requireSupportedContentType(image.type);
  const descriptor = await vaptApiRequest<UploadDescriptor>({
    method: "POST",
    route: `/restaurants/${restaurantId}/menu-items/${itemId}/image/upload`,
    body: {
      contentType,
      contentLength: image.size,
    },
  });

  const response = await fetch(descriptor.uploadUrl, {
    method: descriptor.method,
    headers: descriptor.headers,
    body: image,
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
}: MenuImageCoordinates): Promise<void> {
  requireR2Cutover();
  await vaptApiRequest<null>({
    method: "DELETE",
    route: `/restaurants/${restaurantId}/menu-items/${itemId}/image`,
  });
}
