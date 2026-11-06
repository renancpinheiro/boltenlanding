// Servidor MCP do roadmap (seção 8 do briefing). Transporte Streamable HTTP sem sessão:
// cada POST traz uma mensagem JSON-RPC e recebe a resposta em JSON (sem SSE).
// Autenticação por chave (secret ROADMAP_MCP_KEY): header "Authorization: Bearer <chave>"
// (Claude Code, n8n) ou "?chave=<chave>" na URL (conector do claude.ai, que só aceita URL).
import { admin, CATEGORIAS, cors } from "../_shared/comum.ts";
import { formatarPedido, mesmosPedidos } from "../_shared/formatar.ts";
import { type Idioma, traduzir } from "../_shared/traduzir.ts";

type Obj = Record<string, unknown>;
const VERSOES = ["2025-06-18", "2025-03-26", "2024-11-05"];
const STATUS = ["em_analise", "aberto", "planejado", "em_construcao", "lancado", "recusado", "mesclado"] as const;
const ORIGENS = ["call", "whatsapp", "slack", "mcp"] as const;
const PAGINA = "https://partners.bolten.io/pt/roadmap/";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INSTRUCOES = `Roadmap público dos parceiros da Bolten (${PAGINA}). Antes de criar_pedido, use buscar_itens: se já existe um pedido parecido, registre o interesse com votar (origem e partner_ref) em vez de criar outro. Pedidos criados aqui são formatados pela IA no padrão do time e, por padrão, entram aprovados (status aberto); use status em_analise para mandar à fila de aprovação do painel. A tradução para espanhol é automática. Categorias: ${CATEGORIAS.join(", ")}. Status: ${STATUS.join(", ")}. Origens de pedido e voto: ${ORIGENS.join(", ")}. partner_ref é o nome do parceiro ou da agência (ex.: "Match6 Marketing, call de 06/11").`;

const s = (v: unknown, max = 2000) => String(v ?? "").trim().slice(0, max);
const uuid = (v: unknown, campo: string) => { const x = s(v, 40); if (!UUID.test(x)) throw new Error(`${campo} precisa ser um UUID válido.`); return x; };
const db = admin();

// ---------- autenticação ----------
function seguro(a: string, b: string): boolean {
  if (!a.length || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
function autorizado(req: Request): boolean {
  const chave = Deno.env.get("ROADMAP_MCP_KEY") ?? "";
  if (!chave) return false;
  const h = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const q = new URL(req.url).searchParams.get("chave") ?? "";
  return seguro(h, chave) || seguro(q, chave);
}

// ---------- ferramentas ----------
const FERRAMENTAS = [
  {
    name: "buscar_itens",
    description: "Busca pedidos do roadmap por texto (sem acento, por similaridade), categoria e status. Use antes de criar_pedido para não duplicar. relevancia é só similaridade de texto (ruidosa em frases curtas): para saber se é o mesmo pedido, prefira criar_pedido, que faz a comparação semântica.",
    inputSchema: { type: "object", properties: {
      texto: { type: "string", description: "Palavras ou frase curta do pedido" },
      categoria: { type: "string", enum: [...CATEGORIAS] },
      status: { type: "array", items: { type: "string", enum: [...STATUS] }, description: "Padrão: aberto, planejado, em_construcao e em_analise" },
      limite: { type: "integer", minimum: 1, maximum: 50, default: 10 },
    } },
  },
  {
    name: "ver_item",
    description: "Detalhes de um pedido: textos em PT e ES, votos, texto original do parceiro e comentários.",
    inputSchema: { type: "object", properties: { item_id: { type: "string" } }, required: ["item_id"] },
  },
  {
    name: "criar_pedido",
    description: "Cria um pedido a partir de texto livre (de uma call, WhatsApp ou Slack). A IA formata título, descrição e categoria. Por padrão entra aprovado (aberto); com status em_analise, vai para a fila de aprovação do painel. Antes de criar, a IA compara com os pedidos existentes: se algum pede a mesma coisa, devolve criado: false com a lista em parecidos, sem criar nada; nesse caso use votar no primeiro. Para criar mesmo assim, repita com confirmar: true. Com partner_ref, registra também um voto desse parceiro.",
    inputSchema: { type: "object", properties: {
      texto: { type: "string", description: "O que o parceiro pediu, com as palavras dele" },
      origem: { type: "string", enum: [...ORIGENS], default: "mcp" },
      partner_ref: { type: "string", description: "Parceiro ou agência que pediu" },
      categoria: { type: "string", enum: [...CATEGORIAS], description: "Opcional: força a categoria em vez da sugerida pela IA" },
      idioma: { type: "string", enum: ["pt", "es"], description: "Idioma em que o parceiro escreveu, se souber" },
      ref_externa: { type: "string", description: "Referência na origem (link da mensagem do Slack, id da call)" },
      status: { type: "string", enum: ["aberto", "em_analise"], default: "aberto", description: "em_analise manda para a fila de aprovação do painel" },
      observacao: { type: "string", description: "Nota do time ou da automação guardada junto do texto original (ex.: parecido com outro pedido), visível só no painel" },
      confirmar: { type: "boolean", default: false },
    }, required: ["texto"] },
  },
  {
    name: "votar",
    description: "Registra um voto (interesse) de um parceiro num pedido existente, com origem e partner_ref.",
    inputSchema: { type: "object", properties: {
      item_id: { type: "string" }, origem: { type: "string", enum: [...ORIGENS], default: "mcp" }, partner_ref: { type: "string" },
    }, required: ["item_id"] },
  },
  {
    name: "comentar",
    description: "Publica um comentário como Time Bolten num pedido (ex.: resposta dada em call). Aparece na página na hora.",
    inputSchema: { type: "object", properties: { item_id: { type: "string" }, texto: { type: "string" } }, required: ["item_id", "texto"] },
  },
  {
    name: "listar_pendentes",
    description: "Lista os pedidos em análise (vindos da página), do mais recente ao mais antigo.",
    inputSchema: { type: "object", properties: { limite: { type: "integer", minimum: 1, maximum: 100, default: 30 } } },
  },
  {
    name: "aprovar",
    description: "Aprova (vira aberto, com tradução automática) ou recusa um pedido em análise.",
    inputSchema: { type: "object", properties: { item_id: { type: "string" }, decisao: { type: "string", enum: ["aprovar", "recusar"] } }, required: ["item_id", "decisao"] },
  },
  {
    name: "mudar_status",
    description: "Muda o status de um pedido. Ao mudar para lancado, crie o lançamento com criar_lancamento (passando item_id) para ele aparecer em Lançamentos.",
    inputSchema: { type: "object", properties: { item_id: { type: "string" }, status: { type: "string", enum: [...STATUS] } }, required: ["item_id", "status"] },
  },
  {
    name: "mesclar",
    description: "Junta um pedido duplicado em outro: os votos e comentários vão para o destino e a origem fica como mesclado.",
    inputSchema: { type: "object", properties: { origem_id: { type: "string", description: "Pedido que vai sumir" }, destino_id: { type: "string", description: "Pedido que fica" } }, required: ["origem_id", "destino_id"] },
  },
  {
    name: "criar_lancamento",
    description: "Cria um lançamento (novidade publicada). Texto em PT; o ES é traduzido automaticamente. Com item_id, liga ao pedido de origem e marca o pedido como lançado.",
    inputSchema: { type: "object", properties: {
      titulo: { type: "string" }, texto: { type: "string" }, categoria: { type: "string", enum: [...CATEGORIAS] },
      data: { type: "string", description: "AAAA-MM-DD, padrão hoje" }, item_id: { type: "string" },
      publicado: { type: "boolean", default: true }, midia_url: { type: "string", description: "URL de GIF ou MP4 já hospedado" },
    }, required: ["titulo", "texto", "categoria"] },
  },
  {
    name: "listar_lancados_do_mes",
    description: "Lançamentos publicados de um mês (base do e-mail mensal), com quantos parceiros pediram cada um.",
    inputSchema: { type: "object", properties: { mes: { type: "string", description: "AAAA-MM, padrão o mês atual" } } },
  },
];

const resumo = (i: Obj) => ({
  id: i.id, titulo: i.titulo_pt, descricao: i.descricao_pt, categoria: i.categoria, status: i.status,
  votos: i.votos ?? undefined, comentarios: i.comentarios ?? undefined, relevancia: i.relevancia ?? undefined,
  url: `${PAGINA}#pedido-${i.id}`,
});

async function buscar(texto: string | null, categoria: string | null, status: string[] | null, limite: number) {
  const { data, error } = await db.rpc("buscar_itens", { p_texto: texto, p_categoria: categoria, p_status: status, p_limite: limite });
  if (error) throw new Error(error.message);
  return (data ?? []) as Obj[];
}

async function carregarItem(id: string): Promise<Obj> {
  const { data, error } = await db.from("itens_admin").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Pedido não encontrado.");
  return data as Obj;
}

// Preenche o idioma que falta (mesma regra da Edge Function `traduzir`). Nunca derruba a chamada.
async function completarTraducao(it: Obj): Promise<boolean> {
  try {
    const de: Idioma = it.idioma_origem === "es" && it.titulo_es ? "es" : "pt";
    const vazio = de === "pt" ? !it.titulo_es || !it.descricao_es : !it.titulo_pt || !it.descricao_pt;
    const copia = de === "es" && it.titulo_pt === it.titulo_es;
    if (!vazio && !copia) return false;
    const t = await traduzir(de, de === "pt" ? "es" : "pt", "item", String(de === "pt" ? it.titulo_pt : it.titulo_es), String(de === "pt" ? it.descricao_pt : it.descricao_es));
    const campos = de === "pt" ? { titulo_es: t.titulo, descricao_es: t.texto, traducao_automatica_es: true } : { titulo_pt: t.titulo, descricao_pt: t.texto, traducao_automatica_pt: true };
    await db.from("itens").update(campos).eq("id", it.id as string);
    return true;
  } catch (e) { console.error("traducao", e); return false; }
}

async function contarVotos(id: string): Promise<number> {
  const { count } = await db.from("votos").select("id", { count: "exact", head: true }).eq("item_id", id);
  return count ?? 0;
}

async function executar(nome: string, a: Obj): Promise<unknown> {
  switch (nome) {
    case "buscar_itens": {
      const status = Array.isArray(a.status) && a.status.length ? a.status.map(String).filter((x) => (STATUS as readonly string[]).includes(x)) : ["aberto", "planejado", "em_construcao", "em_analise"];
      const cat = (CATEGORIAS as readonly string[]).includes(String(a.categoria)) ? String(a.categoria) : null;
      const itens = await buscar(s(a.texto, 300) || null, cat, status, Number(a.limite) || 10);
      return { total: itens.length, itens: itens.map(resumo) };
    }
    case "ver_item": {
      const id = uuid(a.item_id, "item_id");
      const it = await carregarItem(id);
      const { data: com } = await db.from("comentarios").select("id,nome,texto,do_time,criado_em").eq("item_id", id).is("apagado_em", null).order("criado_em");
      return { ...resumo(it), titulo_es: it.titulo_es, descricao_es: it.descricao_es, texto_original: it.texto_original, autor: it.autor_nome, origem: it.criado_por_origem, ref_externa: it.ref_externa, criado_em: it.criado_em, lancado_em: it.lancado_em, comentarios: com ?? [] };
    }
    case "criar_pedido": {
      const livre = s(a.texto);
      if (livre.length < 10) throw new Error("Descreva o pedido com pelo menos 10 caracteres.");
      const origem = (ORIGENS as readonly string[]).includes(String(a.origem)) ? String(a.origem) : "mcp";
      const f = await formatarPedido(livre, s(a.idioma, 2) || undefined);
      const categoria = (CATEGORIAS as readonly string[]).includes(String(a.categoria)) ? String(a.categoria) : f.categoria;
      if (a.confirmar !== true) {
        // Compara o título formatado e o texto do parceiro; fica com a maior relevância de cada item.
        const ativos = ["aberto", "planejado", "em_construcao", "em_analise"];
        const porId = new Map<string, Obj>();
        for (const lista of [await buscar(f.titulo, null, ativos, 5), await buscar(livre.slice(0, 200), null, ativos, 5)]) {
          for (const p of lista) { const atual = porId.get(String(p.id)); if (!atual || Number(p.relevancia) > Number(atual.relevancia)) porId.set(String(p.id), p); }
        }
        // Candidatos com alguma similaridade passam pelo julgamento da IA: só os que pedem a mesma coisa voltam.
        const candidatos = [...porId.values()].filter((p) => Number(p.relevancia) >= 0.3).sort((x, y) => Number(y.relevancia) - Number(x.relevancia)).slice(0, 6);
        const mesmos = await mesmosPedidos({ titulo: f.titulo, descricao: f.descricao, texto_original: livre }, candidatos.map((c) => ({ id: String(c.id), titulo: String(c.titulo_pt), descricao: String(c.descricao_pt) })));
        const parecidos = candidatos.filter((c) => mesmos.includes(String(c.id)));
        if (parecidos.length) {
          return { criado: false, pedido_formatado: { ...f, categoria }, parecidos: parecidos.map(resumo), dica: "A IA avaliou que estes pedidos já existentes pedem a mesma coisa. Use votar no primeiro com o partner_ref. Para criar mesmo assim, chame criar_pedido de novo com confirmar: true." };
        }
      }
      const partner = s(a.partner_ref, 80) || null;
      const status = a.status === "em_analise" ? "em_analise" : "aberto";
      const obs = s(a.observacao, 600);
      const linha: Obj = {
        categoria, status, criado_por_origem: origem, idioma_origem: f.idioma,
        texto_original: obs ? `${livre}\n\nNota: ${obs}` : livre, autor_nome: partner, ref_externa: s(a.ref_externa, 300) || null,
        titulo_pt: f.titulo, descricao_pt: f.descricao,
        titulo_es: f.idioma === "es" ? f.titulo : null, descricao_es: f.idioma === "es" ? f.descricao : null,
      };
      const { data, error } = await db.from("itens").insert(linha).select("*").single();
      if (error) throw new Error(error.message);
      if (partner) await db.from("votos").insert({ item_id: data.id, origem, partner_ref: partner });
      const traduzido = await completarTraducao(data as Obj);
      const out: Obj = { criado: true, item: resumo({ ...data, votos: partner ? 1 : 0 }), traducao_automatica: traduzido };
      if (status === "em_analise") out.dica = "O pedido está na fila de aprovação do painel e só aparece na página depois de aprovado.";
      return out;
    }
    case "votar": {
      const id = uuid(a.item_id, "item_id");
      const it = await carregarItem(id);
      if (!["aberto", "planejado", "em_construcao", "em_analise"].includes(String(it.status))) throw new Error(`Este pedido está ${it.status} e não aceita votos.`);
      const origem = (ORIGENS as readonly string[]).includes(String(a.origem)) ? String(a.origem) : "mcp";
      const { error } = await db.from("votos").insert({ item_id: id, origem, partner_ref: s(a.partner_ref, 80) || null });
      if (error) throw new Error(error.message);
      return { item: resumo({ ...it, votos: await contarVotos(id) }) };
    }
    case "comentar": {
      const id = uuid(a.item_id, "item_id");
      const texto = s(a.texto, 1500);
      if (texto.length < 2) throw new Error("Escreva o comentário.");
      await carregarItem(id);
      const { data, error } = await db.from("comentarios").insert({ item_id: id, nome: "Time Bolten", texto, do_time: true }).select("id,criado_em").single();
      if (error) throw new Error(error.message);
      return { comentario_id: data.id, criado_em: data.criado_em, url: `${PAGINA}#pedido-${id}` };
    }
    case "listar_pendentes": {
      const { data, error } = await db.from("itens_admin").select("*").eq("status", "em_analise").order("criado_em", { ascending: false }).limit(Math.min(Number(a.limite) || 30, 100));
      if (error) throw new Error(error.message);
      return { total: data.length, pendentes: data.map((i) => ({ ...resumo(i as Obj), texto_original: i.texto_original, autor: i.autor_nome, origem: i.criado_por_origem, criado_em: i.criado_em })) };
    }
    case "aprovar": {
      const id = uuid(a.item_id, "item_id");
      const it = await carregarItem(id);
      if (it.status !== "em_analise") throw new Error(`Este pedido já está ${it.status}.`);
      const status = a.decisao === "recusar" ? "recusado" : "aberto";
      const { data, error } = await db.from("itens").update({ status }).eq("id", id).select("*").single();
      if (error) throw new Error(error.message);
      const traduzido = status === "aberto" ? await completarTraducao(data as Obj) : false;
      return { item: resumo({ ...data, votos: it.votos }), traducao_automatica: traduzido };
    }
    case "mudar_status": {
      const id = uuid(a.item_id, "item_id");
      const status = String(a.status);
      if (!(STATUS as readonly string[]).includes(status)) throw new Error("Status inválido.");
      const it = await carregarItem(id);
      const campos: Obj = { status };
      if (status === "lancado" && !it.lancado_em) campos.lancado_em = new Date().toISOString();
      const { data, error } = await db.from("itens").update(campos).eq("id", id).select("*").single();
      if (error) throw new Error(error.message);
      const out: Obj = { item: resumo({ ...data, votos: it.votos }) };
      if (status === "lancado") out.dica = "Crie o lançamento com criar_lancamento passando este item_id, para aparecer na aba Lançamentos com \"Pedido por N parceiros\".";
      return out;
    }
    case "mesclar": {
      const origem = uuid(a.origem_id, "origem_id"), destino = uuid(a.destino_id, "destino_id");
      const o = await carregarItem(origem); await carregarItem(destino);
      if (o.status === "mesclado") throw new Error("A origem já foi mesclada.");
      const { error } = await db.rpc("mesclar_itens_servico", { p_origem: origem, p_destino: destino });
      if (error) throw new Error(error.message);
      const d = await carregarItem(destino);
      return { destino: resumo(d), origem_mesclada: origem };
    }
    case "criar_lancamento": {
      const titulo = s(a.titulo, 120), texto = s(a.texto, 2000), categoria = String(a.categoria);
      if (titulo.length < 3 || texto.length < 3) throw new Error("Informe título e texto.");
      if (!(CATEGORIAS as readonly string[]).includes(categoria)) throw new Error("Categoria inválida.");
      const data = /^\d{4}-\d{2}-\d{2}$/.test(s(a.data, 10)) ? s(a.data, 10) : new Date().toISOString().slice(0, 10);
      const itemId = a.item_id ? uuid(a.item_id, "item_id") : null;
      if (itemId) await carregarItem(itemId);
      const linha: Obj = { titulo_pt: titulo, texto_pt: texto, categoria, data, item_id: itemId, publicado: a.publicado !== false, midia_url: s(a.midia_url, 500) || null };
      const { data: l, error } = await db.from("lancamentos").insert(linha).select("*").single();
      if (error) throw new Error(error.message);
      let traduzido = false;
      try {
        const t = await traduzir("pt", "es", "lancamento", titulo, texto);
        await db.from("lancamentos").update({ titulo_es: t.titulo, texto_es: t.texto, traducao_automatica_es: true }).eq("id", l.id);
        traduzido = true;
      } catch (e) { console.error("traducao", e); }
      if (itemId) await db.from("itens").update({ status: "lancado", lancado_em: `${data}T12:00:00Z` }).eq("id", itemId);
      return { lancamento: { id: l.id, titulo, data, categoria, publicado: l.publicado, item_id: itemId, url: `${PAGINA}#l-${l.id}` }, traducao_automatica: traduzido };
    }
    case "listar_lancados_do_mes": {
      const mes = /^\d{4}-\d{2}$/.test(s(a.mes, 7)) ? s(a.mes, 7) : new Date().toISOString().slice(0, 7);
      const [ano, m] = mes.split("-").map(Number);
      const fim = new Date(Date.UTC(ano, m, 1)).toISOString().slice(0, 10);
      const { data, error } = await db.from("lancamentos").select("id,data,categoria,titulo_pt,texto_pt,titulo_es,texto_es,midia_url,item_id").eq("publicado", true).gte("data", `${mes}-01`).lt("data", fim).order("data", { ascending: false });
      if (error) throw new Error(error.message);
      const lista = [];
      for (const l of data) lista.push({ ...l, pedido_por: l.item_id ? await contarVotos(l.item_id) : 0, url: `${PAGINA}#l-${l.id}` });
      return { mes, total: lista.length, lancamentos: lista };
    }
    default:
      throw new Error(`Ferramenta desconhecida: ${nome}`);
  }
}

// ---------- JSON-RPC ----------
const resp = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
const erroRpc = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
const JSONH = { "Content-Type": "application/json; charset=utf-8" };

async function tratar(m: Obj): Promise<Obj | null> {
  if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") return erroRpc((m && m.id) ?? null, -32600, "Requisição inválida");
  const id = m.id, temId = id !== undefined && id !== null;
  const p = (m.params ?? {}) as Obj;
  switch (m.method) {
    case "initialize": {
      const v = typeof p.protocolVersion === "string" && VERSOES.includes(p.protocolVersion) ? p.protocolVersion : VERSOES[0];
      return resp(id, { protocolVersion: v, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "roadmap-bolten", version: "1.0.0" }, instructions: INSTRUCOES });
    }
    case "ping": return temId ? resp(id, {}) : null;
    case "tools/list": return resp(id, { tools: FERRAMENTAS });
    case "tools/call": {
      try {
        const r = await executar(String(p.name), (p.arguments ?? {}) as Obj);
        return resp(id, { content: [{ type: "text", text: JSON.stringify(r, null, 2) }], isError: false });
      } catch (e) {
        return resp(id, { content: [{ type: "text", text: `Erro: ${(e as Error).message}` }], isError: true });
      }
    }
    default:
      if (!temId || m.method.startsWith("notifications/")) return null;
      return erroRpc(id, -32601, `Método não suportado: ${m.method}`);
  }
}

Deno.serve(async (req) => {
  const base = { ...cors(req), "Access-Control-Allow-Headers": "authorization, content-type, accept, mcp-session-id, mcp-protocol-version", "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS" };
  if (req.method === "OPTIONS") return new Response(null, { headers: base });
  if (req.method === "GET") return new Response("MCP do roadmap da Bolten. Conecte um cliente MCP (Streamable HTTP) a esta URL com a chave.", { status: 405, headers: { ...base, "Content-Type": "text/plain; charset=utf-8", "Allow": "POST" } });
  if (req.method === "DELETE") return new Response(null, { status: 204, headers: base });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { ...base, "Allow": "POST" } });
  if (!autorizado(req)) {
    return new Response(JSON.stringify(erroRpc(null, -32001, "Não autorizado: informe a chave em Authorization: Bearer ou em ?chave= na URL.")), { status: 401, headers: { ...base, ...JSONH, "WWW-Authenticate": 'Bearer realm="roadmap"' } });
  }
  let corpo: unknown;
  try { corpo = await req.json(); } catch { return new Response(JSON.stringify(erroRpc(null, -32700, "JSON inválido")), { status: 400, headers: { ...base, ...JSONH } }); }
  const msgs = Array.isArray(corpo) ? corpo : [corpo];
  const saida: Obj[] = [];
  for (const m of msgs) { const r = await tratar(m as Obj); if (r) saida.push(r); }
  if (!saida.length) return new Response(null, { status: 202, headers: base });
  return new Response(JSON.stringify(Array.isArray(corpo) ? saida : saida[0]), { headers: { ...base, ...JSONH } });
});
