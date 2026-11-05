// POST { nome, email, texto_original, categoria, titulo, descricao, idioma, captcha }
// Grava a versão confirmada com status em_analise, mais o texto original. 5 por IP por dia.
import { admin, CATEGORIAS, captchaOk, cors, dentroDoLimite, emailValido, erro, hash, ipDe, json, lerJson, texto } from "../_shared/comum.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return erro(req, "Método não permitido", 405);
  const corpo = await lerJson(req);
  if (!corpo) return erro(req, "JSON inválido");

  const nome = texto(corpo.nome, 80);
  const email = texto(corpo.email, 160).toLowerCase();
  const original = String(corpo.texto_original ?? "").trim().slice(0, 2000);
  const categoria = texto(corpo.categoria, 20);
  const titulo = texto(corpo.titulo, 60).replace(/[.\s]+$/, "");
  const descricao = String(corpo.descricao ?? "").trim().slice(0, 600);
  const idioma = corpo.idioma === "es" ? "es" : "pt";
  if (!nome || !emailValido(email)) return erro(req, "Informe nome e e-mail válidos.");
  if (original.length < 10 || titulo.length < 3 || descricao.length < 3) return erro(req, "Pedido incompleto.");
  if (!(CATEGORIAS as readonly string[]).includes(categoria)) return erro(req, "Categoria inválida.");

  const ip = ipDe(req);
  if (!(await captchaOk(corpo.captcha as string | undefined, ip))) return erro(req, "Não foi possível validar o captcha.", 403);
  const hashIp = await hash(ip);
  if (!(await dentroDoLimite("criar_pedido", hashIp, 5, 86400))) return erro(req, "Limite de pedidos por dia atingido.", 429);

  const linha = {
    categoria, status: "em_analise", criado_por_origem: "pagina",
    texto_original: original, autor_nome: nome, autor_email: email,
    titulo_pt: idioma === "pt" ? titulo : null, descricao_pt: idioma === "pt" ? descricao : null,
    titulo_es: idioma === "es" ? titulo : null, descricao_es: idioma === "es" ? descricao : null,
  };
  // titulo_pt e descricao_pt são obrigatórios no banco: quando o pedido vem em ES,
  // guardamos o ES nos dois e o painel marca a tradução como automática depois.
  if (idioma === "es") { linha.titulo_pt = titulo; linha.descricao_pt = descricao; }

  const { data, error } = await admin().from("itens").insert(linha).select("id").single();
  if (error) { console.error(error); return erro(req, "Não foi possível gravar o pedido.", 500); }
  return json(req, { id: data.id, status: "em_analise" });
});
