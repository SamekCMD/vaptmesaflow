import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FEEDBACK_REASONS,
  getRatedOrderIds,
  markOrderAsRated,
  shouldPromptForOrderFeedback,
  submitOrderFeedback,
} from "@/lib/order-feedback";
import InlineOrderRatingCard from "@/components/menu/InlineOrderRatingCard";
import FloatingActions from "@/components/menu/FloatingActions";
import { requestTableCheck } from "@/lib/public-table-sessions";

vi.mock("@/lib/vapt-api-client", () => ({
  vaptApiRequest: vi.fn(),
}));

vi.mock("@/lib/public-table-sessions", () => ({ requestTableCheck: vi.fn() }));

import { vaptApiRequest } from "@/lib/vapt-api-client";

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.mocked(vaptApiRequest).mockReset();
  vi.mocked(requestTableCheck).mockReset();
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

  it("submits only allowed feedback fields with the opaque order token", async () => {
    vi.mocked(vaptApiRequest).mockResolvedValue({
      orderId: "ord-11",
      restaurantId: "rest-1",
      rating: 5,
      reasons: ["Muito bom"],
      comment: "Muito rápido",
      createdAt: "2026-04-03T12:10:00.000Z",
    });

    const payload = await submitOrderFeedback({
      orderId: "ord-11",
      publicToken: "public-token-that-is-at-least-32-characters",
      rating: 5,
      reasons: ["Muito bom"],
      comment: "Muito rápido",
    });

    expect(payload).toEqual({
      orderId: "ord-11",
      restaurantId: "rest-1",
      rating: 5,
      reasons: ["Muito bom"],
      comment: "Muito rápido",
      createdAt: "2026-04-03T12:10:00.000Z",
    });
    expect(vaptApiRequest).toHaveBeenCalledWith({
      method: "PUT",
      route: "/public/orders/ord-11/feedback",
      requireAuth: false,
      headers: { "X-Vapt-Order-Token": "public-token-that-is-at-least-32-characters" },
      body: { rating: 5, reasons: ["Muito bom"], comment: "Muito rápido" },
    });
  });

  it("shows the inline prompt, expands on star selection, and confirms submission", async () => {
    vi.mocked(vaptApiRequest).mockResolvedValue({});

    render(
      <InlineOrderRatingCard
        orderId="ord-inline"
        publicToken="public-token-that-is-at-least-32-characters"
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

    await waitFor(() => expect(vaptApiRequest).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/avaliação enviada/i)).toBeInTheDocument();
    expect(getRatedOrderIds()).toContain("ord-inline");
  });

  it("requests the check only with access to an order linked to the session", async () => {
    vi.mocked(requestTableCheck).mockResolvedValue({
      sessionId: "session-1",
      status: "check_requested",
    });
    render(
      <FloatingActions
        sessionId="session-1"
        orderAccess={{
          orderId: "order-1",
          publicToken: "public-token-that-is-at-least-32-characters",
        }}
        primaryColor="#0ea573"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir ações de atendimento" }));
    fireEvent.click(screen.getByRole("button", { name: "Pedir a Conta" }));

    await waitFor(() => expect(requestTableCheck).toHaveBeenCalledWith(
      "session-1",
      "order-1",
      "public-token-that-is-at-least-32-characters",
    ));
  });

  it("does not expose a request-check action without an order token", () => {
    render(
      <FloatingActions
        sessionId="session-1"
        orderAccess={null}
        primaryColor="#0ea573"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir ações de atendimento" }));
    expect(screen.getByRole("button", { name: "Pedir a Conta" })).toBeDisabled();
    expect(requestTableCheck).not.toHaveBeenCalled();
  });
});
