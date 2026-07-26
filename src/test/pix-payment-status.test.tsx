import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PixPaymentModal from "@/components/menu/PixPaymentModal";
import { orderClient } from "@/lib/order-client";

vi.mock("@/lib/order-client", () => ({
  orderClient: {
    get: vi.fn(),
  },
}));

describe("public Pix payment status", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("polls only the token-protected public order endpoint", async () => {
    vi.useFakeTimers();
    const onPaymentConfirmed = vi.fn();
    vi.mocked(orderClient.get).mockResolvedValue({
      orderId: "20000000-0000-4000-8000-000000000001",
      displayId: 42,
      restaurantId: "30000000-0000-4000-8000-000000000001",
      tableSessionId: null,
      totalPrice: "23.00",
      status: "waiting_payment",
      paymentStatus: "CONFIRMED",
      channel: "local",
      tableNumber: "2",
      createdAt: "2026-07-25T12:00:00.000Z",
      items: [],
    });

    render(
      <PixPaymentModal
        open
        onClose={vi.fn()}
        orderId="20000000-0000-4000-8000-000000000001"
        publicToken="opaque-public-order-token-that-is-long-enough"
        qrCodeBase64=""
        pixPayload="pix-payload"
        expiration="2026-07-25T23:59:59.000Z"
        primaryColor="#003fd1"
        onPaymentConfirmed={onPaymentConfirmed}
      />,
    );

    await act(async () => vi.advanceTimersByTimeAsync(2100));

    expect(orderClient.get).toHaveBeenCalledWith(
      "20000000-0000-4000-8000-000000000001",
      "opaque-public-order-token-that-is-long-enough",
    );
    expect(onPaymentConfirmed).toHaveBeenCalledOnce();
  });
});
