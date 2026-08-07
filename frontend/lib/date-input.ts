/**
 * Conversão entre `<input type="date">` (que fala `"YYYY-MM-DD"`, sem fuso) e
 * o `DateTime` ISO que a API guarda.
 *
 * M1 (auditoria 2026-08-06): existe porque `new Date("2026-08-10")` é
 * interpretado pelo JS como **meia-noite UTC**, não meia-noite local. Em
 * qualquer fuso a oeste de UTC — todo o Brasil, toda a América — isso volta
 * como o dia ANTERIOR ao exibir: o Personal escolhia 10/08 no lembrete de
 * pagamento e o card passava a dizer 09/08, contradizendo o campo de data
 * logo abaixo (que continuava 10/08, por ser estado local). O aluno recebia a
 * notificação de cobrança na noite do dia anterior ao escolhido.
 *
 * As duas funções são inversas e ambas passam pelo fuso LOCAL de propósito:
 * "dia 10" numa tela de cobrança significa o dia 10 de quem está olhando.
 */

/** `"2026-08-10"` → ISO da meia-noite LOCAL desse dia. */
export function dateInputToIso(value: string): string {
  // O sufixo `T00:00:00` (sem `Z`) é o que muda a interpretação de UTC pra
  // local — é a correção inteira, não um detalhe de formatação.
  return new Date(`${value}T00:00:00`).toISOString();
}

/**
 * ISO → `"YYYY-MM-DD"` no fuso LOCAL, pra preencher o `<input type="date">`.
 *
 * Deliberadamente NÃO usa `iso.slice(0, 10)`: aquele atalho lê a parte de data
 * em UTC, que num fuso a leste de UTC cai no dia anterior ao local (o espelho
 * exato do bug acima, só na outra direção).
 */
export function isoToDateInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}
