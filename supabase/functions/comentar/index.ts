// POST { item_id, nome, email, texto, captcha } -> comentário publicado na hora.
// O e-mail nunca aparece na página. 10 comentários por IP por hora.
import { admin, captchaOk, cors, dentroDoLimite, emailValido, erro, hash, ipDe, json, lerJson, texto, uuidValido } from "../_shared/comum.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return erro(req, "Método não permitido", 405);
  const corpo = await lerJson(req);
  if (!corpo) return erro(req, "JSON inválido");

  const itemId = String(corpo.item_id ?? "");
  const nome = texto(corpo.nome, 80);
  const email = texto(corpo.email, 160).toLowerCase();
  const conteudo = String(corpo.texto ?? "").trim().slice(0, 1500);
  if (!uuidValido(itemId)) return erro(req, "Item inválido.");
  if (!nome || !emailValido(email) || conteudo.length < 2) return erro(req, "Preencha nome, e-mail e comentário.");

  const ip = ipDe(req);
  if (!(await captchaOk(corpo.captcha as string | undefined, ip))) return erro(req, "Não foi possível validar o captcha.", 403);
  const hashIp = await hash(ip);
  if (!(await dentroDoLimite("comentar", hashIp, 10, 3600))) return erro(req, "Muitos comentários em pouco tempo.", 429);

  const db = admin();
  const { data: item } = await db.from("itens").select("id,status").eq("id", itemId).maybeSingle();
  if (!item || !["aberto", "planejado", "em_construcao", "lancado"].includes(item.status)) return erro(req, "Item não encontrado.", 404);

  const { data, error } = await db.from("comentarios")
    .insert({ item_id: itemId, nome, email, texto: conteudo, do_time: false, hash_ip: hashIp })
    .select("id,item_id,nome,texto,do_time,criado_em").single();
  if (error) { console.error(error); return erro(req, "Não foi possível publicar o comentário.", 500); }
  return json(req, data);
});
