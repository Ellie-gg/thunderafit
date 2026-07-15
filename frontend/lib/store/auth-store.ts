import { create } from "zustand";
import type { User } from "../types";

/**
 * Fase 5.5: os tokens vivem em cookies httpOnly (o backend seta e o JS não
 * consegue ler nem escrever). Este store guarda só o `user` — dado não
 * sensível — em sessionStorage, para saber quem está logado sem precisar
 * decodificar um token que o próprio JS não enxerga mais.
 */

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
    sessionStorage.setItem("thunderafit_user", JSON.stringify(user));
    set({ user });
  },

  clearSession: () => {
    sessionStorage.removeItem("thunderafit_user");
    set({ user: null });
  },

  hydrate: () => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem("thunderafit_user");
    set({
      user: raw ? (JSON.parse(raw) as User) : null,
      isHydrated: true,
    });
  },
}));
