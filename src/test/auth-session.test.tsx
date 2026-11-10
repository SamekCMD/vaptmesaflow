import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  refetch: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  signInEmail: vi.fn(),
  signOut: vi.fn(),
  signUpEmail: vi.fn(),
  updateUser: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    changePassword: mocks.changePassword,
    requestPasswordReset: mocks.requestPasswordReset,
    resetPassword: mocks.resetPassword,
    signIn: { email: mocks.signInEmail },
    signOut: mocks.signOut,
    signUp: { email: mocks.signUpEmail },
    updateUser: mocks.updateUser,
    useSession: mocks.useSession,
  },
}));

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

it('logout removes private query data and pending reads without clearing public catalog or cart context',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  client.setQueryData(['vapt-private','user-1','account-bootstrap',null],{private:true});
  client.setQueryData(['vapt-private','old-user','restaurant','org','rest'],{oldPrivate:true});
  client.setQueryData(['public-catalog','some-slug'],{public:true});
  client.setQueryData(['cart','some-slug'],{items:['public-cart']});
  mocks.useSession.mockReturnValue({data:{user:{id:'user-1',name:'Teste',email:'test@example.invalid'},session:{id:'session-1',userId:'user-1',expiresAt:'2030-01-01'}},
    isPending:false,isRefetching:false,refetch:mocks.refetch});
  mocks.signOut.mockResolvedValue({error:null});mocks.refetch.mockResolvedValue(undefined);
  const scopedWrapper=({children}:{children:ReactNode})=><QueryClientProvider client={client}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
  const {result,unmount}=renderHook(()=>useAuth(),{wrapper:scopedWrapper});
  await act(async()=>{await result.current.signOut();});
  expect(client.getQueriesData({queryKey:['vapt-private']})).toEqual([]);
  expect(client.getQueryData(['public-catalog','some-slug'])).toEqual({public:true});
  expect(client.getQueryData(['cart','some-slug'])).toEqual({items:['public-cart']});unmount();client.clear();
});

describe("sessão e operações do Better Auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useSession.mockReturnValue({
      data: {
        session: {
          expiresAt: "2026-10-01T12:00:00.000Z",
          id: "session-1",
          userId: "user-1",
        },
        user: {
          email: "gestor@vapt.test",
          id: "user-1",
          name: "Gestor Vapt",
        },
      },
      error: null,
      isPending: false,
      isRefetching: false,
      refetch: mocks.refetch,
    });
    mocks.refetch.mockResolvedValue(undefined);
    mocks.requestPasswordReset.mockResolvedValue({ data: {}, error: null });
    mocks.resetPassword.mockResolvedValue({ data: {}, error: null });
    mocks.signInEmail.mockResolvedValue({ data: {}, error: null });
    mocks.signOut.mockResolvedValue({ data: {}, error: null });
    mocks.updateUser.mockResolvedValue({ data: {}, error: null });
    mocks.changePassword.mockResolvedValue({ data: {}, error: null });
  });

  it("normaliza usuário e sessão e expõe o estado de carregamento", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.loading).toBe(false);
    expect(result.current.user).toEqual({
      email: "gestor@vapt.test",
      id: "user-1",
      name: "Gestor Vapt",
    });
    expect(result.current.session).toEqual({
      expiresAt: new Date("2026-10-01T12:00:00.000Z"),
      id: "session-1",
      userId: "user-1",
    });
  });

  it("refaz a leitura da sessão após entrar e sair", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signIn("gestor@vapt.test", "senha-segura");
      await result.current.signOut();
    });

    expect(mocks.refetch).toHaveBeenCalledTimes(2);
  });

  it("solicita e conclui a redefinição de senha pelo Better Auth", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.sendPasswordReset(
        "gestor@vapt.test",
        "turnstile-reset-token",
      );
      await result.current.resetPassword("reset-token", "nova-senha-segura");
    });

    expect(mocks.requestPasswordReset).toHaveBeenCalledWith({
      email: "gestor@vapt.test",
      fetchOptions: {
        headers: { "x-captcha-response": "turnstile-reset-token" },
      },
      redirectTo: `${window.location.origin}/reset-password`,
    });
    expect(mocks.resetPassword).toHaveBeenCalledWith({
      newPassword: "nova-senha-segura",
      token: "reset-token",
    });
  });

  it("atualiza nome e senha e refaz a leitura da sessão", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.updateName("Novo Nome");
      await result.current.changePassword("senha-atual", "nova-senha");
    });

    expect(mocks.updateUser).toHaveBeenCalledWith({ name: "Novo Nome" });
    expect(mocks.changePassword).toHaveBeenCalledWith({
      currentPassword: "senha-atual",
      newPassword: "nova-senha",
      revokeOtherSessions: true,
    });
    expect(mocks.refetch).toHaveBeenCalledTimes(2);
  });

  it("retorna um Error sanitizado quando o servidor rejeita a operação", async () => {
    mocks.signInEmail.mockResolvedValue({
      data: null,
      error: {
        code: "INTERNAL_DATABASE_DETAILS",
        message: "sensitive internal database message",
        status: 500,
      },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    const operationErrors: Error[] = [];
    await act(async () => {
      const { error } = await result.current.signIn(
        "gestor@vapt.test",
        "senha-segura",
      );
      if (error) operationErrors.push(error);
    });

    expect(operationErrors).toHaveLength(1);
    const [operationError] = operationErrors;
    expect(operationError).toBeInstanceOf(Error);
    expect(operationError?.message).toBe("Não foi possível concluir a operação.");
    expect(operationError?.message).not.toContain("database");
    expect(mocks.refetch).not.toHaveBeenCalled();
  });
});
