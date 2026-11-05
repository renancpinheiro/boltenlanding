// Camada de dados do roadmap. Lê do Supabase (views públicas, RLS) e escreve só
// pelas Edge Functions. Sem Supabase configurado, usa os dados de exemplo em memória.
(function () {
  const cfg = window.ROADMAP_CONFIG || {};
  const temSupabase = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const supa = temSupabase ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  // Identificador do navegador: UUID guardado no localStorage (1 voto por item por navegador).
  function navegadorId() {
    try {
      let v = localStorage.getItem("rm_nav");
      if (!v) { v = crypto.randomUUID(); localStorage.setItem("rm_nav", v); }
      return v;
    } catch (e) { return "00000000-0000-4000-8000-000000000000"; }
  }

  async function funcao(nome, corpo) {
    const { data, error } = await supa.functions.invoke(nome, { body: corpo });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); if (j && j.erro) msg = j.erro; } catch (e) { /* sem corpo */ }
      throw new Error(msg);
    }
    return data;
  }

  // ---------- Supabase ----------
  const remoto = {
    modo: "supabase",
    supa,
    async carregar() {
      const [itens, lanc] = await Promise.all([
        supa.from("itens_com_votos").select("*"),
        supa.from("lancamentos").select("*").eq("publicado", true).order("data", { ascending: false }),
      ]);
      if (itens.error) throw itens.error;
      if (lanc.error) throw lanc.error;
      return { itens: itens.data, lancamentos: lanc.data };
    },
    async comentarios(itemId) {
      const { data, error } = await supa.from("comentarios_publicos").select("*").eq("item_id", itemId).order("criado_em");
      if (error) throw error;
      return data;
    },
    votar: (itemId) => funcao("votar", { item_id: itemId, navegador_id: navegadorId() }),
    formatarPedido: (texto, idioma) => funcao("formatar_pedido", { texto, idioma }),
    criarPedido: (p) => funcao("criar_pedido", p),
    comentar: (c) => funcao("comentar", c),

    // Sessão do time (mesma origem do painel, então a sessão é compartilhada).
    async ehAdmin() {
      const { data: { session } } = await supa.auth.getSession();
      if (!session) return null;
      const { data } = await supa.from("admins").select("nome").eq("user_id", session.user.id).maybeSingle();
      return data ? { nome: data.nome, user_id: session.user.id } : null;
    },
    async comentarComoTime(itemId, texto, admin) {
      const { data, error } = await supa.from("comentarios")
        .insert({ item_id: itemId, nome: admin.nome, texto, do_time: true, user_id: admin.user_id })
        .select("id,item_id,nome,texto,do_time,criado_em").single();
      if (error) throw error;
      return data;
    },
    async apagarComentario(id) {
      const { error } = await supa.from("comentarios").update({ apagado_em: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    async editarItem(id, campos) {
      const { error } = await supa.from("itens").update(campos).eq("id", id);
      if (error) throw error;
    },
  };

  // ---------- Exemplo (sem banco) ----------
  const ex = window.ROADMAP_EXEMPLO || { itens: [], lancamentos: [], comentarios: [] };
  const votados = new Set();
  const local = {
    modo: "exemplo",
    supa: null,
    async carregar() { return { itens: ex.itens.map((i) => ({ ...i })), lancamentos: ex.lancamentos.map((l) => ({ ...l })) }; },
    async comentarios(itemId) { return ex.comentarios.filter((c) => c.item_id === itemId); },
    async votar(itemId) {
      const it = ex.itens.find((i) => i.id === itemId);
      if (votados.has(itemId)) { votados.delete(itemId); it.votos--; return { votou: false, votos: it.votos }; }
      votados.add(itemId); it.votos++; return { votou: true, votos: it.votos };
    },
    async formatarPedido(texto, idioma) {
      await new Promise((r) => setTimeout(r, 500));
      const s = texto.trim().replace(/\s+/g, " ");
      const n = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const chaves = { agente_ia: ["ia", "agente", "bot"], atendimento: ["whatsapp", "wpp", "disparo", "atendimento", "conversa", "inbox", "instagram"], redes_sociais: ["instagram", "post", "tiktok"], conversoes: ["conversao", "conversion", "pixel", "ads"], crm: ["lead", "funil", "card", "contato", "agenda", "calendar"], plataforma: ["dominio", "menu", "usuario", "marca"] };
      const categoria = Object.keys(chaves).find((k) => chaves[k].some((w) => n.includes(w))) || "plataforma";
      const primeira = s.split(/[.!?]/)[0];
      return { categoria, titulo: primeira.charAt(0).toUpperCase() + primeira.slice(1, 60), descricao: s.charAt(0).toUpperCase() + s.slice(1), idioma };
    },
    async criarPedido() { return { id: crypto.randomUUID(), status: "em_analise" }; },
    async comentar(c) {
      const novo = { id: crypto.randomUUID(), item_id: c.item_id, nome: c.nome, texto: c.texto, do_time: false, criado_em: new Date().toISOString() };
      ex.comentarios.push(novo);
      const it = ex.itens.find((i) => i.id === c.item_id); if (it) it.comentarios++;
      return novo;
    },
    async ehAdmin() { return null; },
    async comentarComoTime() { throw new Error("sem banco"); },
    async apagarComentario() { throw new Error("sem banco"); },
    async editarItem() { throw new Error("sem banco"); },
  };

  window.RoadmapDados = temSupabase ? remoto : local;
})();
