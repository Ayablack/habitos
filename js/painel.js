// Hábitos · Painel do Hoje (quadros, ordem, tamanho), abas das Configurações e ajustes da tela.
'use strict';
/* ===================== Painel do Hoje: quadros, ordem e tamanho ===================== */
// O arranjo fica nos dados (vai no backup e no QR). Só o PC edita; o celular mostra os mesmos quadros, na mesma ordem, em uma coluna.
const BLOCKS = {
  tl: { name: 'Linha do tempo', desc: 'O dia, de acordar a dormir, com o que já foi feito e os horários.' },
  dia: { name: 'Seu dia', desc: 'Anéis de progresso por período e o XP de hoje.' },
  agua: { name: 'Água', desc: 'Copos do dia, meta e os botões +1 e −.' },
  horarios: { name: 'Horários', desc: 'Remédios e outras tarefas com horário. Só aparece quando o dia tem alarme e recolhe quando tudo foi feito.', auto: 'Aparece sozinho quando o dia tem alarme' },
  agora: { name: 'Agora', desc: 'O que precisa de atenção neste momento: horário atrasado, água atrasada e o próximo alarme. Some quando não tem nada.', auto: 'Aparece sozinho quando tem algo pendente' },
  comp: { name: 'Companheiro', desc: 'Seu companheiro, o nível e o XP.' },
  seq: { name: 'Sequência', desc: 'Dias seguidos, recorde e o coringa da semana.' },
  mapa: { name: 'Últimas 16 semanas', desc: 'Mapa dos dias recentes.' },
  nota: { name: 'Nota do dia', desc: 'Uma linha sobre o dia. Aparece no Histórico.' }
};
// Quadros das listas (p-<id>) e dos contadores (c-<id>) nascem e somem junto com elas.
function blockDef(id) {
  if (BLOCKS[id]) return BLOCKS[id];
  if (id.startsWith('p-')) { const l = listById(id.slice(2)); return l ? { name: l.name, desc: 'Lista: as tarefas dela no dia.', list: true } : null; }
  if (id.startsWith('c-')) { const c = counterById(id.slice(2)); return c ? { name: c.name, desc: 'Contador: meta de ' + c.meta + (c.unit ? ' ' + c.unit : '') + ', botão +' + c.step + '.' } : null; }
  return null;
}
const DSIZES = [['s', 'P', 'Pequeno (1/4 da linha)'], ['m', 'M', 'Médio (1/3 da linha)'], ['l', 'G', 'Grande (metade da linha)'], ['xl', 'Inteira', 'Linha inteira']];
// Agora e Nota do dia começam fora do painel: entram por “+ Adicionar quadro”.
const DASH_DEFAULT = [['tl', 'xl'], ['dia', 's'], ['agua', 's'], ['horarios', 's'], ['comp', 's'], ['p-m', 'm'], ['p-d', 'm'], ['p-n', 'm'], ['seq', 'l'], ['mapa', 'l'], ['agora', 's', false], ['nota', 'l', false]];
function defaultDash(at = 0) {
  const out = DASH_DEFAULT.filter(([id]) => blockDef(id)).map(([id, w, on]) => ({ id, w, on: on !== false }));
  return { blocks: out.concat(dynBlocks().filter(b => !out.some(x => x.id === b.id))), updatedAt: at };
}
const dynBlocks = () => [...lists().map(l => ({ id: 'p-' + l.id, w: 'm', on: true })), ...counters().map(c => ({ id: 'c-' + c.id, w: 's', on: true }))];
function sanitizeDash(d) {
  const def = defaultDash(), seen = new Set(), out = [], okW = w => DSIZES.some(s => s[0] === w);
  for (const b of d && Array.isArray(d.blocks) ? d.blocks : []) {
    if (!b || typeof b.id !== 'string' || !blockDef(b.id) || seen.has(b.id)) continue;
    const dw = (def.blocks.find(x => x.id === b.id) || { w: 's' }).w;
    seen.add(b.id); out.push({ id: b.id, w: okW(b.w) ? b.w : dw, on: b.on !== false });
  }
  for (const b of def.blocks) if (!seen.has(b.id)) out.push(b);
  return { blocks: out, updatedAt: d && Number.isFinite(+d.updatedAt) ? +d.updatedAt : 0 };
}
const Dash = {
  editing: false, hist: [], _v: -1,
  get() { if (this._v !== DATA_VER || !DATA.dash || !Array.isArray(DATA.dash.blocks)) { DATA.dash = sanitizeDash(DATA.dash); this._v = DATA_VER; } return DATA.dash; },
  blk(id) { return $(`#dash .blk[data-b="${id}"]`); },
  sig() { return JSON.stringify(this.get().blocks) + (this.editing ? '|e' : ''); },
  // Ordem, tamanho e visibilidade de cada quadro (sem mexer no conteúdo: canvas e botões continuam os mesmos).
  // Cria os quadros de listas e contadores novos e tira os que sumiram.
  syncDom() {
    const dash = $('#dash'), want = new Set(this.get().blocks.map(b => b.id));
    for (const el of $$('#dash > .blk')) if (/^[pc]-/.test(el.dataset.b) && !want.has(el.dataset.b)) el.remove();
    for (const id of want) if (!this.blk(id)) { const el = document.createElement('div'); el.className = 'blk'; el.dataset.b = id; dash.appendChild(el); }
  },
  apply() {
    this.syncDom();
    const d = this.get();
    d.blocks.forEach((b, i) => { const el = this.blk(b.id); if (!el) return; el.style.order = String(i); el.dataset.w = b.w; el.classList.toggle('off', !b.on); });
    document.documentElement.classList.toggle('editing', this.editing);
    const btn = $('#editBtn'); btn.hidden = VIEW !== 'hoje' || isNarrow(); btn.setAttribute('aria-pressed', String(this.editing));
    $('#dashBar').hidden = !this.editing;
    if (this.editing) this.paintEdit(); else $$('#dash .blk').forEach(el => { el.draggable = false; });
  },
  change(fn) {
    this.hist.push(JSON.stringify(this.get())); if (this.hist.length > 60) this.hist.shift();
    const d = this.get(); fn(d); d.updatedAt = Date.now(); saveData(); this.apply();
  },
  visible() { return this.get().blocks.filter(b => b.on); },
  move(id, dir) {
    const vis = this.visible().map(b => b.id), i = vis.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= vis.length) return;
    this.place(id, vis[j], dir > 0);
  },
  // Põe o quadro antes (ou depois) de outro.
  place(id, target, after) {
    if (id === target) return;
    this.change(d => { const a = d.blocks, i = a.findIndex(b => b.id === id); const [x] = a.splice(i, 1); let j = a.findIndex(b => b.id === target); if (after) j++; a.splice(j, 0, x); });
  },
  setW(id, w) { this.change(d => { d.blocks.find(b => b.id === id).w = w; }); },
  hide(id) { this.change(d => { d.blocks.find(b => b.id === id).on = false; }); toast('“' + blockDef(id).name + '” saiu do painel. Dá pra pôr de volta em “+ Adicionar quadro”.'); },
  add(id) { this.change(d => { const a = d.blocks, i = a.findIndex(b => b.id === id); const [x] = a.splice(i, 1); x.on = true; a.push(x); }); this.closeCat(); toast('“' + blockDef(id).name + '” entrou no fim do painel.'); const el = this.blk(id); if (el) el.scrollIntoView({ block: 'nearest' }); },
  reset() { if (!confirm('Voltar o painel pro arranjo padrão?')) return; this.change(d => { Object.assign(d, defaultDash()); }); toast('Painel no arranjo padrão.'); },
  undo() { const s = this.hist.pop(); if (!s) return; DATA.dash = JSON.parse(s); DATA.dash.updatedAt = Date.now(); saveData(); this.apply(); },
  edit(on) {
    if (on && isNarrow()) return;
    this.editing = !!on; if (!on) { this.closeCat(); this.hist = []; }
    this.apply(); Layout.apply(); renderHoje();
    if (on) $('#dashBar').scrollIntoView({ block: 'nearest' });
  },
  paintEdit() {
    const vis = this.visible().map(b => b.id);
    for (const b of this.get().blocks) {
      const el = this.blk(b.id); if (!el) continue;
      let bar = $('.edbar', el); if (!bar) { bar = document.createElement('div'); bar.className = 'edbar'; el.prepend(bar); }
      const i = vis.indexOf(b.id), def = blockDef(b.id), nm = def.name;
      bar.innerHTML = `<span class="grip" aria-hidden="true">⠿</span><b class="nm"${def.auto ? ` title="${def.auto}"` : ''}>${esc(nm)}${def.auto ? ' <span class="xs mu">· automático</span>' : def.list ? ' <span class="xs mu">· lista</span>' : b.id.startsWith('c-') ? ' <span class="xs mu">· contador</span>' : ''}</b>`
        + `<button type="button" class="mini" data-mv="-1" aria-label="Mover ${esc(nm)} pra trás" ${i <= 0 ? 'disabled' : ''}>◀</button><button type="button" class="mini" data-mv="1" aria-label="Mover ${esc(nm)} pra frente" ${i >= vis.length - 1 ? 'disabled' : ''}>▶</button>`
        + `<span class="seg sz" role="radiogroup" aria-label="Tamanho de ${esc(nm)}">${DSIZES.map(([v, s, t]) => `<button type="button" role="radio" aria-checked="${v === b.w}" data-w="${v}" title="${t}">${s}</button>`).join('')}</span>`
        + `<button type="button" class="mini x" data-hide aria-label="Esconder ${esc(nm)}" title="Esconder">×</button>`;
      el.draggable = true;
    }
    $('#dashUndo').disabled = !this.hist.length;
  },
  openCat() {
    const off = this.get().blocks.filter(b => !b.on);
    $('#dashCatList').innerHTML = off.length ? off.map(b => `<div class="trw"><div class="nm"><b>${esc(blockDef(b.id).name)}</b><span class="xs mu">${esc(blockDef(b.id).desc)}</span></div><button type="button" class="btn sm pri" data-add="${b.id}">Adicionar</button></div>`).join('')
      : '<div class="empty-card">Todos os quadros já estão no painel. Pra tirar um, use o × dele.</div>';
    $('#catErr').textContent = ''; for (const id of ['catListName', 'catCntName', 'catCntUnit']) $('#' + id).value = ''; $('#catCntMeta').value = 10; $('#catCntStep').value = 1;
    $('#dashCat').hidden = false; const f = $('#dashCatList [data-add]') || $('#catListName'); f.focus();
  },
  closeCat() { $('#dashCat').hidden = true; },
  // Criar lista ou contador direto do painel (o resto se ajusta em Configurações).
  createFromCat(kind) {
    const err = m => { $('#catErr').textContent = m; };
    if (kind === 'list') {
      const name = $('#catListName').value.trim(); if (!name) return err('Dê um nome pra lista.');
      const l = Lists.create(name); this.closeCat(); toast('Lista “' + l.name + '” criada no fim do painel. Escolha a lista das tarefas em Configurações › Tarefas.');
    } else {
      const name = $('#catCntName').value.trim(); if (!name) return err('Dê um nome pro contador.');
      const c = Counters.create({ name, meta: +$('#catCntMeta').value, step: +$('#catCntStep').value, unit: $('#catCntUnit').value });
      this.closeCat(); toast('Contador “' + c.name + '” criado no fim do painel. XP e “conta pro dia completo” ficam em Configurações › Rotina.');
    }
    const el = this.blk(this.get().blocks[this.get().blocks.length - 1].id); if (el) el.scrollIntoView({ block: 'nearest' });
  },
  init() {
    $('#editBtn').addEventListener('click', () => this.edit(!this.editing));
    $('#dashDone').addEventListener('click', () => this.edit(false));
    $('#dashAdd').addEventListener('click', () => this.openCat());
    $('#dashUndo').addEventListener('click', () => this.undo());
    $('#dashReset').addEventListener('click', () => this.reset());
    $('#dashCatClose').addEventListener('click', () => this.closeCat());
    $('#dashCat').addEventListener('click', e => {
      const b = e.target.closest('[data-add]'), nw = e.target.closest('[data-new]');
      if (b) this.add(b.dataset.add); else if (nw) this.createFromCat(nw.dataset.new); else if (e.target.id === 'dashCat') this.closeCat();
    });
    $('#dashCat').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); this.createFromCat(e.target.closest('[data-form]').dataset.form); } });
    $('#dashCat').addEventListener('keydown', e => { if (e.key === 'Escape') this.closeCat(); });
    const dash = $('#dash');
    dash.addEventListener('click', e => {
      if (!this.editing) return;
      const bar = e.target.closest('.edbar'); if (!bar) return;
      // Só os botões da barra contam (o próprio quadro também tem data-w).
      const q = sel => { const x = e.target.closest(sel); return x && bar.contains(x) ? x : null; };
      const id = bar.parentElement.dataset.b, mv = q('[data-mv]'), w = q('button[data-w]');
      if (mv) this.move(id, +mv.dataset.mv); else if (w) this.setW(id, w.dataset.w); else if (q('[data-hide]')) this.hide(id);
    }, true);
    // Arrastar o quadro inteiro (só no modo de edição).
    let from = null;
    dash.addEventListener('dragstart', e => { const el = e.target.closest('.blk'); if (!this.editing || !el) { e.preventDefault(); return; } from = el.dataset.b; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', from); } catch (x) {} el.classList.add('dragging'); });
    dash.addEventListener('dragend', () => { from = null; $$('#dash .blk').forEach(x => x.classList.remove('dragging', 'drop-a', 'drop-b')); });
    const side = (el, e) => { const r = el.getBoundingClientRect(); return el.dataset.w === 'xl' ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2; };
    dash.addEventListener('dragover', e => { if (!from) return; const el = e.target.closest('.blk'); e.preventDefault(); $$('#dash .blk').forEach(x => x.classList.remove('drop-a', 'drop-b')); if (el && el.dataset.b !== from) el.classList.add(side(el, e) ? 'drop-a' : 'drop-b'); });
    dash.addEventListener('drop', e => { if (!from) return; e.preventDefault(); const el = e.target.closest('.blk'), f = from; from = null; $$('#dash .blk').forEach(x => x.classList.remove('dragging', 'drop-a', 'drop-b')); if (el && el.dataset.b !== f) this.place(f, el.dataset.b, side(el, e)); });
    window.matchMedia('(max-width: 720px)').addEventListener('change', () => { if (isNarrow() && this.editing) this.edit(false); else this.apply(); });
  },
  // QR: arranjo compacto, ex. "tl4,dia1,!mapa3" (tamanho 1–4, ! = escondido).
  pack() { const d = this.get(); return { b: d.blocks.map(b => (b.on ? '' : '!') + b.id + (DSIZES.findIndex(s => s[0] === b.w) + 1)).join(','), u: d.updatedAt }; },
  // Sem limpar aqui: listas e contadores novos do outro aparelho só existem depois de juntar (merge).
  unpack(s, u) {
    const blocks = String(s || '').split(',').filter(Boolean).map(x => { const m = x.match(/^(!?)(.+?)(\d)$/); return m ? { id: m[2], w: (DSIZES[+m[3] - 1] || DSIZES[0])[0], on: !m[1] } : null; }).filter(Boolean);
    return { blocks, updatedAt: +u || 0 };
  },
  merge(d) { if (d && d.updatedAt > this.get().updatedAt) { DATA.dash = sanitizeDash(d); this._v = -1; } }
};

/* ===================== Abas das Configurações ===================== */
const CfgTabs = {
  names: ['tarefas', 'rotina', 'comp', 'aparencia', 'dados'],
  cur: (() => { try { return localStorage.getItem('habitos.cfgtab') || 'tarefas'; } catch (e) { return 'tarefas'; } })(),
  init() {
    if (!this.names.includes(this.cur)) this.cur = 'tarefas';
    $('#cfgTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab2]'); if (b) this.go(b.dataset.tab2); });
    $('#cfgTabs').addEventListener('keydown', e => { const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!k) return; e.preventDefault(); const i = (this.names.indexOf(this.cur) + k + this.names.length) % this.names.length; this.go(this.names[i]); $(`#cfgTabs [data-tab2="${this.cur}"]`).focus(); });
    $('#goEditDash').addEventListener('click', () => { location.hash = '#hoje'; setTimeout(() => Dash.edit(true), 50); });
    this.paint();
  },
  go(t) { if (!this.names.includes(t)) return; this.cur = t; try { localStorage.setItem('habitos.cfgtab', t); } catch (e) {} this.paint(); renderEditor(); window.scrollTo({ top: 0 }); },
  paint() {
    $$('#cfgTabs [data-tab2]').forEach(b => { const on = b.dataset.tab2 === this.cur; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    $$('.cfgtab').forEach(el => { el.hidden = el.id !== 'tab-' + this.cur; });
  }
};

/* ===================== Tela: largura, tamanho, altura e animação ===================== */
// Preferências por aparelho (não entram no QR nem no backup).
const LKEY = 'habitos.tela';
const Layout = {
  o: (() => {
    const d = { width: 'full', zoom: 'auto', height: 'fill', anim: false };
    let o; try { o = Object.assign(d, JSON.parse(localStorage.getItem(LKEY) || '{}')); } catch (e) { o = d; }
    delete o.fit;
    if (!['fill', 'fit', 'scroll'].includes(o.height)) o.height = 'fill';
    return o;
  })(),
  cur: 100, mode: 'scroll', _sig: '', _t: 0,
  save() { try { localStorage.setItem(LKEY, JSON.stringify(this.o)); } catch (e) {} },
  // Automático: 100% até ~2200 px de largura; acima disso cresce junto com a tela (2560 → 130%, 3840 → 195%).
  auto() { const w = window.innerWidth; return w < 2200 ? 100 : clamp(Math.round(w / 1960 * 20) * 5, 100, 200); },
  base() { return this.o.zoom === 'auto' ? this.auto() : clamp(parseInt(this.o.zoom, 10) || 100, 50, 250); },
  setZoom(z) { document.documentElement.style.zoom = z === 100 ? '' : String(z / 100); },
  fits(z) { this.setZoom(z); return $('.app').getBoundingClientRect().bottom <= window.innerHeight + 1; },
  // Maior tamanho em que a tela Hoje cabe inteira na altura da janela.
  fitZoom() {
    let lo = 40, hi = 250;
    if (!this.fits(lo)) return lo;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.fits(m)) lo = m; else hi = m; }
    return lo;
  },
  apply() {
    const H = document.documentElement, app = $('.app'), dash = $('#dash');
    H.classList.toggle('wide', this.o.width === 'full');
    H.classList.toggle('anim-force', !!this.o.anim);
    H.classList.remove('panel', 'compact'); app.style.height = ''; dash.style.removeProperty('--plh');
    // Editando o painel, a página rola normalmente pra todos os quadros ficarem inteiros.
    const hoje = VIEW === 'hoje' && !isNarrow() && !Dash.editing;
    let z = this.base(), mode = 'scroll';
    if (hoje && this.o.height === 'fit') { z = this.fitZoom(); mode = 'fit'; }
    this.setZoom(z); this.cur = z;
    if (hoje && this.o.height === 'fill') {
      // Preenche exatamente a janela: as listas de tarefas ficam com a maior altura que cabe e rolam por dentro.
      H.classList.add('panel');
      const view = $('#view-hoje'), setZ = zz => { this.setZoom(zz); app.style.height = (window.innerHeight / (zz / 100)) + 'px'; };
      const fits = h => { dash.style.setProperty('--plh', h + 'px'); return dash.getBoundingClientRect().bottom <= view.getBoundingClientRect().bottom + 1; };
      const solve = () => { if (!fits(120)) return false; let lo = 120, hi = 2400; while (hi - lo > 2) { const m = (lo + hi) >> 1; if (fits(m)) lo = m; else hi = m; } fits(lo); return true; };
      setZ(z); let ok = solve();
      // Janela baixa: primeiro esconde Sequência e o mapa (também estão no topo e no Histórico), depois diminui até 70%.
      if (!ok) { H.classList.add('compact'); ok = solve(); }
      let zz = z;
      while (!ok && zz > 70) { zz -= 5; setZ(zz); ok = solve(); }
      if (ok) { this.cur = zz; mode = 'fill'; }
      else { H.classList.remove('panel', 'compact'); app.style.height = ''; dash.style.removeProperty('--plh'); this.setZoom(z); this.cur = z; }
      $$('#dash .plist').forEach(markMore);
    }
    this.mode = mode; this.paint();
  },
  maybeRefit(sig) { if (VIEW !== 'hoje' || this.o.height === 'scroll') return; if (sig !== this._sig) { this._sig = sig; this.apply(); } },
  init() {
    $('#lyZoom').innerHTML = '<option value="auto">Automático</option>' + [80, 90, 100, 110, 125, 150, 175, 200].map(z => `<option value="${z}">${z}%</option>`).join('');
    $('#lyWidth').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; this.o.width = b.dataset.v; this.save(); this.apply(); });
    $('#lyZoom').addEventListener('change', e => { this.o.zoom = e.target.value; this.save(); this.apply(); });
    $('#lyHeight').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; this.o.height = b.dataset.v; this.save(); this._sig = ''; this.apply(); });
    $('#tgAnim').addEventListener('click', () => { this.o.anim = !this.o.anim; this.save(); this.apply(); Comp.player.restart(); Ed.pvPlaying = !reduced(); Ed.pvSync(); Ed.render(); });
    window.addEventListener('resize', () => { clearTimeout(this._t); this._t = setTimeout(() => { this._sig = ''; this.apply(); }, 150); });
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => this.paint());
  },
  paint() {
    $$('#lyWidth [data-v]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === this.o.width)));
    $$('#lyHeight [data-v]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === this.o.height)));
    $('#lyHeightHint').textContent = { fill: 'O Hoje ocupa exatamente a janela, sem rolar a página. As listas de tarefas ganham a altura que sobra e rolam por dentro.', fit: 'Diminui ou aumenta o tamanho de tudo pro Hoje caber inteiro, sem rolar.', scroll: 'Página comum: rola pra baixo quando não cabe.' }[this.o.height];
    $('#lyZoom').value = String(this.o.zoom);
    $('#lyAutoV').textContent = 'no automático, esta tela usa ' + this.auto() + '%';
    $('#tgAnim').setAttribute('aria-pressed', String(!!this.o.anim));
    const sys = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('#lyAnimHint').textContent = sys ? (this.o.anim ? 'Seu sistema pede menos movimento, mas o companheiro e os efeitos estão animando porque esta opção está ligada.' : 'Seu sistema está pedindo menos movimento, por isso o companheiro fica parado. No Windows isso vem de Configurações › Acessibilidade › Efeitos visuais › Efeitos de animação. Ligue aqui pra animar só neste app.') : 'O sistema não pede menos movimento: as animações já estão ligadas.';
    const dpr = window.devicePixelRatio || 1;
    $('#lyInfo').textContent = `Sua tela: ${Math.round(screen.width * dpr)} × ${Math.round(screen.height * dpr)} px, com escala de ${Math.round(dpr * 100)}% (sistema e zoom do navegador). Janela: ${window.innerWidth} × ${window.innerHeight}. Tamanho atual da interface: ${this.cur}%.`;
  }
};
document.documentElement.classList.toggle('anim-force', !!Layout.o.anim);
