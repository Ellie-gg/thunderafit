import { create } from "zustand";
import type { User } from "../types";

/**
 * Fase 5.5: os tokens vivem em cookies httpOnly (o backend seta e o JS não
 * consegue ler nem escrever). Este store guarda só o `user` — dado não
 * sensível (id/email/role/plano, nenhum token) — para saber quem está
 * logado sem decodificar um token que o próprio JS não enxerga mais.
 *
 * Fase 18 (Item 2): usa localStorage, NÃO sessionStorage. Causa raiz da
 * "sessão expirando cedo" relatada: o refresh_token vive 7 dias no cookie
 * httpOnly, mas o `user` estava em sessionStorage, que é apagado ao fechar a
 * aba/navegador. Ao reabrir (dentro dos 7 dias), o hydrate não achava usuário
 * e o AuthGuard mandava pro /login — parecia sessão expirada, mas o cookie
 * ainda era válido. localStorage sobrevive ao fechamento da aba, alinhando a
 * memória do frontend à vida real da sessão. Sem custo de segurança: só o
 * perfil não-sensível vai pro localStorage; os tokens seguem em cookie
 * httpOnly, inacessíveis ao JS.
 */
const STORAGE_KEY = "thunderafit_user";

interface AuthState {
  user: User | null;
  isHydrated: boolean;
  setSession: (user: User) => void;
  clearSession: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isHydrated: false,

  setSession: (user) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    set({ user });
  },

  clearSession: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ user: null });
  },

  hydrate: () => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY);
    set({
      user: raw ? (JSON.parse(raw) as User) : null,
      isHydrated: true,
    });
  },
}));
