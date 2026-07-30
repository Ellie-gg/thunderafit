// Perf (Grupo Y, item 102) — cap defensivo, não paginação de verdade: as
// listas que usam isto (programas/treinos de um Personal ou aluno) já são
// limitadas por regras de negócio bem menores (limiteAlunos, sessões por
// programa) que nunca chegam perto do default abaixo pra um usuário real
// hoje — o teto existe só pra nunca deixar uma query virar verdadeiramente
// ilimitada num cenário fora do previsto (bug de dado, conta de estúdio
// grande no plano Plus). `page`/`pageSize` opcionais na querystring seguem o
// mesmo padrão já usado em `GET /api/admin/users`, pra manter só UM jeito de
// paginar no backend inteiro.
export const DEFAULT_PAGE_SIZE = 300;
const MAX_PAGE_SIZE = 500;

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
