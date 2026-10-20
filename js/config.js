// Hábitos · Configurações: tarefas, rotina, lembretes e tema.
'use strict';
/* ===================== Configurações: tarefas ===================== */
const Tasks = {
  editing: null, form: null,
  init() {
    $('#tfDays').innerHTML = WD1.map((d, i) => `<button type="button" data-d="${i}" aria-label="${WD[i]}">${d}</button>`).join('');
    $('#taskNew').addEventListener('click', () => this.open(null));
    $('#tfCancel').addEventListener('click', () => this.close());
    $('#tfSave').addEventListener('click', () => this.save());
    $('#tfArchive').addEventListener('click', () => { if (this.editing) this.archive(this.editing); });
    $('#tfWhen').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; const f = this.form, v = b.dataset.v; if (v === f.type) return;
      if (v === 'horario') f.p = ''; else if (f.type === 'horario' && !f.p) f.p = listOf(null, (this.times()[0]) || '08:00');
      if (v === 'duplo' && !f.p2) f.p2 = listOf('n'); f.type = v; this.paintForm(); });
    $('#tfList').addEventListener('change', e => { this.form.p = e.target.value; this.paintForm(); });
    $('#tfList2').addEventListener('change', e => { this.form.p2 = e.target.value; });
    $('#tfTimes').addEventListener('input', () => { if (this.form.type === 'horario' && !this.form.p) this.paintForm(); });
    $('#tfDays').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (!b) return; const d = +b.dataset.d, s = new Set(this.form.days); if (s.has(d)) s.delete(d); else s.add(d); this.form.days = [...s].sort(); this.paintForm(); });
    $('#tfTemp').addEventListener('change', e => { this.form.temp = e.target.checked; if (this.form.temp && !this.form.start) this.form.start = logicalDate(); this.paintForm(); });
    $('#taskList').addEventListener('click', e => {
      const ed = e.target.closest('[data-edit]'), up = e.target.closest('[data-up]'), dn = e.target.closest('[data-down]');
      if (ed) this.open(ed.dataset.edit); else if (up) this.move(up.dataset.up, -1); else if (dn) this.move(dn.dataset.down, 1);
    });
    $('#archList').addEventListener('click', e => { const r = e.target.closest('[data-restore]'); if (r) this.restore(r.dataset.restore); });
  },
  active() { const t = logicalDate(); return sortTasks(DATA.tasks).filter(x => !x.end || x.end >= t); },
  tags(task) {
    const t = logicalDate(), out = [], chip = id => { const l = listById(listOf(id)); return [l.name, lcolor(l.c)]; };
    if (task.type === 'horario') { out.push(['Horário · ' + task.times.join(', ') + ' · ±' + (task.tol ?? 10) + ' min', '']); out.push(task.p ? chip(task.p) : ['lista pela hora', '']); }
    else if (task.type === 'duplo') out.push([listName(listOf(task.p || 'm')) + ' + ' + listName(listOf(task.p2 || 'n')), '']);
    else out.push(chip(task.p || 'm'));
    const each = taskOccs(task).length > 1 ? ' cada' : '';
    out.push([(task.type === 'horario' ? '20 XP' : '10 XP') + each, 'var(--xp)']);
    if (task.agua) out.push(['+1 copo' + each, 'var(--wa)']);
    else if (task.cnt) { const c = counterById(task.cnt); if (c) out.push(['+' + c.step + ' ' + (c.unit || c.name) + each, 'var(--wa)']); }
    const d = Array.isArray(task.days) && task.days.length ? task.days : ALLDAYS;
    if (d.length < 7) out.push([d.map(i => WD1[i]).join(' '), '']);
    if (task.start && task.start > t) out.push(['começa ' + dm(task.start), '']);
    if (task.end) out.push(['até ' + dm(task.end), '']);
    return out.map(([x, c]) => `<span class="tag" style="${c ? 'color:' + c : ''}">${esc(x)}</span>`).join('');
  },
  render() {
    const list = this.active();
    $('#taskList').innerHTML = list.length ? list.map((task, i) => `<div class="trw" data-tid="${task.id}">
      <div style="display:flex;flex-direction:column"><button type="button" class="mini" data-up="${task.id}" aria-label="Subir ${esc(task.label)}" ${i === 0 ? 'disabled' : ''}>▲</button><button type="button" class="mini" data-down="${task.id}" aria-label="Descer ${esc(task.label)}" ${i === list.length - 1 ? 'disabled' : ''}>▼</button></div>
      <div class="nm"><span>${esc(task.label)}</span><div class="tags">${this.tags(task)}</div></div>
      <button type="button" class="mini" data-edit="${task.id}" aria-label="Editar ${esc(task.label)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button></div>`).join('')
      : '<div class="empty-card">Nenhuma tarefa. Crie a primeira.</div>';
    const t = logicalDate(), arch = sortTasks(DATA.tasks).filter(x => x.end && x.end < t);
    $('#archCount').textContent = arch.length;
    $('#archList').innerHTML = arch.length ? arch.map(task => `<div class="trw"><div class="nm mu"><span>${esc(task.label)}</span><div class="tags"><span class="tag">até ${dm(task.end)}</span></div></div><button type="button" class="btn sm" data-restore="${task.id}">Restaurar</button></div>`).join('') : '<span class="xs mu">Nada arquivado.</span>';
  },
  open(id) {
    const task = id ? DATA.tasks.find(x => x.id === id) : null; this.editing = id;
    const dur = task && task.start && task.end ? diffDays(task.end, task.start) + 1 : 7;
    const cntSel = x => x.agua ? 'agua' : x.cnt && counterById(x.cnt) ? x.cnt : '';
    this.form = task ? { label: task.label, type: task.type, p: task.type === 'horario' ? (task.p && listById(task.p) ? task.p : '') : listOf(task.p || 'm'), p2: listOf(task.p2 || 'n'), times: (task.times || []).join(', '), tol: task.tol ?? 10, days: (task.days && task.days.length ? task.days : ALLDAYS).slice(), temp: !!task.end, start: task.start || logicalDate(), dur, cnt: cntSel(task) }
      : { label: '', type: 'simples', p: lists()[0].id, p2: listOf('n'), times: '08:00', tol: 10, days: ALLDAYS.slice(), temp: false, start: logicalDate(), dur: 7, cnt: '' };
    $('#tfTitle').textContent = task ? 'Editar tarefa' : 'Nova tarefa';
    $('#tfName').value = this.form.label; $('#tfTimes').value = this.form.times; $('#tfTol').value = this.form.tol;
    $('#tfStart').value = this.form.start; $('#tfDur').value = this.form.dur; $('#tfTemp').checked = this.form.temp;
    $('#tfCnt').innerHTML = '<option value="">Nenhum</option><option value="agua">Água (+1 copo)</option>' + counters().map(c => `<option value="${c.id}">${esc(c.name)} (+${c.step}${c.unit ? ' ' + esc(c.unit) : ''})</option>`).join(''); $('#tfCnt').value = this.form.cnt;
    $('#tfArchive').hidden = !task; $('#tfErr').textContent = '';
    $('#tfMore').open = !!(task && (task.end || task.agua || task.cnt || (task.type === 'horario' && (task.tol ?? 10) !== 10)));
    $('#taskForm').hidden = false; this.paintForm(); $('#tfName').focus();
  },
  close() { $('#taskForm').hidden = true; this.editing = null; },
  times() { return $('#tfTimes').value.split(/[,;\s]+/).filter(isTime).map(normTime).sort((a, b) => toMinL(a) - toMinL(b)); },
  paintForm() {
    const f = this.form, L = lists(), opts = L.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('');
    $$('#tfWhen [data-v]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === f.type)));
    // Lista: com horário, “pela hora” põe cada horário na lista do período dele (Manhã, Durante o dia ou Noite).
    const tm = this.times(), auto = f.type === 'horario' ? [...new Set((tm.length ? tm : ['08:00']).map(x => listName(listOf(null, x))))].join(' / ') : '';
    $('#tfList').innerHTML = (f.type === 'horario' ? `<option value="">Pela hora (${esc(auto)})</option>` : '') + opts;
    $('#tfList').value = f.type === 'horario' ? (f.p && listById(f.p) ? f.p : '') : listOf(f.p);
    $('#tfListL').textContent = f.type === 'duplo' ? 'Lista da manhã' : 'Lista';
    $('#tfList2').innerHTML = opts; $('#tfList2').value = listOf(f.p2 || 'n'); $('#tfList2Box').hidden = f.type !== 'duplo';
    $('#tfXP').textContent = { simples: '10 XP por dia', horario: '20 XP por horário · tem janela de tolerância e lembrete', duplo: '10 XP de manhã e 10 à noite' }[f.type];
    $$('#tfDays [data-d]').forEach(b => b.setAttribute('aria-pressed', String(f.days.includes(+b.dataset.d))));
    $('#tfTimeBox').hidden = f.type !== 'horario'; $('#tfTolBox').hidden = f.type !== 'horario'; $('#tfTempBox').hidden = !f.temp;
  },
  save() {
    const f = this.form, err = m => { $('#tfErr').textContent = m; };
    f.label = $('#tfName').value.trim(); f.times = $('#tfTimes').value; f.tol = parseInt($('#tfTol').value, 10); f.start = $('#tfStart').value; f.dur = parseInt($('#tfDur').value, 10); f.temp = $('#tfTemp').checked; f.cnt = $('#tfCnt').value; f.p = $('#tfList').value; f.p2 = $('#tfList2').value;
    if (!f.label) return err('Dê um nome pra tarefa.');
    if (!f.days.length) return err('Escolha pelo menos um dia da semana.');
    let times = [];
    if (f.type === 'horario') {
      times = f.times.split(/[,;\s]+/).filter(Boolean);
      if (!times.length) return err('Informe pelo menos um horário, como 08:00.');
      if (times.some(x => !isTime(x))) return err('Horário inválido. Use o formato 08:00.');
      times = [...new Set(times.map(normTime))].sort((a, b) => toMinL(a) - toMinL(b));
      if (isNaN(f.tol) || f.tol < 0 || f.tol > 120) return err('Tolerância deve ficar entre 0 e 120 minutos.');
    }
    let start = null, end = null;
    if (f.temp) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.start)) return err('Escolha a data de início.');
      if (isNaN(f.dur) || f.dur < 1 || f.dur > 365) return err('Duração deve ficar entre 1 e 365 dias.');
      start = f.start; end = addDays(f.start, f.dur - 1);
      if (end < logicalDate()) return err('Com essa data e duração, a tarefa já teria terminado.');
    }
    const t = logicalDate(), fields = { label: f.label, type: f.type, p: f.p || null, p2: f.type === 'duplo' ? f.p2 || null : null, times, tol: f.type === 'horario' ? f.tol : 10, days: f.days.length === 7 ? ALLDAYS.slice() : f.days.slice(), agua: f.cnt === 'agua' ? 1 : 0, cnt: f.cnt && f.cnt !== 'agua' ? f.cnt : null, updatedAt: Date.now() };
    if (this.editing) {
      const task = DATA.tasks.find(x => x.id === this.editing);
      Object.assign(task, fields);
      if (f.temp) { task.start = start; task.end = end; } else task.end = null;
    } else {
      const order = DATA.tasks.reduce((m, x) => Math.max(m, x.order ?? 0), -1) + 1;
      DATA.tasks.push(Object.assign({ id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), start: f.temp ? start : t, end: f.temp ? end : null, order }, fields));
    }
    touchToday(); saveData(); this.close(); this.render(); toast('Tarefa salva.');
  },
  hasHistory(id) { return Object.values(DATA.days).some(d => Object.keys(d.done || {}).some(k => (k === id || k.startsWith(id + '@')) && isDone(d.done[k]))); },
  archive(id) {
    const task = DATA.tasks.find(x => x.id === id); if (!task) return;
    if (!confirm('Arquivar “' + task.label + '”? Ela some a partir de hoje, mas o histórico e o XP já ganho ficam.')) return;
    const t = logicalDate();
    if (!this.hasHistory(id) && (!task.start || task.start >= t)) DATA.tasks = DATA.tasks.filter(x => x.id !== id);
    else { task.end = addDays(t, -1); if (task.start && task.start > task.end) task.start = task.end; task.updatedAt = Date.now(); }
    touchToday(); saveData(); this.close(); this.render(); toast('Tarefa arquivada.');
  },
  restore(id) { const task = DATA.tasks.find(x => x.id === id); if (!task) return; task.end = null; task.updatedAt = Date.now(); touchToday(); saveData(); this.render(); toast('Tarefa restaurada.'); },
  move(id, dir) {
    const list = this.active(), i = list.findIndex(x => x.id === id), j = i + dir; if (i < 0 || j < 0 || j >= list.length) return;
    list.forEach((x, k) => { x.order = k; }); const a = list[i], b = list[j]; [a.order, b.order] = [b.order, a.order]; a.updatedAt = b.updatedAt = Date.now();
    touchToday(); saveData(); this.render();
  }
};

/* ===================== Configurações: rotina, lembretes, tema ===================== */
const Settings = {
  init() {
    $('#stCutoff').innerHTML = [0, 1, 2, 3, 4, 5, 6].map(h => `<option value="${h}">${pad(h)}:00</option>`).join('');
    const bindNum = (id, key, min, max) => $('#' + id).addEventListener('change', e => { const v = parseInt(e.target.value, 10); if (isNaN(v)) { this.paint(); return; } this.set(key, clamp(v, min, max)); });
    const bindTime = (id, key) => $('#' + id).addEventListener('change', e => { if (isTime(e.target.value)) this.set(key, normTime(e.target.value)); else this.paint(); });
    bindTime('stWake', 'wake'); bindTime('stSleep', 'sleep');
    $('#stCutoff').addEventListener('change', e => this.set('cutoffHour', +e.target.value));
    bindNum('stMeta', 'aguaMeta', 1, 30); bindNum('stCopo', 'copoMl', 50, 1000); bindNum('stLead', 'doseLead', 0, 60); bindNum('stGap', 'aguaGap', 30, 480);
    $('#tgNotif').addEventListener('click', async () => {
      const on = !ST().notif;
      if (on && 'Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) {} }
      this.set('notif', on);
    });
    $('#tgDose').addEventListener('click', () => this.set('notifDose', !ST().notifDose));
    $('#tgAgua').addEventListener('click', () => this.set('notifAgua', !ST().notifAgua));
    $('#tgSom').addEventListener('click', () => { this.set('som', !ST().som); if (ST().som) Sound.tick(); });
    $('#tgConf').addEventListener('click', () => this.set('confete', !ST().confete));
    $('#tgAguaFull').addEventListener('click', () => this.set('aguaFull', ST().aguaFull === false));
    $('#themeSeg').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; DATA.theme = b.dataset.v; saveData(); applyTheme(); this.paint(); });
    $('#ntTest').addEventListener('click', () => testNotify());
    $('#icsExport').addEventListener('click', () => { const r = buildICS(); if (!r.n) { toast('Nenhuma tarefa com horário pra exportar.'); return; } download('horarios-habitos.ics', r.text, 'text/calendar'); toast(r.n + (r.n === 1 ? ' horário exportado.' : ' horários exportados.')); });
  },
  set(key, v) { DATA.settings[key] = v; DATA.settings.updatedAt = Date.now(); if (key === 'aguaMeta' || key === 'aguaFull') touchToday(); saveData(); this.paint(); },
  paint() {
    const s = ST();
    for (const [id, k] of [['stWake', 'wake'], ['stSleep', 'sleep'], ['stMeta', 'aguaMeta'], ['stCopo', 'copoMl'], ['stLead', 'doseLead'], ['stGap', 'aguaGap']]) { const el = $('#' + id); if (document.activeElement !== el) el.value = s[k]; }
    $('#stCutoff').value = String(s.cutoffHour);
    for (const [id, k] of [['tgNotif', 'notif'], ['tgDose', 'notifDose'], ['tgAgua', 'notifAgua'], ['tgSom', 'som'], ['tgConf', 'confete']]) $('#' + id).setAttribute('aria-pressed', String(!!s[k]));
    $('#tgAguaFull').setAttribute('aria-pressed', String(s.aguaFull !== false));
    $('#ntStatus').textContent = notifStatus();
    $$('#themeSeg [data-v]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === DATA.theme)));
  }
};
function applyTheme() {
  const mode = DATA.theme === 'auto' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : DATA.theme;
  document.documentElement.dataset.theme = mode === 'light' ? 'light' : 'dark';
  const m = $('meta[name="theme-color"]'); if (m) m.setAttribute('content', mode === 'light' ? '#F4F5F7' : '#0F1115');
}
