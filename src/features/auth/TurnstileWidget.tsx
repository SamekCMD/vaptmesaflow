import { useEffect, useRef, useState } from "react";

import { ENV } from "@/lib/env";

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  remove: (widgetId: string) => void;
  render: (
    container: HTMLElement,
    options: {
      action: string;
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      sitekey: string;
      theme: "auto";
    },
  ) => string;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileLoader: Promise<TurnstileApi> | null = null;

const loadTurnstile = (): Promise<TurnstileApi> => {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileLoader) return turnstileLoader;

  turnstileLoader = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement("script");

    const handleLoad = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        turnstileLoader = null;
        reject(new Error("Turnstile API unavailable"));
      }
    };
    const handleError = () => {
      turnstileLoader = null;
      reject(new Error("Unable to load Turnstile"));
    };

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existingScript) {
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return turnstileLoader;
};

interface TurnstileWidgetProps {
  action: "login" | "signup" | "recovery";
  onToken: (token: string | null) => void;
  resetKey: number;
}

export const TurnstileWidget = ({ action, onToken, resetKey }: TurnstileWidgetProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let widgetId: string | null = null;

    setLoadFailed(false);
    onToken(null);

    if (!ENV.turnstileSiteKey) {
      setLoadFailed(true);
      return () => {
        active = false;
      };
    }

    loadTurnstile()
      .then((turnstile) => {
        if (!active || !containerRef.current) return;

        widgetId = turnstile.render(containerRef.current, {
          action,
          callback: (token) => onToken(token),
          "error-callback": () => onToken(null),
          "expired-callback": () => onToken(null),
          sitekey: ENV.turnstileSiteKey,
          theme: "auto",
        });
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });

    return () => {
      active = false;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [action, onToken, resetKey]);

  return (
    <div className="space-y-2" aria-label="Verificação de segurança">
      <div ref={containerRef} className="flex min-h-[65px] justify-center" />
      {loadFailed && (
        <p role="alert" className="text-center text-xs text-destructive">
          Não foi possível carregar a verificação de segurança. Recarregue a página.
        </p>
      )}
    </div>
  );
};
