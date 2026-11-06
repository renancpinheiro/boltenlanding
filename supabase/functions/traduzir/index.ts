// POST { tipo: "item" | "lancamento", id, forcar? } -> { traduzido: boolean, campos? }
// Só o time (quem está em `admins`) chama, com a própria sessão. Preenche o idioma que falta
// e marca traducao_automatica_* até alguém revisar. Com forcar = true, refaz mesmo já preenchido.
import { admin, cors, erro, json, lerJson, uuidValido } from "../_shared/comum.ts";
import { type Idioma, traduzir } from "../_shared/traduzir.ts";

const outro = (i: Idioma): Idioma => (i === "pt" ? "es" : "pt");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return erro(req, "Método não permitido", 405);

  // Sessão do admin: o token vem no Authorization e é validado no Auth.
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return erro(req, "Faça login no painel.", 401);
  const db = admin();
  const { data: { user }, error: errUser } = await db.auth.getUser(token);
  if (errUser || !user) return erro(req, "Sessão inválida. Entre de novo no painel.", 401);
  const { data: ehAdmin } = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!ehAdmin) return erro(req, "Este e-mail não está na lista do time.", 403);

  const corpo = await lerJson(req);
  if (!corpo) return erro(req, "JSON inválido");
  const tipo = corpo.tipo === "lancamento" ? "lancamento" : corpo.tipo === "item" ? "item" : null;
  const id = String(corpo.id ?? "");
  const forcar = corpo.forcar === true;
  if (!tipo || !uuidValido(id)) return erro(req, "Informe tipo (item ou lancamento) e id.");

  try {
    if (tipo === "item") {
      const { data: it } = await db.from("itens").select("*").eq("id", id).maybeSingle();
      if (!it) return erro(req, "Item não encontrado.", 404);
      const de: Idioma = it.idioma_origem === "es" && it.titulo_es ? "es" : "pt";
      const para = outro(de);
      const vazio = de === "pt" ? !it.titulo_es || !it.descricao_es : !it.titulo_pt || !it.descricao_pt;
      // Pedido em ES entra com o ES copiado para o PT (o PT é obrigatório no banco).
      const copia = de === "es" && it.titulo_pt === it.titulo_es && it.descricao_pt === it.descricao_es;
      const marcado = de === "pt" ? it.traducao_automatica_es : it.traducao_automatica_pt;
      if (!forcar && !vazio && !copia && !marcado) return json(req, { traduzido: false });

      const t = await traduzir(de, para, "item", de === "pt" ? it.titulo_pt : it.titulo_es, de === "pt" ? it.descricao_pt : it.descricao_es);
      const campos = para === "es"
        ? { titulo_es: t.titulo, descricao_es: t.texto, traducao_automatica_es: true }
        : { titulo_pt: t.titulo, descricao_pt: t.texto, traducao_automatica_pt: true };
      const { error } = await db.from("itens").update(campos).eq("id", id);
      if (error) throw error;
      return json(req, { traduzido: true, de, para, campos });
    }

    const { data: l } = await db.from("lancamentos").select("*").eq("id", id).maybeSingle();
    if (!l) return erro(req, "Lançamento não encontrado.", 404);
    if (!forcar && l.titulo_es && l.texto_es && !l.traducao_automatica_es) return json(req, { traduzido: false });
    const t = await traduzir("pt", "es", "lancamento", l.titulo_pt, l.texto_pt);
    const campos = { titulo_es: t.titulo, texto_es: t.texto, traducao_automatica_es: true };
    const { error } = await db.from("lancamentos").update(campos).eq("id", id);
    if (error) throw error;
    return json(req, { traduzido: true, de: "pt", para: "es", campos });
  } catch (e) {
    console.error(e);
    return erro(req, "Não foi possível traduzir agora. Tente de novo.", 502);
  }
});
