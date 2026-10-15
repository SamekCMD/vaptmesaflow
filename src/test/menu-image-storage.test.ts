import { afterEach, describe, expect, it, vi } from "vitest";

const { envMock } = vi.hoisted(() => ({
  envMock: { menuImageStorageMode: "r2" as "disabled" | "r2" },
}));

vi.mock("@/lib/env", () => ({ ENV: envMock }));

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

const restaurantId = "10000000-0000-4000-8000-000000000001";
const itemId = "20000000-0000-4000-8000-000000000002";

afterEach(() => {
  envMock.menuImageStorageMode = "r2";
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("menu image R2 client", () => {
  it("does not call the API before the coordinated R2 cutover flag is enabled", async () => {
    envMock.menuImageStorageMode = "disabled";

    await expect(uploadMenuImage({
      restaurantId,
      itemId,
      image: new Blob(["jpeg-bytes"], { type: "image/jpeg" }),
    })).rejects.toEqual(expect.objectContaining<VaptApiClientError>({
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
    })).rejects.toEqual(expect.objectContaining<VaptApiClientError>({
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
