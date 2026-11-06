// Roadmap público dos parceiros: abas, lançamentos (resumo e detalhado), roadmap,
// pedidos com votos e comentários, novo pedido em duas etapas. Dados via RoadmapDados.
(function () {
  const I18N = window.ROADMAP_I18N, CATS = window.ROADMAP_CATS, dados = window.RoadmapDados;
  const lang = document.documentElement.dataset.lang === "es" ? "es" : "pt";
  const T = () => I18N[lang];
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const loc = () => lang === "pt" ? "pt-BR" : "es-MX";
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const tx = (o, campo) => (o && (o[campo + "_" + lang] || o[campo + "_pt"])) || "";
  const monthName = (m) => cap(new Date(m + "-15T12:00").toLocaleDateString(loc(), { month: "long" }));
  const fmtDay = (d) => new Date(d.slice(0, 10) + "T12:00").toLocaleDateString(loc(), { day: "numeric", month: "short" }).replace(".", "");
  const catEl = (c) => `<span class="cat c-${c}">${CATS[c] ? CATS[c][lang] : esc(c)}</span>`;
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const ABREV = { pt: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"], es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] };
  const monthAnchor = (m) => `${ABREV[lang][+m.slice(5, 7) - 1]}-${m.slice(2, 4)}`;
  function monthFromAnchor(h) {
    const mm = /^([a-z]{3})-(\d{2})$/.exec(h); if (!mm) return null;
    for (const l of ["pt", "es"]) { const i = ABREV[l].indexOf(mm[1]); if (i >= 0) return `20${mm[2]}-${String(i + 1).padStart(2, "0")}`; }
    return null;
  }
  function tempoRel(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000, a = T().ago;
    if (s < 90) return T().justNow;
    if (s < 3600) return a.m(Math.round(s / 60));
    if (s < 86400) return a.h(Math.round(s / 3600));
    if (s < 86400 * 30) return a.d(Math.round(s / 86400));
    return new Date(iso).toLocaleDateString(loc(), { day: "numeric", month: "short", year: "numeric" });
  }
  const isVideo = (u) => /\.(mp4|webm)(\?|$)/i.test(u || "");
  const midia = (l, cls) => !l.midia_url ? "" : isVideo(l.midia_url)
    ? `<video class="${cls}" src="${esc(l.midia_url)}" autoplay muted loop playsinline aria-label="${esc(tx(l, "titulo"))}"></video>`
    : `<img class="${cls}" src="${esc(l.midia_url)}" alt="${esc(tx(l, "titulo"))}" loading="lazy">`;

  const ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/></svg>';
  const CHAT = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/></svg>';
  const SPARK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8 1.5l1.6 4.2 4.4 1.3-4.4 1.3L8 12.5 6.4 8.3 2 7l4.4-1.3z"/></svg>';
  const CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5 6.5 11.5 12.5 5"/></svg>';

  // ---------- estado ----------
  let ITENS = [], LANC = [], COMENT = {}, admin = null;
  let tab = "changelog", cat = "all", clView = "sum", focusEntry = null, focusMonth = null, openId = null, draft = {};
  let VOTED = new Set();
  try { VOTED = new Set(JSON.parse(localStorage.getItem("rm_voted") || "[]")); } catch (e) { /* sem storage */ }
  const salvarVotos = () => { try { localStorage.setItem("rm_voted", JSON.stringify([...VOTED])); } catch (e) { /* sem storage */ } };

  const publicos = () => ITENS.filter((i) => ["aberto", "planejado", "em_construcao"].includes(i.status));
  const votosDe = (it) => it.votos;
  const voteBtn = (it, inline) => `<button class="vote${inline ? " inline" : ""}" data-vote="${it.id}" aria-pressed="${VOTED.has(it.id)}" aria-label="${T().vote}: ${esc(tx(it, "titulo"))}">${ARROW}<b>${votosDe(it)}</b></button>`;
  const byMonth = () => { const g = {}; LANC.forEach((e) => { const m = e.data.slice(0, 7); (g[m] = g[m] || []).push(e); }); return g; };
  const reqVotes = (l) => { if (!l.item_id) return 0; const it = ITENS.find((i) => i.id === l.item_id); return it ? it.votos : 0; };

  // ---------- abas ----------
  function renderTabs() {
    const keys = ["changelog", "roadmap", "requests"];
    $("#tabs").innerHTML = keys.map((k) => `<a class="tab" role="tab" href="#${{ changelog: "lancamentos", roadmap: "roadmap", requests: "pedidos" }[k]}" data-tab="${k}" aria-selected="${k === tab}" tabindex="0">${T().tabs[k]}</a>`).join("");
    keys.forEach((k) => { $("#p-" + k).hidden = k !== tab; });
  }
  function setHash(h) { try { history.replaceState(null, "", h ? "#" + h : location.pathname + location.search); } catch (e) { /* ignorar */ } }

  // ---------- lançamentos ----------
  function renderChangelog() {
    const keys = Object.keys(byMonth()).sort();
    const ano = keys.length ? keys[keys.length - 1].slice(0, 4) : new Date().getFullYear();
    const hint = clView === "sum" ? (keys.length ? T().since(LANC.length, monthName(keys[0]).toLowerCase()) : T().noItems) : T().sumLede;
    const head = `<div class="yr-head"><div><h2 class="sec-title">${ano}</h2><p class="hint">${hint}</p></div>
      <div class="segmented" role="group"><button class="segmented-item" data-cl="sum" aria-pressed="${clView === "sum"}">${T().clSum}</button><button class="segmented-item" data-cl="det" aria-pressed="${clView === "det"}">${T().clDet}</button></div></div>`;
    $("#p-changelog").innerHTML = head + (clView === "sum" ? summary() : detail());
    const mo = $(".months");
    if (mo) {
      // abre já posicionada no mês mais recente
      const last = mo.querySelector(".pre-soon") || (mo.querySelector(".soon") ? mo.querySelector(".soon").previousElementSibling : mo.lastElementChild);
      if (mo.scrollWidth > mo.clientWidth && last) mo.scrollLeft = Math.max(0, last.offsetLeft - mo.offsetLeft - (innerWidth > 600 ? mo.clientWidth - last.offsetWidth * 2 - 48 : 0));
    }
    if (clView === "det" && (focusEntry !== null || focusMonth !== null)) {
      const el = focusEntry !== null ? document.getElementById("l-" + focusEntry) : document.getElementById(focusMonth);
      focusEntry = null; focusMonth = null;
      if (el) {
        el.scrollIntoView({ block: "start" });
        if (el.classList.contains("entry")) { el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1400); }
      }
    }
  }
  function summary() {
    const g = byMonth(), next = ITENS.filter((i) => i.status === "em_construcao").sort((a, b) => votosDe(b) - votosDe(a)), keys = Object.keys(g).sort();
    if (!keys.length && !next.length) return `<p class="hint">${T().noItems}</p>`;
    const cols = keys.map((m, k) => {
      const list = g[m].slice().sort((a, b) => b.data.localeCompare(a.data));
      const feat = list.filter((e) => e.midia_url).sort((a, b) => reqVotes(b) - reqVotes(a))[0];
      return `<div class="mrow${k === keys.length - 1 && next.length ? " pre-soon" : ""}"><div class="mname"><b>${monthName(m)}</b><span>${T().nLaunch(list.length)}</span></div>
        <ul class="mlist">${list.map((e) => `<li><button class="li" data-entry="${e.id}"><span class="li-t"><b>${esc(tx(e, "titulo"))}</b>${catEl(e.categoria)}</span><time datetime="${e.data}">${fmtDay(e.data)}</time></button></li>`).join("")}</ul>
        ${feat ? `<button class="thumb" data-entry="${feat.id}">${midia(feat, "")}<span>${esc(tx(feat, "titulo"))}</span></button>` : ""}</div>`;
    }).join("");
    const soon = next.length ? `<div class="mrow soon"><div class="mname"><b>${T().soon}</b><span>${T().soonSub}</span></div>
      <ul class="mlist">${next.map((i) => `<li><button class="li" data-goroadmap="1"><span class="li-t"><b>${esc(tx(i, "titulo"))}</b>${catEl(i.categoria)}</span><span class="v"><b>${votosDe(i)}</b> ${T().votes(votosDe(i)).replace(/^\d+\s/, "")}</span></button></li>`).join("")}</ul></div>` : "";
    return `<div class="months">${cols}${soon}</div>`;
  }
  function detail() {
    const g = byMonth(), keys = Object.keys(g).sort().reverse();
    if (!keys.length) return `<p class="hint">${T().noItems}</p>`;
    return keys.map((m) => `<div class="dmonth" id="${monthAnchor(m)}"><div class="mname"><b>${monthName(m)}</b><span>${T().nLaunch(g[m].length)}</span></div>
      <div class="entries">${g[m].slice().sort((a, b) => b.data.localeCompare(a.data)).map((e) => { const rv = reqVotes(e); return `<article class="entry" id="l-${e.id}">
        <div class="meta">${catEl(e.categoria)}<time datetime="${e.data}">${fmtDay(e.data)}</time></div>
        <h3>${esc(tx(e, "titulo"))}</h3><p>${esc(tx(e, "texto"))}</p>
        ${rv ? `<div class="from">${T().fromReq(rv)}</div>` : ""}
        ${midia(e, "")}
      </article>`; }).join("")}</div></div>`).join("") + `<div class="det-foot"><button class="btn btn-secondary" data-cl="sum" data-top="1"><span>${T().backSum}</span></button></div>`;
  }

  // ---------- roadmap ----------
  function renderBoard() {
    const cols = [["planejado", "var(--gray-400)"], ["em_construcao", "var(--yellow-400)"], ["lancado", "var(--green-500)"]];
    $("#board").innerHTML = cols.map(([s, c]) => {
      if (s === "lancado") {
        const rec = LANC.slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, 4);
        return `<div class="col"><h2><i style="background:${c}"></i>${T().cols[s]}<span class="n">${LANC.length}</span></h2>
          <ul>${rec.length ? rec.map((e) => `<li class="go"><button data-entry="${e.id}"><b>${esc(tx(e, "titulo"))}</b><div class="row">${catEl(e.categoria)}<span>${fmtDay(e.data)}</span></div></button></li>`).join("") : `<li class="empty">${T().noItems}</li>`}</ul></div>`;
      }
      const its = ITENS.filter((i) => i.status === s).sort((a, b) => votosDe(b) - votosDe(a));
      return `<div class="col"><h2><i style="background:${c}"></i>${T().cols[s]}<span class="n">${its.length}</span></h2>
        <ul>${its.length ? its.map((i) => `<li><b>${esc(tx(i, "titulo"))}</b><div class="row">${catEl(i.categoria)}</div></li>`).join("") : `<li class="empty">${T().noItems}</li>`}</ul></div>`;
    }).join("");
  }

  // ---------- pedidos ----------
  function renderReqs() {
    $("#q").placeholder = T().askPh;
    $("#cats").innerHTML = `<button class="chip" data-cat="all" aria-pressed="${cat === "all"}">${T().all}</button>` + Object.keys(CATS).map((c) => `<button class="chip" data-cat="${c}" aria-pressed="${cat === c}">${CATS[c][lang]}</button>`).join("");
    const list = publicos().filter((i) => cat === "all" || i.categoria === cat).sort((a, b) => votosDe(b) - votosDe(a));
    $("#reqs").innerHTML = list.map((i) => {
      const open = openId === i.id, n = COMENT[i.id] ? COMENT[i.id].length : i.comentarios;
      return `<li class="req" id="pedido-${i.id}">${voteBtn(i)}<div style="min-width:0">
        <button class="open" data-open="${i.id}" aria-expanded="${open}"><h3>${esc(tx(i, "titulo"))}</h3></button><p>${esc(tx(i, "descricao"))}</p>
        <div class="meta">${catEl(i.categoria)}${i.status !== "aberto" ? `<span class="status-pill ${i.status === "em_construcao" ? "status-pill-warning" : ""}">${T().cols[i.status]}</span>` : ""}
          <button class="btn btn-transparent btn-sm cmeta" data-open="${i.id}">${CHAT}<span>${T().comments(n)}</span></button>
          ${admin ? `<button class="btn btn-secondary btn-sm edit-team" data-edit="${i.id}"><span>${T().edit}</span></button>` : ""}</div>
        ${open ? thread(i) : ""}</div></li>`;
    }).join("") || `<li class="req"><span></span><p class="hint">${T().noItems}</p></li>`;
  }
  function thread(i) {
    const cs = COMENT[i.id];
    const lista = !cs ? `<div class="loading"><div class="chart-skeleton"></div></div>` : cs.length ? `<ul>${cs.map((c) => `<li class="cm${c.do_time ? " team" : ""}"><span class="av">${c.do_time ? "B" : esc(c.nome.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase())}</span><div>
      <div class="who">${esc(c.nome)}${c.do_time ? `<span class="status-pill">${T().team}</span>` : ""}<time datetime="${c.criado_em}">${tempoRel(c.criado_em)}</time>${admin ? `<button class="btn btn-transparent btn-sm del" data-delc="${c.id}" data-item="${i.id}"><span>${T().del}</span></button>` : ""}</div>
      <p>${esc(c.texto)}</p></div></li>`).join("")}</ul>` : "";
    return `<div class="thread">${lista}
      <div class="cform">${admin ? "" : `<input class="form-input" id="cn" placeholder="${T().cName}" autocomplete="name" value="${esc(draft.n || "")}"><input class="form-input" id="ce" type="email" placeholder="${T().cEmail}" autocomplete="email" value="${esc(draft.e || "")}">`}
        <textarea class="form-input" id="ct" placeholder="${T().cText}"></textarea>
        <div class="actions"><span class="hint" id="cerr">${admin ? "" : T().cPriv}</span><button class="btn btn-primary btn-sm" data-comment="${i.id}"><span>${T().cSend}</span></button></div></div></div>`;
  }
  async function abrirThread(id) {
    if (COMENT[id]) return;
    try { COMENT[id] = await dados.comentarios(id); } catch (e) { COMENT[id] = []; }
    if (openId === id) renderReqs();
  }
  function searchSimilar() {
    const q = norm($("#q").value.trim()), box = $("#similar");
    if (q.length < 3) { box.hidden = true; return; }
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    const hits = publicos().map((i) => ({ i, s: words.filter((w) => norm([i.titulo_pt, i.descricao_pt, i.titulo_es, i.descricao_es].join(" ")).includes(w)).length })).filter((h) => h.s > 0).sort((a, b) => b.s - a.s || votosDe(b.i) - votosDe(a.i)).slice(0, 3);
    if (!hits.length) { box.hidden = true; return; }
    box.hidden = false;
    $("#similarList").innerHTML = hits.map(({ i }) => `<li><span>${esc(tx(i, "titulo"))}</span>${voteBtn(i, true)}</li>`).join("") + `<li><button class="linkish" id="noneBtn">${T().none}</button></li>`;
  }

  // ---------- captcha (Cloudflare Turnstile, invisível) ----------
  const siteKey = (window.ROADMAP_CONFIG || {}).turnstileSiteKey;
  function obterCaptcha() {
    if (!siteKey || !window.turnstile) return Promise.resolve(null);
    return new Promise((resolve) => {
      let box = $("#captcha"); if (!box) { box = document.createElement("div"); box.id = "captcha"; document.body.appendChild(box); }
      box.innerHTML = "";
      const id = window.turnstile.render(box, { sitekey: siteKey, size: "invisible", execution: "execute", "error-callback": () => resolve(null), callback: (token) => { resolve(token); setTimeout(() => window.turnstile.remove(id), 0); } });
      window.turnstile.execute(id);
    });
  }

  // ---------- modal ----------
  function modal(title, body, foot) { $("#mt").textContent = title; $("#mbody").innerHTML = body; $("#mfoot").innerHTML = foot; $("#mb").hidden = $("#md").hidden = false; }
  function closeModal() { $("#mb").hidden = $("#md").hidden = true; }
  const btnLoading = (b, on, label) => { if (!b) return; b.disabled = on; if (label) b.querySelector("span").textContent = label; };
  function stepWrite(erro) {
    modal(T().step1, `${erro ? `<p class="form-error">${esc(erro)}</p>` : ""}<div class="two"><div class="field"><label class="field-label" for="nn">${T().cName}</label><input class="form-input" id="nn" value="${esc(draft.n || "")}" autocomplete="name"></div>
      <div class="field"><label class="field-label" for="ne">${T().cEmail}</label><input class="form-input" id="ne" type="email" value="${esc(draft.e || "")}" autocomplete="email"></div></div>
      <div class="field" style="margin-bottom:0"><label class="field-label" for="nd">${T().free}</label><textarea class="form-input" id="nd" rows="5" placeholder="${T().freePh}">${esc(draft.raw || "")}</textarea><p class="hint" style="margin-top:6px">${T().cPriv}</p></div>`,
      `<button class="btn btn-secondary" data-close><span>${T().cancel}</span></button><button class="btn btn-primary" id="toReview"><span>${T().next}</span></button>`);
    setTimeout(() => { const el = $(draft.n ? "#nd" : "#nn"); if (el) el.focus(); }, 10);
  }
  function stepReview(erro) {
    const f = draft.fmt;
    modal(T().step2, `${erro ? `<p class="form-error">${esc(erro)}</p>` : ""}<div class="ai-note">${SPARK}<span>${T().aiNote}</span></div><div class="preview">${catEl(f.categoria)}<h4>${esc(f.titulo)}</h4><p>${esc(f.descricao)}</p>
      <select class="form-select" id="fcat" aria-label="${T().fCat}">${Object.keys(CATS).map((c) => `<option value="${c}" ${c === f.categoria ? "selected" : ""}>${CATS[c][lang]}</option>`).join("")}</select></div>`,
      `<button class="btn btn-secondary" id="backEdit"><span>${T().back}</span></button><button class="btn btn-primary" id="send"><span>${T().sendAs}</span></button>`);
  }
  function stepDone() { modal(T().step1, `<div class="done"><i>${CHECK}</i><div><h4>${T().doneT}</h4><p class="hint">${T().doneP}</p></div></div>`, `<button class="btn btn-primary" data-close><span>${T().close}</span></button>`); }
  function openEdit(id) {
    const it = ITENS.find((i) => i.id === id);
    const st = ["aberto", "planejado", "em_construcao", "lancado"];
    modal(T().editTitle, `<div class="two"><div class="field"><label class="field-label" for="et">${T().fTitle} (PT)</label><input class="form-input" id="et" value="${esc(it.titulo_pt)}"></div><div class="field"><label class="field-label" for="ets">${T().fTitle} (ES)</label><input class="form-input" id="ets" value="${esc(it.titulo_es || "")}"></div></div>
      <div class="two"><div class="field"><label class="field-label" for="ed">${T().fDescShort} (PT)</label><textarea class="form-input" id="ed" rows="3">${esc(it.descricao_pt)}</textarea></div><div class="field"><label class="field-label" for="eds">${T().fDescShort} (ES)</label><textarea class="form-input" id="eds" rows="3">${esc(it.descricao_es || "")}</textarea></div></div>
      <div class="two"><div class="field" style="margin-bottom:0"><label class="field-label" for="ec">${T().fCat}</label><select class="form-select" id="ec">${Object.keys(CATS).map((c) => `<option value="${c}" ${c === it.categoria ? "selected" : ""}>${CATS[c][lang]}</option>`).join("")}</select></div>
      <div class="field" style="margin-bottom:0"><label class="field-label" for="es">${T().status}</label><select class="form-select" id="es">${st.map((s) => `<option value="${s}" ${s === it.status ? "selected" : ""}>${s === "aberto" ? T().open : T().cols[s]}</option>`).join("")}</select></div></div>`,
      `<button class="btn btn-secondary" data-close><span>${T().cancel}</span></button><button class="btn btn-primary" data-saveedit="${id}"><span>${T().save}</span></button>`);
  }
  function toast(msg) { const t = $("#toast"); t.innerHTML = `<div class="toast"><div class="toast-row"><span>${esc(msg)}</span></div></div>`; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 2400); }

  // ---------- render geral ----------
  function texts() { document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = T()[el.dataset.t]; }); }
  function render() { texts(); renderTabs(); renderChangelog(); renderBoard(); renderReqs(); searchSimilar(); }

  // ---------- navegação por hash ----------
  function aplicarHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) return;
    if (h === "lancamentos") tab = "changelog";
    else if (h === "roadmap") tab = "roadmap";
    else if (h === "pedidos") tab = "requests";
    else if (h.startsWith("l-")) { tab = "changelog"; clView = "det"; focusEntry = h.slice(2); }
    else if (h.startsWith("pedido-")) { tab = "requests"; openId = h.slice(7); abrirThread(openId); }
    else if (monthFromAnchor(h)) { tab = "changelog"; clView = "det"; focusMonth = h; }
  }

  // ---------- eventos ----------
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button,[data-tab]"); if (!b) return; const d = b.dataset;
    if (d.tab) { e.preventDefault(); tab = d.tab; setHash(b.getAttribute("href").slice(1)); renderTabs(); if (!b.classList.contains("tab")) window.scrollTo({ top: 0 }); }
    else if (d.goroadmap) { tab = "roadmap"; setHash("roadmap"); renderTabs(); window.scrollTo({ top: 0 }); }
    else if (d.cl) { clView = d.cl; renderChangelog(); if (d.top) window.scrollTo({ top: 0 }); }
    else if (d.entry !== undefined) { clView = "det"; focusEntry = d.entry; if (tab !== "changelog") { tab = "changelog"; renderTabs(); } setHash("l-" + d.entry); renderChangelog(); }
    else if (d.cat) { cat = d.cat; renderReqs(); }
    else if (d.vote) {
      const id = d.vote, it = ITENS.find((i) => i.id === id); if (!it) return;
      const tinha = VOTED.has(id);
      // otimista: marca na hora e confirma com o servidor
      tinha ? VOTED.delete(id) : VOTED.add(id); it.votos += tinha ? -1 : 1; salvarVotos();
      renderReqs(); renderBoard(); searchSimilar(); if (clView === "sum") renderChangelog();
      try {
        const r = await dados.votar(id);
        r.votou ? VOTED.add(id) : VOTED.delete(id); it.votos = r.votos; salvarVotos();
        toast(r.votou ? T().toastVote : T().toastUnvote);
      } catch (err) {
        tinha ? VOTED.add(id) : VOTED.delete(id); it.votos += tinha ? 1 : -1; salvarVotos(); toast(err.message || T().genericError);
      }
      renderReqs(); renderBoard(); searchSimilar(); if (clView === "sum") renderChangelog();
    }
    else if (b.id === "newBtn" || b.id === "noneBtn") { draft = { ...draft, raw: $("#q").value.trim(), fmt: null }; stepWrite(); }
    else if (b.hasAttribute("data-close")) closeModal();
    else if (b.id === "toReview") {
      draft.n = $("#nn").value.trim(); draft.e = $("#ne").value.trim(); draft.raw = $("#nd").value.trim();
      if (!draft.n) { stepWrite(T().vName); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.e)) { stepWrite(T().vEmail); return; }
      if (draft.raw.length < 10) { stepWrite(T().vText); return; }
      btnLoading(b, true, T().formatting);
      try { draft.fmt = await dados.formatarPedido(draft.raw, lang); stepReview(); }
      catch (err) { stepWrite(err.message || T().genericError); }
    }
    else if (b.id === "backEdit") stepWrite();
    else if (b.id === "send") {
      const f = draft.fmt; f.categoria = $("#fcat").value;
      btnLoading(b, true, T().sending);
      try {
        const captcha = await obterCaptcha();
        await dados.criarPedido({ nome: draft.n, email: draft.e, texto_original: draft.raw, categoria: f.categoria, titulo: f.titulo, descricao: f.descricao, idioma: f.idioma || lang, captcha });
        $("#q").value = ""; searchSimilar(); draft = { n: draft.n, e: draft.e }; stepDone();
      } catch (err) { stepReview(err.message || T().genericError); }
    }
    else if (d.open) { const id = d.open; openId = openId === id ? null : id; renderReqs(); if (openId) { setHash("pedido-" + id); abrirThread(id); } else setHash("pedidos"); }
    else if (d.comment) {
      const id = d.comment, t = $("#ct").value.trim(), err = $("#cerr");
      if (admin) {
        if (!t) { err.textContent = T().vComment; return; }
        btnLoading(b, true);
        try { const c = await dados.comentarComoTime(id, t, admin); (COMENT[id] = COMENT[id] || []).push(c); renderReqs(); toast(T().commented); }
        catch (e2) { btnLoading(b, false); err.textContent = e2.message || T().genericError; }
      } else {
        const n = $("#cn").value.trim(), em = $("#ce").value.trim();
        if (!n) { err.textContent = T().vName; $("#cn").focus(); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { err.textContent = T().vEmail; $("#ce").focus(); return; }
        if (!t) { err.textContent = T().vComment; $("#ct").focus(); return; }
        draft.n = n; draft.e = em; btnLoading(b, true);
        try {
          const captcha = await obterCaptcha();
          const c = await dados.comentar({ item_id: id, nome: n, email: em, texto: t, captcha });
          (COMENT[id] = COMENT[id] || []).push(c); renderReqs(); toast(T().commented);
        } catch (e2) { btnLoading(b, false); err.textContent = e2.message || T().genericError; }
      }
    }
    else if (d.delc) {
      try { await dados.apagarComentario(d.delc); COMENT[d.item] = (COMENT[d.item] || []).filter((c) => c.id !== d.delc); renderReqs(); toast(T().deleted); }
      catch (e2) { toast(e2.message || T().genericError); }
    }
    else if (d.edit) openEdit(d.edit);
    else if (d.saveedit) {
      const it = ITENS.find((i) => i.id === d.saveedit);
      const campos = { titulo_pt: $("#et").value.trim(), descricao_pt: $("#ed").value.trim(), titulo_es: $("#ets").value.trim() || null, descricao_es: $("#eds").value.trim() || null, categoria: $("#ec").value, status: $("#es").value };
      if (campos.status === "lancado" && it.status !== "lancado") campos.lancado_em = new Date().toISOString();
      btnLoading(b, true);
      try { await dados.editarItem(it.id, campos); Object.assign(it, campos); closeModal(); render(); toast(T().saved); }
      catch (e2) { btnLoading(b, false); toast(e2.message || T().genericError); }
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("tab")) { e.preventDefault(); e.target.click(); }
  });
  $("#q").addEventListener("input", searchSimilar);
  $("#q").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#newBtn").click(); });
  $("#mb").addEventListener("click", closeModal);
  window.addEventListener("hashchange", () => { aplicarHash(); renderTabs(); renderChangelog(); renderReqs(); });

  // ---------- carga ----------
  async function carregar() {
    texts(); renderTabs();
    $("#p-changelog").innerHTML = `<div class="loading"><div class="chart-skeleton"></div><div class="chart-skeleton"></div><div class="chart-skeleton"></div></div>`;
    try {
      const r = await dados.carregar();
      ITENS = r.itens; LANC = r.lancamentos;
    } catch (err) {
      console.error(err);
      $("#p-changelog").innerHTML = `<div class="erro-box"><b>${T().loadError}</b><button class="linkish" id="retry">${T().retry}</button></div>`;
      $("#retry").addEventListener("click", carregar);
      return;
    }
    if (dados.modo === "exemplo") { const f = $("#foot-exemplo"); if (f) { f.hidden = false; f.textContent = T().exemplo; } }
    try { admin = await dados.ehAdmin(); } catch (e) { admin = null; }
    if (admin) { const l = $("#team-link"); if (l) l.hidden = false; }
    aplicarHash();
    render();
    if (openId) abrirThread(openId);
  }
  if (siteKey) { const s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true; document.head.appendChild(s); }
  carregar();
})();
