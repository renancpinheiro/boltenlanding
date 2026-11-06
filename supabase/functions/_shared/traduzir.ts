// IA que traduz item ou lançamento entre PT-BR e ES (seção 7 do briefing).
// Usada pela Edge Function `traduzir`, chamada pelo painel do time e, depois, pelo MCP.
import Anthropic from "npm:@anthropic-ai/sdk";

export type Idioma = "pt" | "es";

export interface Traducao {
  titulo: string;
  texto: string;
}

// Vocabulário da interface do roadmap e do app (assets/roadmap/i18n.js). A IA deve usar os mesmos termos.
const GLOSSARIO = [
  ["parceiro", "partner"], ["parceiros", "partners"], ["pedido", "solicitud"], ["pedidos", "solicitudes"],
  ["lançamento", "lanzamiento"], ["novidades", "novedades"], ["planejado", "planeado"], ["em construção", "en construcción"],
  ["lançado", "lanzado"], ["em breve", "próximamente"], ["atendimento", "atención"], ["redes sociais", "redes sociales"],
  ["conversões", "conversiones"], ["agente de IA", "agente de IA"], ["plataforma", "plataforma"], ["projeto", "proyecto"],
  ["cliente", "cliente"], ["registro", "registro"], ["arquivados", "archivados"], ["conversa", "conversación"],
  ["e-mail", "correo"], ["agenda", "calendario"], ["usuário", "usuario"], ["card", "tarjeta"], ["etiqueta", "etiqueta"],
  ["domínio", "dominio"], ["fora do horário", "fuera de horario"], ["menu lateral", "menú lateral"], ["configurações", "configuración"],
];

const NOME = { pt: "português do Brasil", es: "espanhol neutro da América Latina" } as const;

function sistema(de: Idioma, para: Idioma, tipo: "item" | "lancamento"): string {
  const glossario = GLOSSARIO.map(([pt, es]) => de === "pt" ? `- ${pt} -> ${es}` : `- ${es} -> ${pt}`).join("\n");
  return `Você traduz textos do roadmap público da Bolten, uma plataforma white-label para agências (chamadas de partners) com CRM, Atendimento, Agente de IA, Redes sociais, Conversões e Plataforma.

Traduza de ${NOME[de]} para ${NOME[para]} e devolva JSON com "titulo" e "texto".

Regras:
- Tom direto, como na interface do app. Em espanhol, trate o leitor por "tú" (ex.: "tu cliente", "puedes"), nunca por "usted" nem por "vos".
- Use exatamente o vocabulário abaixo quando o termo aparecer. Nomes de produto (Bolten, WhatsApp, Instagram, Meta Ads, Google) não mudam.
- Não acrescente nem remova informação. Não explique.
- O título fica curto${tipo === "item" ? ", com no máximo 60 caracteres" : ""}, em sentence case, sem ponto final.
- Sem travessão (—) e sem emoji.

Vocabulário:
${glossario}`;
}

const ESQUEMA = {
  type: "object",
  properties: { titulo: { type: "string" }, texto: { type: "string" } },
  required: ["titulo", "texto"],
  additionalProperties: false,
} as const;

export async function traduzir(de: Idioma, para: Idioma, tipo: "item" | "lancamento", titulo: string, texto: string): Promise<Traducao> {
  const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
  const resposta = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 1024,
    system: sistema(de, para, tipo),
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
    messages: [{ role: "user", content: `Título:\n"""\n${titulo}\n"""\n\nTexto:\n"""\n${texto}\n"""` }],
  });
  if (resposta.stop_reason === "refusal") throw new Error("A IA não traduziu este texto.");
  const bloco = resposta.content.find((b) => b.type === "text");
  if (!bloco || bloco.type !== "text") throw new Error("Resposta vazia da IA.");
  const j = JSON.parse(bloco.text) as Traducao;
  const maxTitulo = tipo === "item" ? 60 : 120;
  return {
    titulo: String(j.titulo).replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "").slice(0, maxTitulo),
    texto: String(j.texto).trim().slice(0, 2000),
  };
}
