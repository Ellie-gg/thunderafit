# Domain: `body` — histórico de medições corporais (Fase 121)

## Por que este domínio existe (e não virou parte de `anamnesis`)

`Anamnesis` é `alunoId @unique`: **um snapshot por aluno, sobrescrito** a cada
edição. É o questionário de ENTRADA (altura, objetivos, condições de saúde,
lesões) e faz sentido assim.

`BodyMeasurement` é uma **série temporal**: N linhas por aluno, nunca
sobrescritas. Antes desta fase o app media a progressão de **carga** com riqueza
(`SetLog`, `/evolucao`, recordes) e não tinha **nada** da progressão **corporal**
— que é justamente o que o aluno associa a "está funcionando".

Duas diferenças justificam o domínio separado em vez de esticar `anamnesis`:
cardinalidade (1:1 vs. 1:N) e **quem escreve** (só o aluno vs. aluno **e**
profissional).

## Modelo

`BodyMeasurement` (`prisma/schema.prisma`):

| Campo | Nota |
|---|---|
| `alunoId` | **Sem `@relation`** — o model `User` não declara relação nenhuma neste schema. A limpeza é manual em `src/lib/user-deletion.ts`. |
| `measuredAt` | Data da MEDIÇÃO, não do cadastro. Retroativo é permitido (lançar a avaliação de ontem); futuro é recusado com 400. |
| `weightKg` | Obrigatório. |
| `waistCm`, `bodyFatPercent` | Opcionais. |
| `recordedByRole` | `ALUNO` (balança de casa) vs. `PERSONAL`/`NUTRICIONISTA` (avaliação presencial). A origem muda como o número deve ser lido, então a UI marca a diferença. |
| `recordedByUserId` | Quem lançou. Sem FK: se o profissional sair, a medição do aluno permanece — só perde a atribuição (`user-deletion.ts` faz `updateMany` pra `null`, não `delete`). |

⚠️ **`alunoId` está no cascade de `src/lib/user-deletion.ts`** — foi adicionado
junto com a tabela, cumprindo a regra escrita em `src/admin/AGENTS.md` ("tabela
nova com coluna estilo `userId` PRECISA ser adicionada à mão"). Essa é
exatamente a regra que o `ClientInvite` quebrou (M4 da auditoria 2026-08-06).
Há teste cobrindo isso em `__tests__/body.test.ts`.

## Escolha dos campos (decisão de produto, não técnica)

Peso + cintura + % de gordura, decidido com o fundador nesta fase. O raciocínio,
pra não ser revisitado às cegas:

- **Só peso engana** — ganho de músculo mascara perda de gordura, que é a queixa
  clássica de quem acha que "não está funcionando".
- **Cintura** é o único perímetro com valor clínico real isolado, e é o que a
  pessoa percebe no ajuste da roupa.
- **Avaliação completa (7 campos)** foi descartada: alto risco de o aluno
  preencher uma vez e nunca mais.

Adicionar coluna anulável depois é migration aditiva simples — se for preciso
crescer, cresça; não force o usuário a preencher mais do que ele mantém.

## Autorização

`bodyService.resolveAlunoId` centraliza. Mesmo espírito do `assertAluno` do
domínio `progress` — não existe um segundo jeito de fazer isso no projeto:

- **ALUNO**: **ignora** `?alunoId=` de propósito e sempre resolve pra si mesmo.
  Um aluno nunca lê nem grava medição de outro, nem por bug de cliente. Há teste
  que cobre as duas direções.
- **PERSONAL/NUTRICIONISTA**: `?alunoId=` obrigatório + `ClientRelation`
  verificada → 403 sem vínculo. Vale pra LER **e pra ESCREVER** (a leitura
  espelha `anamnesis`; a escrita vai além dela por decisão desta fase).
- **ADMIN**: `?alunoId=` obrigatório, sem checagem de vínculo.
- **DELETE**: o próprio aluno, ou profissional vinculado ao aluno da medição.
  **404 genérico** quando não achou OU não tem acesso — nunca confirma que o id
  existe.

## Validação

Os limites em `body.service.ts` (peso 20-400kg, cintura 30-250cm, gordura
1-75%) são **tetos de sanidade, não regra clínica**: barram digitação claramente
errada (vírgula no lugar do ponto, campo trocado) antes de virar um ponto
absurdo no gráfico. Mesma filosofia de `MAX_DURATION_SECONDS` (Fase 119):
validar o impossível, não opinar sobre o plausível.

`parseNumber` aceita **vírgula** como separador decimal (`"81,37"`) — o teclado
numérico em pt-BR produz vírgula, e recusar isso seria erro de UX disfarçado de
validação. Arredonda pra 1 decimal, que é a precisão real de balança/fita.

## Endpoints

| Método | Rota | Nota |
|---|---|---|
| `GET` | `/api/body-measurements` | `?alunoId=` (profissional/admin), `?take=` (default 60, teto 200). Mais recente primeiro. |
| `POST` | `/api/body-measurements` | `?alunoId=` pro profissional lançar avaliação. 201. |
| `DELETE` | `/api/body-measurements/:id` | 404 genérico sem acesso. |

## Frontend

`frontend/components/body-measurements-card.tsx`, montado em **duas** telas com
o mesmo componente: `/evolucao` (aluno, sem `alunoId`) e
`/personal/alunos/[alunoId]` (Personal, com `alunoId`). A prop decide o texto de
subtítulo e o destino da escrita.

Usa `lib/date-input.ts` pra conversão de data — **não** `new Date("YYYY-MM-DD")`,
que é meia-noite **UTC** e voltaria como o dia anterior em todo fuso a oeste de
UTC (foi o M1 da auditoria 2026-08-06).
