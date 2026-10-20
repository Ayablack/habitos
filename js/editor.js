// Hábitos · Editor do companheiro: detecção de sprites, recortes, sequências, prévia e salvar.
'use strict';
/* ===================== Editor de companheiros: detecção ===================== */
const ED = new SheetSet();
// Rotulagem de componentes conectados (8 vizinhos) sobre a máscara, em blocos pra não travar a tela. Devolve caixas em coordenadas da imagem.
async function ccl(mask, W, x0, y0, rw, rh, job, onProg) {
  const lab = new Int32Array(rw * rh); let parent = new Int32Array(1024), n = 1, t0 = performance.now();
  const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) { if (a < b) parent[b] = a; else parent[a] = b; } };
  for (let y = 0; y < rh; y++) {
    const mrow = (y0 + y) * W + x0, row = y * rw;
    for (let x = 0; x < rw; x++) {
      if (!mask[mrow + x]) continue;
      const i = row + x; let l = 0, q;
      if (x > 0 && (q = lab[i - 1])) l = q;
      if (y > 0) {
        const u = i - rw;
        if (x > 0 && (q = lab[u - 1])) { if (l) uni(l, q); else l = q; }
        if ((q = lab[u])) { if (l) uni(l, q); else l = q; }
        if (x < rw - 1 && (q = lab[u + 1])) { if (l) uni(l, q); else l = q; }
      }
      if (!l) { if (n >= parent.length) { const p2 = new Int32Array(parent.length * 2); p2.set(parent); parent = p2; } parent[n] = n; l = n++; }
      lab[i] = l;
    }
    if (job && performance.now() - t0 > 25) { if (onProg) onProg(0.7 * y / rh); await yieldUI(); if (job.cancel) return null; t0 = performance.now(); }
  }
  const mnx = new Int32Array(n).fill(2147483647), mny = new Int32Array(n).fill(2147483647), mxx = new Int32Array(n).fill(-1), mxy = new Int32Array(n).fill(-1), cnt = new Int32Array(n);
  for (let y = 0; y < rh; y++) {
    const row = y * rw;
    for (let x = 0; x < rw; x++) {
      const l = lab[row + x]; if (!l) continue;
      const r = find(l); cnt[r]++;
      if (x < mnx[r]) mnx[r] = x; if (x > mxx[r]) mxx[r] = x; if (y < mny[r]) mny[r] = y; if (y > mxy[r]) mxy[r] = y;
    }
    if (job && performance.now() - t0 > 25) { if (onProg) onProg(0.7 + 0.2 * y / rh); await yieldUI(); if (job.cancel) return null; t0 = performance.now(); }
  }
  const out = [];
  for (let r = 1; r < n; r++) if (cnt[r]) out.push({ x: x0 + mnx[r], y: y0 + mny[r], w: mxx[r] - mnx[r] + 1, h: mxy[r] - mny[r] + 1, n: cnt[r] });
  return out;
}
// Junta partes separadas por até `gap` pixels vazios (cabelo solto, efeitos, sombras próximas).
function mergeBoxes(list, gap) {
  let bs = list;
  for (let pass = 0; pass < 30; pass++) {
    const n = bs.length, par = new Int32Array(n); for (let i = 0; i < n; i++) par[i] = i;
    const f = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    const idx = [...bs.keys()].sort((a, b) => bs[a].x - bs[b].x), act = []; let merged = false;
    for (const i of idx) {
      const b = bs[i];
      for (let k = act.length - 1; k >= 0; k--) {
        const o = bs[act[k]];
        if (b.x - (o.x + o.w - 1) - 1 > gap) { act.splice(k, 1); continue; }
        const dy = Math.max(o.y, b.y) - Math.min(o.y + o.h - 1, b.y + b.h - 1) - 1;
        if (dy <= gap) { const ra = f(i), rb = f(act[k]); if (ra !== rb) { par[ra] = rb; merged = true; } }
      }
      act.push(i);
    }
    if (!merged) return bs;
    const groups = new Map();
    for (let i = 0; i < n; i++) {
      const r = f(i), b = bs[i], g = groups.get(r);
      if (!g) groups.set(r, { x: b.x, y: b.y, x2: b.x + b.w - 1, y2: b.y + b.h - 1, n: b.n });
      else { g.x = Math.min(g.x, b.x); g.y = Math.min(g.y, b.y); g.x2 = Math.max(g.x2, b.x + b.w - 1); g.y2 = Math.max(g.y2, b.y + b.h - 1); g.n += b.n; }
    }
    bs = [...groups.values()].map(g => ({ x: g.x, y: g.y, w: g.x2 - g.x + 1, h: g.y2 - g.y + 1, n: g.n }));
  }
  return bs;
}
// Ordem de leitura: linhas de cima pra baixo, e da esquerda pra direita dentro de cada linha.
function readingRows(boxes) {
  const rows = [];
  for (const b of boxes.slice().sort((a, c) => a.y - c.y || a.x - c.x)) {
    const cy = b.y + b.h / 2; let row = null;
    for (let k = rows.length - 1; k >= 0; k--) if (cy >= rows[k].y && cy <= rows[k].y2) { row = rows[k]; break; }
    if (!row) { row = { y: b.y, y2: b.y + b.h - 1, items: [] }; rows.push(row); }
    row.items.push(b);
  }
  rows.forEach(r => r.items.sort((a, c) => a.x - c.x));
  return rows;
}
const readingOrder = boxes => readingRows(boxes).flatMap(r => r.items);
function modeOf(vals) { const m = new Map(); let best = null, bn = 0; for (const v of vals) { const n = (m.get(v) || 0) + 1; m.set(v, n); if (n > bn) { bn = n; best = v; } } return { v: best, share: vals.length ? vals.filter(x => Math.abs(x - best) <= 1).length / vals.length : 0 }; }
// Sugere uma grade só quando os sprites estão espaçados de forma regular.
function inferGrid(boxes, W, H) {
  if (boxes.length < 4) return null;
  const rows = readingRows(boxes), mw = Math.max(...boxes.map(b => b.w)), mh = Math.max(...boxes.map(b => b.h));
  const dxs = []; for (const r of rows) for (let i = 1; i < r.items.length; i++) dxs.push(Math.round((r.items[i].x + r.items[i].w / 2) - (r.items[i - 1].x + r.items[i - 1].w / 2)));
  if (!dxs.length) return null;
  const mx = modeOf(dxs); if (mx.share < 0.7 || mx.v < mw) return null;
  const px = mx.v; let py = H, oy = 0;
  const cys = rows.map(r => r.items.reduce((s, b) => s + b.y + b.h / 2, 0) / r.items.length);
  if (rows.length > 1) {
    const my = modeOf(cys.slice(1).map((c, i) => Math.round(c - cys[i]))); if (my.share < 0.7 || my.v < mh) return null;
    py = my.v; oy = Math.max(0, Math.round(Math.min(...cys) - py / 2));
  }
  const ox = Math.max(0, Math.round(Math.min(...boxes.map(b => b.x + b.w / 2)) - px / 2));
  const g = { fw: px, fh: py, mx: ox, my: oy, sx: 0, sy: 0 }, { cols, rows: nr } = gridDims(g, W, H);
  const fits = boxes.filter(b => { const c = Math.floor((b.x - ox) / px), r = Math.floor((b.y - oy) / py); return c >= 0 && r >= 0 && c < cols && r < nr && b.x + b.w <= ox + (c + 1) * px && b.y + b.h <= oy + (r + 1) * py; }).length;
  return fits / boxes.length >= 0.9 ? Object.assign(g, { cols, rows: nr }) : null;
}
async function detectSprites(sheet, det, job, onProg) {
  const boxes0 = await ccl(sheet.mask, sheet.w, 0, 0, sheet.w, sheet.h, job, onProg);
  if (!boxes0) return null;
  if (boxes0.length > 60000) return { boxes: [], comps: boxes0.length, small: 0, tooMany: true, grid: null };
  onProg(0.92); await yieldUI(); if (job.cancel) return null;
  const merged = mergeBoxes(boxes0, det.gap), small = merged.filter(b => b.n < det.min).length;
  const boxes = readingOrder(merged.filter(b => b.n >= det.min));
  return { boxes, comps: boxes0.length, small, grid: inferGrid(boxes, sheet.w, sheet.h) };
}
function iou(a, b) {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  const i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1); return i / (a.w * a.h + b.w * b.h - i);
}
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
function bgLine(info, key) {
  if (!info) return '';
  if (info.hasAlpha) return 'Fundo transparente: a imagem já tem canal alfa, não precisa remover nada.';
  if (info.pattern) return 'Fundo quadriculado (ou de várias cores) pintado na própria imagem: parece transparente, mas não é. ' + (key.on ? 'Removido na prévia.' : 'Remova abaixo pra ficar transparente de verdade.');
  if (info.solid) return key.on ? `Fundo sólido ${hexOf(info.bg)}: removido na prévia.` : `Fundo sólido ${hexOf(info.bg)} detectado. Remova abaixo pra ficar transparente.`;
  return 'Sem transparência e sem um fundo claro nas bordas. Se houver fundo, clique em “Adicionar cor da imagem” e depois no fundo (repita pra cada cor, como num quadriculado).';
}

/* ===================== Editor de companheiros ===================== */
// var (e não const): substitui o Ed provisório que o main.js cria enquanto este arquivo não foi carregado.
var Ed = {
  // adv: modo avançado (as 5 etapas). O resumo (estados e atalhos) é o padrão; a escolha fica neste aparelho.
  adv: (() => { try { return localStorage.getItem('habitos.editor') === 'avancado'; } catch (e) { return false; } })(),
  d: null, ver: 0, step: 1, state: 'idle', img: null, sel: [], seqSel: [], pick: [], hist: [], newBlobs: new Set(), quick: false, fresh: false, view: 'proc', picking: false,
  report: null, suggest: null, job: null, drag: null, pvDrag: null, pv: null, pvPlaying: true, z: 1, det: { gap: 2, min: 6 }, frFilter: 'cur', seqFilter: 'all', _raf: 0, _tolSnap: false, _tolT: 0,

  /* ---------- rascunho, desfazer e salvar ---------- */
  reset() {
    this.d = clone(CC); ED.adopt(SAVED); this.newBlobs = new Set(); this.hist = []; this.sel = []; this.seqSel = []; this.pick = []; this.report = null; this.suggest = null; this.quick = false; this.fresh = false;
    if (!this.imOf(this.img)) this.img = this.d.images.length ? this.d.images[0].id : null;
    if (this.seqFilter !== 'all' && !this.imOf(this.seqFilter)) this.seqFilter = 'all';
    this.touch();
  },
  norm() { return sanitizeComp(clone(this.d)); },
  isDirty() { return !!this.d && (this.d.images.some(im => this.newBlobs.has(im.id)) || JSON.stringify(this.norm()) !== JSON.stringify(CC)); },
  touch() { this.ver++; this.schedule(); },
  schedule() { if (!this._raf) this._raf = requestAnimationFrame(() => { this._raf = 0; if (VIEW === 'config') this.render(); }); },
  // Desfazer guarda imagens, recortes e sequências juntos: adicionar ou remover uma imagem também volta.
  snap() {
    const s = JSON.stringify({ images: this.d.images, frames: this.d.frames, states: this.d.states, nextId: this.d.nextId, nextImg: this.d.nextImg, scale: this.d.scale, alpha: this.d.alpha, img: this.img });
    if (this.hist[this.hist.length - 1] !== s) this.hist.push(s);
    if (this.hist.length > 80) this.hist.shift();
  },
  undo() {
    const s = this.hist.pop(); if (!s) return;
    const o = JSON.parse(s), img = o.img; delete o.img; Object.assign(this.d, o);
    this.img = this.imOf(img) ? img : this.d.images.length ? this.d.images[0].id : null;
    if (this.seqFilter !== 'all' && !this.imOf(this.seqFilter)) this.seqFilter = 'all';
    const ids = new Set(this.d.frames.map(f => f.id)); this.sel = this.sel.filter(id => ids.has(id)); this.pick = this.pick.filter(id => ids.has(id)); this.seqSel = [];
    if (this.report && !this.imOf(this.report.img)) this.report = null;
    this.touch(); toast('Desfeito.');
  },
  async save() {
    const c = this.norm(), had = new Set(CC.images.map(im => im.id));
    for (const im of c.images) { const sh = this.sh(im.id); if (sh) { im.w = sh.w; im.h = sh.h; if (sh.blob) im.size = sh.blob.size; } }
    // Primeiro grava as imagens novas; só depois troca a configuração. Se o navegador recusar, nada muda.
    const store = c.images.filter(im => { const sh = this.sh(im.id); return sh && sh.blob && (!had.has(im.id) || this.newBlobs.has(im.id)); });
    try { for (const im of store) await IDB.set(imgDbKey(im.id), this.sh(im.id).blob); }
    catch (e) { toast('O navegador não deixou salvar as imagens. Nada foi alterado.'); return false; }
    const gone = CC.images.filter(im => !c.images.some(x => x.id === im.id)).map(im => im.id);
    CC = c; saveComp(); SAVED.adopt(ED, c.images.map(im => im.id));
    for (const id of gone) { try { await IDB.del(imgDbKey(id)); } catch (e) {} }
    this.newBlobs = new Set(); this.d = clone(CC);
    Comp.player.restart(); Comp.paint(); paintBackupSize();
    for (const id of ['#ceSaved', '#ceSaved2']) { const el = $(id); el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => { el.hidden = true; }, 4000); }
    toast('Companheiro salvo. Já aparece na tela Hoje.'); this.touch(); return true;
  },
  discard() { if (!this.isDirty() || !confirm('Descartar as alterações não salvas do companheiro?')) return; this.reset(); toast('Alterações descartadas.'); },

  /* ---------- imagens ---------- */
  imOf(id) { return this.d ? this.d.images.find(im => im.id === id) || null : null; },
  im() { return this.imOf(this.img); },
  imNum(id) { return this.d.images.findIndex(im => im.id === id) + 1; },
  multi() { return this.d.images.length > 1; },
  sh(id = this.img) { const s = ED.get(id); return s && s.img ? s : null; },
  ensureSh(id = this.img) { const s = this.sh(id), im = this.imOf(id); if (s && im) s.ensure(im.key, this.d.alpha); return s && im ? s : null; },
  setImg(id) { if (!this.imOf(id) || id === this.img) return; this.img = id; this.sel = []; this.picking = false; this.touch(); },
  framesOf(id) { return this.d.frames.filter(f => f.img === id); },
  nextImgId() {
    let n = this.d.nextImg;
    for (const id of [...ED.m.keys(), ...CC.images.map(im => im.id)]) n = Math.max(n, (parseInt(id.slice(1), 10) || 0) + 1);
    return n;
  },
  // Altura típica do personagem numa imagem (mediana dos pixels visíveis dos recortes usados nas sequências, ou de todos).
  charHeight(id) {
    const sh = this.ensureSh(id); if (!sh) return null;
    const used = this.usedIds(); let fs = this.framesOf(id).filter(f => used.has(f.id)); if (!fs.length) fs = this.framesOf(id);
    const hs = fs.map(f => (sh.bbox(f) || f).h).filter(h => h > 0);
    return hs.length ? median(hs) : null;
  },
  niceK(r) {
    const c = [0.25, 0.5, 1, 1.5, 2, 3, 4]; let best = c[0];
    for (const x of c) if (Math.abs(Math.log(x / r)) < Math.abs(Math.log(best / r))) best = x;
    return Math.abs(best / r - 1) <= 0.12 ? best : sanitizeK(Math.round(r * 20) / 20);
  },
  setK(k) { const im = this.im(); if (!im) return; this.snap(); im.k = sanitizeK(k); this.touch(); },
  matchSize() {
    const base = this.d.images[0], cur = this.im(); if (!base || !cur || base.id === cur.id) return;
    const h1 = this.charHeight(base.id), h2 = this.charHeight(cur.id), n = this.imNum(cur.id);
    if (!this.sh(base.id)) { toast('O arquivo da imagem 1 não está neste navegador.'); return; }
    if (!h1) { toast('A imagem 1 ainda não tem recortes. Recorte os sprites dela primeiro.'); return; }
    if (!h2) { toast(`A imagem ${n} ainda não tem recortes. Detecte ou recorte os sprites dela primeiro.`); return; }
    const k = this.niceK(h1 * base.k / h2);
    this.snap(); cur.k = k; this.touch();
    toast(`Imagem ${n} em ${pctOf(k)}: personagem com ${Math.round(h2 * k)} px de altura, como na imagem 1 (${Math.round(h1 * base.k)} px).`);
  },
  async readPng(file) {
    if (!file) return null;
    if (!(file.type === 'image/png' || /\.png$/i.test(file.name))) { toast('Escolha um arquivo PNG.'); return null; }
    this.loading(file.size > 1.5e6 ? 'Carregando imagem grande… pode levar alguns segundos.' : 'Carregando imagem…');
    await new Promise(r => setTimeout(r, 30));
    const sh = new SheetImage();
    try { await sh.load(new Blob([file], { type: 'image/png' })); }
    catch (e) { this.loading(null); toast('Não consegui abrir essa imagem. Confira se é um PNG válido.'); return null; }
    this.loading(null);
    if (sh.w * sh.h > 16e6) { toast('Imagem grande demais (máximo de 16 megapixels).'); return null; }
    return sh;
  },
  // Adiciona uma folha ao companheiro. Nunca apaga recortes nem sequências: “começar do zero” só acontece quando escolhido na importação rápida.
  async addImageFile(file) {
    const quick = this.quick, fresh = this.fresh; this.fresh = false;
    if (!file) { this.quick = false; return; }
    if (!fresh && this.d.images.length >= MAX_IMAGES) { this.quick = false; toast(`O companheiro já tem ${MAX_IMAGES} imagens, o máximo. Remova uma pra adicionar outra.`); return; }
    const sh = await this.readPng(file); if (!sh) { this.quick = false; return; }
    this.snap();
    if (fresh) { this.d.images = []; this.d.frames = []; for (const s of SKEYS) this.d.states[s].seq = []; }
    const first = !this.d.images.length && !this.d.frames.length, n = this.nextImgId(), id = 'i' + n;
    const im = newImage(id, file.name, file.size, sh.w, sh.h);
    im.key = { on: !!(sh.info.bgSet && quick), mode: 'borda', colors: sh.info.bgSet ? clone(sh.info.bgSet) : [], tol: 24, trim: sh.info.pattern ? 1 : 0 };
    // Companheiro vazio: começa com alinhamento pelos pés (o “pelo recorte” existe pra manter companheiros antigos iguais).
    if (first) for (const s of SKEYS) this.d.states[s].align = 'pes';
    this.d.images.push(im); this.d.nextImg = n + 1; ED.put(id, sh);
    this.img = id; this.sel = []; this.pick = []; this.seqSel = []; this.report = null; this.suggest = null; this.view = 'proc'; this.picking = false;
    if (this.multi()) this.seqFilter = id;
    sh.ensure(im.key, this.d.alpha); this.touch();
    const k = this.d.images.length;
    if (!quick) { toast(first ? 'Imagem carregada.' : `Imagem ${k} adicionada. Os recortes e as sequências que já existiam continuam iguais.`); return; }
    if (sh.info.bgSet) toast(sh.info.pattern ? 'Fundo quadriculado pintado na imagem removido. Compare em Original e Processada.' : 'Fundo sólido removido. Compare em Original e Processada.');
    else if (!first) toast(`Imagem ${k} adicionada. Os recortes e as sequências que já existiam continuam iguais.`);
    await this.detect(false);
  },
  // Arquivo de uma imagem que não está neste navegador (backup importado sem as imagens): escolhe o mesmo PNG de novo.
  async relinkImage(file) {
    const im = this.im(); if (!im || !file) return;
    const sh = await this.readPng(file); if (!sh) return;
    if (im.w && (sh.w !== im.w || sh.h !== im.h) && !confirm(`Essa imagem tem ${sh.w}×${sh.h} px, mas a imagem ${this.imNum(im.id)} tinha ${im.w}×${im.h} px. Os recortes podem ficar fora do lugar. Usar mesmo assim?`)) return;
    this.snap(); Object.assign(im, { name: String(file.name).slice(0, 120), size: file.size, w: sh.w, h: sh.h });
    ED.put(im.id, sh); this.newBlobs.add(im.id); sh.ensure(im.key, this.d.alpha); this.touch(); toast('Arquivo da imagem recuperado. Salve pra guardar.');
  },
  quickStart() {
    this.quick = false; this.fresh = false;
    if (!this.d.images.length && !this.d.frames.length) { this.quick = true; this.go(1); $('#ceFile').click(); return; }
    const nf = this.d.frames.length, ni = this.d.images.length, nq = SKEYS.reduce((a, s) => a + this.d.states[s].seq.length, 0);
    $('#ceChoiceTxt').textContent = `O companheiro já tem ${ni} ${ni === 1 ? 'imagem' : 'imagens'}, ${nf} recorte${nf === 1 ? '' : 's'} e ${nq} quadro${nq === 1 ? '' : 's'} nas sequências. O que fazer com a nova imagem?`;
    $('#ceChoice').hidden = false; $('#ceChAdd').focus();
  },
  choose(v) {
    $('#ceChoice').hidden = true; if (v !== 'add' && v !== 'fresh') return;
    this.quick = true; this.fresh = v === 'fresh'; this.go(1); $('#ceFile').click();
  },
  loading(msg) { const el = $('#ceLoading'); el.hidden = !msg; el.textContent = msg || ''; },
  removeImage(id = this.img) {
    const im = this.imOf(id); if (!im) return;
    const n = this.imNum(id), ids = new Set(this.framesOf(id).map(f => f.id));
    const sts = SKEYS.filter(s => this.d.states[s].seq.some(it => ids.has(it.f))), q = SKEYS.reduce((a, s) => a + this.d.states[s].seq.filter(it => ids.has(it.f)).length, 0);
    let msg = `Remover a imagem ${n} (${im.name})?`;
    if (ids.size) msg += ` Os ${ids.size} recorte${ids.size === 1 ? '' : 's'} dela saem junto` + (q ? ` e ${q} quadro${q === 1 ? '' : 's'} saem da${sts.length > 1 ? 's' : ''} sequência${sts.length > 1 ? 's' : ''} de ${sts.map(s => SNAME[s]).join(', ')}` : '') + '.';
    msg += ' As outras imagens não mudam. Dá pra desfazer, e o companheiro salvo só muda quando você salvar.';
    if (!confirm(msg)) return;
    this.snap(); const map = {}; ids.forEach(x => { map[x] = null; });
    this.d.frames = this.d.frames.filter(f => !ids.has(f.id)); this.remap(map);
    this.d.images = this.d.images.filter(x => x.id !== id);
    this.sel = this.sel.filter(x => !ids.has(x)); this.pick = this.pick.filter(x => !ids.has(x)); this.seqSel = [];
    if (this.seqFilter === id) this.seqFilter = 'all';
    if (this.report && this.report.img === id) { this.report = null; this.suggest = null; }
    this.img = this.d.images.length ? this.d.images[Math.min(n - 1, this.d.images.length - 1)].id : null;
    this.touch(); toast(`Imagem ${n} removida. Desfazer traz de volta.`);
  },
  setKey(patch, snap = true) { const im = this.im(); if (!im) return; if (snap) this.snap(); Object.assign(im.key, patch); this.ensureSh(); this.touch(); },
  pickAt(x, y) {
    const sh = this.sh(), im = this.im();
    if (!sh || x < 0 || y < 0 || x >= sh.w || y >= sh.h) return;
    const c = sh.pixel(Math.floor(x), Math.floor(y)).slice(0, 3), cs = keyColors(im.key).slice();
    if (!cs.some(k => Math.abs(k[0] - c[0]) <= 6 && Math.abs(k[1] - c[1]) <= 6 && Math.abs(k[2] - c[2]) <= 6)) cs.push(c);
    this.picking = false; this.setKey({ colors: cs.slice(-6), on: true });
  },

  /* ---------- utilidades de recortes ---------- */
  frame(id) { return this.d.frames.find(f => f.id === id); },
  num(id) { return this.d.frames.findIndex(f => f.id === id) + 1; },
  usedIds() { const s = new Set(); for (const k of SKEYS) for (const it of this.d.states[k].seq) s.add(it.f); return s; },
  usedIn(id) { return SKEYS.filter(k => this.d.states[k].seq.some(it => it.f === id)); },
  newFrame(r, img = this.img) { const id = 'f' + this.d.nextId++; return { id, img, x: r.x, y: r.y, w: r.w, h: r.h, o: { x: r.x, y: r.y, w: r.w, h: r.h } }; },
  clampRect(r, sh = this.sh()) {
    const W = sh ? sh.w : Math.max(1, r.x + r.w), H = sh ? sh.h : Math.max(1, r.y + r.h); r.w = clamp(Math.round(r.w), 1, W); r.h = clamp(Math.round(r.h), 1, H);
    r.x = clamp(Math.round(r.x), 0, W - r.w); r.y = clamp(Math.round(r.y), 0, H - r.h); return r;
  },
  // Troca os recortes desta imagem que não estão em nenhuma sequência pelos novos. Os usados e os das outras imagens ficam.
  replaceLibrary(rects, img = this.img) {
    const used = this.usedIds(), keep = this.d.frames.filter(f => f.img !== img || used.has(f.id)), add = [];
    for (const r of rects) { if (keep.some(f => f.img === img && iou(f, r) > 0.85)) continue; add.push(this.newFrame(r, img)); }
    let at = -1; keep.forEach((f, i) => { if (f.img === img) at = i; });
    if (at < 0) { const order = this.d.images.map(im => im.id), mine = order.indexOf(img); keep.forEach((f, i) => { if (order.indexOf(f.img) < mine) at = i; }); }
    keep.splice(at + 1, 0, ...add);
    this.d.frames = keep; return { added: add.length, kept: keep.filter(f => f.img === img).length - add.length };
  },
  remap(map) {
    for (const k of SKEYS) { const st = this.d.states[k]; st.seq = st.seq.filter(it => map[it.f] !== null).map(it => map[it.f] ? { f: map[it.f], dx: it.dx, dy: it.dy } : it); }
  },
  async contentBox(f) {
    // Caixa do personagem que encosta no recorte, olhando um pouco além das bordas pra não cortar partes.
    const sh = this.ensureSh(f.img); if (!sh) return null;
    const pad = Math.max(8, Math.round(Math.max(f.w, f.h) * 0.25)), x0 = Math.max(0, f.x - pad), y0 = Math.max(0, f.y - pad), x1 = Math.min(sh.w, f.x + f.w + pad), y1 = Math.min(sh.h, f.y + f.h + pad);
    const comps = mergeBoxes(await ccl(sh.mask, sh.w, x0, y0, x1 - x0, y1 - y0), this.det.gap);
    const hit = comps.filter(b => b.x < f.x + f.w && b.x + b.w > f.x && b.y < f.y + f.h && b.y + b.h > f.y);
    if (!hit.length) return null;
    const x = Math.min(...hit.map(b => b.x)), y = Math.min(...hit.map(b => b.y)), x2 = Math.max(...hit.map(b => b.x + b.w)), y2 = Math.max(...hit.map(b => b.y + b.h));
    return { x, y, w: x2 - x, h: y2 - y };
  },

  /* ---------- etapa 2: detecção, grade e recortes (sempre na imagem escolhida) ---------- */
  progress(p, txt) {
    const box = $('#ceProg'); box.hidden = p === null;
    if (p !== null) { $('#ceProgTxt').textContent = txt; $('#ceProgBar').style.width = Math.round(p * 100) + '%'; }
  },
  // snap = false quando faz parte de “adicionar imagem” (um Desfazer só tira a imagem e os recortes dela juntos).
  async detect(snap = true) {
    const im = this.im(), sh = this.ensureSh();
    if (!sh) { this.quick = false; toast(im ? 'O arquivo desta imagem não está neste navegador. Escolha o arquivo de novo na etapa 1.' : 'Carregue uma imagem primeiro.'); return; }
    if (this.job) return;
    const job = this.job = { cancel: false }, id = im.id;
    if (!this.adv) this.setAdv(true);
    this.step = 2; this.render(); this.progress(0, 'Procurando sprites…');
    let res = null;
    try { res = await detectSprites(sh, this.det, job, p => this.progress(p, 'Procurando sprites… ' + Math.round(p * 100) + '%')); }
    catch (e) { console.warn(e); }
    this.job = null; this.progress(null); this.quick = false;
    if (job.cancel) { toast('Detecção cancelada. Nada foi mudado.'); return; }
    if (!res) { toast('A detecção falhou nesta imagem. Você pode recortar manualmente.'); return; }
    if (!this.imOf(id)) return;
    if (snap) this.snap();
    const r = this.replaceLibrary(res.boxes, id);
    this.report = { img: id, res, added: r.added, kept: r.kept }; this.suggest = res.grid; this.sel = []; this.pick = [];
    this.touch();
  },
  cancelJob() { if (this.job) this.job.cancel = true; },
  gridRects(g, ignoreEmpty, sh) {
    const { cols, rows } = gridDims(g, sh.w, sh.h), out = [];
    for (let i = 0; i < cols * rows; i++) { const r = gridRect(g, i, sh.w, sh.h); if (!ignoreEmpty || sh.bbox(r)) out.push(r); }
    return out;
  },
  applyGrid(g) {
    const im = this.im(), sh = this.ensureSh(); if (!sh) return;
    this.snap(); if (g) im.grid = { fw: g.fw, fh: g.fh, mx: g.mx, my: g.my, sx: g.sx, sy: g.sy };
    const rects = this.gridRects(im.grid, $('#gEmpty').checked, sh), r = this.replaceLibrary(rects, im.id);
    this.report = { img: im.id, grid: true, n: rects.length, added: r.added, kept: r.kept }; this.sel = []; this.pick = []; this.touch();
  },
  addFrame() {
    const sh = this.sh(), im = this.im(); if (!sh) return;
    const s0 = this.frame(this.sel[0]), base = s0 && s0.img === im.id ? s0 : { w: Math.min(im.grid.fw, sh.w), h: Math.min(im.grid.fh, sh.h) };
    const wrap = $('#ceSheetWrap'), cx = (wrap.scrollLeft + wrap.clientWidth / 2) / this.z, cy = (wrap.scrollTop + Math.min(wrap.clientHeight, sh.h * this.z) / 2) / this.z;
    this.snap(); const f = this.newFrame(this.clampRect({ x: cx - base.w / 2, y: cy - base.h / 2, w: base.w, h: base.h }));
    this.d.frames.push(f); this.sel = [f.id]; this.touch();
  },
  dupFrames() {
    if (!this.sel.length) return; this.snap(); const out = [];
    for (const id of this.sel) { const f = this.frame(id), k = this.d.frames.indexOf(f), c = this.newFrame(f, f.img); c.o = Object.assign({}, f.o); this.d.frames.splice(k + 1, 0, c); out.push(c.id); }
    this.sel = out; this.touch(); toast(out.length === 1 ? 'Recorte duplicado.' : out.length + ' recortes duplicados.');
  },
  delFrames() {
    if (!this.sel.length) return;
    const used = this.sel.filter(id => this.usedIn(id).length);
    if (used.length && !confirm((used.length === 1 ? 'Esse recorte está' : used.length + ' recortes estão') + ' em sequências. Excluir e tirar das sequências também?')) return;
    this.snap(); const del = new Set(this.sel), map = {}; del.forEach(id => { map[id] = null; });
    this.d.frames = this.d.frames.filter(f => !del.has(f.id)); this.remap(map); this.pick = this.pick.filter(id => !del.has(id)); this.sel = []; this.touch();
  },
  mergeFrames() {
    if (this.sel.length < 2) { toast('Selecione 2 ou mais recortes pra unir (Ctrl + clique).'); return; }
    const fs = this.sel.map(id => this.frame(id));
    if (new Set(fs.map(f => f.img)).size > 1) { toast('Só dá pra unir recortes da mesma imagem.'); return; }
    const x = Math.min(...fs.map(f => f.x)), y = Math.min(...fs.map(f => f.y)), x2 = Math.max(...fs.map(f => f.x + f.w)), y2 = Math.max(...fs.map(f => f.y + f.h));
    this.snap(); const n = this.newFrame({ x, y, w: x2 - x, h: y2 - y }, fs[0].img), k = Math.min(...fs.map(f => this.d.frames.indexOf(f))), map = {};
    fs.forEach(f => { map[f.id] = n.id; }); this.d.frames = this.d.frames.filter(f => !map[f.id]); this.d.frames.splice(k, 0, n); this.remap(map);
    for (const s of SKEYS) { const q = this.d.states[s].seq; this.d.states[s].seq = q.filter((it, i) => !(i > 0 && it.f === n.id && q[i - 1].f === n.id)); }
    this.sel = [n.id]; this.touch();
  },
  async splitFrames() {
    if (!this.sel.length) { toast('Selecione um recorte pra dividir.'); return; }
    const plan = [];
    for (const id of this.sel) {
      const f = this.frame(id), sh = this.ensureSh(f.img); if (!sh) continue;
      let parts = readingOrder(mergeBoxes(await ccl(sh.mask, sh.w, f.x, f.y, f.w, f.h), 0).filter(b => b.n >= this.det.min));
      if (parts.length < 2) {
        // Personagens encostados: corta na coluna ou linha com menos pixels, perto do meio (a que for mais "fina").
        const cut = vert => {
          const len = vert ? f.w : f.h, across = vert ? f.h : f.w; if (len < 4) return null;
          let best = -1, bestN = Infinity;
          for (let t = Math.floor(len * 0.25); t <= Math.ceil(len * 0.75); t++) {
            let c = 0; for (let u = 0; u < across; u++) { const x = vert ? f.x + t : f.x + u, y = vert ? f.y + u : f.y + t; c += sh.mask[y * sh.w + x]; }
            if (c < bestN || (c === bestN && Math.abs(t - len / 2) < Math.abs(best - len / 2))) { bestN = c; best = t; }
          }
          return { vert, t: best, score: bestN / across };
        };
        const cs = [cut(true), cut(false)].filter(Boolean).sort((a, b) => a.score - b.score); if (!cs.length) continue;
        const { vert, t } = cs[0];
        parts = vert ? [{ x: f.x, y: f.y, w: t, h: f.h }, { x: f.x + t, y: f.y, w: f.w - t, h: f.h }] : [{ x: f.x, y: f.y, w: f.w, h: t }, { x: f.x, y: f.y + t, w: f.w, h: f.h - t }];
      }
      plan.push({ f, parts });
    }
    if (!plan.length) { toast('Esse recorte é pequeno demais pra dividir.'); return; }
    this.snap(); const sel = [], map = {};
    for (const { f, parts } of plan) {
      const nf = parts.map(p => this.newFrame(p, f.img)), k = this.d.frames.indexOf(f);
      this.d.frames.splice(k, 1, ...nf); map[f.id] = nf[0].id; sel.push(...nf.map(x => x.id));
    }
    this.remap(map); this.sel = sel; this.touch(); toast(sel.length + ' recortes depois de dividir.');
  },
  async fitFrames(center) {
    if (!this.sel.length) return;
    const res = [];
    for (const id of this.sel) { const f = this.frame(id), b = await this.contentBox(f); if (b) res.push([f, b]); }
    if (!res.length) { toast('Não achei pixels do personagem nesse recorte.'); return; }
    this.snap();
    for (const [f, b] of res) {
      const sh = this.sh(f.img);
      if (center) Object.assign(f, this.clampRect({ x: b.x + b.w / 2 - f.w / 2, y: b.y + b.h / 2 - f.h / 2, w: f.w, h: f.h }, sh));
      else Object.assign(f, this.clampRect({ x: b.x, y: b.y, w: b.w, h: b.h }, sh));
    }
    this.touch();
  },
  restoreFrames() { if (!this.sel.length) return; this.snap(); for (const id of this.sel) { const f = this.frame(id); Object.assign(f, f.o); } this.touch(); },
  setFrameField(k, v) {
    const f = this.frame(this.sel[0]); if (!f || this.sel.length !== 1) return;
    const n = parseInt(v, 10); if (isNaN(n)) { this.touch(); return; }
    this.snap(); f[k] = n; Object.assign(f, this.clampRect(f, this.sh(f.img))); this.touch();
  },
  moveLib(fromId, toId, after) {
    const a = this.d.frames, i = a.findIndex(f => f.id === fromId); if (i < 0) return;
    this.snap(); const [x] = a.splice(i, 1); let j = a.findIndex(f => f.id === toId); if (after) j++; a.splice(j, 0, x); this.touch();
  },

  /* ---------- etapa 2: folha interativa (mostra a imagem escolhida e só os recortes dela) ---------- */
  sheetZoom() {
    const sh = this.sh(); if (!sh) return 1;
    const v = $('#ceZoom').value, avail = Math.max(120, $('#ceSheetWrap').clientWidth - 2);
    let z = v === 'auto' ? (avail / sh.w >= 2 ? Math.min(6, Math.floor(avail / sh.w)) : avail / sh.w) : +v;
    const lim = Math.min(8192 / sh.w, 16384 / sh.h, Math.sqrt(40e6 / (sh.w * sh.h)));
    return Math.max(0.05, Math.min(z, lim));
  },
  imgPt(e) { const cv = $('#ceSheet'), r = cv.getBoundingClientRect(), sh = this.sh(); return { x: (e.clientX - r.left) * (cv.width / r.width) / this.z, y: (e.clientY - r.top) * (cv.height / r.height) / this.z, s: r.width / (sh ? sh.w : 1) }; },
  handles(f) { return { nw: [f.x, f.y], n: [f.x + f.w / 2, f.y], ne: [f.x + f.w, f.y], e: [f.x + f.w, f.y + f.h / 2], se: [f.x + f.w, f.y + f.h], s: [f.x + f.w / 2, f.y + f.h], sw: [f.x, f.y + f.h], w: [f.x, f.y + f.h / 2] }; },
  hitHandle(p) {
    if (this.sel.length !== 1) return null; const f = this.frame(this.sel[0]); if (!f || f.img !== this.img) return null;
    const tol = 7 / p.s; for (const [k, [x, y]] of Object.entries(this.handles(f))) if (Math.abs(p.x - x) <= tol && Math.abs(p.y - y) <= tol) return k;
    return null;
  },
  hitFrame(p) {
    const inside = f => f.img === this.img && p.x >= f.x && p.x < f.x + f.w && p.y >= f.y && p.y < f.y + f.h;
    for (const id of this.sel.slice().reverse()) { const f = this.frame(id); if (f && inside(f)) return f; }
    for (let k = this.d.frames.length - 1; k >= 0; k--) if (inside(this.d.frames[k])) return this.d.frames[k];
    return null;
  },
  sheetDown(e) {
    if (!this.sh() || e.button > 0) return;
    const cv = $('#ceSheet'), p = this.imgPt(e); cv.focus({ preventScroll: true });
    if (this.picking) { this.pickAt(p.x, p.y); return; }
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    const multi = e.shiftKey || e.ctrlKey || e.metaKey, h = this.hitHandle(p);
    if (h) { const f = this.frame(this.sel[0]); this.drag = { t: 'resize', h, id: f.id, p0: p, o: { x: f.x, y: f.y, w: f.w, h: f.h } }; return; }
    const f = this.hitFrame(p);
    if (f) {
      if (multi) { this.sel = this.sel.includes(f.id) ? this.sel.filter(x => x !== f.id) : this.sel.concat(f.id); this.drag = null; this.paintSel(); return; }
      if (!this.sel.includes(f.id)) this.sel = [f.id];
      this.drag = { t: 'move', p0: p, o: this.sel.map(id => this.frame(id)).filter(g => g && g.img === this.img).map(g => ({ id: g.id, x: g.x, y: g.y })) };
      this.paintSel(); return;
    }
    if (!multi) this.sel = [];
    this.drag = { t: 'new', p0: p, p1: p }; this.paintSel();
  },
  sheetMove(e) {
    const sh = this.sh(); if (!sh) return;
    const p = this.imgPt(e), cv = $('#ceSheet'), d = this.drag;
    if (!d) { const h = this.picking ? null : this.hitHandle(p); cv.style.cursor = this.picking ? 'copy' : h ? ({ n: 'ns', s: 'ns', e: 'ew', w: 'ew', nw: 'nwse', se: 'nwse', ne: 'nesw', sw: 'nesw' }[h] + '-resize') : this.hitFrame(p) ? 'move' : 'crosshair'; return; }
    if (d.t === 'new') { d.p1 = p; this.drawSheet(); return; }
    const dx = Math.round(p.x - d.p0.x), dy = Math.round(p.y - d.p0.y);
    if (!d.moved && !dx && !dy) return;
    if (!d.moved) { this.snap(); d.moved = true; }
    if (d.t === 'move') for (const o of d.o) { const f = this.frame(o.id); f.x = clamp(o.x + dx, 0, sh.w - f.w); f.y = clamp(o.y + dy, 0, sh.h - f.h); }
    else {
      const f = this.frame(d.id), o = d.o; let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
      if (d.h.includes('w')) x1 = clamp(Math.round(p.x), 0, x2 - 1); if (d.h.includes('e')) x2 = clamp(Math.round(p.x), x1 + 1, sh.w);
      if (d.h.includes('n')) y1 = clamp(Math.round(p.y), 0, y2 - 1); if (d.h.includes('s')) y2 = clamp(Math.round(p.y), y1 + 1, sh.h);
      f.x = x1; f.y = y1; f.w = x2 - x1; f.h = y2 - y1;
    }
    this.drawSheet(); this.paintInspector();
  },
  sheetUp() {
    const d = this.drag; this.drag = null; if (!d) return;
    if (d.t === 'new') {
      const sh = this.sh(); if (!sh) return;
      const x = Math.max(0, Math.floor(Math.min(d.p0.x, d.p1.x))), y = Math.max(0, Math.floor(Math.min(d.p0.y, d.p1.y))), x2 = Math.min(sh.w, Math.ceil(Math.max(d.p0.x, d.p1.x))), y2 = Math.min(sh.h, Math.ceil(Math.max(d.p0.y, d.p1.y)));
      if (x2 - x >= 2 && y2 - y >= 2) { this.snap(); const f = this.newFrame({ x, y, w: x2 - x, h: y2 - y }); this.d.frames.push(f); this.sel = [f.id]; }
      this.touch(); return;
    }
    if (d.moved) this.touch(); else this.paintSel();
  },
  sheetKey(e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel.length) { e.preventDefault(); this.delFrames(); return; }
    const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!m || !this.sel.length) return; e.preventDefault(); this.snap();
    for (const id of this.sel) { const f = this.frame(id); if (e.shiftKey) { f.w += m[0]; f.h += m[1]; } else { f.x += m[0]; f.y += m[1]; } Object.assign(f, this.clampRect(f, this.sh(f.img))); }
    this.touch();
  },
  drawSheet() {
    const cv = $('#ceSheet'), ctx = cv.getContext('2d'), sh = this.ensureSh();
    $('#ceSheetEmpty').hidden = !!sh;
    $('#ceSheetEmpty').textContent = this.im() ? 'O arquivo desta imagem não está neste navegador. Escolha o arquivo de novo na etapa 1.' : 'Carregue uma imagem na etapa 1.';
    if (!sh) { cv.width = 0; cv.height = 0; return; }
    const z = this.z = this.sheetZoom(), W = Math.ceil(sh.w * z), H = Math.ceil(sh.h * z);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, W, H); ctx.drawImage(this.view === 'orig' ? sh.img : sh.src, 0, 0, sh.w * z, sh.h * z);
    const cur = new Set(this.d.states[this.state].seq.map(it => it.f)), used = this.usedIds(), sel = new Set(this.sel);
    ctx.font = 'bold 11px ui-monospace,monospace'; ctx.lineWidth = 1;
    this.d.frames.forEach((f, k) => {
      if (f.img !== this.img) return;
      const x = f.x * z, y = f.y * z, w = f.w * z, h = f.h * z, isSel = sel.has(f.id);
      ctx.setLineDash(used.has(f.id) || isSel ? [] : [4, 3]); ctx.lineWidth = isSel ? 2 : 1;
      ctx.strokeStyle = isSel ? '#F5B83D' : cur.has(f.id) ? '#3DDC97' : used.has(f.id) ? '#B49CFF' : 'rgba(90,169,255,.95)';
      ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.max(1, Math.round(w) - 1), Math.max(1, Math.round(h) - 1));
      if (w >= 14 && h >= 12) { const t = String(k + 1), tw = ctx.measureText(t).width + 6; ctx.setLineDash([]); ctx.fillStyle = isSel ? '#F5B83D' : 'rgba(15,17,21,.78)'; ctx.fillRect(Math.round(x), Math.round(y), tw, 14); ctx.fillStyle = isSel ? '#0F1115' : '#E8EAED'; ctx.fillText(t, Math.round(x) + 3, Math.round(y) + 11); }
    });
    ctx.setLineDash([]);
    if (this.sel.length === 1) { const f = this.frame(this.sel[0]); if (f && f.img === this.img) for (const [hx, hy] of Object.values(this.handles(f))) { ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#0F1115'; ctx.lineWidth = 1; ctx.fillRect(Math.round(hx * z) - 4, Math.round(hy * z) - 4, 8, 8); ctx.strokeRect(Math.round(hx * z) - 3.5, Math.round(hy * z) - 3.5, 7, 7); } }
    const d = this.drag;
    if (d && d.t === 'new') { const x = Math.min(d.p0.x, d.p1.x) * z, y = Math.min(d.p0.y, d.p1.y) * z; ctx.setLineDash([5, 3]); ctx.strokeStyle = '#F5B83D'; ctx.lineWidth = 2; ctx.strokeRect(x, y, Math.abs(d.p1.x - d.p0.x) * z, Math.abs(d.p1.y - d.p0.y) * z); ctx.setLineDash([]); }
  },
  // Miniatura de um recorte (cada recorte sabe de qual imagem é).
  thumb(cv, f, size, set = ED) {
    const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); if (!f) return;
    const sh = set.get(f.img); if (!sh || !sh.src) return;
    let s = Math.min(size / f.w, size / f.h); if (s >= 1) s = Math.floor(s);
    g.imageSmoothingEnabled = false; g.drawImage(sh.src, f.x, f.y, f.w, f.h, Math.round((size - f.w * s) / 2), Math.round((size - f.h * s) / 2), Math.round(f.w * s), Math.round(f.h * s));
  },
  // Miniatura da imagem inteira (lista de imagens).
  thumbImg(cv, id, size) {
    const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); const sh = this.ensureSh(id); if (!sh) return;
    const s = Math.min(size / sh.w, size / sh.h); g.imageSmoothingEnabled = s >= 1 ? false : true;
    g.drawImage(sh.src, Math.round((size - sh.w * s) / 2), Math.round((size - sh.h * s) / 2), Math.round(sh.w * s), Math.round(sh.h * s));
  },
  badge(f) { return this.multi() ? `<span class="ib">${this.imNum(f.img)}</span>` : ''; },
  paintSel() {
    $$('#frGallery .fthumb').forEach(el => el.classList.toggle('sel', this.sel.includes(el.dataset.id)));
    this.drawSheet(); this.paintInspector();
  },
  paintInspector() {
    const one = this.sel.length === 1 ? this.frame(this.sel[0]) : null;
    for (const [id, k] of [['#frX', 'x'], ['#frY', 'y'], ['#frW', 'w'], ['#frH', 'h']]) { const el = $(id); el.disabled = !one; if (document.activeElement !== el) el.value = one ? one[k] : ''; }
    const info = $('#frInfo'), n = this.d.frames.length, here = this.framesOf(this.img).length;
    if (one) { const u = this.usedIn(one.id).map(s => SNAME[s]); info.textContent = `Recorte ${this.num(one.id)} de ${n}` + (this.multi() ? ` · imagem ${this.imNum(one.img)}` : '') + ` · ${one.w}×${one.h} px em x ${one.x}, y ${one.y}` + (u.length ? ' · usado em ' + u.join(', ') : ''); }
    else info.textContent = this.sel.length ? this.sel.length + ' recortes selecionados.' : n ? 'Clique num recorte pra selecionar. Ctrl + clique seleciona vários.' : '';
    $('#frCount').textContent = n ? (this.multi() ? `${here} recorte${here === 1 ? '' : 's'} nesta imagem · ${n} no total` : `${n} recorte${n === 1 ? '' : 's'}`) + ` · ${this.sel.length} selecionado${this.sel.length === 1 ? '' : 's'}` : 'Nenhum recorte ainda';
    const zc = $('#frZoom'); zc.width = zc.height = 160; this.thumb(zc, one || this.frame(this.sel[0]), 160);
    for (const id of ['#frDup', '#frDel', '#frFit', '#frCenter', '#frRestore', '#frSplit']) $(id).disabled = !this.sel.length;
    $('#frMerge').disabled = this.sel.length < 2;
  },

  /* ---------- etapa 3: sequência do estado (pode misturar recortes de imagens diferentes) ---------- */
  seq() { return this.d.states[this.state].seq; },
  libFrames() { return this.seqFilter === 'all' ? this.d.frames : this.framesOf(this.seqFilter); },
  addPicked(all) {
    const ids = all ? this.libFrames().map(f => f.id) : this.pick.slice();
    if (!ids.length) { toast(all ? 'Não há recortes. Volte na etapa 2.' : 'Clique nos recortes que vão entrar na animação.'); return; }
    this.snap(); this.seq().push(...ids.map(f => ({ f, dx: 0, dy: 0 }))); this.pick = []; this.seqSel = []; this.touch();
  },
  seqOp(op) {
    const q = this.seq(), s = this.seqSel.slice().sort((a, b) => a - b);
    if (op === 'clear') { if (!q.length || !confirm('Tirar todos os quadros da sequência de ' + SNAME[this.state] + '?')) return; this.snap(); q.length = 0; this.seqSel = []; }
    else if (op === 'rev') { if (q.length < 2) return; this.snap(); q.reverse(); this.seqSel = this.seqSel.map(i => q.length - 1 - i); }
    else if (!s.length) { toast('Selecione quadros na sequência.'); return; }
    else if (op === 'del') { this.snap(); for (const i of s.reverse()) q.splice(i, 1); this.seqSel = []; }
    else if (op === 'dup') { this.snap(); let add = 0; const ns = []; for (const i of s) { q.splice(i + add + 1, 0, clone(q[i + add])); ns.push(i + add + 1); add++; } this.seqSel = ns; }
    else if (op === 'left' || op === 'right') {
      const d = op === 'left' ? -1 : 1; if ((d < 0 && s[0] === 0) || (d > 0 && s[s.length - 1] === q.length - 1)) return; this.snap();
      for (const i of d < 0 ? s : s.reverse()) { const [x] = q.splice(i, 1); q.splice(i + d, 0, x); }
      this.seqSel = this.seqSel.map(i => i + d);
    }
    this.touch();
  },
  moveSeq(from, to, after) {
    const q = this.seq(); from = +from; to = +to; if (from === to) return;
    this.snap(); const [x] = q.splice(from, 1); let j = to > from ? to - 1 : to; if (after) j++; q.splice(j, 0, x); this.seqSel = [j]; this.touch();
  },
  copyState(from, to, move) {
    if (from === to) return; const src = this.d.states[from];
    if (!src.seq.length) { toast(SNAME[from] + ' não tem quadros.'); return; }
    if (this.d.states[to].seq.length && !confirm('Substituir a sequência de ' + SNAME[to] + '?')) return;
    this.snap(); const name = this.d.states[to].name; this.d.states[to] = Object.assign(clone(src), { name });
    if (move) { src.seq = []; this.state = to; }
    this.seqSel = []; this.touch(); toast((move ? 'Sequência movida pra ' : 'Sequência copiada pra ') + SNAME[to] + '.');
  },

  /* ---------- etapa 4: prévia e alinhamento ---------- */
  stateCfg() { return this.d.states[this.state]; },
  pvSync() {
    const pv = this.pv; if (!pv) return;
    if (pv.state !== this.state) { pv.state = this.state; pv.i = 0; }
    const show = this.adv && this.step === 4 && VIEW === 'config' && CfgTabs.cur === 'comp';
    pv.paused = !show || !this.pvPlaying; pv.restart();
  },
  nudge(dx, dy) {
    const it = this.pv && this.pv.current(); if (!it) return;
    if (this.pvPlaying) { this.pvPlaying = false; }
    this.snap(); const s = this.seq()[it.k]; s.dx += dx; s.dy += dy; this.touch();
  },
  pvDown(e) {
    const it = this.pv && this.pv.current(); if (!it || e.button > 0) return;
    this.pvPlaying = false; this.pvSync();
    const cv = $('#pvCanvas'); try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    const s = this.seq()[it.k]; this.pvDrag = { x: e.clientX, y: e.clientY, k: it.k, dx: s.dx, dy: s.dy, sc: cv.getBoundingClientRect().width / cv.width * this.pv.lastScale, moved: false };
  },
  pvMove(e) {
    const d = this.pvDrag; if (!d) return;
    const dx = Math.round((e.clientX - d.x) / d.sc), dy = Math.round((e.clientY - d.y) / d.sc), s = this.seq()[d.k];
    if (!s || (s.dx === d.dx + dx && s.dy === d.dy + dy)) return;
    if (!d.moved) { this.snap(); d.moved = true; }
    s.dx = d.dx + dx; s.dy = d.dy + dy; this.ver++; this.pv.draw(); this.paintAlign();
  },
  pvUp() { const d = this.pvDrag; this.pvDrag = null; if (d && d.moved) this.touch(); },
  paintAlign() {
    const it = this.pv && this.pv.current(), st = this.stateCfg();
    const s = it ? this.seq()[it.k] : null;
    $('#alInfo').textContent = s ? `Quadro ${it.k + 1} (recorte ${this.num(s.f)}${this.multi() ? ', imagem ' + this.imNum(it.r.img) : ''}): ajuste x ${s.dx > 0 ? '+' : ''}${s.dx}, y ${s.dy > 0 ? '+' : ''}${s.dy}` : 'Sem quadros nesta sequência.';
    $$('#alMode [data-v]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === st.align)));
    $('#alHint').textContent = { pes: 'Os pés de todos os quadros ficam na mesma linha. Bom pra andar, comemorar e pular.', centro: 'O centro do personagem fica fixo. Bom pra efeitos e poses flutuando.', recorte: 'Usa a base de cada recorte, como as folhas em grade. Bom pra grades regulares.' }[st.align];
  },

  /* ---------- exportar e importar ---------- */
  async exportComp() {
    const images = await compImagesOut(CC, SAVED), out = { type: 'habitos-companheiro', v: 3, exportedAt: new Date().toISOString(), config: CC, images };
    const txt = JSON.stringify(out), miss = CC.images.length - images.length; download('companheiro-habitos.json', txt);
    $('#compIoInfo').hidden = false; $('#compIoInfo').innerHTML = esc('Arquivo gerado: ' + fmtBytes(txt.length) + ', com ' + (images.length === 1 ? '1 imagem' : images.length + ' imagens') + ', os recortes e as sequências.')
      + (miss ? ` <span class="warn">${miss === 1 ? '1 imagem não está' : miss + ' imagens não estão'} neste navegador e ficou de fora.</span>` : '')
      + (txt.length > BIG_FILE ? ' <span class="warn">Arquivo grande: pode demorar pra enviar ou abrir no celular.</span>' : '')
      + (this.isDirty() ? esc(' Exportei a versão salva: salve antes pra incluir as mudanças do rascunho.') : '');
  },
  async importComp(file) {
    if (!file) return;
    let obj; try { obj = JSON.parse(await readText(file)); } catch (e) { toast('Arquivo inválido.'); return; }
    if (!obj || obj.type !== 'habitos-companheiro') { toast('Esse arquivo não é uma exportação de companheiro.'); return; }
    const has = CC.images.length || CC.frames.length;
    if ((has || this.isDirty()) && !confirm('Importar troca o companheiro atual pelo do arquivo (imagens, recortes e sequências)' + (this.isDirty() ? ', e descarta as alterações não salvas' : '') + '. Pra guardar o atual, exporte antes. Continuar?')) return;
    if (!obj.config || obj.config.v !== 3) { toast('Esse companheiro foi exportado numa versão antiga (16/10) e não pode mais ser importado.'); return; }
    const r = await applyCompanion(obj.config, obj.images);
    toast(r.missing ? `Companheiro importado, mas ${r.missing === 1 ? '1 imagem não veio' : r.missing + ' imagens não vieram'} no arquivo. Escolha o arquivo de novo na etapa Imagem.` : r.fail ? 'Importado, mas o navegador não deixou guardar as imagens: elas somem ao recarregar.' : `Companheiro importado com ${r.images === 1 ? '1 imagem' : r.images + ' imagens'}.`);
  },

  /* ---------- montagem da interface ---------- */
  init() {
    const on = (sel, ev, fn) => $(sel).addEventListener(ev, fn);
    $('#ceSteps').innerHTML = ['Imagens', 'Recortes', 'Sequência', 'Prévia', 'Salvar'].map((t, i) => `<button type="button" data-step="${i + 1}"><b>${i + 1}</b><span>${t}</span></button>`).join('');
    $('#ceZoom').innerHTML = '<option value="auto">Ajustar</option>' + [0.5, 1, 2, 3, 4, 6, 8].map(z => `<option value="${z}">${String(z).replace('.', ',')}×</option>`).join('');
    $('#pvScale').innerHTML = '<option value="auto">Automático</option>' + [1, 2, 3, 4, 5, 6, 8].map(z => `<option value="${z}">${z}×</option>`).join('');
    $('#ceScale').innerHTML = [1, 2, 3, 4, 5, 6, 8].map(z => `<option value="${z}">até ${z}×</option>`).join('');
    on('#ceSteps', 'click', e => { const b = e.target.closest('[data-step]'); if (b) this.go(+b.dataset.step); });
    on('#ceBack', 'click', () => this.go(this.step - 1));
    on('#ceNext', 'click', () => this.go(this.step + 1));
    on('#ceQuick', 'click', () => this.quickStart());
    on('#ceChoice', 'click', e => { const b = e.target.closest('[data-ch]'); if (b) this.choose(b.dataset.ch); else if (e.target.id === 'ceChoice') this.choose('cancel'); });
    on('#ceChoice', 'keydown', e => { if (e.key === 'Escape') { e.preventDefault(); this.choose('cancel'); } });
    on('#ceAdvOpen', 'click', () => this.go(this.step || 1));
    on('#ceAdvClose', 'click', () => { this.setAdv(false); const t = $('#compEditor').getBoundingClientRect().top; if (t < 0) $('#compEditor').scrollIntoView({ block: 'start' }); });
    on('#ceStates', 'click', e => { const b = e.target.closest('[data-go]'); if (!b) return; this.state = b.dataset.st; this.seqSel = []; this.go(+b.dataset.go); });
    on('#ceSave', 'click', () => this.save()); on('#ceSave2', 'click', () => this.save());
    on('#ceDiscard', 'click', () => this.discard()); on('#ceUndo', 'click', () => this.undo());
    on('#compEditor', 'click', e => {
      const b = e.target.closest('[data-state]'); if (b && b.closest('.statebar')) { this.state = b.dataset.state; this.seqSel = []; this.touch(); return; }
      const im = e.target.closest('[data-img]'); if (im && (im.closest('#ceImgList') || im.closest('#ceImgSel'))) this.setImg(im.dataset.img);
    });
    on('#compEditor', 'keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { e.preventDefault(); this.undo(); } });
    // etapa 1
    on('#ceFile', 'change', e => { const f = e.target.files[0]; e.target.value = ''; this.addImageFile(f); });
    on('#ceFile', 'cancel', () => { this.quick = false; this.fresh = false; });
    const drop = $('#ceDrop');
    // Clique direto na área de arrastar: sempre adiciona (nunca usa o “começar do zero” da importação rápida).
    drop.addEventListener('click', e => { if (e.target.id !== 'ceFile') { this.quick = false; this.fresh = false; } });
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); drop.classList.add('over'); } }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
    drop.addEventListener('drop', e => { if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); this.quick = false; this.fresh = false; this.addImageFile(e.dataTransfer.files[0]); });
    on('#ceRelink', 'click', () => $('#ceRelinkFile').click());
    on('#ceRelinkFile', 'change', e => { const f = e.target.files[0]; e.target.value = ''; this.relinkImage(f); });
    on('#ceImgK', 'change', e => this.setK(+e.target.value));
    on('#ceImgMatch', 'click', () => this.matchSize());
    on('#ceView', 'click', e => { const b = e.target.closest('[data-v]'); if (b) { this.view = b.dataset.v; this.touch(); } });
    on('#ceKeyMode', 'click', e => { const b = e.target.closest('[data-v]'); if (b) this.setKey({ mode: b.dataset.v }); });
    on('#ceKeyPick', 'click', () => { this.picking = !this.picking; this.touch(); });
    on('#ceKeyCorner', 'click', () => { const sh = this.sh(); if (!sh) return; const set = sh.info.bgSet ? clone(sh.info.bgSet) : [sh.pixel(0, 0).slice(0, 3)]; this.setKey({ colors: set, on: true }); this.view = 'proc'; });
    on('#ceKeyApply', 'click', () => { const im = this.im(); if (!im) return; if (!keyColors(im.key).length) { toast('Escolha a cor do fundo primeiro: clique em “Adicionar cor da imagem” e depois no fundo.'); return; } this.setKey({ on: true }); this.view = 'proc'; });
    on('#ceKeyColors', 'click', e => { const b = e.target.closest('[data-rmc]'), im = this.im(); if (!b || !im) return; const cs = keyColors(im.key).slice(); cs.splice(+b.dataset.rmc, 1); this.setKey({ colors: cs, on: im.key.on && cs.length > 0 }); });
    on('#ceKeyUndo', 'click', () => this.setKey({ on: false }));
    on('#ceKeyTol', 'input', e => {
      const im = this.im(); if (!im) return;
      if (!this._tolSnap) { this.snap(); this._tolSnap = true; }
      im.key.tol = +e.target.value; $('#ceKeyTolV').textContent = e.target.value;
      clearTimeout(this._tolT); this._tolT = setTimeout(() => { this.ensureSh(); this.touch(); }, 90);
    });
    on('#ceKeyTol', 'change', () => { this._tolSnap = false; });
    on('#ceKeyTrim', 'change', e => this.setKey({ trim: +e.target.value }));
    on('#ceImgPrev', 'click', e => { const sh = this.sh(); if (!this.picking || !sh) return; const cv = e.currentTarget, r = cv.getBoundingClientRect(); this.pickAt((e.clientX - r.left) / r.width * sh.w, (e.clientY - r.top) / r.height * sh.h); });
    on('#ceImgRemove', 'click', () => this.removeImage());
    on('#ceDetect1', 'click', () => this.detect());
    on('#ceManual', 'click', () => this.go(2));
    // etapa 2
    on('#ceDetect', 'click', () => this.detect());
    on('#ceCancel', 'click', () => this.cancelJob());
    on('#ceGridBtn', 'click', () => { const g = $('#ceGrid'); g.hidden = !g.hidden; $('#ceGridBtn').setAttribute('aria-expanded', String(!g.hidden)); this.touch(); });
    for (const [id, k] of [['#gFw', 'fw'], ['#gFh', 'fh'], ['#gMx', 'mx'], ['#gMy', 'my'], ['#gSx', 'sx'], ['#gSy', 'sy']]) on(id, 'input', e => { const v = parseInt(e.target.value, 10), im = this.im(); if (isNaN(v) || !im) return; im.grid[k] = clamp(v, +e.target.min, +e.target.max); this.paintGridInfo(); });
    on('#gApply', 'click', () => this.applyGrid(null));
    on('#ceReport', 'click', e => { if (e.target.closest('#ceUseGrid') && this.suggest) this.applyGrid(this.suggest); });
    on('#frFilter', 'click', e => { const b = e.target.closest('[data-v]'); if (b) { this.frFilter = b.dataset.v; this.touch(); } });
    on('#frAdd', 'click', () => this.addFrame()); on('#frDup', 'click', () => this.dupFrames()); on('#frDel', 'click', () => this.delFrames());
    on('#frMerge', 'click', () => this.mergeFrames()); on('#frSplit', 'click', () => this.splitFrames());
    on('#frFit', 'click', () => this.fitFrames(false)); on('#frCenter', 'click', () => this.fitFrames(true)); on('#frRestore', 'click', () => this.restoreFrames());
    for (const [id, k] of [['#frX', 'x'], ['#frY', 'y'], ['#frW', 'w'], ['#frH', 'h']]) on(id, 'change', e => this.setFrameField(k, e.target.value));
    on('#detGap', 'change', e => { this.det.gap = toInt(e.target.value, 2, 0, 50); });
    on('#detMin', 'change', e => { this.det.min = toInt(e.target.value, 6, 1, 100000); });
    on('#detAlpha', 'change', e => { this.snap(); this.d.alpha = toInt(e.target.value, 8, 0, 254); this.ensureSh(); this.touch(); });
    on('#ceZoom', 'change', () => this.drawSheet());
    const sh = $('#ceSheet');
    sh.addEventListener('pointerdown', e => this.sheetDown(e)); sh.addEventListener('pointermove', e => this.sheetMove(e));
    sh.addEventListener('pointerup', () => this.sheetUp()); sh.addEventListener('pointercancel', () => this.sheetUp()); sh.addEventListener('keydown', e => this.sheetKey(e));
    on('#frGallery', 'click', e => {
      const b = e.target.closest('.fthumb'); if (!b) return; const id = b.dataset.id, f = this.frame(id); if (!f) return;
      // Recorte de outra imagem (filtro “Todas”): passa a mostrar a imagem dele.
      if (f.img !== this.img) { this.img = f.img; this.sel = [id]; this.touch(); return; }
      const vis = $$('#frGallery .fthumb').map(x => x.dataset.id);
      if (e.shiftKey && this.sel.length) { const a = vis.indexOf(this.sel[this.sel.length - 1]), z = vis.indexOf(id); this.sel = [...new Set(this.sel.concat(vis.slice(Math.min(a, z), Math.max(a, z) + 1)))]; }
      else if (e.ctrlKey || e.metaKey) this.sel = this.sel.includes(id) ? this.sel.filter(x => x !== id) : this.sel.concat(id);
      else this.sel = [id];
      this.paintSel();
    });
    bindDnD($('#frGallery'), '.fthumb', 'id', (a, b, after) => this.moveLib(a, b, after));
    // etapa 3
    on('#seqFilter', 'click', e => { const b = e.target.closest('[data-v]'); if (b) { this.seqFilter = b.dataset.v; this.touch(); } });
    on('#seqLib', 'click', e => { const b = e.target.closest('.fthumb'); if (!b) return; const id = b.dataset.id; this.pick = this.pick.includes(id) ? this.pick.filter(x => x !== id) : this.pick.concat(id); this.render3(); });
    on('#seqLib', 'dblclick', e => { const b = e.target.closest('.fthumb'); if (!b) return; this.pick = [b.dataset.id]; this.addPicked(false); });
    on('#seqAddSel', 'click', () => this.addPicked(false)); on('#seqAddAll', 'click', () => this.addPicked(true));
    on('#seqPickClear', 'click', () => { this.pick = []; this.render3(); });
    on('#seqList', 'click', e => {
      const b = e.target.closest('.fthumb'); if (!b) return; const i = +b.dataset.i;
      if (e.shiftKey && this.seqSel.length) { const a = this.seqSel[this.seqSel.length - 1]; for (let k = Math.min(a, i); k <= Math.max(a, i); k++) if (!this.seqSel.includes(k)) this.seqSel.push(k); }
      else if (e.ctrlKey || e.metaKey) this.seqSel = this.seqSel.includes(i) ? this.seqSel.filter(x => x !== i) : this.seqSel.concat(i);
      else this.seqSel = [i];
      this.render3();
    });
    bindDnD($('#seqList'), '.fthumb', 'i', (a, b, after) => this.moveSeq(a, b, after));
    for (const op of ['left', 'right', 'dup', 'del', 'rev', 'clear']) on('#seq' + op[0].toUpperCase() + op.slice(1), 'click', () => this.seqOp(op));
    on('#seqCopy', 'click', () => this.copyState($('#seqFrom').value, this.state, false));
    // etapa 4
    this.pv = new Player($('#pvCanvas'), $('#pvWrap'), { maxPx: 300, cap: false, sheet: () => ED, cfg: () => this.d, ver: () => this.ver, auto: false, onDraw: (i, n) => { $('#pvIdx').textContent = n ? `${i + 1} / ${n}` : '0 / 0'; if (this.step === 4) this.paintAlign(); } });
    this.pv.guides = true; this.pvPlaying = !reduced();
    on('#pvPlay', 'click', () => { this.pvPlaying = !this.pvPlaying; this.pvSync(); this.render4(); });
    on('#pvRestart', 'click', () => { this.pv.i = 0; this.pvSync(); });
    on('#pvPrev', 'click', () => { this.pvPlaying = false; this.pvSync(); this.pv.step(-1); this.render4(); });
    on('#pvNext', 'click', () => { this.pvPlaying = false; this.pvSync(); this.pv.step(1); this.render4(); });
    on('#pvFps', 'input', e => { if (!this._fpsSnap) { this.snap(); this._fpsSnap = true; } this.stateCfg().fps = +e.target.value; $('#pvFpsV').textContent = e.target.value + ' quadros/s'; this.ver++; this.pvSync(); this.paintHeader(); });
    on('#pvFps', 'change', () => { this._fpsSnap = false; this.touch(); });
    on('#pvLoop', 'change', e => { this.snap(); this.stateCfg().loop = e.target.checked; this.pv.i = 0; this.touch(); });
    on('#pvScale', 'change', e => { this.pv.scaleOverride = e.target.value === 'auto' ? null : +e.target.value; this.pv.draw(); });
    on('#pvBg', 'click', e => { const b = e.target.closest('[data-v]'); if (b) { this.pvBg = b.dataset.v; this.render4(); } });
    on('#pvColor', 'input', () => { this.pvBg = 'color'; this.render4(); });
    on('#pvGuides', 'change', e => { this.pv.guides = e.target.checked; this.pv.draw(); });
    on('#pvOnion', 'change', e => { this.pv.onion = e.target.checked; this.pv.draw(); });
    on('#alMode', 'click', e => { const b = e.target.closest('[data-v]'); if (!b) return; this.snap(); this.stateCfg().align = b.dataset.v; this.touch(); });
    on('#alL', 'click', () => this.nudge(-1, 0)); on('#alR', 'click', () => this.nudge(1, 0)); on('#alU', 'click', () => this.nudge(0, -1)); on('#alD', 'click', () => this.nudge(0, 1));
    on('#alReset', 'click', () => { const it = this.pv.current(); if (!it) return; this.snap(); const s = this.seq()[it.k]; s.dx = 0; s.dy = 0; this.touch(); });
    on('#alResetAll', 'click', () => { if (!this.seq().length) return; this.snap(); this.seq().forEach(s => { s.dx = 0; s.dy = 0; }); this.touch(); });
    const pc = $('#pvCanvas');
    pc.addEventListener('pointerdown', e => this.pvDown(e)); pc.addEventListener('pointermove', e => this.pvMove(e)); pc.addEventListener('pointerup', () => this.pvUp()); pc.addEventListener('pointercancel', () => this.pvUp());
    // etapa 5
    on('#seqName', 'input', e => { this.stateCfg().name = e.target.value.slice(0, 40); this.paintHeader(); });
    on('#seqName', 'change', () => this.touch());
    on('#ceScale', 'change', e => { this.snap(); this.d.scale = +e.target.value; this.touch(); });
    on('#cpCopy', 'click', () => this.copyState(this.state, $('#cpTarget').value, false));
    on('#cpMove', 'click', () => this.copyState(this.state, $('#cpTarget').value, true));
    on('#ceSummary', 'click', e => { const b = e.target.closest('[data-s]'); if (b) { this.state = b.dataset.s; this.touch(); } });
    on('#compExport', 'click', () => this.exportComp());
    on('#compImport', 'change', e => { this.importComp(e.target.files[0]); e.target.value = ''; });
    window.addEventListener('resize', () => { if (VIEW === 'config' && this.step === 2) this.drawSheet(); });
    window.addEventListener('beforeunload', e => { if (this.isDirty()) { e.preventDefault(); e.returnValue = ''; } });
  },
  setAdv(on) { this.adv = !!on; try { localStorage.setItem('habitos.editor', on ? 'avancado' : 'resumo'); } catch (e) {} this.picking = false; this.touch(); },
  go(step) {
    step = clamp(step, 1, 5); if (!this.adv) this.setAdv(true);
    if (step > 1 && !this.d.images.length) { toast('Comece escolhendo uma imagem.'); step = 1; }
    this.step = step; this.picking = false; this.touch();
    const top = $('#compEditor').getBoundingClientRect().top; if (top < 0) $('#compEditor').scrollIntoView({ block: 'start' });
  },
  onLeave() { if (this.pv) this.pv.pause(true); },

  /* ---------- desenho das etapas ---------- */
  paintHeader() {
    const n = this.norm(), dirty = this.d.images.some(im => this.newBlobs.has(im.id)) || JSON.stringify(n) !== JSON.stringify(CC);
    $('#ceDirty').hidden = !dirty; for (const id of ['#ceSave', '#ceSave2', '#ceDiscard']) $(id).disabled = !dirty; $('#ceUndo').disabled = !this.hist.length;
    $('#compEditor .savebar').hidden = !this.adv && !dirty && !this.hist.length; $('#compExport').disabled = !CC.images.length && !CC.frames.length;
    const status = s => { const c = n.states[s].seq.length, sd = JSON.stringify(n.states[s]) !== JSON.stringify(CC.states[s]); return { c, sd }; };
    const ni = this.d.images.length;
    $('#ceStatus').innerHTML = SKEYS.map(s => { const { c, sd } = status(s); return `<span class="stchip ${c ? 'ok' : ''} ${sd ? 'dirty' : ''}" data-s="${s}">${SNAME[s]}: ${c ? c + (c === 1 ? ' quadro' : ' quadros') : 'não configurado'}${sd ? ' · não salvo' : ''}</span>`; }).join('')
      + (ni > 1 ? `<span class="stchip">${ni} imagens</span>` : '');
    $$('.statebar').forEach(el => { el.innerHTML = SKEYS.map(s => { const { c, sd } = status(s); return `<button type="button" role="radio" aria-checked="${s === this.state}" data-state="${s}"><span class="led" style="background:${c ? 'var(--ok)' : 'transparent'};border:1px solid ${c ? 'var(--ok)' : 'var(--mu)'}"></span>${SNAME[s]}${sd ? '<span class="n">• não salvo</span>' : ''}</button>`; }).join(''); });
    $$('.stname').forEach(el => { el.textContent = SNAME[this.state]; });
    const done = [ni > 0, this.d.frames.length > 0, this.seq().length > 0, this.seq().length > 0, !dirty && CC.states.idle.seq.length > 0];
    $$('#ceSteps [data-step]').forEach(b => { const k = +b.dataset.step; if (k === this.step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); b.classList.toggle('done', done[k - 1]); });
    $('#ceBack').hidden = this.step === 1; $('#ceNext').hidden = this.step === 5;
    $('#ceNext').textContent = ['', 'Próximo: recortes →', 'Próximo: sequência →', 'Próximo: prévia →', 'Próximo: salvar →'][this.step] || '';
  },
  render() {
    if (!this.d) return;
    ED.ensure(this.d);
    this.paintHeader();
    $('#ceSimple').hidden = this.adv; $('#ceAdv').hidden = !this.adv;
    if (!this.adv) this.renderSimple();
    else { $$('.cestep').forEach(el => { el.hidden = el.id !== 'ceStep' + this.step; }); this['render' + this.step](); }
    this.pvSync();
  },
  imgButtons(sel, extra) {
    return (extra || '') + this.d.images.map((x, i) => `<button type="button" role="radio" aria-checked="${x.id === sel}" data-${extra === undefined ? 'img' : 'v'}="${x.id}" title="${esc(x.name)}">Imagem ${i + 1}${this.sh(x.id) ? '' : ' <span class="n">sem arquivo</span>'}</button>`).join('');
  },
  // Resumo: os 4 estados com atalhos pra montar a sequência ou ver a prévia.
  renderSimple() {
    const has = this.d.images.length > 0 || this.d.frames.length > 0, n = this.norm();
    $('#ceEmpty').hidden = has; $('#ceStates').hidden = !has;
    if (!has) return;
    $('#ceStates').innerHTML = SKEYS.map(s => {
      const q = this.d.states[s], c = q.seq.length, sd = JSON.stringify(n.states[s]) !== JSON.stringify(CC.states[s]);
      return `<div class="sumrow" data-s="${s}"><canvas width="56" height="56" class="sprite checker"></canvas><span class="stack" style="gap:6px;flex:1;min-width:0"><b>${SNAME[s]}${q.name ? ' · ' + esc(q.name) : ''}</b><span class="xs mu">${c ? `${c} quadro${c === 1 ? '' : 's'} · ${q.fps} quadros/s · ${q.loop ? 'repete' : 'toca uma vez'}` : (s === 'idle' ? 'não configurado: o Hoje fica sem companheiro' : 'não configurado: usa o Repouso com um efeito')}</span>${sd ? '<span class="xs dirty">alterações não salvas</span>' : ''}<span class="btnrow"><button type="button" class="btn sm" data-go="3" data-st="${s}">${c ? 'Trocar quadros' : 'Escolher quadros'}</button><button type="button" class="btn sm" data-go="4" data-st="${s}" ${c ? '' : 'disabled'}>Prévia</button></span></span></div>`;
    }).join('');
    $$('#ceStates [data-s]').forEach(b => { const q = this.d.states[b.dataset.s].seq; this.thumb($('canvas', b), q.length ? this.frame(q[0].f) : null, 56); });
  },
  render1() {
    const ims = this.d.images, im = this.im(), sh = this.sh();
    const list = $('#ceImgList'); list.hidden = !ims.length;
    list.innerHTML = ims.map((x, i) => {
      const ok = !!this.sh(x.id), nf = this.framesOf(x.id).length, used = this.usedIds(), nu = this.framesOf(x.id).filter(f => used.has(f.id)).length;
      return `<button type="button" class="imgcard" data-img="${x.id}" aria-pressed="${x.id === this.img}"><canvas width="56" height="56" class="sprite checker"></canvas><span class="stack" style="gap:2px;min-width:0"><b>Imagem ${i + 1}</b><span class="xs mu ell">${esc(x.name)}</span><span class="xs ${ok ? 'mu' : 'warn'}">${ok ? `${pctOf(x.k)} · ${nf} recorte${nf === 1 ? '' : 's'}${nu ? ` · ${nu} em uso` : ''}` : 'arquivo não encontrado'}</span></span></button>`;
    }).join('');
    $$('#ceImgList .imgcard').forEach(b => this.thumbImg($('canvas', b), b.dataset.img, 56));
    $('#ceDropT').textContent = ims.length ? 'Adicionar outra folha de sprites (PNG)' : 'Arraste uma folha de sprites (PNG) aqui';
    $('#ceDropS').textContent = ims.length ? 'Arraste aqui ou clique. Os recortes e as sequências que já existem continuam iguais.' : 'ou clique pra escolher. A imagem fica só neste navegador e o arquivo original nunca é alterado.';
    $('#ceDrop').classList.toggle('compact', ims.length > 0);
    $('#ceImgBox').hidden = !im;
    if (!im) return;
    const n = this.imNum(im.id);
    $('#ceImgName').textContent = (this.multi() ? `Imagem ${n} · ` : '') + im.name;
    $('#ceMissing').hidden = !!sh; $('#ceImgMain').hidden = !sh;
    $('#ceImgRemove').textContent = this.multi() ? `Remover a imagem ${n}` : 'Remover imagem';
    if (!sh) { $('#ceMissingTxt').textContent = `O arquivo da imagem ${n} (${im.name}, ${im.w}×${im.h} px) não está neste navegador, por exemplo depois de importar um backup sem as imagens. Os recortes e as sequências dela continuam guardados: escolha o mesmo PNG pra recuperar.`; return; }
    const k = im.key;
    $('#ceImgInfo').textContent = `${sh.w} × ${sh.h} px · ${fmtBytes(sh.blob ? sh.blob.size : 0)}`;
    $('#ceBgInfo').textContent = bgLine(sh.info, k);
    // tamanho
    const opts = [0.5, 1, 2, 3]; if (!opts.includes(im.k)) opts.push(im.k); opts.sort((a, b) => a - b);
    $('#ceImgK').innerHTML = opts.map(v => `<option value="${v}" ${v === im.k ? 'selected' : ''}>${pctOf(v)}${[0.5, 1, 2, 3].includes(v) ? '' : ' (igualado)'}</option>`).join('');
    const isBase = n === 1, mb = $('#ceImgMatch'); mb.disabled = isBase || !this.multi(); mb.hidden = !this.multi();
    let hint = 'Muda o tamanho do personagem desta imagem no companheiro. A ampliação não suaviza: os pixels continuam nítidos.';
    if (this.multi()) {
      if (isBase) hint = 'A imagem 1 é a referência de tamanho. Nas outras imagens, use “Igualar à imagem 1” pra o personagem ficar do mesmo tamanho.';
      else { const h1 = this.charHeight(this.d.images[0].id), h2 = this.charHeight(im.id); hint = h1 && h2 ? `Altura do personagem: ${Math.round(h2 * im.k)} px aqui e ${Math.round(h1 * this.d.images[0].k)} px na imagem 1.` + (Math.abs(h2 * im.k - h1 * this.d.images[0].k) > Math.max(2, h1 * this.d.images[0].k * 0.08) ? ' Use “Igualar à imagem 1” pra deixar parecidos.' : ' Já estão parecidos.') : 'Depois de recortar os sprites das duas imagens, use “Igualar à imagem 1” pra o personagem ficar do mesmo tamanho.'; }
    }
    $('#ceImgKHint').textContent = hint;
    // fundo
    $$('#ceView [data-v]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === this.view)));
    $$('#ceKeyMode [data-v]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === k.mode)));
    const kc = keyColors(k);
    $('#ceKeyColors').innerHTML = kc.length ? kc.map((c, i) => `<span class="kc"><i style="background:rgb(${c.join(',')})"></i><span class="mono">${hexOf(c)}</span><button type="button" data-rmc="${i}" aria-label="Tirar a cor ${hexOf(c)}">×</button></span>`).join('') : '<span class="xs mu">Nenhuma cor de fundo escolhida.</span>';
    $('#ceKeyTol').value = k.tol; $('#ceKeyTolV').textContent = k.tol; $('#ceKeyTrim').value = String(k.trim || 0);
    $('#ceKeyPick').textContent = this.picking ? 'Cancelar' : 'Adicionar cor da imagem';
    $('#ceKeyApply').disabled = k.on || !kc.length; $('#ceKeyUndo').disabled = !k.on;
    $('#ceKeyHint').textContent = this.picking ? 'Clique num pixel do fundo na imagem ao lado.' : k.on ? (k.mode === 'borda' ? 'Fundo removido só onde encosta nas bordas: partes do personagem com a mesma cor ficam. Se sobrar fundo preso entre braço e corpo, use “Essa cor na imagem toda”.' : 'Essa cor sumiu da imagem toda. Se o personagem perdeu partes, volte pra “Só o fundo ligado às bordas”.') : 'A remoção só vale pra exibição: o arquivo original não muda.';
    $('#ceDetect1').textContent = this.multi() ? `Detectar sprites da imagem ${n}` : 'Detectar sprites automaticamente';
    const cv = $('#ceImgPrev'), avail = Math.max(120, cv.parentElement.clientWidth - 22);
    let z = avail / sh.w >= 1 ? Math.min(4, Math.floor(avail / sh.w)) : avail / sh.w;
    if (sh.h * z > 640 && z > 1) z = Math.max(1, Math.floor(640 / sh.h));
    const W = Math.max(1, Math.round(sh.w * z)), H = Math.max(1, Math.round(sh.h * z));
    cv.width = W; cv.height = H; cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv.style.cursor = this.picking ? 'copy' : 'default';
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, W, H); g.drawImage(this.view === 'orig' ? sh.img : sh.src, 0, 0, W, H);
  },
  paintGridInfo() {
    const im = this.im(), sh = this.sh(), g = im ? im.grid : defaultGrid();
    for (const [id, k] of [['#gFw', 'fw'], ['#gFh', 'fh'], ['#gMx', 'mx'], ['#gMy', 'my'], ['#gSx', 'sx'], ['#gSy', 'sy']]) { const el = $(id); if (document.activeElement !== el) el.value = g[k]; }
    if (!sh) { $('#gInfo').textContent = ''; return; }
    const { cols, rows } = gridDims(g, sh.w, sh.h), lx = sh.w - g.mx - (cols ? cols * g.fw + (cols - 1) * g.sx : 0), ly = sh.h - g.my - (rows ? rows * g.fh + (rows - 1) * g.sy : 0);
    let h = `Grade${this.multi() ? ' da imagem ' + this.imNum(im.id) : ''}: <b>${cols} × ${rows} = ${cols * rows} quadros</b> de ${g.fw}×${g.fh} px.`;
    if (!cols || !rows) h += ' <span class="warn">O quadro é maior que a imagem.</span>';
    else if (lx > g.mx || ly > g.my) h += ` <span class="warn">Sobram ${lx - g.mx} px à direita e ${ly - g.my} px embaixo além da margem: confira tamanho, margem e espaçamento.</span>`;
    else h += (g.mx || g.my) ? ' A grade cobre a imagem inteira, com a mesma margem em todas as bordas.' : ' A grade cobre a imagem inteira.';
    $('#gInfo').innerHTML = h;
  },
  render2() {
    const sh = this.sh(), multi = this.multi();
    for (const id of ['#ceDetect', '#ceGridBtn', '#frAdd']) $(id).disabled = !sh || !!this.job;
    $('#ceImgSelBox').hidden = !multi; if (multi) $('#ceImgSel').innerHTML = this.imgButtons(this.img);
    $('#ceDetect').textContent = multi ? `Detectar sprites da imagem ${this.imNum(this.img)}` : 'Detectar sprites automaticamente';
    $('#ceSheetHint').textContent = this.picking ? 'Clique num pixel do fundo pra torná-lo transparente.' : 'Arraste numa área vazia pra criar um recorte. Clique pra selecionar e arraste as alças pra redimensionar. Ctrl + clique seleciona vários. Setas movem 1 px (Shift + setas redimensiona).';
    this.paintGridInfo();
    // relatório (só o da imagem escolhida)
    const rep = $('#ceReport'), R = this.report && this.report.img === this.img ? this.report : null, other = multi ? ' Os recortes das outras imagens não mudaram.' : '';
    if (!R) rep.hidden = true;
    else if (R.grid) { rep.hidden = false; rep.innerHTML = `<span><b>${R.n}</b> recortes gerados pela grade${R.kept ? `. ${R.kept} recortes usados em sequências foram mantidos` : ''}.${other}</span><span class="mu">Revise abaixo. Nada é salvo até você clicar em Salvar.</span>`; }
    else {
      const res = R.res, bs = res.boxes, warn = [], lines = [], info = sh ? sh.info : null;
      if (res.tooMany) warn.push('A imagem tem pontos demais separados (ruído ou fundo com textura). Remova o fundo na etapa 1 ou recorte manualmente.');
      else if (!bs.length) warn.push('Não encontrei sprites. Se o fundo não for transparente, remova o fundo na etapa 1. Você também pode recortar manualmente ou gerar por grade.');
      else {
        lines.push((multi ? `Imagem ${this.imNum(this.img)}: encontrei` : 'Encontrei') + ` <b>${bs.length}</b> sprite${bs.length === 1 ? '' : 's'}` + (R.kept ? `; ${R.kept} recorte${R.kept === 1 ? '' : 's'} já usado${R.kept === 1 ? '' : 's'} em sequências ficaram como estavam.` : '.') + other);
        lines.push(bgLine(info, this.im().key));
        const ws = bs.map(b => b.w), hs = bs.map(b => b.h);
        if (res.grid) lines.push(`Parece uma grade regular de ${res.grid.cols} × ${res.grid.rows} quadros de ${res.grid.fw}×${res.grid.fh} px. <button type="button" class="btn sm" id="ceUseGrid">Usar grade sugerida</button>`);
        else lines.push(`Organização irregular, em ${readingRows(bs).length} linha${readingRows(bs).length === 1 ? '' : 's'}. Tamanhos de ${Math.min(...ws)}×${Math.min(...hs)} a ${Math.max(...ws)}×${Math.max(...hs)} px.`);
        const area = sh ? sh.w * sh.h : Infinity, big = bs.map((b, i) => [b, i]).filter(([b]) => b.w * b.h > area * 0.25).map(([, i]) => i + 1);
        if (big.length) warn.push(`O recorte ${big.join(', ')} ocupa boa parte da imagem: o fundo não foi separado dos personagens. Se a imagem tem um quadriculado ou outro fundo pintado, volte na etapa 1, use “Adicionar cor da imagem” em cada cor do fundo e detecte de novo.`);
        // Compara a largura com sprites de altura parecida: um recorte bem mais largo pode ser dois personagens encostados.
        const wide = bs.map((b, i) => { const peers = bs.filter(o => Math.abs(o.h - b.h) <= b.h * 0.25); return peers.length >= 3 && b.w > median(peers.map(o => o.w)) * 1.7 && b.w > 8 ? i + 1 : 0; }).filter(Boolean);
        if (wide.length) warn.push(`Recorte${wide.length > 1 ? 's' : ''} ${wide.slice(0, 8).join(', ')}${wide.length > 8 ? '…' : ''} bem mais larg${wide.length > 1 ? 'os' : 'o'} que os outros: pode ser dois personagens encostados ou um efeito. Selecione e use Dividir.`);
        if (Math.max(...hs) > Math.min(...hs) * 1.5) warn.push('Os sprites têm alturas bem diferentes: na prévia, o alinhamento pelos pés evita que o personagem pule.');
        if (bs.length > 150) warn.push('Muitos recortes: a imagem pode ter textos ou efeitos. Exclua o que não for personagem.');
        if (res.small) warn.push(`Ignorei ${res.small} ponto${res.small === 1 ? '' : 's'} solto${res.small === 1 ? '' : 's'} com menos de ${this.det.min} pixels.`);
        if (multi && this.imNum(this.img) > 1) { const h1 = this.charHeight(this.d.images[0].id), h2 = this.charHeight(this.img), im = this.im(); if (h1 && h2 && Math.abs(h2 * im.k - h1 * this.d.images[0].k) > Math.max(2, h1 * this.d.images[0].k * 0.08)) lines.push(`O personagem aqui tem ${Math.round(h2 * im.k)} px de altura e ${Math.round(h1 * this.d.images[0].k)} px na imagem 1. Pra ficarem do mesmo tamanho, use “Igualar à imagem 1” na etapa 1.`); }
      }
      rep.hidden = false;
      rep.innerHTML = lines.map(l => `<span>${l}</span>`).join('') + warn.map(w => `<span class="warn">Atenção: ${w}</span>`).join('') + '<span class="mu">Revise os recortes abaixo. Nada é salvo até você clicar em Salvar.</span>';
    }
    $('#detGap').value = this.det.gap; $('#detMin').value = this.det.min; $('#detAlpha').value = this.d.alpha;
    this.drawSheet();
    // galeria
    $('#frFilter').hidden = !multi;
    if (multi) $$('#frFilter [data-v]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === this.frFilter)));
    const used = {}; for (const s of SKEYS) for (const it of this.d.states[s].seq) (used[it.f] = used[it.f] || new Set()).add(s);
    const col = { idle: 'var(--ok)', celebrate: 'var(--xp)', tired: 'var(--mu)', levelup: 'var(--nt)' };
    const vis = this.d.frames.map((f, k) => [f, k]).filter(([f]) => !multi || this.frFilter === 'all' || f.img === this.img);
    $('#frGallery').innerHTML = vis.length ? vis.map(([f, k]) => `<button type="button" class="fthumb ${this.sel.includes(f.id) ? 'sel' : ''} ${f.img !== this.img ? 'other' : ''}" data-id="${f.id}" draggable="true" title="Recorte ${k + 1}${multi ? ' · imagem ' + this.imNum(f.img) : ''} · ${f.w}×${f.h} px"><canvas width="64" height="64" class="sprite checker"></canvas><span class="b">${k + 1}</span><span class="mu">${f.w}×${f.h}</span>${this.badge(f)}${used[f.id] ? `<span class="used">${[...used[f.id]].map(s => `<i style="background:${col[s]}" title="${SNAME[s]}"></i>`).join('')}</span>` : ''}</button>`).join('')
      : `<div class="empty-card">Nenhum recorte${multi ? ' nesta imagem' : ''}. Use “Detectar sprites automaticamente”, “Gerar por grade” ou arraste sobre a imagem.</div>`;
    $$('#frGallery .fthumb').forEach(b => this.thumb($('canvas', b), this.frame(b.dataset.id), 64));
    this.paintInspector();
  },
  render3() {
    const q = this.seq(), multi = this.multi(), lib = this.libFrames();
    $('#seqFilter').hidden = !multi;
    if (multi) $('#seqFilter').innerHTML = `<button type="button" role="radio" aria-checked="${this.seqFilter === 'all'}" data-v="all">Todas as imagens</button>` + this.d.images.map((x, i) => `<button type="button" role="radio" aria-checked="${x.id === this.seqFilter}" data-v="${x.id}" title="${esc(x.name)}">Imagem ${i + 1}</button>`).join('');
    $('#seqLib').innerHTML = lib.length ? lib.map(f => { const k = this.num(f.id) - 1, o = this.pick.indexOf(f.id); return `<button type="button" class="fthumb ${o >= 0 ? 'picked' : ''}" data-id="${f.id}" aria-pressed="${o >= 0}" title="Recorte ${k + 1}${multi ? ' · imagem ' + this.imNum(f.img) : ''}"><canvas width="64" height="64" class="sprite checker"></canvas><span class="b">${k + 1}</span>${this.badge(f)}${o >= 0 ? `<span class="ord">${o + 1}</span>` : ''}</button>`; }).join('')
      : `<div class="empty-card">Sem recortes${multi && this.seqFilter !== 'all' ? ' nesta imagem' : ''}. Volte na etapa 2.</div>`;
    $$('#seqLib .fthumb').forEach(b => this.thumb($('canvas', b), this.frame(b.dataset.id), 64));
    $('#seqAddSel').textContent = this.pick.length ? `Adicionar ${this.pick.length} selecionado${this.pick.length === 1 ? '' : 's'}` : 'Adicionar selecionados';
    $('#seqAddAll').textContent = multi && this.seqFilter !== 'all' ? `Adicionar todos da imagem ${this.imNum(this.seqFilter)}` : 'Adicionar todos';
    $('#seqList').innerHTML = q.length ? q.map((it, i) => { const f = this.frame(it.f); return `<button type="button" class="fthumb ${this.seqSel.includes(i) ? 'sel' : ''}" data-i="${i}" draggable="true" title="Quadro ${i + 1} · recorte ${this.num(it.f)}${multi && f ? ' · imagem ' + this.imNum(f.img) : ''}"><canvas width="64" height="64" class="sprite checker"></canvas><span class="b">${i + 1}</span><span class="mu">#${this.num(it.f)}</span>${f ? this.badge(f) : ''}</button>`; }).join('')
      : `<div class="empty-card">A sequência de ${SNAME[this.state]} está vazia. Clique nos recortes acima, na ordem da animação, e depois em “Adicionar”.</div>`;
    $$('#seqList .fthumb').forEach(b => this.thumb($('canvas', b), this.frame(q[+b.dataset.i].f), 64));
    $('#seqCount').textContent = q.length + (q.length === 1 ? ' quadro' : ' quadros') + (this.seqSel.length ? ' · ' + this.seqSel.length + ' selecionado' + (this.seqSel.length === 1 ? '' : 's') : '');
    for (const id of ['#seqLeft', '#seqRight', '#seqDup', '#seqDel']) $(id).disabled = !this.seqSel.length;
    $('#seqRev').disabled = q.length < 2; $('#seqClear').disabled = !q.length;
    const others = SKEYS.filter(s => s !== this.state && this.d.states[s].seq.length);
    const fromPrev = $('#seqFrom').value;
    $('#seqFrom').innerHTML = others.length ? others.map(s => `<option value="${s}">${SNAME[s]} (${this.d.states[s].seq.length})</option>`).join('') : '<option value="">nenhum outro estado configurado</option>';
    if (others.includes(fromPrev)) $('#seqFrom').value = fromPrev;
    $('#seqCopy').disabled = !others.length;
  },
  render4() {
    const st = this.stateCfg();
    $('#pvFps').value = st.fps; $('#pvFpsV').textContent = st.fps + ' quadros/s'; $('#pvLoop').checked = st.loop;
    $('#pvPlay').textContent = this.pvPlaying ? 'Pausar' : 'Reproduzir'; $('#pvPlay').setAttribute('aria-pressed', String(this.pvPlaying));
    const bg = this.pvBg || 'checker', w = $('#pvWrap');
    $$('#pvBg [data-v]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === bg)));
    w.classList.toggle('checker', bg === 'checker'); w.classList.toggle('bg-dark', bg === 'dark'); w.classList.toggle('bg-light', bg === 'light');
    w.style.background = bg === 'color' ? $('#pvColor').value : '';
    $('#pvGuides').checked = this.pv.guides; $('#pvOnion').checked = this.pv.onion;
    const lay = this.pv.layout();
    $('#pvStage').textContent = lay ? `Área comum a todos os estados: ${Math.ceil(lay.W)}×${Math.ceil(lay.H)} px.` + (lay.ks.some(k => k !== 1) ? ' Inclui o tamanho escolhido pra cada imagem.' : '') + ` ${this.seq().length ? '' : 'Este estado está vazio: no Hoje ele usa o Repouso com um efeito.'}` : 'Sem quadros ainda.';
    $('#pvNote').textContent = reduced() ? 'Movimento reduzido ativo no sistema: a prévia começa pausada e o companheiro fica parado no Hoje.' : '';
    this.paintAlign();
  },
  render5() {
    const st = this.stateCfg(), n = this.norm();
    $('#ceSummary').innerHTML = SKEYS.map(s => { const q = this.d.states[s], c = q.seq.length, sd = JSON.stringify(n.states[s]) !== JSON.stringify(CC.states[s]);
      const imgs = this.multi() ? [...new Set(q.seq.map(it => { const f = this.frame(it.f); return f ? this.imNum(f.img) : 0; }).filter(Boolean))].sort() : [];
      return `<button type="button" class="sumrow ${s === this.state ? 'cur' : ''}" data-s="${s}"><canvas width="56" height="56" class="sprite checker"></canvas><span class="stack" style="gap:2px"><b>${SNAME[s]}${q.name ? ' · ' + esc(q.name) : ''}</b><span class="xs mu">${c ? `${c} quadro${c === 1 ? '' : 's'} · ${q.fps} quadros/s · ${q.loop ? 'repete' : 'toca uma vez'}` + (imgs.length ? ` · imagem ${imgs.join(' e ')}` : '') : 'não configurado: usa o Repouso com efeito'}</span>${sd ? '<span class="xs dirty">alterações não salvas</span>' : ''}</span></button>`; }).join('');
    $$('#ceSummary [data-s]').forEach(b => { const q = this.d.states[b.dataset.s].seq; this.thumb($('canvas', b), q.length ? this.frame(q[0].f) : null, 56); });
    const nm = $('#seqName'); if (document.activeElement !== nm) nm.value = st.name;
    $('#ceScale').value = String(this.d.scale);
    // Redesenhar não pode perder o destino que a pessoa escolheu.
    const cpPrev = $('#cpTarget').value;
    $('#cpTarget').innerHTML = SKEYS.filter(s => s !== this.state).map(s => `<option value="${s}">${SNAME[s]}</option>`).join('');
    if (cpPrev && cpPrev !== this.state) $('#cpTarget').value = cpPrev;
    $('#cpCopy').disabled = $('#cpMove').disabled = !st.seq.length;
  }
};

function bindDnD(box, sel, key, onDrop) {
  let from = null;
  box.addEventListener('dragstart', e => { const el = e.target.closest(sel); if (!el) return; from = el.dataset[key]; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', from); } catch (x) {} el.classList.add('dragging'); });
  box.addEventListener('dragend', () => { from = null; $$('.over, .dragging', box).forEach(x => x.classList.remove('over', 'dragging')); });
  box.addEventListener('dragover', e => { if (from === null) return; e.preventDefault(); const el = e.target.closest(sel); $$('.over', box).forEach(x => x.classList.remove('over')); if (el) el.classList.add('over'); });
  box.addEventListener('drop', e => {
    if (from === null) return; e.preventDefault(); const el = e.target.closest(sel), f = from; from = null;
    if (!el || el.dataset[key] === f) return; const r = el.getBoundingClientRect(); onDrop(f, el.dataset[key], e.clientX > r.left + r.width / 2);
  });
}
