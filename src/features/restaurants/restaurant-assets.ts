import { buildSupabaseStoragePublicUrl } from "@/lib/env";
import { supabase } from "@/lib/supabase";

export type RestaurantAssetBucket = "restaurant-assets" | "menu-images";
export type RestaurantImageKind = "logo" | "menu-item";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_SIZE_LIMITS: Record<RestaurantImageKind, number> = {
  logo: 2 * 1024 * 1024,
  "menu-item": 5 * 1024 * 1024,
};

const extensionByContentType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateRestaurantImage(file: File, kind: RestaurantImageKind) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Use uma imagem PNG, JPG ou WebP.");
  }

  if (file.size > IMAGE_SIZE_LIMITS[kind]) {
    throw new Error(
      kind === "logo"
        ? "O logo deve ter no máximo 2 MB."
        : "A imagem do produto deve ter no máximo 5 MB.",
    );
  }
}

type RestaurantAssetPathInput = {
  organizationId: string;
  restaurantId: string;
  assetId: string;
};

export function buildRestaurantLogoPath(
  input: RestaurantAssetPathInput & { contentType: string },
) {
  const extension = extensionByContentType[input.contentType];
  if (!extension) throw new Error("Formato de imagem não suportado.");

  return `organizations/${input.organizationId}/restaurants/${input.restaurantId}/branding/${input.assetId}.${extension}`;
}

export function buildMenuItemImagePath(
  input: RestaurantAssetPathInput & { itemId: string; contentType?: string },
) {
  const extension = extensionByContentType[input.contentType ?? "image/jpeg"];
  if (!extension) throw new Error("Formato de imagem não suportado.");

  return `organizations/${input.organizationId}/restaurants/${input.restaurantId}/menu-items/${input.itemId}/${input.assetId}.${extension}`;
}

type UploadRestaurantAssetInput = {
  bucket: RestaurantAssetBucket;
  path: string;
  body: Blob;
  contentType: string;
};

export async function uploadRestaurantAsset(input: UploadRestaurantAssetInput) {
  const { data, error } = await supabase.storage
    .from(input.bucket)
    .upload(input.path, input.body, { contentType: input.contentType, upsert: false });

  if (error) throw error;
  const path = data.path;

  return {
    path,
    publicUrl: buildSupabaseStoragePublicUrl(input.bucket, path),
  };
}

function extractPublicAssetPath(publicUrl: string, bucket: RestaurantAssetBucket) {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const markerIndex = publicUrl.indexOf(marker);
  if (markerIndex < 0) return null;

  return decodeURIComponent(publicUrl.slice(markerIndex + marker.length));
}

async function removeRestaurantAssetBestEffort(
  bucket: RestaurantAssetBucket,
  path: string,
) {
  await supabase.storage.from(bucket).remove([path]);
}

type PersistRestaurantAssetUploadInput = UploadRestaurantAssetInput & {
  previousPublicUrl?: string | null;
  persist: (publicUrl: string) => Promise<void>;
};

export async function persistRestaurantAssetUpload(
  input: PersistRestaurantAssetUploadInput,
) {
  const uploaded = await uploadRestaurantAsset(input);

  try {
    await input.persist(uploaded.publicUrl);
  } catch (error) {
    await removeRestaurantAssetBestEffort(input.bucket, uploaded.path);
    throw error;
  }

  const previousPath = input.previousPublicUrl
    ? extractPublicAssetPath(input.previousPublicUrl, input.bucket)
    : null;
  if (previousPath && previousPath !== uploaded.path) {
    await removeRestaurantAssetBestEffort(input.bucket, previousPath);
  }

  return uploaded;
}

type PersistMenuItemImageInput = {
  organizationId: string;
  restaurantId: string;
  itemId: string;
  assetId?: string;
  image: Blob;
  previousPublicUrl?: string | null;
  persist: (publicUrl: string) => Promise<void>;
};

export function persistMenuItemImage(input: PersistMenuItemImageInput) {
  const contentType = input.image.type || "image/jpeg";

  return persistRestaurantAssetUpload({
    bucket: "menu-images",
    path: buildMenuItemImagePath({
      organizationId: input.organizationId,
      restaurantId: input.restaurantId,
      itemId: input.itemId,
      assetId: input.assetId ?? crypto.randomUUID(),
      contentType,
    }),
    body: input.image,
    contentType,
    previousPublicUrl: input.previousPublicUrl,
    persist: input.persist,
  });
}

export async function removePersistedRestaurantAsset(
  bucket: RestaurantAssetBucket,
  publicUrl: string,
) {
  const path = extractPublicAssetPath(publicUrl, bucket);
  if (!path) return;

  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}
