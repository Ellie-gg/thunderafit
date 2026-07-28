/**
 * Fase 86 — "encaminhar convite pro WhatsApp": `wa.me` é o jeito padrão/nativo
 * de qualquer site abrir o WhatsApp com uma mensagem pré-preenchida, sem SDK
 * nem autenticação — abre o app no celular (se instalado) ou o WhatsApp Web
 * no desktop, e a pessoa só escolhe o contato. Nenhum número de destino é
 * fixado aqui (não sabemos o WhatsApp de quem vai receber o convite).
 */
export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
