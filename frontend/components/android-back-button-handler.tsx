"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

/**
 * Fase 95 — sem isto, o botão/gesto de voltar do Android sempre FECHA o app,
 * mesmo navegando dentro dele: é o comportamento nativo padrão do Capacitor
 * quando nenhum listener JS de `backButton` está registrado (o app precisa
 * assumir esse controle explicitamente, documentado no plugin
 * `@capacitor/app`). Web (fora do WebView nativo do Capacitor) nunca registra
 * nada aqui — a navegação normal do navegador continua intacta.
 *
 * Não precisa de nenhum botão "Voltar" dentro da UI (like alguns apps têm) —
 * o próprio gesto/botão físico do Android passa a navegar o histórico do
 * app (equivalente a `window.history.back()`, o mesmo histórico que o
 * roteador do Next.js já usa) e só MINIMIZA (não mata o processo) quando não
 * há mais pra onde voltar — convenção padrão do Android nesse ponto, e evita
 * o re-login/flash de carregamento que um `exitApp()` mais abrupto causaria
 * ao reabrir.
 */
export function AndroidBackButtonHandler() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.minimizeApp();
      }
    });

    return () => {
      listenerPromise.then((handle) => handle.remove());
    };
  }, []);

  return null;
}
