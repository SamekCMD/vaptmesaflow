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

const upsertMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: upsertMock,
    })),
  },
}));

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
  upsertMock.mockReset();
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
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const payload = await submitOrderFeedback({
      orderId: "ord-11",
      restaurantId: "rest-1",
      rating: 5,
      reasons: ["Muito bom"],
      comment: "Muito rápido",
      createdAt: "2026-04-03T12:10:00.000Z",
      feedbackWebhookUrl: "https://example.com/feedback",
    });

    expect(payload).toEqual({
      order_id: "ord-11",
      restaurant_id: "rest-1",
      rating: 5,
      reasons: ["Muito bom"],
      comment: "Muito rápido",
      created_at: "2026-04-03T12:10:00.000Z",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/feedback",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(payload);
    expect(upsertMock).toHaveBeenCalledWith(payload, { onConflict: "order_id" });
  });

  it("shows the inline prompt, expands on star selection, and confirms submission", async () => {
    upsertMock.mockResolvedValue({ error: null });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <InlineOrderRatingCard
        orderId="ord-inline"
        restaurantId="rest-1"
        displayId={42}
        primaryColor="#0ea573"
        feedbackWebhookUrl="https://example.com/feedback"
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
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/avaliação enviada/i)).toBeInTheDocument();
    expect(getRatedOrderIds()).toContain("ord-inline");
  });
});
