// Hábitos · Tela Histórico.
'use strict';
/* ===================== Tela Histórico ===================== */
const Hist = {
  filter: 'all',
  rows() {
    const t = logicalDate();
    return sortTasks(DATA.tasks).filter(task => !task.end || task.end >= t).flatMap(task => taskOccs(task).map(o => ({ o, task })));
  },
  has(day, k, task, oid) { return day && day.sched ? day.sched.some(x => x.oid === oid) : isScheduled(task, k) && taskOccs(task).some(x => x.oid === oid); },
  occStats(o, task) {
    const t = logicalDate(); let start = DATA.createdAt; if (task.start && task.start > start) start = task.start;
    let run = 0, best = 0;
    for (let k = start; k <= t; k = addDays(k, 1)) {
      const day = DATA.days[k]; if (!this.has(day, k, task, o.oid)) continue;
      if (day && isDone(day.done[o.oid])) { run++; if (run > best) best = run; } else if (k < t) run = 0;
    }
    let due = 0, ok = 0;
    for (let i = 1; i <= 30; i++) { const k = addDays(t, -i); if (k < start) break; const day = DATA.days[k]; if (!this.has(day, k, task, o.oid)) continue; due++; if (day && isDone(day.done[o.oid])) ok++; }
    return { cur: run, best, due, pct: due ? Math.round(ok / due * 100) : null };
  },
  overall(from, to) {
    const t = logicalDate(); let due = 0, ok = 0, days = 0, water = 0;
    for (let i = from; i <= to; i++) {
      const k = addDays(t, -i); if (k < DATA.createdAt) break;
      const day = DATA.days[k], s = schedOf(day, k); days++; water += aguaOf(day, k);
      due += s.length; if (day) ok += s.filter(o => isDone(day.done[o.oid])).length;
    }
    return { due, ok, days, pct: due ? Math.round(ok / due * 100) : null, water: days ? water / days : null };
  },
  render() {
    const t = logicalDate(), S = Game.summary(), lv = Game.level(S.xp);
    // Estatísticas
    const cur = this.overall(1, 30), prev = this.overall(31, 60), pq = punctuality();
    const diff = cur.pct !== null && prev.pct !== null ? cur.pct - prev.pct : null;
    const stats = [
      ['Conclusão · 30 dias', cur.pct !== null ? cur.pct + '%' : '—', cur.pct === null ? 'sem dias completos ainda' : diff !== null ? (diff >= 0 ? '+' : '') + diff + ' pontos vs. 30 dias anteriores' : cur.ok + ' de ' + cur.due + ' tarefas'],
      ['Melhor sequência', String(S.best), S.best ? (S.best === 1 ? 'dia' : 'dias') + (S.bestDate ? ' · até ' + dm(S.bestDate) : '') : 'comece hoje'],
      ['Horários no horário', pq.pct !== null ? pq.pct + '%' : '—', pq.due ? pq.ok + ' de ' + pq.due + ' em 30 dias' : 'nenhum horário registrado'],
      ['Água · média diária', cur.water !== null ? cur.water.toFixed(1).replace('.', ',') : '—', cur.water !== null ? 'copos · meta ' + ST().aguaMeta : 'sem dias completos ainda']
    ];
    $('#hStats').innerHTML = stats.map(([a, v, s]) => `<div class="card stat"><span class="sm mu">${a}</span><span class="v mono">${v}</span><span class="xs mu">${s}</span></div>`).join('');
    // Mapa do ano
    $$('#hFilter [data-f]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.f === this.filter)));
    const start = addDays(weekStart(t), -52 * 7); let heat = '';
    for (let i = 0; i < 53 * 7; i++) {
      const k = addDays(start, i); let cls = '', tip = dm(k);
      if (k > t) cls = 'fut';
      else {
        const day = DATA.days[k]; let r = 0;
        if (day) {
          if (this.filter === 'agua') r = Math.min(aguaOf(day, k), metaOf(day)) / metaOf(day);
          else if (this.filter === 'horario') { const tm = schedOf(day, k).filter(o => o.time); r = tm.length ? tm.filter(o => isDone(day.done[o.oid])).length / tm.length : 0; }
          else r = Game.ratio(day, k);
        }
        cls = r === 0 ? '' : r < .25 ? 'lv1' : r < .5 ? 'lv2' : r < .85 ? 'lv3' : 'lv4';
        if (S.jokerDays.has(k)) { cls += ' jk'; tip += ' · coringa'; }
        tip += ' · ' + Math.round(r * 100) + '%';
        if (DATA.days[k] && DATA.days[k].note) tip += ' · “' + DATA.days[k].note + '”';
      }
      heat += `<span class="cell ${cls}" title="${esc(tip)}"></span>`;
    }
    $('#hHeat').innerHTML = heat;
    // Notas do dia (as mais recentes primeiro)
    const notes = Object.keys(DATA.days).filter(k => k <= t && DATA.days[k].note).sort().reverse();
    $('#hNotesInfo').textContent = notes.length ? notes.length + (notes.length === 1 ? ' nota' : ' notas') : '';
    $('#hNotes').innerHTML = notes.length ? notes.slice(0, 60).map(k => `<div class="noterow"><span class="mono xs mu">${dm(k)}</span><span class="xs mu">${WD[weekday(k)].slice(0, 3)}</span><span style="flex:1;min-width:0">${esc(DATA.days[k].note)}</span></div>`).join('')
      : '<div class="empty-card">Nenhuma nota ainda. No Hoje, adicione o quadro “Nota do dia” (lápis › + Adicionar quadro) e escreva uma linha sobre o dia.</div>';
    // Por tarefa
    const rows = this.rows().map(r => Object.assign(r, this.occStats(r.o, r.task)));
    const seen = {}; rows.forEach(r => { seen[r.o.label] = (seen[r.o.label] || 0) + 1; });
    rows.forEach(r => { if (seen[r.o.label] > 1 && !r.o.part && !r.o.time) r.o = Object.assign({}, r.o, { part: listName(r.o.p).toLowerCase() }); });
    const attn = rows.filter(r => r.pct !== null && r.pct < 50 && r.due >= 5).sort((a, b) => a.pct - b.pct).slice(0, 3);
    $('#hAttn').innerHTML = attn.length ? `<div class="attn"><span class="xs b warn" style="letter-spacing:.06em">PRECISAM DE ATENÇÃO</span>${attn.map(r => `<div class="rowline" style="font-size:14px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--xp)" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9"/></svg><span style="flex:1">${esc(occLabel(r.o))}</span><span class="xs mu">${r.pct}% em 30 dias</span></div>`).join('')}</div>` : '';
    $('#hTasks').innerHTML = rows.length ? rows.map(r => {
      const low = r.pct !== null && r.pct < 50 && r.due >= 5;
      return `<div class="trow"><span style="${low ? 'color:var(--xp)' : ''}">${esc(occLabel(r.o))}</span><span class="mono">${r.cur}</span><span class="mono mu">${r.best}</span><div style="display:flex;align-items:center;gap:6px"><div class="bar" style="flex:1"><div style="width:${r.pct || 0}%;background:${low ? 'var(--xp)' : 'var(--ok)'}"></div></div><span class="mono xs mu" style="width:34px">${r.pct === null ? '—' : r.pct + '%'}</span></div></div>`;
    }).join('') : '<div class="empty-card">Nenhuma tarefa ativa.</div>';
    // Semana
    const wsk = weekStart(t); $('#hWeekRange').textContent = dm(wsk) + '–' + dm(addDays(wsk, 6));
    const week = rows.map(r => {
      let due = 0, ok = 0, times = [];
      for (let k = wsk; k <= t; k = addDays(k, 1)) {
        const day = DATA.days[k]; if (!this.has(day, k, r.task, r.o.oid)) continue;
        const v = day && day.done[r.o.oid];
        if (k === t && !isDone(v)) continue;
        due++; if (isDone(v)) { ok++; if (r.o.time) times.push(toMinL(v)); }
      }
      return { r, due, ok, times };
    }).filter(w => w.due > 0);
    let wh = '';
    if (!week.length) wh = '<div class="empty-card">Ainda sem registros nesta semana.</div>';
    else {
      const good = week.filter(w => w.due >= 2 && w.ok === w.due).slice(0, 3);
      const bad = week.filter(w => w.due >= 2 && w.ok / w.due < 0.6).sort((a, b) => a.ok / a.due - b.ok / b.due).slice(0, 2);
      wh += `<div class="wbox"><span class="xs b" style="color:var(--ok);letter-spacing:.06em">FOI BEM</span><span style="line-height:1.5">${good.length ? good.map(w => esc(occLabel(w.r.o)) + ': todos os ' + w.due + ' dias').join('. ') + '.' : 'Nenhuma tarefa com 100% ainda nesta semana.'}</span></div>`;
      wh += `<div class="wbox"><span class="xs b warn" style="letter-spacing:.06em">FICOU PRA TRÁS</span><span style="line-height:1.5">${bad.length ? bad.map(w => esc(occLabel(w.r.o)) + ': ' + w.ok + ' de ' + w.due).join('. ') + '.' : 'Nada abaixo de 60% nesta semana.'}</span></div>`;
      const timed = week.filter(w => w.times.length).slice(0, 2);
      if (timed.length) wh += `<div class="grid2" style="gap:10px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">${timed.map(w => `<div class="wbox"><span class="xs mu">${esc(occLabel(w.r.o))} · média</span><span class="mono b" style="font-size:20px">${fmtMin(w.times.reduce((a, b) => a + b, 0) / w.times.length)}</span></div>`).join('')}</div>`;
    }
    $('#hWeek').innerHTML = wh;
    // Níveis
    $('#hLvLine').textContent = lv.line; $('#hLvBar').style.width = lv.pct.toFixed(1) + '%';
    $('#hLevels').innerHTML = CFG.levels.map(([x, name], i) => `<div class="${i + 1 < lv.n ? 'past' : i + 1 === lv.n ? 'cur' : ''}"><span class="sq pix">${i + 1}</span><span class="xs" style="color:${i + 1 === lv.n ? 'var(--tx)' : 'var(--mu)'}">${name}</span><span class="mono" style="font-size:10px;color:var(--mu)">${x}</span></div>`).join('');
    // Conquistas
    const A = [
      ['semana', 'Primeira semana', '7 dias seguidos', Math.min(S.best, 7), 7],
      ['pontual', 'Pontual', '20 horários no horário', Math.min(S.counts.pont, 20), 20],
      ['hidratado', 'Hidratado', 'meta de água em 5 dias', Math.min(S.counts.hid, 5), 5],
      ['perfeito', 'Dia perfeito', '100% num dia', S.ach.perfeito ? 1 : 0, 1],
      ['mes', 'Mês de ferro', '30 dias seguidos', Math.min(S.best, 30), 30],
      ['sorriso', 'Sorriso de ouro', 'fio dental em 14 noites', Math.min(S.counts.fd, 14), 14]
    ];
    const won = A.filter(a => S.ach[a[0]]).length;
    $('#hAchCount').textContent = won + ' de ' + A.length;
    $('#hAch').innerHTML = A.map(([id, name, desc, c, tot]) => S.ach[id]
      ? `<div class="ach on" data-ach="${id}"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--xp)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/></svg><span class="b">${name}</span><span class="mu">${desc}</span><span class="xs" style="color:var(--xp)">desbloqueada ${dm(S.ach[id])}</span></div>`
      : `<div class="ach off" data-ach="${id}"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><span class="b">${name}</span><span>${desc}</span><div style="width:100%;display:flex;align-items:center;gap:6px"><div class="bar" style="flex:1;height:4px"><div style="width:${Math.round(c / tot * 100)}%;background:var(--mu)"></div></div><span class="mono" style="font-size:10px">${c}/${tot}</span></div></div>`).join('');
  }
};
