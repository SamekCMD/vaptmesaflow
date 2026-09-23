import { useEffect, useRef, useState } from "react";

import { ENV } from "@/lib/env";

type TurnstileWidgetId = string;

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      appearance: "always";
      language: string;
      size: "flexible";
      theme: "auto";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
    },
  ) => TurnstileWidgetId;
  remove: (widgetId: TurnstileWidgetId) => void;
  reset: (widgetId: TurnstileWidgetId) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface TurnstileWidgetProps {
  action: "login" | "signup";
  onTokenChange: (token: string | null) => void;
  resetKey?: number;
}

const SCRIPT_ID = "cloudflare-turnstile-script";
let turnstileScriptPromise: Promise<TurnstileApi> | null = null;

const loadTurnstile = (): Promise<TurnstileApi> => {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");

    const handleLoad = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Turnstile carregou sem disponibilizar a API"));
    };
    const handleError = () => reject(new Error("Não foi possível carregar o Turnstile"));

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return turnstileScriptPromise;
};

const TurnstileWidget = ({ action, onTokenChange, resetKey = 0 }: TurnstileWidgetProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null);
  const previousResetKey = useRef(resetKey);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: ENV.turnstileSiteKey,
          action,
          appearance: "always",
          language: "pt-BR",
          size: "flexible",
          theme: "auto",
          callback: (token) => onTokenChange(token),
          "error-callback": () => onTokenChange(null),
          "expired-callback": () => onTokenChange(null),
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, onTokenChange]);

  useEffect(() => {
    if (previousResetKey.current === resetKey) return;
    previousResetKey.current = resetKey;
    onTokenChange(null);
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [onTokenChange, resetKey]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        aria-label="Verificação anti-robô"
        className="min-h-[65px] w-full overflow-x-auto"
      />
      {loadError && (
        <p className="text-xs text-destructive" role="alert">
          Não foi possível carregar a verificação. Atualize a página e tente novamente.
        </p>
      )}
    </div>
  );
};

export default TurnstileWidget;
