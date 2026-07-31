"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

// Fase 77 — SSO Google via Google Identity Services (script vanilla, sem
// dependência npm nova no client) — carrega o script uma única vez mesmo
// que o componente monte de novo (troca de step na tela de login), e
// devolve o ID token (JWT) pro callback verificar no backend.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
let scriptLoadPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services script."));
    document.head.appendChild(script);
  });
  // A10 (auditoria 2026-07-31): sem isso, uma falha de carregamento (DNS
  // bloqueado, bloqueador de anúncios) ficava guardada pra sempre — a
  // promessa REJEITADA nunca era limpa, então nenhuma remontagem do
  // componente (ex: trocar de step em /login e voltar) tentava carregar de
  // novo, e o rejection não tratado no `.then` do efeito virava um erro
  // silencioso no console sem nenhum aviso pro usuário.
  scriptLoadPromise.catch(() => {
    scriptLoadPromise = null;
  });
  return scriptLoadPromise;
}

export function GoogleSignInButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const t = useTranslations("login");
  const containerId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  // `initialize` só roda 1x (por client ID) — a ref garante que o callback
  // sempre chama a versão MAIS RECENTE de onCredential, mesmo que o pai
  // passe uma função nova a cada render (o `initialize` inicial não seria
  // re-executado pra pegar essa nova referência).
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;
  // Fase 77: sem client ID configurado (ambiente local/dev sem .env
  // preenchido ainda), o componente simplesmente não renderiza nada em vez
  // de quebrar a tela de login inteira.
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setLoadFailed(false);

    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => onCredentialRef.current(response.credential),
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          width: 320,
          text: "continue_with",
        });
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId) return null;

  if (loadFailed) {
    return <p className="text-center text-xs text-muted">{t("googleLoadError")}</p>;
  }

  return <div id={containerId} ref={containerRef} className="flex justify-center" />;
}
