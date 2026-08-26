import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MercadoPagoSettingsCard from "@/components/payments/MercadoPagoSettingsCard";
import { paymentConnectionClient } from "@/lib/payment-client";

vi.mock("@/lib/payment-client", () => ({
  paymentConnectionClient: {
    getMercadoPagoStatus: vi.fn(),
    connectMercadoPago: vi.fn(),
    disconnectMercadoPago: vi.fn(),
  },
}));

const mockedClient = vi.mocked(paymentConnectionClient);

describe("configuração do Mercado Pago", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("explica o benefício e oferece conexão sem expor credenciais", async () => {
    mockedClient.getMercadoPagoStatus.mockResolvedValue({
      connected: false,
      status: "disconnected",
    });

    render(
      <MercadoPagoSettingsCard
        restaurantId="10000000-0000-4000-8000-000000000001"
        environment="sandbox"
        onAuthorizationUrl={vi.fn()}
      />,
    );

    expect(await screen.findByText("Receba pagamentos online com Mercado Pago")).toBeInTheDocument();
    expect(screen.getByText(/credenciais não ficam expostas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conectar Mercado Pago" })).toBeEnabled();
    expect(screen.queryByText(/api key|access token|cpf|cnpj/i)).not.toBeInTheDocument();
  });

  it("inicia o OAuth e entrega somente a URL segura para redirecionamento", async () => {
    const onAuthorizationUrl = vi.fn();
    mockedClient.getMercadoPagoStatus.mockResolvedValue({
      connected: false,
      status: "disconnected",
    });
    mockedClient.connectMercadoPago.mockResolvedValue({
      authorizationUrl: "https://auth.mercadopago.com/authorization?state=seguro",
    });

    render(
      <MercadoPagoSettingsCard
        restaurantId="10000000-0000-4000-8000-000000000001"
        environment="sandbox"
        onAuthorizationUrl={onAuthorizationUrl}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Conectar Mercado Pago" }));

    await waitFor(() => {
      expect(mockedClient.connectMercadoPago).toHaveBeenCalledWith(
        "10000000-0000-4000-8000-000000000001",
        "sandbox",
        window.location.origin,
      );
      expect(onAuthorizationUrl).toHaveBeenCalledWith(
        "https://auth.mercadopago.com/authorization?state=seguro",
      );
    });
  });

  it("bloqueia uma URL de autorização fora do Mercado Pago", async () => {
    const onAuthorizationUrl = vi.fn();
    mockedClient.getMercadoPagoStatus.mockResolvedValue({
      connected: false,
      status: "disconnected",
    });
    mockedClient.connectMercadoPago.mockResolvedValue({
      authorizationUrl: "https://site-malicioso.example/roubar",
    });

    render(
      <MercadoPagoSettingsCard
        restaurantId="10000000-0000-4000-8000-000000000001"
        environment="sandbox"
        onAuthorizationUrl={onAuthorizationUrl}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Conectar Mercado Pago" }));

    expect(await screen.findByText("Não foi possível iniciar a conexão")).toBeInTheDocument();
    expect(onAuthorizationUrl).not.toHaveBeenCalled();
  });

  it("mostra a conta conectada e exige confirmação para desconectar", async () => {
    mockedClient.getMercadoPagoStatus.mockResolvedValue({
      connected: true,
      status: "active",
      externalAccountId: "3595396807",
      environment: "sandbox",
      tokenExpiresAt: "2027-02-02T12:00:00.000Z",
    });
    mockedClient.disconnectMercadoPago.mockResolvedValue({
      connected: false,
      status: "disconnected",
    });

    render(
      <MercadoPagoSettingsCard
        restaurantId="10000000-0000-4000-8000-000000000001"
        environment="sandbox"
        onAuthorizationUrl={vi.fn()}
      />,
    );

    expect(await screen.findByText("Mercado Pago conectado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Desconectar Mercado Pago" }));

    await waitFor(() => {
      expect(mockedClient.disconnectMercadoPago).toHaveBeenCalledWith(
        "10000000-0000-4000-8000-000000000001",
        "sandbox",
      );
      expect(screen.getByText("Mercado Pago desconectado")).toBeInTheDocument();
    });
  });

  it("orienta reconexão quando a consulta da conta falha", async () => {
    mockedClient.getMercadoPagoStatus.mockRejectedValue(new Error("indisponível"));

    render(
      <MercadoPagoSettingsCard
        restaurantId="10000000-0000-4000-8000-000000000001"
        environment="production"
        onAuthorizationUrl={vi.fn()}
      />,
    );

    expect(await screen.findByText("Não foi possível verificar a conexão")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeEnabled();
  });
});
