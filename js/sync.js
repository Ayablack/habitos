// Hábitos · Passar dados pro outro aparelho por QR.
'use strict';
/* ===================== Sincronização por QR ===================== */
const b64u = {
  enc(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(str) { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
};
async function packText(json) {
  const bytes = new TextEncoder().encode(json);
  if ('CompressionStream' in window) {
    const buf = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
    return 'z' + b64u.enc(new Uint8Array(buf));
  }
  return 'j' + b64u.enc(bytes);
}
async function unpackText(s) {
  const bytes = b64u.dec(s.slice(1));
  if (s[0] === 'z') { const buf = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer(); return new TextDecoder().decode(buf); }
  if (s[0] === 'j') return new TextDecoder().decode(bytes);
  throw new Error('formato desconhecido');
}
const DEFAULT_IDS = new Set(DEFAULT_TASKS.map(t => t.id));
const TYPE_CODE = { simples: 's', horario: 'h', duplo: 'd' }, CODE_TYPE = { s: 'simples', h: 'horario', d: 'duplo' };
const Pack = {
  // Formato compacto pro QR: só tarefas criadas ou alteradas, horários sem dois-pontos, registros em texto curto.
  task(t) {
    const o = { i: t.id, l: t.label, y: TYPE_CODE[t.type] || 's', o: t.order ?? 0 };
    if (t.type === 'simples' || t.p) o.p = t.p || 'm';
    if (t.p2) o.q = t.p2; if (t.cnt) o.n = t.cnt;
    if (t.type === 'horario') { o.t = (t.times || []).map(x => x.replace(':', '')).join(','); if ((t.tol ?? 10) !== 10) o.c = t.tol; }
    if (Array.isArray(t.days) && t.days.length && t.days.length < 7) o.d = t.days.join('');
    if (t.start) o.s = t.start; if (t.end) o.e = t.end; if (t.updatedAt) o.u = t.updatedAt; if (t.agua) o.w = 1;
    return o;
  },
  untask(o) {
    return { id: String(o.i), label: String(o.l || 'Tarefa'), type: CODE_TYPE[o.y] || 'simples', p: o.p || null, times: o.t ? String(o.t).split(',').filter(Boolean).map(x => x.slice(0, 2) + ':' + x.slice(2)) : [], tol: o.c ?? 10,
      days: o.d ? String(o.d).split('').map(Number) : ALLDAYS.slice(), start: o.s || null, end: o.e || null, order: o.o ?? 0, updatedAt: o.u || 0, agua: o.w ? 1 : 0, p2: o.q || null, cnt: o.n || null };
  },
  // Retrato do dia (tarefas, meta da água e contadores daquele dia). Só vai no QR quando é diferente do que o outro aparelho
  // montaria com as tarefas e metas de agora; assim o XP e a % dos dias passados ficam iguais nos dois aparelhos.
  frozen(d, k) {
    const x = {};
    if (Array.isArray(d.sched) && JSON.stringify(d.sched) !== JSON.stringify(snapshot(k))) x.s = d.sched.map(o => [o.oid, o.xp, o.time || '', o.time ? o.tol : '', o.w ?? ''].join('|'));
    if (d.meta && d.meta !== ST().aguaMeta) x.m = d.meta;
    if (d.cm && JSON.stringify(d.cm) !== JSON.stringify(cntDefs())) x.cm = d.cm;
    if (d.af !== undefined && d.af !== (ST().aguaFull !== false ? 1 : 0)) x.af = d.af;
    return Object.keys(x).length ? x : null;
  },
  day(d, k) {
    const a = [Object.entries(d.done || {}).map(([k, v]) => k + '=' + (v === 'skip' ? 'x' : v.replace(':', ''))).join(';'), d.agua || 0, d.aguaLast ? d.aguaLast.replace(':', '') : ''];
    const c = Object.entries(d.c || {}).map(([k, v]) => k + '=' + v).join(';');
    const f = this.frozen(d, k);
    if (c || d.note || f) a.push(c); if (d.note || f) a.push(d.note || '', d.nu || 0); if (f) a.push(f);
    return a;
  },
  list(l) { const o = { i: l.id, n: l.name, c: l.c, o: l.order ?? 0, u: l.updatedAt || 0 }; if (l.del) o.x = 1; return o; },
  unlist(o) { return { id: String(o.i), name: String(o.n || 'Lista').slice(0, 30), c: LCOLORS.some(c => c[0] === o.c) ? o.c : 'xp', order: +o.o || 0, updatedAt: +o.u || 0, del: o.x ? 1 : 0 }; },
  cnt(c) { const o = { i: c.id, n: c.name, un: c.unit || '', s: c.step, m: c.meta, x: c.xp || 0, f: c.full ? 1 : 0, o: c.order ?? 0, u: c.updatedAt || 0 }; if (c.del) o.d = 1; return o; },
  uncnt(o) { return sanitizeCnt({ id: String(o.i), name: o.n, unit: o.un, step: o.s, meta: o.m, xp: o.x, full: !!o.f, order: o.o, updatedAt: o.u, del: o.d ? 1 : 0 }); },
  unday(a) {
    const done = {};
    for (const part of String(a[0] || '').split(';').filter(Boolean)) { const [k, v] = part.split('='); if (k && v) done[k] = v === 'x' ? 'skip' : v.slice(0, 2) + ':' + v.slice(2); }
    const c = {}; for (const part of String(a[3] || '').split(';').filter(Boolean)) { const [k, v] = part.split('='); if (k && +v > 0) c[k] = +v; }
    const out = { done, agua: +a[1] || 0, aguaLast: a[2] ? a[2].slice(0, 2) + ':' + a[2].slice(2) : null, c, note: a[4] ? String(a[4]).slice(0, 140) : '', nu: +a[5] || 0 };
    const f = a[6] && typeof a[6] === 'object' ? a[6] : null;
    if (f) {
      if (Array.isArray(f.s)) out.sched = f.s.map(x => { const [oid, xp, time, tol, w] = String(x).split('|'), o = { oid, xp: +xp }; if (time) { o.time = time; o.tol = +tol; } if (w) o.w = w === '1' ? 1 : w; return o; });
      if (f.m) out.meta = f.m; if (f.cm) out.cm = f.cm; if (f.af !== undefined) out.af = f.af;
    }
    return out;
  }
};
const Sync = {
  async payload() {
    const t = logicalDate();
    const tasks = DATA.tasks.filter(x => !DEFAULT_IDS.has(x.id) || x.updatedAt).map(x => Pack.task(x));
    const settings = DATA.settings.updatedAt ? DATA.settings : null;
    for (const n of CFG.syncDays) {
      const days = {};
      for (let i = 0; i < n; i++) { const k = addDays(t, -i), d = DATA.days[k]; if (d && Object.keys(d.done || {}).length + (d.agua || 0) + Object.keys(d.c || {}).length + (d.note ? 1 : 0) > 0) days[k] = Pack.day(d, k); }
      const pk = { t: 'hq', v: 2, c: DATA.createdAt, k: tasks, s: settings, d: days };
      if (DATA.lists.some(l => l.updatedAt)) pk.l = DATA.lists.map(l => Pack.list(l));
      if (DATA.counters.length) pk.n = DATA.counters.map(c => Pack.cnt(c));
      if (Dash.get().updatedAt) pk.b = Dash.pack();
      const txt = await packText(JSON.stringify(pk));
      if (txt.length <= CFG.qrMaxChars || n === 1) return { txt, n, count: Object.keys(days).length };
    }
  },
  base() { return /^https?:/.test(location.protocol) ? location.origin + location.pathname : 'habitos:'; },
  async show() {
    if (typeof qrcode !== 'function') { toast('Gerador de QR indisponível.'); return; }
    const p = await this.payload(), text = this.base() + '#sync=' + p.txt;
    let qr;
    try { qr = qrcode(0, 'L'); qr.addData(text, 'Byte'); qr.make(); } catch (e) { toast('Dados demais pro QR. Use “Compartilhar backup”.'); return; }
    // Tamanho pelo espaço do cartão (até 340 px), em pixels reais da tela: cabe no celular e cada quadradinho fica nítido pra câmera.
    const n = qr.getModuleCount(), quiet = 4, m = n + quiet * 2, cv = $('#qrCanvas'), g = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
    const avail = Math.min(340, $('.qrbox').clientWidth || 340), size = Math.max(1, Math.floor(avail * dpr / m));
    cv.width = cv.height = m * size; cv.style.width = (m * size / dpr) + 'px'; g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect((c + quiet) * size, (r + quiet) * size, size, size);
    cv.dataset.text = text;
    $('#qrInfo').textContent = `QR com as tarefas, listas, contadores, configurações, o arranjo do painel e ${p.count} dia${p.count === 1 ? '' : 's'} com registro (até ${p.n} dias pra trás). No outro aparelho, toque em “Ler QR” e aponte a câmera.`;
  },
  stream: null, timer: null,
  async read() {
    if (!('BarcodeDetector' in window)) { toast('Este navegador não lê QR. Use “Compartilhar backup” e importe o arquivo.'); return; }
    let det; try { det = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { toast('Leitor de QR indisponível neste navegador.'); return; }
    try { this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); } catch (e) { toast('Sem acesso à câmera.'); return; }
    const v = $('#scanVideo'); v.srcObject = this.stream; await v.play().catch(() => {}); $('#scanModal').hidden = false;
    this.timer = setInterval(async () => {
      try { const r = await det.detect(v); const hit = r.find(x => x.rawValue && x.rawValue.includes('#sync=')); if (hit) { this.close(); await this.receive(hit.rawValue); } } catch (e) {}
    }, 350);
  },
  close() { clearInterval(this.timer); this.timer = null; if (this.stream) this.stream.getTracks().forEach(t => t.stop()); this.stream = null; $('#scanModal').hidden = true; },
  async receive(raw) {
    const s = raw.slice(raw.indexOf('#sync=') + 6);
    let obj; try { obj = JSON.parse(await unpackText(s)); } catch (e) { toast('QR inválido ou incompleto.'); return false; }
    if (obj && obj.t === 'hq' && obj.v === 2 && Array.isArray(obj.k) && obj.d) {
      const days = {}; for (const [k, a] of Object.entries(obj.d)) days[k] = Pack.unday(a);
      obj = { t: 'hq', c: obj.c, tasks: obj.k.map(x => Pack.untask(x)), settings: obj.s, days, dash: obj.b && obj.b.b ? Dash.unpack(obj.b.b, obj.b.u) : null, lists: Array.isArray(obj.l) ? obj.l.map(x => Pack.unlist(x)) : null, counters: Array.isArray(obj.n) ? obj.n.map(x => Pack.uncnt(x)) : null };
    }
    if (!obj || obj.t !== 'hq' || !Array.isArray(obj.tasks) || !obj.days) { toast('Esse QR não é do app Hábitos.'); return false; }
    // O link pode ter vindo de qualquer lugar: passa pela mesma validação do backup antes de juntar.
    obj = { c: okDate(obj.c) ? obj.c : null, tasks: obj.tasks.map(cleanTask).filter(Boolean), settings: obj.settings ? cleanSettings(obj.settings) : null, days: cleanDays(obj.days), dash: obj.dash || null,
      lists: Array.isArray(obj.lists) ? obj.lists.map(cleanList).filter(Boolean) : null, counters: Array.isArray(obj.counters) ? obj.counters.map(cleanCnt).filter(Boolean) : null };
    const n = Object.keys(obj.days).length;
    if (!confirm('Juntar ' + n + ' dia' + (n === 1 ? '' : 's') + ' de registros e as tarefas do outro aparelho com os deste? Nada é apagado.')) return false;
    const added = this.merge(obj); renderAll(); toast(added + ' registro' + (added === 1 ? '' : 's') + ' novo' + (added === 1 ? '' : 's') + ' recebido' + (added === 1 ? '' : 's') + '.');
    return true;
  },
  merge(obj) {
    // Listas e contadores primeiro: o arranjo do painel e as tarefas apontam pra eles.
    const byId = (arr, inc) => { for (const x of inc || []) { const i = arr.findIndex(y => y.id === x.id); if (i < 0) arr.push(x); else if ((x.updatedAt || 0) > (arr[i].updatedAt || 0)) arr[i] = x; } };
    byId(DATA.lists, obj.lists); byId(DATA.counters, obj.counters);
    for (const t of obj.tasks) { const i = DATA.tasks.findIndex(x => x.id === t.id); if (i < 0) DATA.tasks.push(t); else if ((t.updatedAt || 0) > (DATA.tasks[i].updatedAt || 0)) DATA.tasks[i] = t; }
    if (obj.settings && (obj.settings.updatedAt || 0) > (DATA.settings.updatedAt || 0)) DATA.settings = cleanSettings(obj.settings);
    if (obj.dash) Dash.merge(obj.dash);
    if (obj.c && obj.c < DATA.createdAt) DATA.createdAt = obj.c;
    let added = 0;
    for (const [k, sd] of Object.entries(obj.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
      let day = DATA.days[k]; if (!day) { day = DATA.days[k] = { done: {}, agua: 0 }; }
      for (const [oid, v] of Object.entries(sd.done || {})) {
        const cur = day.done[oid];
        if (!cur || (cur === 'skip' && v !== 'skip')) { day.done[oid] = v; added++; }
        else if (isDone(cur) && isDone(v) && toMinL(v) < toMinL(cur)) day.done[oid] = v;
      }
      if ((sd.agua || 0) > (day.agua || 0)) { day.agua = sd.agua; added++; }
      if (sd.aguaLast && (!day.aguaLast || sd.aguaLast > day.aguaLast)) day.aguaLast = sd.aguaLast;
      for (const [id, v] of Object.entries(sd.c || {})) if (v > ((day.c || {})[id] || 0)) { day.c = day.c || {}; day.c[id] = v; added++; }
      if (sd.note && (!day.note || (sd.nu || 0) > (day.nu || 0))) { day.note = sd.note; day.nu = sd.nu || 0; }
      // Dia novo neste aparelho: usa o retrato que veio do outro, se veio; senão, monta com as tarefas de agora.
      if (!day.sched) { freezeDay(day, k); for (const f of ['sched', 'meta', 'cm', 'af']) if (sd[f] !== undefined) day[f] = sd[f]; }
    }
    touchToday(); saveData(); return added;
  }
};
