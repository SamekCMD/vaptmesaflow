import { afterEach, describe, expect, it, vi } from "vitest";

const { envMock } = vi.hoisted(() => ({
  envMock: { menuImageStorageMode: "r2" as "disabled" | "r2", publicCatalogEventsEnabled: false },
}));

vi.mock("@/lib/env", () => ({ ENV: envMock }));
vi.mock("@/lib/menu-image-optimization", () => ({ optimizeMenuImage: vi.fn(async (image: Blob) => image) }));

vi.mock("@/lib/vapt-api-client", () => ({
  vaptApiRequest: vi.fn(),
  VaptApiClientError: class VaptApiClientError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly status = 500,
    ) {
      super(message);
    }
  },
}));

import { vaptApiRequest, VaptApiClientError } from "@/lib/vapt-api-client";
import { deleteMenuImage, uploadMenuImage } from "@/lib/menu-image-storage";
import { optimizeMenuImage } from "@/lib/menu-image-optimization";

const restaurantId = "10000000-0000-4000-8000-000000000001";
const itemId = "20000000-0000-4000-8000-000000000002";

afterEach(() => {
  envMock.menuImageStorageMode = "r2";
  envMock.publicCatalogEventsEnabled = false;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("menu image R2 client", () => {
  it("new uploads forward the exact staging If-Match and omit credentials", async () => {
    envMock.publicCatalogEventsEnabled = true;
    const objectKey = `${restaurantId}/${itemId}/33333333-3333-4333-8333-333333333333`;
    const image = new Blob(["webp"], { type: "image/webp" });
    vi.mocked(vaptApiRequest).mockResolvedValue({ state: "upload_required", method: "PUT", objectKey, uploadUrl: "https://signed.test/upload",
      publicUrl: `https://assets.test/${objectKey}`, headers: { "Content-Type": "image/webp", "If-Match": '"fence-etag"' }, expiresInSeconds: 300 });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetchMock);
    await uploadMenuImage({ restaurantId, itemId, image });
    expect(fetchMock).toHaveBeenCalledWith("https://signed.test/upload", { method: "PUT", headers: { "Content-Type": "image/webp", "If-Match": '"fence-etag"' }, body: image, credentials: "omit" });
  });
  it("never PUTs without a staging condition or accepts a different tenant's uploaded key", async () => {
    envMock.publicCatalogEventsEnabled = true;
    const objectKey = `${restaurantId}/${itemId}/33333333-3333-4333-8333-333333333333`;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetchMock);
    vi.mocked(vaptApiRequest).mockResolvedValue({ state: "upload_required", method: "PUT", objectKey, uploadUrl: "https://signed.test/upload", publicUrl: `https://assets.test/${objectKey}`, headers: { "Content-Type": "image/webp" }, expiresInSeconds: 300 });
    await expect(uploadMenuImage({ restaurantId, itemId, image: new Blob(["webp"], { type: "image/webp" }) })).rejects.toMatchObject({ code: "invalid_image_descriptor" });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.mocked(vaptApiRequest).mockResolvedValue({ state: "uploaded", objectKey, publicUrl: `https://assets.test/99999999-9999-4999-8999-999999999999/${itemId}/33333333-3333-4333-8333-333333333333` });
    await expect(uploadMenuImage({ restaurantId, itemId, image: new Blob(["webp"], { type: "image/webp" }) })).rejects.toMatchObject({ code: "invalid_image_key" });
  });
  it("replays an already uploaded immutable object without PUT or overwrite", async () => {
    envMock.publicCatalogEventsEnabled = true;
    const objectKey = `${restaurantId}/${itemId}/33333333-3333-4333-8333-333333333333`;
    vi.mocked(vaptApiRequest).mockResolvedValue({ state: "uploaded", objectKey, publicUrl: `https://assets.test/${objectKey}` });
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect(await uploadMenuImage({ restaurantId, itemId, image: new Blob(["webp"], { type: "image/webp" }) })).toBe(`https://assets.test/${objectKey}`);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vaptApiRequest).toHaveBeenCalledWith(expect.objectContaining({ headers: { "X-Vapt-Catalog-Protocol": "1", "Idempotency-Key": expect.any(String) } }));
  });
  it("cleanup names only the exact immutable object belonging to this restaurant/item", async () => {
    envMock.publicCatalogEventsEnabled = true;
    const objectKey = `${restaurantId}/${itemId}/33333333-3333-4333-8333-333333333333`;
    vi.mocked(vaptApiRequest).mockResolvedValue(null);
    await deleteMenuImage({ restaurantId, itemId, imageUrl: `https://assets.test/prefix/${objectKey}` });
    expect(vaptApiRequest).toHaveBeenCalledWith({ method: "DELETE", route: `/restaurants/${restaurantId}/menu-items/${itemId}/image`, query: { objectKey } });
    vi.mocked(vaptApiRequest).mockClear();
    await expect(deleteMenuImage({ restaurantId, itemId, imageUrl: "https://assets.test/another/tenant/key" })).rejects.toMatchObject({ code: "invalid_image_key" });
    expect(vaptApiRequest).not.toHaveBeenCalled();
  });
  it("signs and uploads the converted WebP bytes, not the original PNG", async () => {
    const optimized = new Blob(["optimized-webp"], { type: "image/webp" });
    vi.mocked(optimizeMenuImage).mockResolvedValueOnce(optimized);
    vi.mocked(vaptApiRequest).mockResolvedValue({ method: "PUT", uploadUrl: "https://signed.example.com/upload",
      publicUrl: "https://assets.test/image", objectKey: "restaurant/item", headers: { "Content-Type": "image/webp" }, expiresInSeconds: 300 });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetchMock);
    await uploadMenuImage({ restaurantId, itemId, image: new Blob(["original-png-image"], { type: "image/png" }) });
    expect(vaptApiRequest).toHaveBeenCalledWith(expect.objectContaining({ body: { contentType: "image/webp", contentLength: 14 } }));
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: optimized }));
  });

  it("never reserves an upload or sends bytes if optimization fails", async () => {
    vi.mocked(optimizeMenuImage).mockRejectedValueOnce(new Error("Imagem inválida"));
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(uploadMenuImage({ restaurantId, itemId, image: new Blob(["bad-image"], { type: "image/png" }) })).rejects.toThrow("Imagem inválida");
    expect(vaptApiRequest).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not call the API before the coordinated R2 cutover flag is enabled", async () => {
    envMock.menuImageStorageMode = "disabled";

    await expect(uploadMenuImage({
      restaurantId,
      itemId,
      image: new Blob(["jpeg-bytes"], { type: "image/jpeg" }),
    })).rejects.toEqual(expect.objectContaining<Partial<VaptApiClientError>>({
      code: "storage_not_configured",
    }));
    expect(vaptApiRequest).not.toHaveBeenCalled();
  });

  it("requests a scoped URL and uploads the exact blob with signed headers", async () => {
    vi.mocked(vaptApiRequest).mockResolvedValue({
      method: "PUT",
      uploadUrl: "https://signed.example.com/upload",
      publicUrl: `https://assets.vapt.app.br/${restaurantId}/${itemId}`,
      objectKey: `${restaurantId}/${itemId}`,
      headers: { "Content-Type": "image/jpeg" },
      expiresInSeconds: 300,
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const image = new Blob(["jpeg-bytes"], { type: "image/jpeg" });

    const publicUrl = await uploadMenuImage({ restaurantId, itemId, image });

    expect(vaptApiRequest).toHaveBeenCalledWith({
      method: "POST",
      route: `/restaurants/${restaurantId}/menu-items/${itemId}/image/upload`,
      body: { contentType: "image/jpeg", contentLength: image.size },
    });
    expect(fetchMock).toHaveBeenCalledWith("https://signed.example.com/upload", {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: image,
    });
    expect(publicUrl).toBe(`https://assets.vapt.app.br/${restaurantId}/${itemId}`);
  });

  it("surfaces an upload failure without returning the public URL", async () => {
    vi.mocked(vaptApiRequest).mockResolvedValue({
      method: "PUT",
      uploadUrl: "https://signed.example.com/upload",
      publicUrl: "https://assets.vapt.app.br/object",
      objectKey: "restaurant/item",
      headers: { "Content-Type": "image/jpeg" },
      expiresInSeconds: 300,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(uploadMenuImage({
      restaurantId,
      itemId,
      image: new Blob(["jpeg-bytes"], { type: "image/jpeg" }),
    })).rejects.toEqual(expect.objectContaining<Partial<VaptApiClientError>>({
      code: "storage_upload_failed",
    }));
  });

  it("routes deletion through the authenticated API", async () => {
    vi.mocked(vaptApiRequest).mockResolvedValue(null);

    await deleteMenuImage({ restaurantId, itemId });

    expect(vaptApiRequest).toHaveBeenCalledWith({
      method: "DELETE",
      route: `/restaurants/${restaurantId}/menu-items/${itemId}/image`,
    });
  });
});
