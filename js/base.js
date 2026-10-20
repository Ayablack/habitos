// Hábitos · Configurações fixas, utilidades, dados salvos no navegador e as regras de XP, sequência e coringa.
'use strict';
/* ===================== Parâmetros centrais ===================== */
const CFG = {
  esquecidoMin: 120,
  xp: { simples: 10, horario: 20, aguaMeta: 20, diaCompleto: 30, recorde: 25 },
  levels: [[0,'Novato'],[100,'Aprendiz'],[250,'Desperto'],[450,'Constante'],[700,'Disciplinado'],[1000,'Firme'],[1350,'Veterano'],[1750,'Mestre'],[2200,'Lenda'],[2700,'Inabalável']],
  tiredDays: 2,
  anim: { celebrateMs: 1500, levelupMs: 3000, tapMs: 600 },
  syncDays: [14, 10, 7, 5, 3, 2, 1], qrMaxChars: 700
};
const ALLDAYS = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_SETTINGS = { wake: '08:00', sleep: '22:00', cutoffHour: 4, aguaMeta: 10, copoMl: 200, notif: false, notifDose: true, doseLead: 5, notifAgua: false, aguaGap: 120, som: true, confete: true, aguaFull: true, updatedAt: 0 };
const DEFAULT_TASKS = [
  { id: 'd1', label: 'Escovar os dentes', type: 'simples', p: 'm' },
  { id: 'a1', label: 'Copo d’água ao acordar', type: 'simples', p: 'm', agua: 1 },
  { id: 'r1', label: 'Remédio', type: 'horario', times: ['08:00'], tol: 10 },
  { id: 'c1', label: 'Tomar café', type: 'simples', p: 'm' },
  { id: 'b1', label: 'Arrumar a cama', type: 'simples', p: 'm' },
  { id: 's1', label: '10 min de sol ou caminhada', type: 'simples', p: 'd' },
  { id: 'p1', label: 'Pausa pra alongar', type: 'simples', p: 'd' },
  { id: 'f1', label: 'Comer uma fruta', type: 'simples', p: 'd' },
  { id: 'r2', label: 'Remédio', type: 'horario', times: ['20:00'], tol: 10 },
  { id: 'd2', label: 'Escovar os dentes', type: 'simples', p: 'n' },
  { id: 'fd', label: 'Fio dental', type: 'simples', p: 'n' },
  { id: 'bn', label: 'Tomar banho', type: 'simples', p: 'n' },
  { id: 'pr', label: 'Deixar o dia de amanhã pronto', type: 'simples', p: 'n' },
  { id: 'tl', label: 'Largar a tela 30 min antes', type: 'simples', p: 'n' }
].map((t, i) => Object.assign({ p: null, times: [], tol: 10, days: ALLDAYS.slice(), start: null, end: null, order: i, updatedAt: 0, agua: 0 }, t));
const PERIODS = [['m', 'Manhã', 'var(--xp)'], ['d', 'Durante o dia', 'var(--ok)'], ['n', 'Noite', 'var(--nt)']];
// Listas suas: substituem os períodos fixos. m, d e n são as listas que já vêm (Manhã, Durante o dia, Noite).
const LCOLORS = [['xp', 'var(--xp)', 'amarelo'], ['ok', 'var(--ok)', 'verde'], ['nt', 'var(--nt)', 'lilás'], ['wa', 'var(--wa)', 'azul'], ['rs', '#F07FB0', 'rosa'], ['ci', '#5FD4E6', 'ciano'], ['bad', 'var(--bad)', 'vermelho']];
const lcolor = k => (LCOLORS.find(c => c[0] === k) || LCOLORS[0])[1];
const DEFAULT_LISTS = [['m', 'Manhã', 'xp'], ['d', 'Durante o dia', 'ok'], ['n', 'Noite', 'nt']].map(([id, name, c], i) => ({ id, name, c, order: i, updatedAt: 0 }));
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
function lists() { const L = (DATA && Array.isArray(DATA.lists) ? DATA.lists : DEFAULT_LISTS).filter(l => !l.del).sort(byOrder); return L.length ? L : DEFAULT_LISTS; }
const listById = id => lists().find(l => l.id === id);
// Lista de uma tarefa: a escolhida; sem escolha (tarefa com horário no automático), a do período da hora; se ela não existir mais, a primeira.
function listOf(p, tm) { const L = lists(); if (p && L.some(l => l.id === p)) return p; if (tm) { const q = periodOf(tm); if (L.some(l => l.id === q)) return q; } return L[0].id; }
function listName(id) { const l = listById(id) || (DATA && (DATA.lists || []).find(x => x.id === id)); return l ? l.name : ({ m: 'Manhã', d: 'Dia', n: 'Noite' }[id] || 'Lista'); }
// Contadores seus. A Água é o contador fixo: continua em day.agua e na meta das configurações.
function counters() { return (DATA && Array.isArray(DATA.counters) ? DATA.counters : []).filter(c => !c.del).sort(byOrder); }
const counterById = id => counters().find(c => c.id === id);
function cntDefs() { const o = {}; for (const c of counters()) o[c.id] = [c.meta, c.xp || 0, c.full ? 1 : 0, c.step || 1]; return o; }
const STATES = [['idle', 'Repouso'], ['celebrate', 'Comemoração'], ['tired', 'Desânimo'], ['levelup', 'Subida de nível']];
const STATE_COLORS = { idle: '#3DDC97', celebrate: '#F5B83D', tired: '#9AA0AA', levelup: '#B49CFF' };

/* ===================== Utilidades ===================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Respeita o “reduzir movimento” do sistema, a menos que a pessoa peça pra animar mesmo assim (Configurações › Tela).
const reduced = () => !document.documentElement.classList.contains('anim-force') && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isNarrow = () => window.matchMedia('(max-width: 720px)').matches;
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const hhmm = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
const isTime = s => /^([01]?\d|2[0-3]):[0-5]\d$/.test(s);
const normTime = s => { const p = s.split(':'); return pad(+p[0]) + ':' + p[1]; };
const toMin = s => { const p = s.split(':').map(Number); return p[0] * 60 + p[1]; };
const cutoff = () => (typeof DATA !== 'undefined' && DATA && DATA.settings ? DATA.settings.cutoffHour : 4);
const toMinL = s => { const m = toMin(s); return m < cutoff() * 60 ? m + 1440 : m; };
const fmtMin = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
const fmtDur = m => m >= 60 ? Math.floor(m / 60) + 'h ' + pad(m % 60) + 'min' : m + ' min';
const fmtBytes = n => n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clone = o => JSON.parse(JSON.stringify(o));
const TIME_OFFSET = (() => { const q = new URLSearchParams(location.search).get('agora'); const t = q ? Date.parse(q) : NaN; return isNaN(t) ? 0 : t - Date.now(); })();
const now = () => new Date(Date.now() + TIME_OFFSET);
function logicalDate(d = now()) { return ymd(new Date(d.getTime() - cutoff() * 3600e3)); }
function nowMin(d = now()) { const m = d.getHours() * 60 + d.getMinutes(); return m < cutoff() * 60 ? m + 1440 : m; }
function parseKey(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function addDays(s, n) { const d = parseKey(s); d.setDate(d.getDate() + n); return ymd(d); }
function diffDays(a, b) { const x = a.split('-').map(Number), y = b.split('-').map(Number); return Math.round((Date.UTC(x[0], x[1] - 1, x[2]) - Date.UTC(y[0], y[1] - 1, y[2])) / 864e5); }
const weekday = k => parseKey(k).getDay();
const weekStart = k => addDays(k, -weekday(k));
const dm = k => k.slice(8, 10) + '/' + k.slice(5, 7);
const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const WD1 = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function dateLabel(k) { const d = parseKey(k); return WD[d.getDay()] + ', ' + d.getDate() + ' de ' + MO[d.getMonth()]; }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 3500); }
function download(name, text, type = 'application/json') {
  const u = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 2000);
}
const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
function dataURLToBlob(u) {
  const i = u.indexOf(','); const mime = (u.slice(0, i).match(/data:([^;]+)/) || [])[1] || 'image/png';
  const bin = atob(u.slice(i + 1)); const arr = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
  return new Blob([arr], { type: mime });
}
const readText = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsText(f); });

/* ===================== Dados (localStorage) e migração ===================== */
const KEY = 'habitos.v1';
let DATA = null, DATA_VER = 0;
function isScheduled(t, k) {
  if (t.start && k < t.start) return false;
  if (t.end && k > t.end) return false;
  const d = Array.isArray(t.days) && t.days.length ? t.days : ALLDAYS;
  return d.includes(weekday(k));
}
function periodOf(tm) { const m = toMinL(tm); return m < 720 ? 'm' : m < 1080 ? 'd' : 'n'; }
// Ao marcar, a tarefa soma no contador: 1 = Água (um copo), texto = id de um contador seu (soma um passo dele).
const wOf = t => t.agua ? 1 : t.cnt || 0;
function taskOccs(t) {
  if (t.type === 'horario') {
    const times = (t.times || []).slice().sort((a, b) => toMinL(a) - toMinL(b)), multi = times.length > 1;
    return times.map(tm => ({ oid: multi ? t.id + '@' + tm : t.id, tid: t.id, label: t.label, p: listOf(t.p, tm), time: tm, tol: t.tol ?? 10, xp: CFG.xp.horario, w: wOf(t) }));
  }
  if (t.type === 'duplo') return [
    { oid: t.id + '@m', tid: t.id, label: t.label, p: listOf(t.p || 'm'), part: 'manhã', xp: CFG.xp.simples, w: wOf(t) },
    { oid: t.id + '@n', tid: t.id, label: t.label, p: listOf(t.p2 || 'n'), part: 'noite', xp: CFG.xp.simples, w: wOf(t) }];
  return [{ oid: t.id, tid: t.id, label: t.label, p: listOf(t.p || 'm'), xp: CFG.xp.simples, w: wOf(t) }];
}
const sortTasks = tasks => tasks.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
function occurrencesFor(k, tasks = DATA.tasks) { return sortTasks(tasks).filter(t => isScheduled(t, k)).flatMap(taskOccs); }
// Retrato das tarefas do dia. A marca “conta como copo” (w) só vale a partir do dia em que a ligação com o contador de água existe (aguaSince).
function snapshot(k, tasks = DATA.tasks, since = DATA.aguaSince) { return occurrencesFor(k, tasks).map(o => { const s = o.time ? { oid: o.oid, xp: o.xp, time: o.time, tol: o.tol } : { oid: o.oid, xp: o.xp }; if (o.w === 1 && (!since || k >= since)) s.w = 1; else if (typeof o.w === 'string') s.w = o.w; return s; }); }
function occLabel(o) { return o.label + (o.part ? ' (' + o.part + ')' : '') + (o.time ? ' · ' + o.time : ''); }
// Validação de tudo que entra de fora (navegador, backup e QR): ids, horários e datas no formato certo, números nos limites, textos com tamanho máximo.
// Assim nada que chega por um arquivo ou por um link vira código na página, e uma configuração estranha não quebra a tela.
const SAFE_ID = /^[A-Za-z0-9_-]{1,40}$/, OID = /^[A-Za-z0-9_-]{1,40}(@[A-Za-z0-9:]{1,5})?$/, DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const okId = v => typeof v === 'string' && SAFE_ID.test(v);
const okDate = v => typeof v === 'string' && DATE_RE.test(v);
const numIn = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? clamp(v, a, b) : d; };
const intIn = (v, a, b, d) => { v = parseInt(v, 10); return Number.isFinite(v) ? clamp(v, a, b) : d; };
const timeOr = (v, d = null) => typeof v === 'string' && isTime(v) ? normTime(v) : d;
function cleanSettings(s) {
  const D = DEFAULT_SETTINGS; s = Object.assign({}, D, s && typeof s === 'object' ? s : {});
  return Object.assign(s, { wake: timeOr(s.wake, D.wake), sleep: timeOr(s.sleep, D.sleep), cutoffHour: intIn(s.cutoffHour, 0, 6, D.cutoffHour), aguaMeta: intIn(s.aguaMeta, 1, 30, D.aguaMeta),
    copoMl: intIn(s.copoMl, 50, 1000, D.copoMl), doseLead: intIn(s.doseLead, 0, 60, D.doseLead), aguaGap: intIn(s.aguaGap, 30, 480, D.aguaGap),
    notif: !!s.notif, notifDose: !!s.notifDose, notifAgua: !!s.notifAgua, som: !!s.som, confete: !!s.confete, aguaFull: s.aguaFull !== false, updatedAt: numIn(s.updatedAt, 0, 1e15, 0) });
}
function cleanTask(t) {
  if (!t || typeof t !== 'object' || !okId(t.id)) return null;
  const days = [...new Set((Array.isArray(t.days) ? t.days : []).map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  return Object.assign({}, t, { label: String(t.label ?? '').trim().slice(0, 60) || 'Tarefa', type: ['simples', 'horario', 'duplo'].includes(t.type) ? t.type : 'simples',
    p: okId(t.p) ? t.p : null, p2: okId(t.p2) ? t.p2 : null, times: [...new Set((Array.isArray(t.times) ? t.times : []).map(x => timeOr(x)).filter(Boolean))], tol: intIn(t.tol, 0, 120, 10),
    days: days.length ? days : ALLDAYS.slice(), start: okDate(t.start) ? t.start : null, end: okDate(t.end) ? t.end : null, order: numIn(t.order, -1e9, 1e9, 0),
    updatedAt: numIn(t.updatedAt, 0, 1e15, 0), agua: t.agua ? 1 : 0, cnt: okId(t.cnt) ? t.cnt : null });
}
function cleanList(l) {
  if (!l || typeof l !== 'object' || !okId(l.id)) return null;
  return { id: l.id, name: String(l.name ?? '').trim().slice(0, 30) || 'Lista', c: LCOLORS.some(c => c[0] === l.c) ? l.c : 'xp', order: numIn(l.order, -1e9, 1e9, 0), updatedAt: numIn(l.updatedAt, 0, 1e15, 0), ...(l.del ? { del: 1 } : {}) };
}
function sanitizeCnt(c) {
  const n = (v, a, b, d) => { v = parseInt(v, 10); return Number.isFinite(v) ? clamp(v, a, b) : d; };
  return { id: String(c.id), name: String(c.name || 'Contador').trim().slice(0, 30) || 'Contador', unit: String(c.unit || '').trim().slice(0, 16), step: n(c.step, 1, 1000, 1), meta: n(c.meta, 1, 100000, 10),
    xp: n(c.xp, 0, 100, 0), full: !!c.full, order: +c.order || 0, updatedAt: +c.updatedAt || 0, del: c.del ? 1 : 0 };
}
const cleanCnt = c => c && typeof c === 'object' && okId(c.id) ? sanitizeCnt(c) : null;
function cleanDay(day) {
  if (!day || typeof day !== 'object') return null;
  const out = Object.assign({}, day, { done: {}, agua: intIn(day.agua, 0, 30, 0) });
  for (const [k, v] of Object.entries(day.done && typeof day.done === 'object' ? day.done : {})) { const tm = v === 'skip' ? v : timeOr(v); if (OID.test(k) && tm) out.done[k] = tm; }
  const al = timeOr(day.aguaLast); if (al) out.aguaLast = al; else delete out.aguaLast;
  delete out.c; if (day.c && typeof day.c === 'object') { out.c = {}; for (const [k, v] of Object.entries(day.c)) { const n = intIn(v, 0, 1e7, 0); if (okId(k) && n > 0) out.c[k] = n; } }
  if (day.note) out.note = String(day.note).slice(0, 140); else delete out.note;
  if ('nu' in day) out.nu = numIn(day.nu, 0, 1e15, 0);
  delete out.sched; if (Array.isArray(day.sched)) out.sched = day.sched.filter(o => o && OID.test(o.oid)).map(o => {
    const s = { oid: o.oid, xp: intIn(o.xp, 0, 1000, 10) }, tm = timeOr(o.time); if (tm) { s.time = tm; s.tol = intIn(o.tol, 0, 120, 10); } if (o.w === 1 || okId(o.w)) s.w = o.w; return s; });
  const m = intIn(day.meta, 1, 30, 0); if (m) out.meta = m; else delete out.meta;
  delete out.cm; if (day.cm && typeof day.cm === 'object') { out.cm = {}; for (const [k, v] of Object.entries(day.cm)) if (okId(k) && Array.isArray(v)) out.cm[k] = [intIn(v[0], 1, 100000, 10), intIn(v[1], 0, 100, 0), v[2] ? 1 : 0, intIn(v[3], 1, 1000, 1)]; }
  if ('af' in day) out.af = day.af ? 1 : 0;
  return out;
}
function cleanDays(days) {
  const out = {}; for (const [k, v] of Object.entries(days && typeof days === 'object' ? days : {})) { const day = okDate(k) ? cleanDay(v) : null; if (day) out[k] = day; }
  return out;
}
function migrate(d) {
  if (!d || typeof d !== 'object' || !d.days || typeof d.days !== 'object') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.aguaSince || '')) d.aguaSince = logicalDate();
  if (d.version === 1) {
    d.version = 2; d.tasks = clone(DEFAULT_TASKS); d.settings = Object.assign({}, DEFAULT_SETTINGS);
    for (const k of Object.keys(d.days)) { const day = d.days[k]; day.done = day.done || {}; day.agua = day.agua || 0; day.sched = snapshot(k, d.tasks, d.aguaSince); day.meta = 10; }
  }
  if (d.version !== 2) return null;
  for (const t of Array.isArray(d.tasks) ? d.tasks : []) if (t && t.id === 'a1' && t.agua === undefined && /[áa]gua/i.test(t.label || '')) t.agua = 1;
  d.settings = cleanSettings(d.settings);
  d.lists = (Array.isArray(d.lists) ? d.lists : []).map(cleanList).filter(Boolean);
  if (!d.lists.length) d.lists = clone(DEFAULT_LISTS);
  d.counters = (Array.isArray(d.counters) ? d.counters : []).map(cleanCnt).filter(Boolean);
  d.tasks = (Array.isArray(d.tasks) ? d.tasks : clone(DEFAULT_TASKS)).map(cleanTask).filter(Boolean);
  d.days = cleanDays(d.days);
  if (!okDate(d.createdAt)) d.createdAt = logicalDate();
  if (!['dark', 'light', 'auto'].includes(d.theme)) d.theme = 'dark';
  // Congela o retrato de dias que ainda não têm um, pra mudanças futuras em tarefas e metas não alterarem o passado.
  for (const k of Object.keys(d.days)) { const day = d.days[k]; if (!day || typeof day !== 'object') { delete d.days[k]; continue; } day.done = day.done || {}; if (!day.sched) day.sched = snapshot(k, d.tasks, d.aguaSince); if (!day.meta) day.meta = d.settings.aguaMeta; }
  return d;
}
function freshData() { return { version: 2, createdAt: null, aguaSince: null, theme: 'dark', settings: Object.assign({}, DEFAULT_SETTINGS), tasks: clone(DEFAULT_TASKS), lists: clone(DEFAULT_LISTS), counters: [], days: {} }; }
function loadData() {
  let d = null;
  try { d = migrate(JSON.parse(localStorage.getItem(KEY))); } catch (e) { d = null; }
  if (!d) { DATA = freshData(); DATA.createdAt = DATA.aguaSince = logicalDate(); return DATA; }
  return d;
}
DATA = loadData();
const ST = () => DATA.settings;
function saveData() { DATA_VER++; try { localStorage.setItem(KEY, JSON.stringify(DATA)); } catch (e) { toast('Não consegui salvar no navegador.'); } }
function todayDay() { const k = logicalDate(); if (!DATA.days[k]) DATA.days[k] = { done: {}, agua: 0 }; return DATA.days[k]; }
// Retrato do dia: tarefas, meta de água e contadores valendo hoje. Mudanças depois não alteram dias que já passaram.
function freezeDay(day, k) { day.sched = snapshot(k); day.meta = ST().aguaMeta; day.cm = cntDefs(); day.af = ST().aguaFull !== false ? 1 : 0; return day; }
function touchToday() { return freezeDay(todayDay(), logicalDate()); }
if (DATA.days[logicalDate()]) touchToday();
saveData();
const isDone = v => !!v && v !== 'skip';
const schedOf = (day, k) => day && day.sched ? day.sched : snapshot(k);
const metaOf = day => day && day.meta ? day.meta : ST().aguaMeta;
// Copos do dia: os do contador (day.agua) mais as tarefas marcadas que contam como copo, como “Copo d’água ao acordar”.
// O copo da tarefa vem do estado dela: marcar de novo ou recarregar não soma duas vezes, e desmarcar tira o copo.
const taskCups = (day, k) => day ? schedOf(day, k).filter(o => o.w === 1 && isDone((day.done || {})[o.oid])).length : 0;
// Contadores valendo num dia: o retrato dele; dia sem registro ainda usa os de agora. Dias de antes dos contadores não têm nenhum.
const cmOf = day => day && day.cm ? day.cm : day && day.sched ? {} : cntDefs();
const afOf = day => day && day.af !== undefined ? !!day.af : day && day.sched ? true : ST().aguaFull !== false;
function cntOf(day, k, id) {
  if (!day) return 0; const d = cmOf(day)[id], step = d ? d[3] : ((counterById(id) || {}).step || 1);
  return ((day.c || {})[id] || 0) + schedOf(day, k).filter(o => o.w === id && isDone((day.done || {})[o.oid])).length * step;
}
const cntTask = (day, k, id) => day ? cntOf(day, k, id) - ((day.c || {})[id] || 0) : 0;
const aguaOf = (day, k) => day ? (day.agua || 0) + taskCups(day, k) : 0;
function aguaLastOf(day, k) {
  let last = day && day.aguaLast ? day.aguaLast : null;
  if (day) for (const o of schedOf(day, k)) { const v = (day.done || {})[o.oid]; if (o.w && isDone(v) && (!last || toMinL(v) > toMinL(last))) last = v; }
  return last;
}
function sleepMin() { const w = toMin(ST().wake), s = toMin(ST().sleep); return s <= w ? s + 1440 : s; }
function onTime(v, o) { return isDone(v) && Math.abs(toMinL(v) - toMin(o.time) - (toMin(o.time) < cutoff() * 60 ? 1440 : 0)) <= (o.tol ?? 10); }

/* ===================== XP, nível, sequência, coringa, desânimo ===================== */
const Game = {
  _c: null,
  dayXP(day, k) {
    if (!day) return 0;
    const s = schedOf(day, k); let xp = 0, all = s.length > 0;
    for (const o of s) { if (isDone(day.done[o.oid])) xp += o.xp; else all = false; }
    if (aguaOf(day, k) >= metaOf(day)) xp += CFG.xp.aguaMeta;
    for (const [id, c] of Object.entries(cmOf(day))) if (cntOf(day, k, id) >= c[0]) xp += c[1];
    if (all && this.goalsOk(day, k)) xp += CFG.xp.diaCompleto;
    return xp;
  },
  // Metas que contam pro dia completo: a água (se estiver marcada) e os contadores com “conta pro dia completo”.
  goalsOk(day, k) {
    if (afOf(day) && aguaOf(day, k) < metaOf(day)) return false;
    for (const [id, c] of Object.entries(cmOf(day))) if (c[2] && cntOf(day, k, id) < c[0]) return false;
    return true;
  },
  complete(day, k) { if (!day) return false; const s = schedOf(day, k); return s.length > 0 && s.every(o => isDone(day.done[o.oid])) && this.goalsOk(day, k); },
  ratio(day, k) {
    if (!day) return 0; const s = schedOf(day, k); let n = s.filter(o => isDone((day.done || {})[o.oid])).length, d = s.length;
    if (afOf(day)) { const m = metaOf(day); n += Math.min(aguaOf(day, k), m) / m; d++; }
    for (const [id, c] of Object.entries(cmOf(day))) if (c[2]) { n += Math.min(cntOf(day, k, id) / c[0], 1); d++; }
    return d ? n / d : 0;
  },
  active(day) { return !!day && ((day.agua || 0) > 0 || Object.values(day.done || {}).some(isDone) || Object.values(day.c || {}).some(v => v > 0)); },
  summary() {
    const t = logicalDate(), key = DATA_VER + '|' + t;
    if (this._c && this._c.key === key) return this._c.val;
    let first = DATA.createdAt < t ? DATA.createdAt : t;
    for (const k of Object.keys(DATA.days)) if (k < first) first = k;
    let xp = 0, run = 0, best = 0, bonusRun = false, lastBefore = null, bestDate = null, cPont = 0, cHid = 0, cFd = 0;
    const jokers = {}, ach = { semana: null, mes: null, pontual: null, hidratado: null, perfeito: null, sorriso: null };
    for (let k = first; k <= t; k = addDays(k, 1)) {
      const day = DATA.days[k];
      xp += this.dayXP(day, k);
      if (this.active(day)) {
        run++; if (k < t) lastBefore = k;
        if (run > best) { if (!bonusRun) { xp += CFG.xp.recorde; bonusRun = true; } best = run; bestDate = k; }
        if (run >= 7 && !ach.semana) ach.semana = k;
        if (run >= 30 && !ach.mes) ach.mes = k;
      } else if (k < t) {
        const w = weekStart(k);
        if (run > 0 && !jokers[w]) jokers[w] = k; else { run = 0; bonusRun = false; }
      }
      if (day) {
        for (const o of schedOf(day, k)) if (o.time && onTime(day.done[o.oid], o)) { cPont++; if (cPont >= 20 && !ach.pontual) ach.pontual = k; }
        if (aguaOf(day, k) >= metaOf(day)) { cHid++; if (cHid >= 5 && !ach.hidratado) ach.hidratado = k; }
        if (!ach.perfeito && this.complete(day, k)) ach.perfeito = k;
        if (isDone(day.done.fd)) { cFd++; if (cFd >= 14 && !ach.sorriso) ach.sorriso = k; }
      }
    }
    const todayActive = this.active(DATA.days[t]);
    const gapBefore = lastBefore ? diffDays(t, lastBefore) - 1 : diffDays(t, DATA.createdAt);
    const val = { xp, streak: run, best, bestDate, jokers, jokerDays: new Set(Object.values(jokers)), jokerWeek: jokers[weekStart(t)] || null, ach, counts: { pont: cPont, hid: cHid, fd: cFd }, todayActive, tired: !todayActive && gapBefore >= CFG.tiredDays, recovered: todayActive && gapBefore >= CFG.tiredDays, gapBefore };
    this._c = { key, val };
    return val;
  },
  level(xp) {
    const L = CFG.levels; let i = 0;
    while (i < L.length - 1 && xp >= L[i + 1][0]) i++;
    if (i === L.length - 1) return { n: L.length, name: L[i][1], pct: 100, line: xp + ' XP · nível máximo' };
    const lo = L[i][0], hi = L[i + 1][0];
    return { n: i + 1, name: L[i][1], pct: (xp - lo) / (hi - lo) * 100, line: xp + ' XP · faltam ' + (hi - xp) + ' pro ' + L[i + 1][1] };
  }
};

function doseStatus(o, day, nm) {
  const v = day.done[o.oid], s = toMinL(o.time), tol = o.tol ?? 10;
  if (v === 'skip') return { k: 'pulado' };
  if (v) return { k: Math.abs(toMinL(v) - s) <= tol ? 'tomado' : 'tomadoAtraso', at: v };
  if (nm < s - tol) return { k: 'aguardando', inMin: s - nm };
  if (nm <= s + tol) return { k: 'janela', closes: s + tol - nm };
  if (nm <= s + CFG.esquecidoMin) return { k: 'atrasado', late: nm - s };
  return { k: 'esquecido' };
}
function punctuality(range = 30) {
  const t = logicalDate(), nm = nowMin();
  let streak = 0, broken = false, due = 0, ok = 0;
  for (let i = 0; i < 120; i++) {
    const k = addDays(t, -i);
    if (k < DATA.createdAt && !DATA.days[k]) break;
    const day = DATA.days[k] || { done: {} };
    const timed = schedOf(DATA.days[k], k).filter(o => o.time).reverse();
    for (const o of timed) {
      const v = day.done[o.oid];
      if (i === 0 && !v && nm <= toMinL(o.time) + (o.tol ?? 10)) continue;
      const on = onTime(v, o);
      if (i < range) { due++; if (on) ok++; }
      if (!broken) { if (on) streak++; else broken = true; }
    }
  }
  return { streak, due, ok, pct: due ? Math.round(ok / due * 100) : null };
}
