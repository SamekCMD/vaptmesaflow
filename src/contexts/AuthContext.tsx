/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useLayoutEffect, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { clearOwnerRealtimeScopes, resumeOwnerRealtimeScopes } from "@/lib/realtime/client";

export type VaptUser = {
  id: string;
  email: string;
  name: string;
};

export type VaptSession = {
  id: string;
  userId: string;
  expiresAt: Date;
};

export class AuthOperationError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(error?: { status?: number; code?: string }) {
    super("Não foi possível concluir a operação.");
    this.name = "AuthOperationError";
    this.status = error?.status;
    this.code = error?.code;
  }
}

type AuthResult = { error: Error | null };

interface AuthContextValue {
  user: VaptUser | null;
  session: VaptSession | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    name: string,
    captchaToken?: string,
  ) => Promise<AuthResult>;
  signIn: (
    email: string,
    password: string,
    captchaToken?: string,
  ) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  sendPasswordReset: (
    email: string,
    captchaToken?: string,
  ) => Promise<AuthResult>;
  resetPassword: (token: string, newPassword: string) => Promise<AuthResult>;
  updateName: (name: string) => Promise<AuthResult>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<AuthResult>;
}

type BetterAuthError = {
  status?: number;
  code?: string;
} | null;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const captchaFetchOptions = (captchaToken?: string) =>
  captchaToken
    ? {
        fetchOptions: {
          headers: { "x-captcha-response": captchaToken },
        },
      }
    : {};

const toAuthResult = (error: BetterAuthError): AuthResult => ({
  error: error ? new AuthOperationError(error) : null,
});

const safeAuthResult = async (
  operation: () => Promise<{ error: BetterAuthError }>,
  onSuccess?: () => Promise<unknown>,
): Promise<AuthResult> => {
  try {
    const { error } = await operation();
    if (error) return toAuthResult(error);
    await onSuccess?.();
    return { error: null };
  } catch {
    return { error: new AuthOperationError() };
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { data, isPending, isRefetching, refetch } = authClient.useSession();

  const user: VaptUser | null = data?.user
    ? {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
      }
    : null;

  const session: VaptSession | null = data?.session
    ? {
        id: data.session.id,
        userId: data.session.userId,
        expiresAt: new Date(data.session.expiresAt),
      }
    : null;

  // Invalidate the prior identity before pending admissions can create sockets.
  useLayoutEffect(() => {
    if (user?.id && session?.id) resumeOwnerRealtimeScopes(user.id);
    return () => clearOwnerRealtimeScopes();
  }, [user?.id, session?.id]);

  const signUp = (
    email: string,
    password: string,
    name: string,
    captchaToken?: string,
  ) =>
    safeAuthResult(() =>
      authClient.signUp.email({
        email,
        password,
        name,
        callbackURL: `${window.location.origin}/login?verified=1`,
        ...captchaFetchOptions(captchaToken),
      }),
    );

  const signIn = (
    email: string,
    password: string,
    captchaToken?: string,
  ) =>
    safeAuthResult(
      () =>
        authClient.signIn.email({
          email,
          password,
          ...captchaFetchOptions(captchaToken),
        }),
      refetch,
    );

  const signOut = async () => {
    clearOwnerRealtimeScopes();
    try {
      const { error } = await authClient.signOut();
      if (error) throw new AuthOperationError(error);
      await refetch();
    } catch (error) {
      if (error instanceof AuthOperationError) throw error;
      throw new AuthOperationError();
    }
  };

  const sendPasswordReset = (email: string, captchaToken?: string) =>
    safeAuthResult(() =>
      authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
        ...captchaFetchOptions(captchaToken),
      }),
    );

  const resetPassword = (token: string, newPassword: string) =>
    safeAuthResult(() => authClient.resetPassword({ token, newPassword }));

  const updateName = (name: string) =>
    safeAuthResult(() => authClient.updateUser({ name }), refetch);

  const changePassword = (currentPassword: string, newPassword: string) =>
    safeAuthResult(
      () =>
        authClient.changePassword({
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        }),
      refetch,
    );

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading: isPending || isRefetching,
        signUp,
        signIn,
        signOut,
        sendPasswordReset,
        resetPassword,
        updateName,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
