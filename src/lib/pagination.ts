// Perf (Grupo Y, item 102) — cap defensivo, não paginação de verdade: as
// listas que usam isto (programas/treinos de um Personal ou aluno) já são
// limitadas por regras de negócio bem menores (sessões por programa) que
// nunca chegam perto do default abaixo pra um usuário real hoje — o teto
// existe só pra nunca deixar uma query virar verdadeiramente ilimitada num
// cenário fora do previsto (bug de dado, conta de estúdio grande no plano
// Plus). `page`/`pageSize` opcionais na querystring seguem o mesmo padrão já
// usado em `GET /api/admin/users`, pra manter só UM jeito de paginar no
// backend inteiro.
//
// Achado real (auditoria 2026-07-31, item F10): "conta de estúdio grande no
// plano Plus" deixou de ser hipotético — `PLUS_LIMITE_ALUNOS` é 1.000.000
// (essencialmente sem teto). Um Personal Plus com centenas de alunos, cada
// um com uma instância de programa aplicada, pode legitimamente ter mais
// linhas de `WorkoutProgram` do que este cap. Mitigado (não eliminado) nesta
// mesma auditoria: `/personal/programas` e `/personal/alunos` agora pedem
// `type: "template"`/`type: "instance"` separadamente em vez da lista mista
// de antes — templates ficam sempre bem abaixo do cap (`MAX_PERSONAL_TEMPLATES
// = 50`), e as duas listas não competem mais pelo mesmo teto. A lista de
// INSTÂNCIAS de um estúdio realmente grande (centenas de alunos simultâneos)
// ainda pode, em teoria, ultrapassar o cap — resolver isso de verdade exige
// paginação real na UI de `/personal/alunos` (scroll infinito ou páginas),
// fora do escopo desta correção. Cap elevado aqui como headroom adicional
// barato enquanto isso não for necessário.
export const DEFAULT_PAGE_SIZE = 1000;
const MAX_PAGE_SIZE = 2000;

export function parsePaginationQuery(query: { page?: string; pageSize?: string }): {
  skip: number;
  take: number;
} {
  const page = Math.max(1, query.page ? parseInt(query.page, 10) || 1 : 1);
  const pageSize = Math.min(
    Math.max(1, query.pageSize ? parseInt(query.pageSize, 10) || DEFAULT_PAGE_SIZE : DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  );
  return { skip: (page - 1) * pageSize, take: pageSize };
}
