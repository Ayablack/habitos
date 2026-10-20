// Hábitos · Navegação entre telas e início do app.
'use strict';
/* ===================== Navegação e inicialização ===================== */
let VIEW = 'hoje';
// Editor do companheiro: um terço do código e usado pouco, então só é carregado quando a aba Configurações › Companheiro abre.
// Até lá, Ed é um substituto que não faz nada; js/editor.js troca pelo de verdade.
var Ed = { provisorio: true, pvPlaying: true, init() {}, reset() {}, render() {}, onLeave() {}, isDirty() { return false; }, pvSync() {} };
let edCarregando = null;
function carregarEditor() {
  if (!Ed.provisorio) return Promise.resolve();
  return edCarregando = edCarregando || new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'js/editor.js';
    s.onload = () => { Ed.init(); Ed.reset(); res(); };
    s.onerror = () => { edCarregando = null; s.remove(); toast('Não consegui abrir o editor do companheiro. Confira a internet e tente de novo.'); rej(new Error('editor')); };
    document.head.appendChild(s);
  });
}
// Mostra o editor quando a aba do companheiro está aberta (carregando o arquivo na primeira vez).
function renderEditor() { if (VIEW === 'config' && CfgTabs.cur === 'comp') carregarEditor().then(() => Ed.render(), () => {}); }
function renderAll() {
  if (VIEW === 'hoje') renderHoje();
  if (VIEW === 'historico') Hist.render();
  if (VIEW === 'config') { CfgTabs.paint(); Tasks.render(); Lists.render(); Counters.render(); Settings.paint(); Layout.paint(); renderEditor(); paintBackupSize(); }
  if (VIEW !== 'hoje') { const S = Game.summary(); $('#streakTop').textContent = S.streak + (S.streak === 1 ? ' dia' : ' dias'); $('#dateLabel').textContent = dateLabel(logicalDate()); $('#clockLabel').textContent = hhmm(now()); }
}
function route() {
  const prev = VIEW;
  if (location.hash.startsWith('#sync=')) { const raw = location.hash; history.replaceState(null, '', location.pathname + location.search + '#hoje'); Sync.receive(raw); }
  const v = (location.hash || '#hoje').slice(1); VIEW = ['hoje', 'historico', 'config'].includes(v) ? v : 'hoje';
  if (VIEW === 'historico' && prev !== 'historico') Hist.jump = true;
  for (const id of ['hoje', 'historico', 'config']) $('#view-' + id).hidden = id !== VIEW;
  $$('[data-tab]').forEach(a => { if (a.dataset.tab === VIEW) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#pageTitle').textContent = { hoje: 'Hoje', historico: 'Histórico', config: 'Configurações' }[VIEW];
  if (prev === 'config' && VIEW !== 'config') { Ed.onLeave(); if (Ed.isDirty()) toast('O companheiro tem alterações não salvas. Volte em Configurações pra salvar.'); }
  if (VIEW !== 'hoje' && Dash.editing) { Dash.editing = false; Dash.closeCat(); Dash.hist = []; }
  Comp.player.pause(VIEW !== 'hoje');
  Dash.apply(); renderAll(); Layout.apply();
}
async function init() {
  applyTheme(); Comp.init(); Ed.init(); Tasks.init(); Settings.init(); Layout.init(); Dash.init(); CfgTabs.init(); Lists.init(); Counters.init(); Nota.init(); BackupNag.init(); Ed.reset();
  $('#themeBtn').addEventListener('click', () => { const cur = document.documentElement.dataset.theme; DATA.theme = cur === 'light' ? 'dark' : 'light'; saveData(); applyTheme(); Settings.paint(); if (VIEW === 'config') Ed.render(); });
  $('#fsBtn').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); });
  $('#bannerClose').addEventListener('click', () => { $('#banner').hidden = true; });
  $('#appVer').textContent = 'Versão do app: ' + VERSAO;
  $('#aguaPlus').addEventListener('click', () => changeAgua(1));
  $('#aguaMinus').addEventListener('click', () => changeAgua(-1));
  $('#dash').addEventListener('click', e => {
    if (Dash.editing) return;
    const q = s => e.target.closest(s);
    const t = q('[data-task]'); if (t) { toggleTask(t.dataset.task); return; }
    const a = q('[data-take]'), sk = q('[data-skip]'), c = q('[data-cnt]'), w = q('[data-agua]');
    if (a) { takeDose(a.dataset.take); return; } if (sk) { skipDose(sk.dataset.skip); return; }
    if (c) { changeCnt(c.dataset.cnt, +c.dataset.n); return; } if (w) { changeAgua(1); return; }
    const x = q('[data-expand]'); if (x) { expanded[x.dataset.expand] = !expanded[x.dataset.expand]; renderHoje(); Layout.apply(); }
  });
  $('#hFilter').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { Hist.filter = b.dataset.f; Hist.jump = true; Hist.render(); } });
  $('#qrShow').addEventListener('click', () => Sync.show());
  $('#qrRead').addEventListener('click', () => Sync.read());
  $('#scanClose').addEventListener('click', () => Sync.close());
  $('#bkExport').addEventListener('click', () => exportBackup());
  $('#bkShare').addEventListener('click', () => shareBackup());
  $('#bkImport').addEventListener('change', e => { importBackup(e.target.files[0]); e.target.value = ''; });
  $('#bkImg').addEventListener('change', () => paintBackupSize());
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || VIEW !== 'hoje' || Dash.editing) return;
    if (e.key === 'a' || e.key === 'A') changeAgua(1);
    else if (e.key === 'f' || e.key === 'F') $('#fsBtn').click();
  });
  window.addEventListener('hashchange', route);
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => { Comp.player.restart(); Ed.pvSync(); });
  window.matchMedia('(max-width: 720px)').addEventListener('change', () => renderAll());
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (DATA.theme === 'auto') applyTheme(); });
  window.addEventListener('storage', e => { if (e.key === KEY) { DATA = loadData(); DATA_VER++; renderAll(); } });
  await loadSavedImages();
  Ed.reset();
  route();
  // Redesenhar troca os botões das tarefas. Se isso cair no meio de um toque, o toque se perde: espera o dedo soltar.
  // Pra gastar menos bateria: só redesenha com a aba visível e quando algo mudou (o minuto do relógio, o dia, os dados ou o companheiro).
  let pressing = false, pending = false, last = '';
  const redraw = () => {
    if (VIEW !== 'hoje' || document.hidden) return;
    if (pressing) { pending = true; return; }
    const sig = hhmm(now()) + '|' + logicalDate() + '|' + DATA_VER + '|' + CC_VER;
    if (sig === last) return;
    pending = false; last = sig; renderHoje();
  };
  document.addEventListener('pointerdown', () => { pressing = true; }, true);
  const release = () => { pressing = false; if (pending) setTimeout(redraw, 300); };
  document.addEventListener('pointerup', release, true); document.addEventListener('pointercancel', release, true);
  const tickAll = () => { Remind.tick(); redraw(); };
  setInterval(tickAll, 30000); setTimeout(() => Remind.tick(), 1500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tickAll(); });
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    // Versão nova: quando um service worker novo assume esta página, pergunta a versão dele; se for outra, oferece recarregar.
    // Sem service worker antes (primeira visita), não avisa nada. Ao voltar pra aba, procura atualização no máximo a cada 30 min.
    const tinha = !!navigator.serviceWorker.controller; let procurou = Date.now();
    const versaoDe = sw => new Promise(res => { if (!sw) return res(null); const ch = new MessageChannel(); ch.port1.onmessage = e => res(e.data); sw.postMessage('versao', [ch.port2]); setTimeout(() => res(null), 3000); });
    navigator.serviceWorker.addEventListener('controllerchange', async () => {
      if (!tinha) return;
      const v = await versaoDe(navigator.serviceWorker.controller);
      if (v && v !== VERSAO) Banner.show('Versão nova do app pronta', null, { label: 'Recarregar', fn: () => location.reload() });
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && SWREG && Date.now() - procurou > 30 * 60e3) { procurou = Date.now(); SWREG.update().catch(() => {}); } });
    navigator.serviceWorker.register('sw.js').then(r => { SWREG = r; }).catch(() => {});
  }
  try {
    let ok = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
    if (!ok && navigator.storage && navigator.storage.persist) ok = await navigator.storage.persist();
    $('#persistInfo').textContent = ok ? 'Armazenamento persistente concedido: o navegador não apaga esses dados sozinho.' : 'O navegador pode apagar esses dados se faltar espaço ou se você limpar os dados do site. Exporte o companheiro pra ter uma cópia.';
  } catch (e) { $('#persistInfo').textContent = 'Não deu pra verificar a persistência deste navegador. Exporte o companheiro pra ter uma cópia.'; }
}
init();
