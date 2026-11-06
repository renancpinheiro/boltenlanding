// IA que formata o pedido no padrão do time (seção 6 do briefing).
// Usada pela Edge Function pública `formatar_pedido` e pelo MCP antes de gravar.
import Anthropic from "npm:@anthropic-ai/sdk";
import { CATEGORIAS, type Categoria } from "./comum.ts";

export interface PedidoFormatado {
  categoria: Categoria;
  titulo: string;
  descricao: string;
  idioma: "pt" | "es";
}

const SISTEMA = `Você organiza pedidos de funcionalidade enviados por parceiros (agências) da Bolten, uma plataforma white-label com CRM (funil, Kanban, contatos, tarefas), Atendimento (conversas com clientes por WhatsApp e, em breve, Instagram), Agente de IA, Redes sociais, Conversões (Meta Ads e Google Ads), Relatórios (dashboards e métricas), Pagamentos (cobrança, assinatura, repasse), Integrações (API, webhooks, ERP, outros sistemas) e configurações da Plataforma (acesso, usuários, white-label, produtos).

Receba o texto livre do parceiro e devolva JSON com:
- categoria: uma destas chaves: crm, atendimento, agente_ia, redes_sociais, conversoes, relatorios, pagamentos, integracoes, plataforma. Pedidos sobre conversas, inbox, WhatsApp ou Instagram Direct são atendimento. Pedidos sobre API, webhook ou ligar a Bolten a outro sistema são integracoes. Se não der para saber, use a mais provável.
- titulo: curto, até 60 caracteres, começando pelo que a funcionalidade faz. Sem a categoria, sem colchetes e sem ponto final. Sentence case.
- descricao: uma ou duas frases dizendo o que acontece e para quê.
- idioma: "pt" ou "es", o idioma em que o parceiro escreveu.

Regras:
- Não invente informação. Se o parceiro não disse para quê, a descrição diz só o quê.
- Escreva no mesmo idioma do parceiro (português do Brasil ou espanhol neutro da América Latina).
- Não use travessão (—) nem emoji.

Exemplos do padrão:
- "Follow up de inativação" / "Mensagem automática após falta de resposta." (categoria atendimento)
- "Reconhecimento de arquivo PDF" / "Ao receber arquivo PDF, verificar para enviarmos uma resposta padrão." (categoria agente_ia)`;

const ESQUEMA = {
  type: "object",
  properties: {
    categoria: { type: "string", enum: [...CATEGORIAS] },
    titulo: { type: "string" },
    descricao: { type: "string" },
    idioma: { type: "string", enum: ["pt", "es"] },
  },
  required: ["categoria", "titulo", "descricao", "idioma"],
  additionalProperties: false,
} as const;

export async function formatarPedido(textoLivre: string, idiomaSugerido?: string): Promise<PedidoFormatado> {
  const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
  const resposta = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 1024,
    system: SISTEMA,
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
    messages: [{
      role: "user",
      content: `Idioma da interface em que o parceiro estava: ${idiomaSugerido === "es" ? "es" : "pt"}.\n\nTexto do parceiro:\n"""\n${textoLivre}\n"""`,
    }],
  });
  if (resposta.stop_reason === "refusal") throw new Error("A IA não formatou este texto.");
  const bloco = resposta.content.find((b) => b.type === "text");
  if (!bloco || bloco.type !== "text") throw new Error("Resposta vazia da IA.");
  const j = JSON.parse(bloco.text) as PedidoFormatado;
  return {
    categoria: CATEGORIAS.includes(j.categoria) ? j.categoria : "plataforma",
    titulo: String(j.titulo).replace(/[.\s]+$/, "").slice(0, 60),
    descricao: String(j.descricao).slice(0, 600),
    idioma: j.idioma === "es" ? "es" : "pt",
  };
}

// Entre os candidatos parecidos (vindos da busca por similaridade), a IA diz quais são o MESMO pedido.
// A similaridade de trigramas em frases curtas é ruidosa; o julgamento semântico é o que evita duplicar.
export interface Candidato { id: string; titulo: string; descricao: string }

export async function mesmosPedidos(pedido: { titulo: string; descricao: string; texto_original: string }, candidatos: Candidato[]): Promise<string[]> {
  if (!candidatos.length) return [];
  const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
  const esquema = {
    type: "object",
    properties: { mesmos: { type: "array", items: { type: "string", enum: candidatos.map((c) => c.id) } } },
    required: ["mesmos"],
    additionalProperties: false,
  } as const;
  const resposta = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 300,
    system: `Você compara pedidos de funcionalidade do roadmap da Bolten (CRM, atendimento por WhatsApp, Agente de IA, redes sociais, conversões, relatórios, pagamentos, integrações, plataforma). Dado um pedido novo e uma lista de pedidos existentes, devolva os ids dos existentes que pedem a MESMA coisa, isto é, se a funcionalidade for construída, o pedido novo fica atendido. Assunto parecido, mesma área ou mesma palavra não bastam: "pagar por boleto" e "pagar por Pix" são pedidos diferentes; "follow-up automático quando o lead some" e "follow-up por inatividade" são o mesmo. Na dúvida, não inclua.`,
    output_config: { effort: "low", format: { type: "json_schema", schema: esquema } },
    messages: [{
      role: "user",
      content: `Pedido novo:\nTítulo: ${pedido.titulo}\nDescrição: ${pedido.descricao}\nTexto do parceiro: ${pedido.texto_original}\n\nExistentes:\n${candidatos.map((c) => `- id ${c.id}: ${c.titulo}. ${c.descricao}`).join("\n")}`,
    }],
  });
  const bloco = resposta.content.find((b) => b.type === "text");
  if (!bloco || bloco.type !== "text") return [];
  try { return (JSON.parse(bloco.text).mesmos as string[]).filter((id) => candidatos.some((c) => c.id === id)); } catch { return []; }
}
