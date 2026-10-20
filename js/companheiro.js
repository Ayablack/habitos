// Hábitos · Companheiro: imagens guardadas, formato dos dados, folha de sprites, animação e o quadro na tela Hoje.
'use strict';
/* ===================== IndexedDB (imagem do companheiro) ===================== */
const IDB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      if (!('indexedDB' in window)) { rej(new Error('IndexedDB indisponível')); return; }
      const r = indexedDB.open('habitos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async tx(mode, fn) {
    const db = this.db || await this.open();
    return new Promise((res, rej) => {
      const tr = db.transaction('kv', mode); const q = fn(tr.objectStore('kv'));
      tr.oncomplete = () => res(q && q.result); tr.onerror = () => rej(tr.error); tr.onabort = () => rej(tr.error);
    });
  },
  get(k) { return this.tx('readonly', st => st.get(k)); },
  set(k, v) { return this.tx('readwrite', st => st.put(v, k)); },
  del(k) { return this.tx('readwrite', st => st.delete(k)); }
};

/* ===================== Companheiro: modelo de dados ===================== */
// v3: o companheiro pode ter várias imagens (folhas de sprites). Cada imagem tem fundo, grade e tamanho próprios;
// cada recorte aponta pra sua imagem; cada estado tem sequência, velocidade, repetição, alinhamento e nome.
const CKEY = 'habitos.companheiro';
const SKEYS = ['idle', 'celebrate', 'tired', 'levelup'];
const SNAME = { idle: 'Repouso', celebrate: 'Comemoração', tired: 'Desânimo', levelup: 'Subida de nível' };
const ALIGNS = ['pes', 'centro', 'recorte'];
const MAX_IMAGES = 12;
const BIG_FILE = 5 * 1048576;   // acima disso, avisa que o arquivo exportado ficou grande
const toInt = (v, d, a, b) => { const n = parseInt(v, 10); return isNaN(n) ? d : clamp(n, a, b); };
const imgDbKey = id => 'companion.img.' + id;
const pctOf = k => Math.round(k * 100) + '%';
function emptyState(fps = 8) { return { seq: [], fps, loop: true, align: 'pes', name: '' }; }
const emptyStates = () => ({ idle: emptyState(), celebrate: emptyState(), tired: emptyState(), levelup: emptyState() });
const defaultKey = () => ({ on: false, mode: 'borda', colors: [], tol: 24, trim: 0 });
const defaultGrid = () => ({ fw: 32, fh: 32, mx: 0, my: 0, sx: 0, sy: 0 });
function defaultComp() { return { v: 3, scale: 3, alpha: 8, images: [], frames: [], states: emptyStates(), nextId: 1, nextImg: 1, legacy: null }; }
function newImage(id, name, size, w, h) { return { id, name: String(name || 'imagem').slice(0, 120), size: size || 0, w, h, k: 1, key: defaultKey(), grid: defaultGrid() }; }
function gridDims(g, W, H) { return { cols: Math.max(0, Math.floor((W - g.mx + g.sx) / (g.fw + g.sx))), rows: Math.max(0, Math.floor((H - g.my + g.sy) / (g.fh + g.sy))) }; }
function gridRect(g, i, W, H) {
  const { cols, rows } = gridDims(g, W, H);
  if (!cols || !rows || i < 0 || i >= cols * rows) return null;
  return { x: g.mx + (i % cols) * (g.fw + g.sx), y: g.my + Math.floor(i / cols) * (g.fh + g.sy), w: g.fw, h: g.fh };
}
const rgbOf = c => Array.isArray(c) && c.length >= 3 ? c.slice(0, 3).map(v => toInt(v, 0, 0, 255)) : null;
function sanitizeKey(k) {
  k = Object.assign(defaultKey(), k || {});
  const cols = (Array.isArray(k.colors) ? k.colors : [k.color]).map(rgbOf).filter(Boolean).slice(0, 6);
  return { on: !!k.on && cols.length > 0, mode: ['borda', 'global'].includes(k.mode) ? k.mode : 'borda', colors: cols, tol: toInt(k.tol, 24, 0, 255), trim: toInt(k.trim, 0, 0, 3) };
}
function sanitizeGrid(g) {
  g = Object.assign(defaultGrid(), g || {});
  return { fw: toInt(g.fw, 32, 1, 4096), fh: toInt(g.fh, 32, 1, 4096), mx: toInt(g.mx, 0, 0, 4096), my: toInt(g.my, 0, 0, 4096), sx: toInt(g.sx, 0, 0, 4096), sy: toInt(g.sy, 0, 0, 4096) };
}
// Tamanho da imagem no companheiro (1 = 100%). Fica entre 25% e 400%.
const sanitizeK = v => { const n = +v; return Number.isFinite(n) && n > 0 ? clamp(Math.round(n * 100) / 100, 0.25, 4) : 1; };
function sanitizeFrames(list) {
  return (Array.isArray(list) ? list : []).filter(f => f && typeof f.id === 'string' && /^f\d+$/.test(f.id) && [f.x, f.y, f.w, f.h].every(Number.isFinite) && f.w >= 1 && f.h >= 1)
    .map(f => { const r = { x: Math.round(f.x), y: Math.round(f.y), w: Math.round(f.w), h: Math.round(f.h) }, q = f.o && [f.o.x, f.o.y, f.o.w, f.o.h].every(Number.isFinite) ? f.o : r;
      return { id: f.id, img: typeof f.img === 'string' ? f.img : '', x: r.x, y: r.y, w: r.w, h: r.h, o: { x: Math.round(q.x), y: Math.round(q.y), w: Math.round(q.w), h: Math.round(q.h) } }; });
}
function sanitizeStates(states, ids) {
  const out = {};
  for (const s of SKEYS) {
    const src = (states || {})[s] || {};
    out[s] = {
      seq: (Array.isArray(src.seq) ? src.seq : []).filter(it => it && ids.has(it.f)).map(it => ({ f: it.f, dx: Math.round(+it.dx || 0), dy: Math.round(+it.dy || 0) })),
      fps: toInt(src.fps, 8, 1, 24), loop: src.loop !== false, align: ALIGNS.includes(src.align) ? src.align : 'pes', name: String(src.name || '').slice(0, 40)
    };
  }
  return out;
}
const maxNum = (ids, p) => ids.reduce((m, id) => { const n = parseInt(String(id).slice(p.length), 10); return String(id).startsWith(p) && n > m ? n : m; }, 0);
// Manter: as versões de 16/10 (até 16h39) salvavam o companheiro nos formatos v1 e v2, e backups ou exportações daquela
// época só abrem com estas conversões. A pessoa pediu pra não apagar.
// Formato antigo (v1): todos os quadros com o mesmo tamanho, índices de grade ou posições livres por estado.
// A migração cria um recorte por quadro e alinha "pelo recorte", que reproduz exatamente a aparência antiga.
function migrateComp1(c) {
  const o = { v: 2, image: null, scale: 3, alpha: 8, key: defaultKey(), grid: defaultGrid(), frames: [], states: emptyStates(), nextId: 1, legacy: null };
  const g = { fw: toInt(c.fw, 32, 1, 4096), fh: toInt(c.fh, 32, 1, 4096), mx: toInt(c.mx, 0, 0, 4096), my: toInt(c.my, 0, 0, 4096), sx: toInt(c.sx, 0, 0, 4096), sy: toInt(c.sy, 0, 0, 4096) };
  o.legacy = clone(c); o.grid = g; o.scale = toInt(c.scale, 3, 1, 8);
  o.image = c.image && c.image.w ? { name: c.image.name, size: c.image.size, w: c.image.w, h: c.image.h } : null;
  const k = c.key || {};
  o.key = { on: !!k.on, mode: 'global', colors: Array.isArray(k.color) ? [k.color.slice(0, 3)] : [], tol: toInt(k.tol, 24, 0, 255) };
  const fps = toInt(c.fps, 8, 1, 24), mode = c.mode === 'free' ? 'free' : 'grid', lists = (c.frames || {})[mode] || {}, byKey = {};
  for (const s of SKEYS) {
    const st = emptyState(fps); st.align = 'recorte';
    for (const f of Array.isArray(lists[s]) ? lists[s] : []) {
      let r = null;
      if (mode === 'grid' && typeof f === 'number' && o.image) r = gridRect(g, f, o.image.w, o.image.h);
      else if (mode === 'free' && f && typeof f.x === 'number') r = { x: f.x, y: f.y, w: g.fw, h: g.fh };
      if (!r) continue;
      const key = r.x + ',' + r.y + ',' + r.w + ',' + r.h;
      if (!byKey[key]) { const id = 'f' + o.nextId++; byKey[key] = id; o.frames.push({ id, x: r.x, y: r.y, w: r.w, h: r.h, o: { x: r.x, y: r.y, w: r.w, h: r.h } }); }
      st.seq.push({ f: byKey[key], dx: 0, dy: 0 });
    }
    o.states[s] = st;
  }
  return o;
}
// v2 → v3: a imagem única vira a “imagem 1”, com o mesmo fundo, a mesma grade e 100% de tamanho. Nada muda na aparência.
function migrateComp2(c) {
  const frames = sanitizeFrames(c.frames), ids = new Set(frames.map(f => f.id)), o = defaultComp();
  const im = c.image && typeof c.image === 'object' ? c.image : null;
  if (im || frames.length) {
    o.images = [Object.assign(newImage('i1', im ? im.name : 'imagem', im ? toInt(im.size, 0, 0, 1e10) : 0, im ? toInt(im.w, 0, 0, 1e5) : 0, im ? toInt(im.h, 0, 0, 1e5) : 0), { key: sanitizeKey(c.key), grid: sanitizeGrid(c.grid) })];
    o.nextImg = 2;
  }
  o.frames = frames.map(f => Object.assign(f, { img: 'i1' }));
  o.states = sanitizeStates(c.states, ids);
  o.scale = c.scale; o.alpha = c.alpha; o.nextId = c.nextId; o.legacy = c.legacy || null;
  return o;
}
function sanitizeComp(c) {
  if (!c || typeof c !== 'object') return defaultComp();
  if (c.v !== 3) return sanitizeComp(migrateComp2(c.v === 2 ? c : migrateComp1(c)));
  const o = defaultComp(), seen = new Set();
  o.images = (Array.isArray(c.images) ? c.images : []).filter(im => im && typeof im.id === 'string' && /^i\d+$/.test(im.id) && !seen.has(im.id) && seen.add(im.id)).slice(0, MAX_IMAGES)
    .map(im => ({ id: im.id, name: String(im.name || 'imagem').slice(0, 120), size: toInt(im.size, 0, 0, 1e10), w: toInt(im.w, 0, 0, 1e5), h: toInt(im.h, 0, 0, 1e5), k: sanitizeK(im.k), key: sanitizeKey(im.key), grid: sanitizeGrid(im.grid) }));
  const imgs = new Set(o.images.map(im => im.id));
  o.frames = sanitizeFrames(c.frames).filter(f => imgs.has(f.img));
  const ids = new Set(o.frames.map(f => f.id));
  o.states = sanitizeStates(c.states, ids);
  o.scale = toInt(c.scale, 3, 1, 8); o.alpha = toInt(c.alpha, 8, 0, 254);
  o.nextId = Math.max(toInt(c.nextId, 1, 1, 1e9), maxNum([...ids], 'f') + 1);
  o.nextImg = Math.max(toInt(c.nextImg, 1, 1, 1e9), maxNum([...imgs], 'i') + 1);
  o.legacy = c.legacy && typeof c.legacy === 'object' ? c.legacy : null;
  return o;
}
let CC = (() => {
  let raw = null; try { raw = JSON.parse(localStorage.getItem(CKEY)); } catch (e) {}
  const c = sanitizeComp(raw);
  // Formato antigo: guarda uma cópia do jeito que estava antes de converter.
  if (raw && raw.v !== 3) { try { localStorage.setItem(CKEY + '.v' + (raw.v === 2 ? 2 : 1) + '-backup', JSON.stringify(raw)); localStorage.setItem(CKEY, JSON.stringify(c)); } catch (e) {} }
  return c;
})();
let CC_VER = 0;
function saveComp() { CC_VER++; try { localStorage.setItem(CKEY, JSON.stringify(CC)); } catch (e) { toast('Não consegui salvar as configurações do companheiro.'); } }

/* ===================== Folha de sprites: imagem, fundo e máscara ===================== */
function loadImage(blob) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob); const im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); res(im); };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('imagem inválida')); };
    im.src = url;
  });
}
// Cede a vez pro navegador desenhar (progresso visível) sem travar se a aba estiver em segundo plano.
const yieldUI = () => new Promise(r => { let done = false; const f = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(() => setTimeout(f, 0)); setTimeout(f, 50); });
const hexOf = c => '#' + c.map(v => pad(v.toString(16))).join('').toUpperCase();
function colorNear(p, i, k, t) { return Math.abs(p[i] - k[0]) <= t && Math.abs(p[i + 1] - k[1]) <= t && Math.abs(p[i + 2] - k[2]) <= t; }
// Testa se um pixel é do fundo: perto de alguma das cores ou, com várias cores (quadriculado), entre elas,
// o que cobre as bordas borradas dos quadradinhos quando a imagem foi ampliada.
function bgMatcher(colors, t, between) {
  const lo = [0, 1, 2].map(c => Math.min(...colors.map(k => k[c])) - t), hi = [0, 1, 2].map(c => Math.max(...colors.map(k => k[c])) + t);
  const chroma = Math.max(...colors.map(k => Math.max(...k) - Math.min(...k))) + t, multi = between && colors.length > 1;
  return (p, i) => {
    for (const k of colors) if (colorNear(p, i, k, t)) return true;
    if (!multi) return false;
    const r = p[i], g = p[i + 1], b = p[i + 2];
    return r >= lo[0] && r <= hi[0] && g >= lo[1] && g <= hi[1] && b >= lo[2] && b <= hi[2] && Math.max(r, g, b) - Math.min(r, g, b) <= chroma;
  };
}
const keyColors = key => key && Array.isArray(key.colors) && key.colors.length ? key.colors : key && Array.isArray(key.color) ? [key.color] : [];
// Preenche a partir das bordas tudo que for fundo (ou transparente). Protege pixels do personagem com a mesma cor.
function floodEdges(p, W, H, colors, t) {
  const vis = new Uint8Array(W * H), q = new Int32Array(W * H); let qh = 0, qt = 0; const m = bgMatcher(colors, t, true);
  const ok = j => { const i = j * 4; return p[i + 3] === 0 || m(p, i); };
  const push = j => { if (!vis[j] && ok(j)) { vis[j] = 1; q[qt++] = j; } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (qh < qt) {
    const j = q[qh++], x = j % W;
    if (x > 0) push(j - 1); if (x < W - 1) push(j + 1); if (j >= W) push(j - W); if (j < (H - 1) * W) push(j + W);
  }
  return vis;
}
function analyzeSheet(p, W, H) {
  let transp = 0; for (let i = 3; i < p.length; i += 4) if (p[i] < 250) transp++;
  // Cores das bordas, agrupadas por semelhança (ruído de compressão e marca d'água leve caem no mesmo grupo).
  const counts = new Map(); let border = 0;
  const add = j => { const i = j * 4; if (p[i + 3] < 250) return; border++; const k = (p[i] << 16) | (p[i + 1] << 8) | p[i + 2]; counts.set(k, (counts.get(k) || 0) + 1); };
  for (let x = 0; x < W; x++) { add(x); if (H > 1) add((H - 1) * W + x); }
  for (let y = 1; y < H - 1; y++) { add(y * W); if (W > 1) add(y * W + W - 1); }
  const groups = [];
  for (const [k, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    const c = [(k >> 16) & 255, (k >> 8) & 255, k & 255], g = groups.find(x => Math.abs(x.c[0] - c[0]) <= 14 && Math.abs(x.c[1] - c[1]) <= 14 && Math.abs(x.c[2] - c[2]) <= 14);
    if (g) g.n += n; else if (groups.length < 256) groups.push({ c, n });
  }
  groups.sort((a, b) => b.n - a.n);
  const total = Math.max(1, border), pal = []; let cum = 0;
  for (const g of groups) { if (pal.length >= 4 || g.n / total < 0.04) break; pal.push(g.c); cum += g.n; }
  const hasAlpha = transp > W * H * 0.001, top = groups.length ? groups[0].n / total : 0, frac = cum / total;
  let bgSet = null;
  if (!hasAlpha && pal.length) { if (top >= 0.85) bgSet = [pal[0]]; else if (frac >= 0.85) bgSet = pal; else if (top >= 0.5) bgSet = [pal[0]]; }
  return { hasAlpha, transpFrac: transp / (W * H), bg: bgSet ? bgSet[0] : null, bgSet, bgFrac: frac, solid: !!bgSet && bgSet.length === 1, pattern: !!bgSet && bgSet.length > 1 };
}
class SheetImage {
  constructor() { this.clear(); }
  clear() { this.img = null; this.blob = null; this.orig = null; this.info = null; this.src = null; this.mask = null; this.sig = ''; this.bb = new Map(); }
  get w() { return this.img ? this.img.naturalWidth || this.img.width : 0; }
  get h() { return this.img ? this.img.naturalHeight || this.img.height : 0; }
  async load(blob) {
    const img = await loadImage(blob);
    this.clear(); this.img = img; this.blob = blob;
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    this.orig = x.getImageData(0, 0, this.w, this.h); this.info = analyzeSheet(this.orig.data, this.w, this.h);
  }
  // Compartilha a imagem e a versão processada (nunca são alteradas no lugar: um fundo novo gera tela e máscara novas).
  adopt(o) { this.img = o.img; this.blob = o.blob; this.orig = o.orig; this.info = o.info; this.src = o.src; this.mask = o.mask; this.sig = o.sig; this.bb = new Map(o.bb); }
  // Gera a versão exibida (sem fundo, se pedido) e a máscara do personagem. Só refaz quando o fundo ou a transparência mínima mudam.
  ensure(key, alpha = 8) {
    if (!this.img) return;
    const kc = keyColors(key), sig = JSON.stringify([!!(key && key.on), key && key.mode, kc, key && key.tol, key && key.trim, alpha]);
    if (sig === this.sig && this.src) return;
    const W = this.w, H = this.h, d = new ImageData(new Uint8ClampedArray(this.orig.data), W, H), p = d.data;
    if (key && key.on && kc.length) {
      if (key.mode === 'global') { const m = bgMatcher(kc, key.tol, false); for (let i = 0; i < p.length; i += 4) if (m(p, i)) p[i + 3] = 0; }
      else { const fl = floodEdges(p, W, H, kc, key.tol); for (let j = 0; j < fl.length; j++) if (fl[j]) p[j * 4 + 3] = 0; }
      // Limpar contorno: tira 1 a 3 camadas de pixels claros grudados no fundo (sobra de imagem ampliada com suavização).
      if (key.trim) {
        const m2 = bgMatcher(kc, key.tol * 2 + 16, true);
        for (let pass = 0; pass < key.trim; pass++) {
          const kill = [];
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const j = y * W + x, i = j * 4; if (!p[i + 3]) continue;
            const edge = (x > 0 && !p[i - 1]) || (x < W - 1 && !p[i + 7]) || (y > 0 && !p[i - W * 4 + 3]) || (y < H - 1 && !p[i + W * 4 + 3]);
            if (edge && m2(p, i)) kill.push(i);
          }
          if (!kill.length) break; for (const i of kill) p[i + 3] = 0;
        }
      }
    }
    const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(d, 0, 0);
    const m = new Uint8Array(W * H); for (let j = 0; j < m.length; j++) m[j] = p[j * 4 + 3] > alpha ? 1 : 0;
    // Fundo ainda não removido: a detecção ignora mesmo assim o fundo ligado às bordas.
    if (!(key && key.on) && this.info.bgSet) { const fl = floodEdges(this.orig.data, W, H, this.info.bgSet, 24); for (let j = 0; j < fl.length; j++) if (fl[j]) m[j] = 0; }
    this.src = c; this.mask = m; this.sig = sig; this.bb = new Map();
  }
  // Caixa dos pixels do personagem dentro de um recorte (coordenadas relativas ao recorte), ou null se vazio.
  bbox(r) {
    if (!this.mask) return null;
    const k = r.x + ',' + r.y + ',' + r.w + ',' + r.h; if (this.bb.has(k)) return this.bb.get(k);
    const W = this.w, x0 = Math.max(0, r.x), y0 = Math.max(0, r.y), x1 = Math.min(W, r.x + r.w), y1 = Math.min(this.h, r.y + r.h);
    let a = Infinity, b = Infinity, c = -1, d = -1;
    for (let y = y0; y < y1; y++) { const row = y * W; for (let x = x0; x < x1; x++) if (this.mask[row + x]) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; d = y; } }
    const out = c < 0 ? null : { x: a - r.x, y: b - r.y, w: c - a + 1, h: d - b + 1 };
    if (this.bb.size > 4000) this.bb.clear();
    this.bb.set(k, out); return out;
  }
  pixel(x, y) { const i = (y * this.w + x) * 4, p = this.orig.data; return [p[i], p[i + 1], p[i + 2], p[i + 3]]; }
}
// Conjunto das imagens de um companheiro, uma folha por imagem (id → SheetImage).
class SheetSet {
  constructor() { this.m = new Map(); this.v = 0; }
  get(id) { return this.m.get(id) || null; }
  has(id) { const s = this.m.get(id); return !!(s && s.img); }
  put(id, sh) { this.m.set(id, sh); this.v++; return sh; }
  async load(id, blob) { const sh = new SheetImage(); await sh.load(blob); return this.put(id, sh); }
  clear() { this.m = new Map(); this.v++; }
  // Copia as folhas de outro conjunto (só as da lista de ids, se houver).
  adopt(o, only) { this.m = new Map(); for (const [id, sh] of o.m) if (!only || only.includes(id)) { const s = new SheetImage(); s.adopt(sh); this.m.set(id, s); } this.v++; }
  any(cfg) { return cfg.images.some(im => this.has(im.id)); }
  ensure(cfg) { for (const im of cfg.images) { const s = this.get(im.id); if (s && s.img) s.ensure(im.key, cfg.alpha); } }
  sig(cfg) { return this.v + '|' + cfg.images.map(im => { const s = this.get(im.id); return im.id + ':' + im.k + ':' + (s && s.img ? s.w + 'x' + s.h + s.sig : '-'); }).join(','); }
}
const SAVED = new SheetSet();
// Lê do navegador as imagens do companheiro salvo. A imagem do formato antigo (uma só) vira a imagem 1.
async function loadSavedImages() {
  SAVED.clear();
  for (const im of CC.images) {
    try {
      let blob = await IDB.get(imgDbKey(im.id)), legacy = false;
      if (!blob && im.id === 'i1') { blob = await IDB.get('companion.image'); legacy = !!blob; }
      if (!blob) continue;
      const sh = new SheetImage(); await sh.load(blob);
      if (legacy) {
        if (im.w && (sh.w !== im.w || sh.h !== im.h)) continue;
        try { await IDB.set(imgDbKey(im.id), blob); } catch (e) {}
      }
      SAVED.put(im.id, sh);
    } catch (e) { console.warn('Imagem do companheiro indisponível:', im.id, e); }
  }
}

/* ===================== Alinhamento e área de exibição comum ===================== */
// Âncora de cada quadro: pelos pés (base dos pixels), pelo centro dos pixels ou pela base do recorte.
function anchorOf(f, align, sheet) {
  if (align === 'recorte') return { ax: Math.floor(f.w / 2), ay: f.h };
  const bb = sheet.bbox(f) || { x: 0, y: 0, w: f.w, h: f.h };
  return align === 'centro' ? { ax: bb.x + Math.floor(bb.w / 2), ay: bb.y + Math.floor(bb.h / 2) } : { ax: bb.x + Math.floor(bb.w / 2), ay: bb.y + bb.h };
}
// Calcula uma área comum a todos os estados: as âncoras coincidem e o personagem não pula entre poses de tamanhos diferentes.
// Cada imagem entra com o seu tamanho (k); os ajustes finos (dx, dy) ficam em pixels da área comum.
function stageLayout(cfg, set) {
  const fmap = new Map(cfg.frames.map(f => [f.id, f])), imap = new Map(cfg.images.map(im => [im.id, im])), per = {}, ks = new Set();
  let L = 0, R = 0, U = 0, D = 0, any = false;
  for (const s of SKEYS) {
    const st = cfg.states[s]; per[s] = [];
    st.seq.forEach((it, k) => {
      const f = fmap.get(it.f), im = f && imap.get(f.img), sh = f && set.get(f.img); if (!f || !im || !sh || !sh.src) return;
      const sc = im.k, a = anchorOf(f, st.align, sh), ax = a.ax * sc, ay = a.ay * sc;
      per[s].push({ r: f, sh, sc, ax, ay, dx: it.dx, dy: it.dy, k });
      // Pelo recorte, a área inclui o recorte inteiro (como nas grades antigas); pelos pés ou centro, só os pixels do personagem.
      const e = st.align === 'recorte' ? { x: 0, y: 0, w: f.w, h: f.h } : (sh.bbox(f) || { x: 0, y: 0, w: f.w, h: f.h });
      L = Math.max(L, ax - e.x * sc - it.dx); R = Math.max(R, (e.x + e.w) * sc - ax + it.dx); U = Math.max(U, ay - e.y * sc - it.dy); D = Math.max(D, (e.y + e.h) * sc - ay + it.dy); any = true; ks.add(sc);
    });
  }
  return any ? { W: Math.max(1, L + R), H: Math.max(1, U + D), L, U, per, ks: [...ks] } : null;
}

/* ===================== Reprodutor de animação ===================== */
class Player {
  constructor(canvas, wrap, o) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.wrap = wrap;
    this.o = Object.assign({ maxPx: 136, cap: true, sheet: () => SAVED, cfg: () => CC, ver: () => CC_VER, auto: true, onDraw: null }, o || {});
    this.state = 'idle'; this.i = 0; this.timer = null; this.paused = false; this.scaleOverride = null; this.bg = null; this.guides = false; this.onion = false; this._k = ''; this._lay = null; this.lastScale = 1;
  }
  layout() {
    const set = this.o.sheet(), cfg = this.o.cfg();
    set.ensure(cfg);
    const k = this.o.ver() + '|' + set.sig(cfg);
    if (k !== this._k) { this._k = k; this._lay = stageLayout(cfg, set); }
    return this._lay;
  }
  seq() {
    const lay = this.layout(), cfg = this.o.cfg();
    if (!lay) return { f: [], fb: false, st: cfg.states[this.state], lay: null };
    let f = lay.per[this.state] || [], fb = false, s = this.state;
    if (!f.length && s !== 'idle') { f = lay.per.idle; fb = true; s = 'idle'; }
    return { f, fb, st: cfg.states[s], lay };
  }
  play(state) { this.state = state; this.i = 0; this.restart(); }
  restart() {
    clearInterval(this.timer); this.timer = null; this.draw();
    if (this.paused || (this.o.auto && reduced())) return;
    const { f, st } = this.seq();
    if (f.length > 1) this.timer = setInterval(() => this.tick(), Math.round(1000 / st.fps));
  }
  tick() {
    const { f, st } = this.seq(); if (!f.length) return;
    if (!st.loop && this.i % f.length === f.length - 1) { clearInterval(this.timer); this.timer = null; return; }
    this.i = (this.i + 1) % f.length; this.draw();
  }
  pause(p) { this.paused = p; this.restart(); }
  step(n) { const { f } = this.seq(); if (!f.length) return; this.i = ((this.i % f.length) + n + f.length * 4) % f.length; this.draw(); }
  index() { const { f } = this.seq(); return f.length ? this.i % f.length : 0; }
  current() { const { f } = this.seq(); return f.length ? f[this.i % f.length] : null; }
  // Ampliação inteira sempre que possível; com imagens em 50%, prefere um valor que mantenha cada pixel inteiro.
  scale(lay) {
    if (this.scaleOverride) return this.scaleOverride;
    const m = Math.max(lay.W, lay.H), cap = this.o.cap ? this.o.cfg().scale : 8;
    if (m > this.o.maxPx) return this.o.maxPx / m;
    const s = Math.max(1, Math.min(cap, Math.floor(this.o.maxPx / m)));
    for (let t = s; t >= 1; t--) if (lay.ks.every(k => Math.abs(t * k - Math.round(t * k)) < 1e-6)) return t;
    return s;
  }
  draw() {
    const { f, fb, lay } = this.seq(), empty = !f.length;
    this.wrap.classList.toggle('empty', empty); this.wrap.dataset.state = this.state; this.wrap.dataset.fallback = fb ? '1' : '';
    if (empty) { this.cv.width = 0; this.cv.height = 0; this.cv.dataset.frame = ''; this.cv.dataset.fid = ''; if (this.o.onDraw) this.o.onDraw(0, 0); return; }
    const s = this.lastScale = this.scale(lay), W = Math.max(1, Math.round(lay.W * s)), H = Math.max(1, Math.round(lay.H * s));
    if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; }
    const c = this.ctx, n = f.length, idx = this.i % n;
    c.imageSmoothingEnabled = false; c.clearRect(0, 0, W, H);
    if (this.bg) { c.fillStyle = this.bg; c.fillRect(0, 0, W, H); }
    const put = it => { const x = lay.L - it.ax + it.dx, y = lay.U - it.ay + it.dy; c.drawImage(it.sh.src, it.r.x, it.r.y, it.r.w, it.r.h, Math.round(x * s), Math.round(y * s), Math.round(it.r.w * it.sc * s), Math.round(it.r.h * it.sc * s)); };
    if (this.onion && n > 1) { c.globalAlpha = 0.35; put(f[(idx - 1 + n) % n]); c.globalAlpha = 1; }
    put(f[idx]);
    if (this.guides) {
      c.save(); c.strokeStyle = 'rgba(255,122,122,.9)'; c.setLineDash([4, 3]); c.lineWidth = 1;
      const gx = Math.round(lay.L * s) + 0.5, gy = Math.round(lay.U * s) - 0.5;
      c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); c.moveTo(gx, 0); c.lineTo(gx, H); c.stroke(); c.restore();
    }
    this.cv.dataset.frame = String(idx); this.cv.dataset.fid = f[idx].r.id;
    if (this.o.onDraw) this.o.onDraw(idx, n);
  }
}

/* ===================== Companheiro na tela Hoje ===================== */
const Comp = {
  player: null, base: 'idle', recovered: false, timer: null, kind: null,
  init() { this.player = new Player($('#compCanvas'), $('#compStage'), { maxPx: 136, cap: true }); this.player.play('idle'); $('#compStage').addEventListener('click', () => this.tap()); },
  setBase(state, recovered) {
    this.recovered = recovered;
    if (this.base !== state) { this.base = state; if (!this.timer) this.player.play(state); }
    this.paint();
  },
  react(kind, text) {
    clearTimeout(this.timer); const st = $('#compStage');
    st.classList.remove('fx-party', 'fx-burst', 'hop'); void st.offsetWidth;
    this.kind = kind; this.player.play(kind); $('#compFloat').textContent = text || '';
    st.classList.add(kind === 'levelup' ? 'fx-burst' : 'fx-party'); this.paint();
    this.timer = setTimeout(() => { this.timer = null; this.kind = null; st.classList.remove('fx-party', 'fx-burst'); this.player.play(this.base); this.paint(); }, kind === 'levelup' ? CFG.anim.levelupMs : CFG.anim.celebrateMs);
  },
  tap() {
    if (this.timer) return; const st = $('#compStage');
    st.classList.remove('hop'); void st.offsetWidth; st.classList.add('hop');
    setTimeout(() => st.classList.remove('hop'), CFG.anim.tapMs);
  },
  paint() {
    const chip = $('#compChip'); let label, bg = 'var(--sf2)', fg = 'var(--mu)', note;
    if (this.kind === 'levelup') { label = 'Subiu de nível'; bg = 'var(--xp)'; fg = 'var(--bg)'; note = 'Novo nível desbloqueado'; }
    else if (this.kind === 'celebrate') { label = 'Comemorando'; bg = 'var(--ok)'; fg = 'var(--okt)'; note = 'Reage a cada XP ganho'; }
    else if (this.base === 'tired') { label = 'Desanimado'; note = CFG.tiredDays + ' dias sem registro · volta ao normal na próxima tarefa'; }
    else if (this.recovered) { label = 'Recuperado'; bg = 'var(--ok)'; fg = 'var(--okt)'; note = 'De volta ao normal'; }
    else { label = 'Repouso'; note = 'Toque para interagir'; }
    chip.textContent = label; chip.style.background = bg; chip.style.color = fg;
    $('#compNote').textContent = SAVED.any(CC) && CC.states.idle.seq.length ? note : 'Configure o companheiro em Configurações.';
    $('#compStage').dataset.kind = this.kind || this.base;
  }
};
