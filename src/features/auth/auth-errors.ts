export const AUTH_RATE_LIMIT_MESSAGE =
  "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";

export const AUTH_CAPTCHA_MESSAGE =
  "Não foi possível validar o desafio de segurança. Tente novamente.";

export const RECOVERY_SUCCESS_MESSAGE =
  "Se existir uma conta para este email, você receberá as instruções de recuperação.";

export const RECOVERY_OPERATIONAL_ERROR =
  "Não foi possível enviar as instruções agora. Tente novamente mais tarde.";

type AuthErrorLike = Error & {
  code?: string;
  status?: number;
};

export const mapAuthError = (error: unknown, fallback: string): string => {
  if (!(error instanceof Error)) return fallback;

  const authError = error as AuthErrorLike;
  const code = authError.code?.toLowerCase() ?? "";
  const message = authError.message.toLowerCase();

  if (
    authError.status === 429 ||
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit"
  ) {
    return AUTH_RATE_LIMIT_MESSAGE;
  }

  if (code.includes("captcha") || message.includes("captcha")) {
    return AUTH_CAPTCHA_MESSAGE;
  }

  return fallback;
};

export const mapRecoveryRequestError = (error: unknown): string => {
  if (!(error instanceof Error)) return RECOVERY_OPERATIONAL_ERROR;

  const authError = error as AuthErrorLike;
  const code = authError.code?.toLowerCase() ?? "";
  const message = authError.message.toLowerCase();
  if (code === "user_not_found" || message.includes("user not found")) {
    return RECOVERY_SUCCESS_MESSAGE;
  }

  return mapAuthError(error, RECOVERY_OPERATIONAL_ERROR);
};
