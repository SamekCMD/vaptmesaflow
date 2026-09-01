import { supabase } from "@/lib/supabase";

export const PENDING_SIGNUP_EMAIL_KEY = "vapt_pending_signup_email";

export const normalizeAuthEmail = (email: string) => email.trim().toLowerCase();

const getSignupConfirmationRedirectUrl = () =>
  `${window.location.origin}/onboarding`;

export const getPendingSignupEmail = () =>
  sessionStorage.getItem(PENDING_SIGNUP_EMAIL_KEY) ?? "";

export const setPendingSignupEmail = (email: string) =>
  sessionStorage.setItem(PENDING_SIGNUP_EMAIL_KEY, normalizeAuthEmail(email));

export const clearPendingSignupEmail = () =>
  sessionStorage.removeItem(PENDING_SIGNUP_EMAIL_KEY);

export const authService = {
  signUp: (email: string, password: string, fullName: string, captchaToken: string) =>
    supabase.auth.signUp({
      email: normalizeAuthEmail(email),
      password,
      options: {
        captchaToken,
        data: { full_name: fullName.trim() },
        emailRedirectTo: getSignupConfirmationRedirectUrl(),
      },
    }),

  verifySignupOtp: (email: string, token: string) =>
    supabase.auth.verifyOtp({
      email: normalizeAuthEmail(email),
      token: token.trim(),
      type: "signup",
    }),

  resendSignupOtp: (email: string, captchaToken: string) =>
    supabase.auth.resend({
      type: "signup",
      email: normalizeAuthEmail(email),
      options: {
        captchaToken,
        emailRedirectTo: getSignupConfirmationRedirectUrl(),
      },
    }),

  signIn: (email: string, password: string, captchaToken: string) =>
    supabase.auth.signInWithPassword({
      email: normalizeAuthEmail(email),
      password,
      options: { captchaToken },
    }),

  requestPasswordReset: (email: string, captchaToken: string) =>
    supabase.auth.resetPasswordForEmail(normalizeAuthEmail(email), {
      captchaToken,
      redirectTo: `${window.location.origin}/reset-password`,
    }),

  updatePassword: (password: string) => supabase.auth.updateUser({ password }),

  signOut: () => supabase.auth.signOut(),
};
