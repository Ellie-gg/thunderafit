import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { User } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Fase 39: primeiro nome do usuário quando existe (cadastro mínimo de nome);
// contas antigas não têm esse dado, então cai pro mesmo fallback já usado na
// saudação do dashboard (prefixo do e-mail).
export function firstNameOrEmailPrefix(user: Pick<User, "name" | "email"> | null | undefined): string {
  if (user?.name?.trim()) return user.name.trim().split(/\s+/)[0];
  return user?.email.split("@")[0] ?? "Você";
}
