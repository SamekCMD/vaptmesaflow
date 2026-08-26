import { beforeEach, describe, expect, it, vi } from "vitest";

import { paymentConnectionClient } from "@/lib/payment-client";
import { vaptApiRequest } from "@/lib/vapt-api-client";

vi.mock("@/lib/vapt-api-client", () => ({
  vaptApiRequest: vi.fn(),
}));

const mockedRequest = vi.mocked(vaptApiRequest);

describe("cliente de conexão de pagamentos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consulta o status autenticado do Mercado Pago", async () => {
    mockedRequest.mockResolvedValue({ connected: false, status: "disconnected" });

    await paymentConnectionClient.getMercadoPagoStatus("restaurant-1", "sandbox");

    expect(mockedRequest).toHaveBeenCalledWith({
      method: "GET",
      route: "/restaurants/restaurant-1/payments/mercado-pago/status",
      query: { environment: "sandbox" },
    });
  });

  it("inicia a conexão OAuth no ambiente configurado", async () => {
    mockedRequest.mockResolvedValue({ authorizationUrl: "https://auth.mercadopago.com" });

    await paymentConnectionClient.connectMercadoPago(
      "restaurant-1",
      "production",
      "https://preview.vapt.test",
    );

    expect(mockedRequest).toHaveBeenCalledWith({
      route: "/restaurants/restaurant-1/payments/mercado-pago/connect",
      body: {
        environment: "production",
        returnOrigin: "https://preview.vapt.test",
      },
    });
  });

  it("desconecta a conta usando DELETE autenticado", async () => {
    mockedRequest.mockResolvedValue({ connected: false, status: "disconnected" });

    await paymentConnectionClient.disconnectMercadoPago("restaurant-1", "production");

    expect(mockedRequest).toHaveBeenCalledWith({
      method: "DELETE",
      route: "/restaurants/restaurant-1/payments/mercado-pago/connection",
      query: { environment: "production" },
    });
  });
});
