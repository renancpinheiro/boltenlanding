// POST { item_id, navegador_id } -> { votou: boolean, votos: number }
// Clicar marca, clicar de novo desmarca. 1 voto por item por navegador. 30 votos por IP por hora.
import { admin, cors, dentroDoLimite, erro, hash, ipDe, json, lerJson, uuidValido } from "../_shared/comum.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return erro(req, "Método não permitido", 405);
  const corpo = await lerJson(req);
  if (!corpo) return erro(req, "JSON inválido");
  const itemId = String(corpo.item_id ?? "");
  const navegadorId = String(corpo.navegador_id ?? "");
  if (!uuidValido(itemId) || !uuidValido(navegadorId)) return erro(req, "Parâmetros inválidos");

  const ip = ipDe(req);
  const [hashIp, hashNav] = await Promise.all([hash(ip), hash(navegadorId)]);
  if (!(await dentroDoLimite("votar", hashIp, 30, 3600))) return erro(req, "Muitos votos em pouco tempo. Tente mais tarde.", 429);

  const db = admin();
  const { data: item } = await db.from("itens").select("id,status").eq("id", itemId).maybeSingle();
  if (!item || !["aberto", "planejado", "em_construcao"].includes(item.status)) return erro(req, "Este item não aceita votos.", 404);

  const { data: existente } = await db.from("votos").select("id")
    .eq("item_id", itemId).eq("origem", "pagina").eq("hash_navegador", hashNav).maybeSingle();

  let votou: boolean;
  if (existente) {
    await db.from("votos").delete().eq("id", existente.id);
    votou = false;
  } else {
    const { error } = await db.from("votos").insert({ item_id: itemId, origem: "pagina", hash_navegador: hashNav, hash_ip: hashIp });
    if (error && !error.message.includes("votos_unico_navegador")) return erro(req, "Não foi possível registrar o voto.", 500);
    votou = true;
  }
  const { count } = await db.from("votos").select("id", { count: "exact", head: true }).eq("item_id", itemId);
  return json(req, { votou, votos: count ?? 0 });
});
