import { hasActivePremium } from "@/lib/premium";
import type { AdminUser } from "@/lib/types";

const DIA = 24 * 60 * 60 * 1000;
const futuro = () => new Date(Date.now() + 3 * DIA).toISOString();
const passado = () => new Date(Date.now() - 3 * DIA).toISOString();

// Só os campos que `hasActivePremium` lê — o resto do AdminUser é irrelevante
// aqui, e forçar o objeto inteiro só tornaria o teste frágil.
type Alvo = Parameters<typeof hasActivePremium>[0];

function aluno(over: Partial<Alvo> = {}): Alvo {
  return {
    role: "ALUNO" as AdminUser["role"],
    alunoPremiumStatus: "TRIAL",
    alunoPremiumExpiresAt: futuro(),
    planoAssinatura: "FREE",
    planoAssinaturaExpiresAt: null,
    ...over,
  };
}

function personal(over: Partial<Alvo> = {}): Alvo {
  return {
    role: "PERSONAL" as AdminUser["role"],
    alunoPremiumStatus: "NONE",
    alunoPremiumExpiresAt: null,
    planoAssinatura: "PLUS",
    planoAssinaturaExpiresAt: null,
    ...over,
  };
}

describe("hasActivePremium — ALUNO", () => {
  it("concede acesso com teste grátis vigente", () => {
    expect(hasActivePremium(aluno({ alunoPremiumStatus: "TRIAL", alunoPremiumExpiresAt: futuro() }))).toBe(true);
  });

  it("concede acesso com concessão manual (ACTIVE) vigente", () => {
    expect(hasActivePremium(aluno({ alunoPremiumStatus: "ACTIVE", alunoPremiumExpiresAt: futuro() }))).toBe(true);
  });

  it("concede acesso a CANCELED que ainda está no prazo de carência", () => {
    expect(hasActivePremium(aluno({ alunoPremiumStatus: "CANCELED", alunoPremiumExpiresAt: futuro() }))).toBe(true);
  });

  // Este é O bug reportado pelo fundador: nada reescreve o status pra NONE
  // quando o prazo vence, então olhar só o status mostrava "Premium ativo
  // (permanente)" pra sempre no painel admin.
  it("NEGA acesso quando o teste grátis já venceu, mesmo com status TRIAL preso no banco", () => {
    expect(hasActivePremium(aluno({ alunoPremiumStatus: "TRIAL", alunoPremiumExpiresAt: passado() }))).toBe(false);
  });

  it("NEGA acesso quando uma concessão ACTIVE já venceu", () => {
    expect(hasActivePremium(aluno({ alunoPremiumStatus: "ACTIVE", alunoPremiumExpiresAt: passado() }))).toBe(false);
  });

  it("NEGA acesso com status NONE, mesmo que sobre um prazo futuro no banco", () => {
    expect(hasActivePremium(aluno({ alunoPremiumStatus: "NONE", alunoPremiumExpiresAt: futuro() }))).toBe(false);
  });

  // Pro ALUNO, "sem prazo" nunca é acesso legítimo — diferente do PERSONAL.
  it("NEGA acesso quando não há prazo nenhum", () => {
    expect(hasActivePremium(aluno({ alunoPremiumStatus: "ACTIVE", alunoPremiumExpiresAt: null }))).toBe(false);
  });

  it("NEGA acesso quando o status vem ausente da API", () => {
    expect(hasActivePremium(aluno({ alunoPremiumStatus: undefined }))).toBe(false);
  });

  it("NEGA acesso com data inválida em vez de estourar", () => {
    expect(hasActivePremium(aluno({ alunoPremiumStatus: "ACTIVE", alunoPremiumExpiresAt: "não-é-data" }))).toBe(false);
  });
});

describe("hasActivePremium — PERSONAL/NUTRICIONISTA", () => {
  // Aqui prazo nulo significa PERMANENTE (assinatura real via Stripe), o
  // oposto do ALUNO — é a assimetria proposital que o helper documenta.
  it("concede acesso a plano pago sem prazo (assinatura permanente)", () => {
    expect(hasActivePremium(personal({ planoAssinatura: "PLUS", planoAssinaturaExpiresAt: null }))).toBe(true);
  });

  it("concede acesso a concessão com prazo ainda vigente", () => {
    expect(hasActivePremium(personal({ planoAssinatura: "BASE", planoAssinaturaExpiresAt: futuro() }))).toBe(true);
  });

  it("NEGA acesso quando o plano é FREE", () => {
    expect(hasActivePremium(personal({ planoAssinatura: "FREE" }))).toBe(false);
  });

  it("NEGA acesso quando a concessão com prazo já venceu", () => {
    expect(hasActivePremium(personal({ planoAssinatura: "PLUS", planoAssinaturaExpiresAt: passado() }))).toBe(false);
  });

  it("vale igual pra NUTRICIONISTA", () => {
    expect(
      hasActivePremium(personal({ role: "NUTRICIONISTA" as AdminUser["role"], planoAssinatura: "BASE" }))
    ).toBe(true);
  });
});
