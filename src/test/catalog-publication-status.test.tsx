import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogPublicationStatus } from "@/components/menu/CatalogPublicationStatus";
import type { CommandReceipt } from "@/lib/catalog/contracts";
const receipt: CommandReceipt = { operationId: "11111111-1111-4111-8111-111111111111", restaurantId: "22222222-2222-4222-8222-222222222222",
  phase: "committed", version: "12", committed: true, retryable: true };
afterEach(cleanup);
describe("owner publication feedback", () => {
  it("lost response is uncertain, not accepted or published; only manual verification is offered", () => {
    render(<CatalogPublicationStatus receipt={null} authenticated busy={false} onCheck={() => {}} onRetry={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Confirmação pendente");
    expect(screen.getByRole("button", { name: "Verificar publicação" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Tentar publicação novamente" })).not.toBeInTheDocument();
  });
  it("ownerSeesCommittedNotReady: only user actions read/retry, never labels accepted as published", () => {
    const check = vi.fn(); const retry = vi.fn();
    const view = render(<CatalogPublicationStatus receipt={receipt} authenticated busy={false} onCheck={check} onRetry={retry} />);
    expect(screen.getByRole("status")).toHaveTextContent("Gravada; publicação pendente"); expect(screen.queryByText("Publicada")).not.toBeInTheDocument();
    expect(check).not.toHaveBeenCalled(); expect(retry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Verificar publicação" })); expect(check).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Tentar publicação novamente" })); expect(retry).toHaveBeenCalledOnce();
    view.rerender(<CatalogPublicationStatus receipt={{ ...receipt, phase: "ready", retryable: false }} authenticated busy={false} onCheck={check} onRetry={retry} />);
    expect(screen.getByRole("status")).toHaveTextContent("Publicada"); expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("blocked/logout/busy retain honest status but cannot auto-resend or invoke disabled actions", () => {
    const retry = vi.fn(); const check = vi.fn();
    const view = render(<CatalogPublicationStatus receipt={{ ...receipt, phase: "blocked" }} authenticated={false} busy={false} onCheck={check} onRetry={retry} />);
    expect(screen.getByRole("status")).toHaveTextContent("Publicação bloqueada");
    for (const button of screen.getAllByRole("button")) { expect(button).toBeDisabled(); fireEvent.click(button); }
    expect(retry).not.toHaveBeenCalled(); expect(check).not.toHaveBeenCalled();
    view.rerender(<CatalogPublicationStatus receipt={{ ...receipt, phase: "accepted", committed: false, version: null }} authenticated busy onCheck={check} onRetry={retry} />);
    expect(screen.getByRole("status")).toHaveTextContent("Alteração aceita"); expect(screen.getByRole("button", { name: "Verificar publicação" })).toBeDisabled();
  });
  it("private-only ready says saved, not that a catalog version was published", () => {
    render(<CatalogPublicationStatus receipt={{ ...receipt, phase: "ready", version: null, retryable: false }} authenticated busy={false} onCheck={() => {}} onRetry={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Alteração salva"); expect(screen.queryByText("Publicada")).not.toBeInTheDocument();
  });
});
