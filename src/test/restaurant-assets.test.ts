import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabase } from "@/lib/supabase";
import {
  buildMenuItemImagePath,
  buildRestaurantLogoPath,
  persistMenuItemImage,
  persistRestaurantAssetUpload,
  removePersistedRestaurantAsset,
  uploadRestaurantAsset,
  validateRestaurantImage,
} from "@/features/restaurants/restaurant-assets";

const storageMocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: storageMocks.upload,
        remove: storageMocks.remove,
      })),
    },
  },
}));

describe("restaurant assets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unsupported formats and files above each UX limit", () => {
    expect(() => validateRestaurantImage(
      new File(["gif"], "logo.gif", { type: "image/gif" }),
      "logo",
    )).toThrow("Use uma imagem PNG, JPG ou WebP.");

    expect(() => validateRestaurantImage(
      new File([new Uint8Array(2 * 1024 * 1024 + 1)], "logo.png", { type: "image/png" }),
      "logo",
    )).toThrow("O logo deve ter no máximo 2 MB.");

    expect(() => validateRestaurantImage(
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "dish.webp", { type: "image/webp" }),
      "menu-item",
    )).toThrow("A imagem do produto deve ter no máximo 5 MB.");
  });

  it("builds organization and restaurant scoped paths", () => {
    expect(buildRestaurantLogoPath({
      organizationId: "org-1",
      restaurantId: "rest-1",
      assetId: "asset-1",
      contentType: "image/png",
    })).toBe("organizations/org-1/restaurants/rest-1/branding/asset-1.png");

    expect(buildMenuItemImagePath({
      organizationId: "org-1",
      restaurantId: "rest-1",
      itemId: "item-1",
      assetId: "asset-2",
    })).toBe("organizations/org-1/restaurants/rest-1/menu-items/item-1/asset-2.jpg");
  });

  it("uploads to the selected bucket and returns the persisted public URL", async () => {
    storageMocks.upload.mockResolvedValue({ data: { path: "stored/logo.png" }, error: null });
    const file = new File(["logo"], "logo.png", { type: "image/png" });

    const result = await uploadRestaurantAsset({
      bucket: "restaurant-assets",
      path: "organizations/org-1/restaurants/rest-1/branding/asset-1.png",
      body: file,
      contentType: file.type,
    });

    expect(supabase.storage.from).toHaveBeenCalledWith("restaurant-assets");
    expect(storageMocks.upload).toHaveBeenCalledWith(
      "organizations/org-1/restaurants/rest-1/branding/asset-1.png",
      file,
      { contentType: "image/png", upsert: false },
    );
    expect(result).toEqual({
      path: "stored/logo.png",
      publicUrl: "https://supabase.test.example.com/storage/v1/object/public/restaurant-assets/stored/logo.png",
    });
  });

  it("surfaces storage errors without returning a temporary URL", async () => {
    const storageError = { message: "storage unavailable" };
    storageMocks.upload.mockResolvedValue({ data: null, error: storageError });

    await expect(uploadRestaurantAsset({
      bucket: "restaurant-assets",
      path: "organizations/org-1/restaurants/rest-1/branding/asset-1.png",
      body: new Blob(["logo"], { type: "image/png" }),
      contentType: "image/png",
    })).rejects.toBe(storageError);
  });

  it("removes a new object when database persistence fails and keeps the previous asset", async () => {
    storageMocks.upload.mockResolvedValue({
      data: { path: "organizations/org-1/restaurants/rest-1/branding/new.png" },
      error: null,
    });
    storageMocks.remove.mockResolvedValue({ data: null, error: null });
    const persist = vi.fn().mockRejectedValue(new Error("database unavailable"));

    await expect(persistRestaurantAssetUpload({
      bucket: "restaurant-assets",
      path: "organizations/org-1/restaurants/rest-1/branding/new.png",
      body: new Blob(["new"], { type: "image/png" }),
      contentType: "image/png",
      previousPublicUrl: "https://supabase.test.example.com/storage/v1/object/public/restaurant-assets/organizations/org-1/restaurants/rest-1/branding/old.png",
      persist,
    })).rejects.toThrow("database unavailable");

    expect(persist).toHaveBeenCalledWith(
      "https://supabase.test.example.com/storage/v1/object/public/restaurant-assets/organizations/org-1/restaurants/rest-1/branding/new.png",
    );
    expect(storageMocks.remove).toHaveBeenCalledTimes(1);
    expect(storageMocks.remove).toHaveBeenCalledWith([
      "organizations/org-1/restaurants/rest-1/branding/new.png",
    ]);
  });

  it("removes the previous managed object only after persistence succeeds", async () => {
    storageMocks.upload.mockResolvedValue({
      data: { path: "organizations/org-1/restaurants/rest-1/branding/new.png" },
      error: null,
    });
    storageMocks.remove.mockResolvedValue({ data: null, error: null });
    const persist = vi.fn().mockResolvedValue(undefined);

    await persistRestaurantAssetUpload({
      bucket: "restaurant-assets",
      path: "organizations/org-1/restaurants/rest-1/branding/new.png",
      body: new Blob(["new"], { type: "image/png" }),
      contentType: "image/png",
      previousPublicUrl: "https://supabase.test.example.com/storage/v1/object/public/restaurant-assets/organizations/org-1/restaurants/rest-1/branding/old.png",
      persist,
    });

    expect(storageMocks.remove).toHaveBeenCalledWith([
      "organizations/org-1/restaurants/rest-1/branding/old.png",
    ]);
  });

  it("persists product images in the scoped menu bucket", async () => {
    storageMocks.upload.mockResolvedValue({
      data: { path: "organizations/org-1/restaurants/rest-1/menu-items/item-1/asset-1.jpg" },
      error: null,
    });
    storageMocks.remove.mockResolvedValue({ data: null, error: null });
    const persist = vi.fn().mockResolvedValue(undefined);

    await persistMenuItemImage({
      organizationId: "org-1",
      restaurantId: "rest-1",
      itemId: "item-1",
      assetId: "asset-1",
      image: new Blob(["dish"], { type: "image/jpeg" }),
      previousPublicUrl: null,
      persist,
    });

    expect(supabase.storage.from).toHaveBeenCalledWith("menu-images");
    expect(storageMocks.upload).toHaveBeenCalledWith(
      "organizations/org-1/restaurants/rest-1/menu-items/item-1/asset-1.jpg",
      expect.any(Blob),
      { contentType: "image/jpeg", upsert: false },
    );
    expect(persist).toHaveBeenCalledWith(
      "https://supabase.test.example.com/storage/v1/object/public/menu-images/organizations/org-1/restaurants/rest-1/menu-items/item-1/asset-1.jpg",
    );
  });

  it("removes both scoped and legacy persisted product URLs", async () => {
    storageMocks.remove.mockResolvedValue({ data: null, error: null });

    await removePersistedRestaurantAsset(
      "menu-images",
      "https://supabase.test.example.com/storage/v1/object/public/menu-images/rest-1/item-1",
    );

    expect(storageMocks.remove).toHaveBeenCalledWith(["rest-1/item-1"]);
  });
});
