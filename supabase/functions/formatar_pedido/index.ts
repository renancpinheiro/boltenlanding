// POST { texto, idioma } -> { categoria, titulo, descricao, idioma }
// Não grava nada. 20 chamadas por IP por hora.
import { cors, dentroDoLimite, erro, hash, ipDe, json, lerJson, texto } from "../_shared/comum.ts";
import { formatarPedido } from "../_shared/formatar.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return erro(req, "Método não permitido", 405);
  const corpo = await lerJson(req);
  if (!corpo) return erro(req, "JSON inválido");
  const livre = String(corpo.texto ?? "").trim().slice(0, 2000);
  if (livre.length < 10) return erro(req, "Conte um pouco mais sobre o que você precisa.");

  const hashIp = await hash(ipDe(req));
  if (!(await dentroDoLimite("formatar", hashIp, 20, 3600))) return erro(req, "Muitas tentativas. Tente mais tarde.", 429);

  try {
    const f = await formatarPedido(livre, texto(corpo.idioma, 2));
    return json(req, f);
  } catch (e) {
    console.error(e);
    return erro(req, "Não foi possível organizar o texto agora. Tente de novo.", 502);
  }
});
