// Utilidades compartilhadas pelas Edge Functions públicas do roadmap.
import { createClient } from "npm:@supabase/supabase-js@2";

export const CATEGORIAS = ["crm", "whatsapp", "agente_ia", "redes_sociais", "conversoes", "plataforma"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

const ORIGENS_PERMITIDAS = (Deno.env.get("ORIGENS_PERMITIDAS") ?? "https://partners.bolten.io")
  .split(",").map((s) => s.trim()).filter(Boolean);

export function cors(req: Request): Record<string, string> {
  const origem = req.headers.get("origin") ?? "";
  const ok = ORIGENS_PERMITIDAS.includes("*") || ORIGENS_PERMITIDAS.includes(origem) ||
    /^http:\/\/localhost(:\d+)?$/.test(origem) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origem);
  return {
    "Access-Control-Allow-Origin": ok ? origem : ORIGENS_PERMITIDAS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(req: Request, corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

export function erro(req: Request, mensagem: string, status = 400): Response {
  return json(req, { erro: mensagem }, status);
}

// Cliente com service role: só as funções escrevem no banco.
export function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY"))!,
    { auth: { persistSession: false } },
  );
}

export function ipDe(req: Request): string {
  const xf = req.headers.get("x-forwarded-for") ?? "";
  return xf.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "0.0.0.0";
}

// SHA-256 com sal em secret. O valor em claro nunca é gravado (LGPD).
export async function hash(valor: string): Promise<string> {
  const sal = Deno.env.get("HASH_SALT");
  if (!sal) throw new Error("HASH_SALT não configurado");
  const bytes = new TextEncoder().encode(`${sal}:${valor}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Limite por IP: devolve true quando ainda está dentro do limite.
export async function dentroDoLimite(acao: string, hashIp: string, maximo: number, segundos: number): Promise<boolean> {
  const janela = Math.floor(Date.now() / 1000 / segundos);
  const { data, error } = await admin().rpc("incrementar_limite", {
    p_chave: `${acao}:${hashIp}:${janela}`,
    p_segundos: segundos,
  });
  if (error) throw error;
  return (data as number) <= maximo;
}

// Cloudflare Turnstile (captcha invisível). Se o secret não existir, não exige token.
export async function captchaOk(token: string | undefined, ip: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET");
  if (!secret) return true;
  if (!token) return false;
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  const j = await r.json().catch(() => ({ success: false }));
  return j.success === true;
}

export function texto(v: unknown, max: number): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function emailValido(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 160;
}

export function uuidValido(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function lerJson(req: Request): Promise<Record<string, unknown> | null> {
  try { return await req.json(); } catch { return null; }
}
