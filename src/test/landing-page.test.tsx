import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "@/pages/Index";

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: MockIntersectionObserver,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockReducedMotion() {
  vi.stubGlobal(
    "matchMedia",
    ((query: string) =>
      ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent() {
          return false;
        },
      }) as unknown as MediaQueryList)
  );
}

describe("landing page copy", () => {
  it("renders the operational cockpit hero copy", () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Index />
        </MemoryRouter>
      </AuthProvider>
    );

    const hero = screen.getByText("Cockpit operacional em tempo real").closest("section");

    expect(hero).not.toBeNull();
    const cockpit = within(hero as HTMLElement);

    expect(cockpit.getByText("Cockpit operacional em tempo real")).toBeInTheDocument();
    expect(cockpit.getByRole("heading", { name: "Seu restaurante no piloto automático." })).toBeInTheDocument();
    expect(cockpit.getByRole("link", { name: "Começar Agora" })).toBeInTheDocument();
    expect(cockpit.getByRole("link", { name: "Ver cockpit" })).toBeInTheDocument();
    expect(cockpit.getByText("Pedidos abertos")).toBeInTheDocument();
    expect(cockpit.getByText("Receita por hora")).toBeInTheDocument();
    expect(cockpit.getByText("Fila de preparo")).toBeInTheDocument();
  });

  it("renders the operational story blocks", () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Index />
        </MemoryRouter>
      </AuthProvider>
    );

    const features = screen
      .getByRole("heading", {
        name: "Da mesa ao fechamento, o fluxo fica legível",
      })
      .closest("section");

    expect(features).not.toBeNull();
    const story = within(features as HTMLElement);

    expect(story.getByRole("heading", { name: "Cardápio e mesas" })).toBeInTheDocument();
    expect(story.getByRole("heading", { name: "Cozinha" })).toBeInTheDocument();
    expect(story.getByRole("heading", { name: "Caixa" })).toBeInTheDocument();
    expect(story.getByRole("heading", { name: "Gestão" })).toBeInTheDocument();
    expect(story.getByText("Menos atrito na mesa.")).toBeInTheDocument();
    expect(story.getByText("Menos atraso no pico.")).toBeInTheDocument();
    expect(story.getByText("Fechamento mais rápido.")).toBeInTheDocument();
    expect(story.getByText("Decisão mais rápida.")).toBeInTheDocument();
  });

  it("renders the operational proof section", () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Index />
        </MemoryRouter>
      </AuthProvider>
    );

    const proof = screen
      .getByRole("heading", { name: "Confiança que aparece no salão, na cozinha e no caixa" })
      .closest("section");

    expect(proof).not.toBeNull();
    const trust = within(proof as HTMLElement);

    expect(trust.getByText("Prova operacional em campo")).toBeInTheDocument();
    expect(trust.getByText("40% mais rápido")).toBeInTheDocument();
    expect(trust.getByText("98% rastreados")).toBeInTheDocument();
    expect(trust.getByText("12 min")).toBeInTheDocument();
    expect(trust.getByText("Sinais de operação")).toBeInTheDocument();
    expect(trust.getByText("Salão")).toBeInTheDocument();
    expect(trust.getByText("Cozinha")).toBeInTheDocument();
    expect(trust.getByText("Caixa")).toBeInTheDocument();
    expect(trust.getByText("Bistrô du Chef")).toBeInTheDocument();
    expect(trust.getByText("Sem promessa genérica: o salão enxerga, a cozinha prioriza e o caixa fecha com clareza.")).toBeInTheDocument();
  });

  it("renders the pricing, faq, and footer trust copy", () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Index />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByRole("heading", { name: "Planos para rodar sem atrito" })).toBeInTheDocument();
    expect(screen.getByText("3 dias grátis - sem fidelidade - suporte humano")).toBeInTheDocument();
    expect(screen.getByText("Dúvidas de operação")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Respostas para entrar em produção sem surpresa" })).toBeInTheDocument();
    expect(screen.getByText("Operação pronta para ganhar clareza?")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Comece com 3 dias grátis e veja o fluxo inteiro em um só painel" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar conta grátis" })).toBeInTheDocument();
    expect(screen.getByText("Sem fidelidade. Sem cartão no teste. Sem ruído entre salão, cozinha e caixa.")).toBeInTheDocument();
  });

  it("avoids hidden entrance states when reduced motion is preferred", async () => {
    mockReducedMotion();

    render(
      <AuthProvider>
        <MemoryRouter>
          <Index />
        </MemoryRouter>
      </AuthProvider>
    );

    const hero = screen.getByText("Cockpit operacional em tempo real").closest("section");

    expect(hero).not.toBeNull();
    await waitFor(() => {
      expect(hero?.querySelector('[style*="translateY("]')).toBeNull();
    });
  });
});
