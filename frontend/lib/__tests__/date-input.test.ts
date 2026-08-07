import { dateInputToIso, isoToDateInput } from "@/lib/date-input";

// Os testes rodam no fuso da máquina/CI, então em vez de fixar um offset (o
// que os tornaria verdes só no Brasil) eles asseveram a PROPRIEDADE que o bug
// M1 violava: o dia que entra é o dia que sai, no fuso local de quem olha.
describe("dateInputToIso / isoToDateInput (M1)", () => {
  it("preserva o dia escolhido ao ir e voltar", () => {
    for (const dia of ["2026-08-10", "2026-01-01", "2026-12-31", "2026-02-28"]) {
      expect(isoToDateInput(dateInputToIso(dia))).toBe(dia);
    }
  });

  it("o dia exibido por toLocaleDateString bate com o dia escolhido", () => {
    // Era exatamente aqui que o card contradizia o campo de data: o Personal
    // escolhia 10/08 e o resumo logo acima passava a exibir 09/08.
    const iso = dateInputToIso("2026-08-10");
    const exibido = new Date(iso).toLocaleDateString("pt-BR");
    const [ano, mes, dia] = "2026-08-10".split("-");
    expect(exibido).toBe(`${dia}/${mes}/${ano}`);
  });

  it("gera meia-noite LOCAL, não meia-noite UTC", () => {
    const d = new Date(dateInputToIso("2026-08-10"));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getDate()).toBe(10);
  });

  it("atravessa a virada de mês e de ano sem deslocar o dia", () => {
    expect(isoToDateInput(dateInputToIso("2026-03-01"))).toBe("2026-03-01");
    expect(isoToDateInput(dateInputToIso("2027-01-01"))).toBe("2027-01-01");
  });

  it("isoToDateInput devolve string vazia para ISO inválido, em vez de NaN", () => {
    expect(isoToDateInput("não-é-data")).toBe("");
  });

  it("zero-padding de mês e dia de um dígito", () => {
    expect(isoToDateInput(dateInputToIso("2026-04-05"))).toBe("2026-04-05");
  });
});
