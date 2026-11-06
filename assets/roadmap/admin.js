// Painel do time: login por link mágico, aprovação de pedidos, edição de itens e lançamentos.
// Lê e escreve direto no Supabase com a sessão do admin (RLS libera só quem está em `admins`).
(function () {
  const cfg = window.ROADMAP_CONFIG || {}, CATS = window.ROADMAP_CATS;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const STATUS = { em_analise: "Em análise", aberto: "Aberto", planejado: "Planejado", em_construcao: "Em construção", lancado: "Lançado", recusado: "Recusado", mesclado: "Mesclado" };
  const ORIGEM = { pagina: "pela página", call: "em call", whatsapp: "pelo WhatsApp", slack: "pelo Slack", fider: "do Fider", notion: "do Notion", mcp: "pelo MCP" };
  const catEl = (c) => `<span class="cat c-${c}">${CATS[c] ? CATS[c].pt : esc(c)}</span>`;
  const pill = (s) => `<span class="status-pill ${s === "em_construcao" || s === "em_analise" ? "status-pill-warning" : s === "lancado" ? "status-pill-success" : s === "recusado" ? "status-pill-danger" : ""}">${STATUS[s] || s}</span>`;
  const fmt = (d) => new Date(d).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }).replace(".", "");
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const auto = (f) => f ? `<span class="auto">Tradução automática</span>` : "";
  const emEs = (i) => i.idioma_origem === "es" ? `<span class="auto">Escrito em espanhol</span>` : "";
  const isVideo = (u) => /\.(mp4|webm)(\?|$)/i.test(u || "");
  function toast(msg) { const t = $("#toast"); t.innerHTML = `<div class="toast"><div class="toast-row"><span>${esc(msg)}</span></div></div>`; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 2600); }
  function modal(title, body, foot) { $("#mt").textContent = title; $("#mbody").innerHTML = body; $("#mfoot").innerHTML = foot; $("#mb").hidden = $("#md").hidden = false; }
  function closeModal() { $("#mb").hidden = $("#md").hidden = true; }
  const busy = (b, on) => { if (b) b.disabled = on; };

  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) { $("#v-sem-banco").hidden = false; return; }
  const supa = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  let admin = null, ITENS = [], LANC = [], tab = "aprovacao", filtro = "ativos";

  // ---------- sessão ----------
  async function iniciar() {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) { mostrar("login"); return; }
    const { data } = await supa.from("admins").select("nome").eq("user_id", session.user.id).maybeSingle();
    if (!data) { await supa.auth.signOut(); mostrar("login"); $("#login-msg").textContent = "Este e-mail não está na lista do time."; return; }
    admin = { nome: data.nome, user_id: session.user.id, email: session.user.email };
    $("#who").hidden = false; $("#who-nome").textContent = admin.nome;
    mostrar("painel");
    await carregar();
  }
  function mostrar(v) { ["login", "painel"].forEach((k) => { $("#v-" + k).hidden = k !== v; }); }
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#login-email").value.trim(), b = e.target.querySelector("button");
    busy(b, true); $("#login-msg").textContent = "Enviando";
    const { error } = await supa.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true } });
    busy(b, false);
    $("#login-msg").textContent = error ? "Não foi possível enviar o link: " + error.message : "Link enviado. Confira o seu e-mail e abra o link neste navegador.";
  });
  $("#sair").addEventListener("click", async () => { await supa.auth.signOut(); location.reload(); });
  supa.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN" && !admin) iniciar(); });

  // ---------- dados ----------
  async function carregar() {
    const [a, b] = await Promise.all([
      supa.from("itens_admin").select("*").order("criado_em", { ascending: false }),
      supa.from("lancamentos").select("*").order("data", { ascending: false }),
    ]);
    if (a.error || b.error) { toast("Não foi possível carregar: " + (a.error || b.error).message); return; }
    ITENS = a.data; LANC = b.data;
    render();
  }
  const pendentes = () => ITENS.filter((i) => i.status === "em_analise");
  // Pede à Edge Function `traduzir` para preencher o idioma que falta (ou refazer, com forcar).
  async function traduzir(tipo, id, forcar) {
    const { data, error } = await supa.functions.invoke("traduzir", { body: { tipo, id, forcar: !!forcar } });
    if (error) { let msg = error.message; try { msg = (await error.context.json()).erro || msg; } catch (_) {} toast("Tradução automática falhou: " + msg); return false; }
    if (data && data.traduzido) toast(data.para === "pt" ? "Tradução automática para PT pronta" : "Tradução automática para ES pronta");
    return !!(data && data.traduzido);
  }
  function parecido(p) {
    const words = norm(p.titulo_pt + " " + p.descricao_pt).split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    const hits = ITENS.filter((i) => i.id !== p.id && ["aberto", "planejado", "em_construcao"].includes(i.status))
      .map((i) => ({ i, s: words.filter((w) => norm([i.titulo_pt, i.descricao_pt, i.titulo_es, i.descricao_es].join(" ")).includes(w)).length }))
      .filter((h) => h.s >= 2).sort((a, b) => b.s - a.s);
    return hits.length ? hits[0].i : null;
  }

  // ---------- render ----------
  function render() { renderTabs(); renderPendentes(); renderItens(); renderLanc(); }
  function renderTabs() {
    const n = pendentes().length;
    const keys = [["aprovacao", "Aprovação"], ["itens", "Itens"], ["lancamentos", "Lançamentos"]];
    $("#tabs").innerHTML = keys.map(([k, l]) => `<a class="tab" role="tab" href="#${k}" data-tab="${k}" aria-selected="${k === tab}" tabindex="0">${l}${k === "aprovacao" && n ? `<span class="count">${n}</span>` : ""}</a>`).join("");
    keys.forEach(([k]) => { $("#p-" + k).hidden = k !== tab; });
  }
  function renderPendentes() {
    const ps = pendentes();
    $("#pendingList").innerHTML = ps.length ? ps.map((p) => { const dup = parecido(p); return `<div class="prow"><div><h4>${esc(p.titulo_pt)}${emEs(p)}</h4><p class="hint">${esc(p.descricao_pt)}</p>
      ${p.texto_original ? `<p class="orig"><b>Texto original</b>${esc(p.texto_original)}</p>` : ""}
      <div class="sub">${catEl(p.categoria)}<span class="hint">${p.autor_nome ? esc(p.autor_nome) + (p.autor_email ? " (" + esc(p.autor_email) + ")" : "") + ", " : ""}${ORIGEM[p.criado_por_origem] || ""}, ${fmt(p.criado_em)}</span></div></div>
      <div class="acts">${dup ? `<button class="btn btn-secondary btn-sm" data-merge="${p.id}" data-into="${dup.id}"><span>Mesclar com ${esc(dup.titulo_pt)}</span></button>` : ""}<button class="btn btn-secondary btn-sm" data-edit="${p.id}"><span>Editar</span></button><button class="btn btn-secondary btn-sm" data-reject="${p.id}"><span>Recusar</span></button><button class="btn btn-primary btn-sm" data-approve="${p.id}"><span>Aprovar</span></button></div></div>`; }).join("")
      : `<div class="empty-box">Nada aguardando aprovação.</div>`;
  }
  function renderItens() {
    const fs = [["ativos", "Ativos"], ["aberto", "Abertos"], ["planejado", "Planejados"], ["em_construcao", "Em construção"], ["lancado", "Lançados"], ["recusado", "Recusados"], ["mesclado", "Mesclados"]];
    $("#item-filtros").innerHTML = fs.map(([k, l]) => `<button class="chip" data-filtro="${k}" aria-pressed="${filtro === k}">${l}</button>`).join("");
    const list = ITENS.filter((i) => filtro === "ativos" ? ["aberto", "planejado", "em_construcao"].includes(i.status) : i.status === filtro).sort((a, b) => b.votos - a.votos);
    $("#itemList").innerHTML = list.map((i) => `<li class="req item"><div style="min-width:0"><h3>${esc(i.titulo_pt)}${auto(i.traducao_automatica_es || i.traducao_automatica_pt)}${emEs(i)}</h3><p>${esc(i.descricao_pt)}</p>
      <div class="meta">${catEl(i.categoria)}${pill(i.status)}<span class="vt">${i.votos} ${i.votos === 1 ? "voto" : "votos"}</span>${i.mesclado_em ? `<span class="hint">mesclado em: ${esc((ITENS.find((x) => x.id === i.mesclado_em) || {}).titulo_pt || i.mesclado_em)}</span>` : ""}</div></div>
      <div class="acts"><a class="btn btn-transparent btn-sm" href="../../pt/roadmap/#pedido-${i.id}" target="_blank" rel="noopener"><span>Ver</span></a><button class="btn btn-secondary btn-sm" data-edit="${i.id}"><span>Editar</span></button></div></li>`).join("") || `<li class="req"><span></span><p class="hint">Nada aqui.</p></li>`;
  }
  function renderLanc() {
    $("#lancList").innerHTML = LANC.map((l) => `<li class="req lanc">${l.midia_url ? (isVideo(l.midia_url) ? `<video class="mini" src="${esc(l.midia_url)}" muted loop autoplay playsinline></video>` : `<img class="mini" src="${esc(l.midia_url)}" alt="">`) : `<div class="semmidia">sem mídia</div>`}
      <div style="min-width:0"><h3>${esc(l.titulo_pt)}${auto(l.traducao_automatica_es)}</h3><p>${esc(l.texto_pt)}</p>
      <div class="meta">${catEl(l.categoria)}<span class="hint">${fmt(l.data)}</span>${l.publicado ? `<span class="status-pill status-pill-success">Publicado</span>` : `<span class="status-pill">Rascunho</span>`}${l.item_id ? `<span class="hint">ligado a: ${esc((ITENS.find((x) => x.id === l.item_id) || {}).titulo_pt || "item")}</span>` : ""}</div></div>
      <div class="acts"><a class="btn btn-transparent btn-sm" href="../../pt/roadmap/#l-${l.id}" target="_blank" rel="noopener"><span>Ver</span></a><button class="btn btn-secondary btn-sm" data-editlanc="${l.id}"><span>Editar</span></button></div></li>`).join("") || `<li class="req"><span></span><p class="hint">Nenhum lançamento ainda.</p></li>`;
  }

  // ---------- formulários ----------
  function formItem(it) {
    const st = ["em_analise", "aberto", "planejado", "em_construcao", "lancado", "recusado"];
    modal("Editar item", `<div class="two"><div class="field"><label class="field-label" for="et">Título (PT) ${auto(it.traducao_automatica_pt)}</label><input class="form-input" id="et" value="${esc(it.titulo_pt)}" maxlength="60"></div><div class="field"><label class="field-label" for="ets">Título (ES) ${auto(it.traducao_automatica_es)}</label><input class="form-input" id="ets" value="${esc(it.titulo_es || "")}" maxlength="60"></div></div>
      <div class="two"><div class="field"><label class="field-label" for="ed">Descrição (PT)</label><textarea class="form-input" id="ed" rows="3">${esc(it.descricao_pt)}</textarea></div><div class="field"><label class="field-label" for="eds">Descrição (ES)</label><textarea class="form-input" id="eds" rows="3">${esc(it.descricao_es || "")}</textarea></div></div>
      <div class="two"><div class="field" style="margin-bottom:0"><label class="field-label" for="ec">Categoria</label><select class="form-select" id="ec">${Object.keys(CATS).map((c) => `<option value="${c}" ${c === it.categoria ? "selected" : ""}>${CATS[c].pt}</option>`).join("")}</select></div>
      <div class="field" style="margin-bottom:0"><label class="field-label" for="es">Status</label><select class="form-select" id="es">${st.map((s) => `<option value="${s}" ${s === it.status ? "selected" : ""}>${STATUS[s]}</option>`).join("")}</select></div></div>
      ${it.texto_original ? `<p class="orig"><b>Texto original</b>${esc(it.texto_original)}</p>` : ""}`,
      `<button class="btn btn-transparent perigo" data-delitem="${it.id}"><span>Apagar</span></button><button class="btn btn-transparent" data-retraduzir="item" data-id="${it.id}" title="Refaz a tradução automática do idioma que falta"><span>Traduzir de novo</span></button><button class="btn btn-secondary" data-close><span>Cancelar</span></button><button class="btn btn-primary" data-saveitem="${it.id}"><span>Salvar</span></button>`);
  }
  function formLanc(l) {
    l = l || { data: new Date().toISOString().slice(0, 10), categoria: "plataforma", publicado: false };
    const itens = ITENS.filter((i) => ["lancado", "em_construcao", "planejado", "aberto"].includes(i.status)).sort((a, b) => b.votos - a.votos);
    modal(l.id ? "Editar lançamento" : "Novo lançamento", `<div class="two"><div class="field"><label class="field-label" for="ld">Data</label><input class="form-input" id="ld" type="date" value="${esc(l.data)}"></div><div class="field"><label class="field-label" for="lc">Categoria</label><select class="form-select" id="lc">${Object.keys(CATS).map((c) => `<option value="${c}" ${c === l.categoria ? "selected" : ""}>${CATS[c].pt}</option>`).join("")}</select></div></div>
      <div class="two"><div class="field"><label class="field-label" for="lt">Título (PT)</label><input class="form-input" id="lt" value="${esc(l.titulo_pt || "")}"></div><div class="field"><label class="field-label" for="lts">Título (ES) ${auto(l.traducao_automatica_es)}</label><input class="form-input" id="lts" value="${esc(l.titulo_es || "")}"></div></div>
      <div class="two"><div class="field"><label class="field-label" for="lx">Texto (PT)</label><textarea class="form-input" id="lx" rows="4">${esc(l.texto_pt || "")}</textarea></div><div class="field"><label class="field-label" for="lxs">Texto (ES)</label><textarea class="form-input" id="lxs" rows="4">${esc(l.texto_es || "")}</textarea></div></div>
      <div class="field"><label class="field-label" for="li">Pedido de origem (opcional, mostra "Pedido por N parceiros")</label><select class="form-select" id="li"><option value="">Nenhum</option>${itens.map((i) => `<option value="${i.id}" ${i.id === l.item_id ? "selected" : ""}>${esc(i.titulo_pt)} (${i.votos} votos)</option>`).join("")}</select></div>
      <div class="field"><label class="field-label" for="lm">Mídia (GIF ou MP4 em loop, sem som)</label><input class="form-file" id="lm" type="file" accept="image/gif,image/png,image/webp,video/mp4">
        <div id="lm-prev">${l.midia_url ? (isVideo(l.midia_url) ? `<video class="midia-prev" src="${esc(l.midia_url)}" muted loop autoplay playsinline></video>` : `<img class="midia-prev" src="${esc(l.midia_url)}" alt="">`) : ""}</div>
        ${l.midia_url ? `<label class="check" style="margin-top:8px"><input type="checkbox" id="lm-rm"> Remover a mídia atual</label>` : ""}</div>
      <label class="check"><input type="checkbox" id="lp" ${l.publicado ? "checked" : ""}> Publicado (aparece na página)</label>
      <p class="form-error" id="lerr" hidden></p>`,
      `${l.id ? `<button class="btn btn-transparent perigo" data-dellanc="${l.id}"><span>Apagar</span></button>` : ""}${l.id ? `<button class="btn btn-transparent" data-retraduzir="lancamento" data-id="${l.id}" title="Refaz a tradução automática para ES"><span>Traduzir de novo</span></button>` : ""}<button class="btn btn-secondary" data-close><span>Cancelar</span></button><button class="btn btn-primary" data-savelanc="${l.id || ""}"><span>Salvar</span></button>`);
  }
  async function salvarLanc(id, b) {
    const err = $("#lerr"); err.hidden = true;
    const campos = { data: $("#ld").value, categoria: $("#lc").value, titulo_pt: $("#lt").value.trim(), titulo_es: $("#lts").value.trim() || null, texto_pt: $("#lx").value.trim(), texto_es: $("#lxs").value.trim() || null, item_id: $("#li").value || null, publicado: $("#lp").checked };
    if (!campos.data || !campos.titulo_pt || !campos.texto_pt) { err.textContent = "Data, título e texto em PT são obrigatórios."; err.hidden = false; return; }
    if (campos.titulo_es || campos.texto_es) campos.traducao_automatica_es = false;
    busy(b, true);
    try {
      const f = $("#lm").files[0];
      if (f) {
        const ext = (f.name.split(".").pop() || "gif").toLowerCase();
        const path = `lancamentos/${crypto.randomUUID()}.${ext}`;
        const up = await supa.storage.from("roadmap").upload(path, f, { contentType: f.type, cacheControl: "31536000" });
        if (up.error) throw up.error;
        campos.midia_url = supa.storage.from("roadmap").getPublicUrl(path).data.publicUrl;
      } else if ($("#lm-rm") && $("#lm-rm").checked) campos.midia_url = null;
      const r = id ? await supa.from("lancamentos").update(campos).eq("id", id).select("id").single() : await supa.from("lancamentos").insert(campos).select("id").single();
      if (r.error) throw r.error;
      closeModal(); toast(id ? "Lançamento atualizado" : "Lançamento criado");
      if (!campos.titulo_es || !campos.texto_es) await traduzir("lancamento", r.data.id);
      await carregar();
    } catch (e) { busy(b, false); err.textContent = e.message || "Não foi possível salvar."; err.hidden = false; }
  }

  // ---------- eventos ----------
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button,[data-tab]"); if (!b) return; const d = b.dataset;
    if (d.tab) { e.preventDefault(); tab = d.tab; renderTabs(); }
    else if (d.filtro) { filtro = d.filtro; renderItens(); }
    else if (b.hasAttribute("data-close")) closeModal();
    else if (d.approve) { busy(b, true); const r = await supa.from("itens").update({ status: "aberto" }).eq("id", d.approve); if (r.error) { busy(b, false); toast(r.error.message); } else { toast("Pedido aprovado"); await traduzir("item", d.approve); await carregar(); } }
    else if (d.reject) { busy(b, true); const r = await supa.from("itens").update({ status: "recusado" }).eq("id", d.reject); if (r.error) { busy(b, false); toast(r.error.message); } else { toast("Pedido recusado"); await carregar(); } }
    else if (d.merge) { busy(b, true); const r = await supa.rpc("mesclar_itens", { p_origem: d.merge, p_destino: d.into }); if (r.error) { busy(b, false); toast(r.error.message); } else { toast("Pedido mesclado, votos somados"); await carregar(); } }
    else if (d.edit) formItem(ITENS.find((i) => i.id === d.edit));
    else if (d.saveitem) {
      const it = ITENS.find((i) => i.id === d.saveitem);
      const campos = { titulo_pt: $("#et").value.trim(), descricao_pt: $("#ed").value.trim(), titulo_es: $("#ets").value.trim() || null, descricao_es: $("#eds").value.trim() || null, categoria: $("#ec").value, status: $("#es").value };
      if (!campos.titulo_pt || !campos.descricao_pt) { toast("Título e descrição em PT são obrigatórios."); return; }
      if (campos.titulo_es !== it.titulo_es || campos.descricao_es !== it.descricao_es) campos.traducao_automatica_es = false;
      if (campos.titulo_pt !== it.titulo_pt || campos.descricao_pt !== it.descricao_pt) campos.traducao_automatica_pt = false;
      const virouLancado = campos.status === "lancado" && it.status !== "lancado";
      if (virouLancado) campos.lancado_em = new Date().toISOString();
      busy(b, true);
      const r = await supa.from("itens").update(campos).eq("id", it.id);
      if (r.error) { busy(b, false); toast(r.error.message); return; }
      toast("Item atualizado");
      if (!campos.titulo_es || !campos.descricao_es) await traduzir("item", it.id);
      await carregar();
      if (virouLancado && confirm("Criar o lançamento já ligado a este item?")) {
        formLanc({ data: new Date().toISOString().slice(0, 10), categoria: campos.categoria, titulo_pt: campos.titulo_pt, titulo_es: campos.titulo_es, texto_pt: campos.descricao_pt, texto_es: campos.descricao_es, item_id: it.id, publicado: false });
      } else closeModal();
    }
    else if (d.delitem) {
      const it = ITENS.find((i) => i.id === d.delitem);
      if (!confirm(`Apagar "${it.titulo_pt}"? Os votos e comentários dele também somem. Não dá para desfazer.`)) return;
      busy(b, true);
      const r = await supa.from("itens").delete().eq("id", it.id);
      if (r.error) { busy(b, false); toast(r.error.message); return; }
      closeModal(); toast("Pedido apagado"); await carregar();
    }
    else if (d.dellanc) {
      const l = LANC.find((x) => x.id === d.dellanc);
      if (!confirm(`Apagar o lançamento "${l.titulo_pt}"? Não dá para desfazer.`)) return;
      busy(b, true);
      const r = await supa.from("lancamentos").delete().eq("id", l.id);
      if (r.error) { busy(b, false); toast(r.error.message); return; }
      // Mídia que estava no Storage do roadmap sai junto (se falhar, só fica um arquivo órfão).
      const caminho = (l.midia_url || "").split("/object/public/roadmap/")[1];
      if (caminho) await supa.storage.from("roadmap").remove([decodeURIComponent(caminho)]).catch(() => {});
      closeModal(); toast("Lançamento apagado"); await carregar();
    }
    else if (d.retraduzir) {
      busy(b, true);
      const ok = await traduzir(d.retraduzir, d.id, true);
      await carregar();
      if (ok) { if (d.retraduzir === "item") formItem(ITENS.find((i) => i.id === d.id)); else formLanc(LANC.find((l) => l.id === d.id)); } else busy(b, false);
    }
    else if (b.id === "novoLanc") formLanc(null);
    else if (d.editlanc) formLanc(LANC.find((l) => l.id === d.editlanc));
    else if (d.savelanc !== undefined) salvarLanc(d.savelanc || null, b);
  });
  document.addEventListener("change", (e) => {
    if (e.target.id !== "lm") return;
    const f = e.target.files[0], prev = $("#lm-prev"); if (!f) return;
    const url = URL.createObjectURL(f);
    prev.innerHTML = f.type.startsWith("video") ? `<video class="midia-prev" src="${url}" muted loop autoplay playsinline></video>` : `<img class="midia-prev" src="${url}" alt="">`;
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  $("#mb").addEventListener("click", closeModal);
  iniciar();
})();
