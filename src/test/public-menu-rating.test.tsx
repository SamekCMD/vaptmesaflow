import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FEEDBACK_REASONS,
  buildOrderFeedbackPayload,
  getRatedOrderIds,
  markOrderAsRated,
  shouldPromptForOrderFeedback,
  submitOrderFeedback,
} from "@/lib/order-feedback";
import InlineOrderRatingCard from "@/components/menu/InlineOrderRatingCard";

const { upsertMock, ingestMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  ingestMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: upsertMock,
    })),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
    },
  },
}));

vi.mock("@/lib/n8n-client", () => ({
  n8nClient: {
    ingest: {
      orderFeedback: ingestMock,
    },
  },
  N8nClientError: class extends Error {},
}));

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
  upsertMock.mockReset();
  ingestMock.mockReset();
  upsertMock.mockResolvedValue({ error: null });
});

describe("order feedback rules", () => {
  it("prompts only for completed unrated orders", () => {
    sessionStorage.clear();

    expect(
      shouldPromptForOrderFeedback({
        orderId: "ord-1",
        status: "completed",
      }),
    ).toBe(true);

    markOrderAsRated("ord-1");

    expect(
      shouldPromptForOrderFeedback({
        orderId: "ord-1",
        status: "completed",
      }),
    ).toBe(false);

    expect(
      shouldPromptForOrderFeedback({
        orderId: "ord-2",
        status: "preparing",
      }),
    ).toBe(false);
  });

  it("stores rated order ids without duplicates", () => {
    sessionStorage.clear();

    markOrderAsRated("ord-9");
    markOrderAsRated("ord-9");

    expect(getRatedOrderIds()).toEqual(["ord-9"]);
  });

  it("exposes the supported operational reasons", () => {
    expect(FEEDBACK_REASONS).toEqual([
      "Demorou",
      "Veio certo",
      "Veio incompleto",
      "Muito bom",
      "Precisei de ajuda",
    ]);
  });

  it("builds the structured feedback payload", () => {
    expect(
      buildOrderFeedbackPayload({
        orderId: "ord-5",
        restaurantId: "rest-1",
        rating: 4,
        reasons: ["Demorou"],
        comment: "Saiu tarde",
        createdAt: "2026-04-03T12:00:00.000Z",
      }),
    ).toEqual({
      order_id: "ord-5",
      restaurant_id: "rest-1",
      rating: 4,
      reasons: ["Demorou"],
      comment: "Saiu tarde",
      created_at: "2026-04-03T12:00:00.000Z",
    });
  });

  it("submits the structured payload to the configured webhook", async () => {
    upsertMock.mockResolvedValue({ error: null });
    ingestMock.mockResolvedValue({ success: true });

    const payload = await submitOrderFeedback({
      orderId: "ord-11",
      restaurantId: "rest-1",
      rating: 5,
      reasons: ["Muito bom"],
      comment: "Muito rápido",
      createdAt: "2026-04-03T12:10:00.000Z",
    });

    expect(payload).toEqual({
      order_id: "ord-11",
      restaurant_id: "rest-1",
      rating: 5,
      reasons: ["Muito bom"],
      comment: "Muito rápido",
      created_at: "2026-04-03T12:10:00.000Z",
    });
    expect(ingestMock).toHaveBeenCalledWith(payload);
    expect(upsertMock).toHaveBeenCalledWith(payload, { onConflict: "order_id" });
  });

  it("shows the inline prompt, expands on star selection, and confirms submission", async () => {
    upsertMock.mockResolvedValue({ error: null });
    ingestMock.mockResolvedValue({ success: true });

    render(
      <InlineOrderRatingCard
        orderId="ord-inline"
        restaurantId="rest-1"
        displayId={42}
        primaryColor="#0ea573"
      />,
    );

    expect(screen.getByText(/como foi este pedido\?/i)).toBeInTheDocument();
    expect(screen.getByText(/sua opinião ajuda o restaurante a melhorar a operação/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "4 estrelas" }));

    expect(screen.getByText("Demorou")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/comentário opcional para o pedido #42/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar avaliação/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /enviar avaliação/i }));

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(ingestMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/avaliação enviada/i)).toBeInTheDocument();
    expect(getRatedOrderIds()).toContain("ord-inline");
  });
});
