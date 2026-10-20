// Hábitos · Marcar tarefas, água e contadores, e desenhar a tela Hoje.
'use strict';
/* ===================== Ações ===================== */
function commit(mutator) {
  const before = Game.summary(), tk = logicalDate(), wasComplete = Game.complete(DATA.days[tk], tk);
  const day = touchToday(); mutator(day); saveData();
  const after = Game.summary(), isComplete = Game.complete(DATA.days[tk], tk);
  const lb = Game.level(before.xp).n, la = Game.level(after.xp).n;
  if (la > lb) Comp.react('levelup', 'NÍVEL ' + la);
  else if (after.xp > before.xp) Comp.react('celebrate', '+' + (after.xp - before.xp) + ' XP');
  if (isComplete && !wasComplete) { Sound.fanfare(); confetti(); }
  else if (after.xp > before.xp) Sound.tick();
  renderHoje();
}
function toggleTask(oid) { commit(d => { if (d.done[oid]) delete d.done[oid]; else d.done[oid] = hhmm(now()); }); }
function skipDose(oid) { commit(d => { d.done[oid] = 'skip'; }); }
function takeDose(oid) { commit(d => { d.done[oid] = hhmm(now()); }); }
function changeAgua(n) {
  const tk = logicalDate(), day = DATA.days[tk];
  if (n < 0 && !(day && day.agua > 0) && taskCups(day, tk)) {
    const o = schedOf(day, tk).find(x => x.w && isDone(day.done[x.oid])), t = o && DATA.tasks.find(x => x.id === o.oid.split('@')[0]);
    toast('Esse copo veio da tarefa “' + (t ? t.label : 'de água') + '”. Pra tirar, desmarque a tarefa.'); return;
  }
  commit(d => { const before = d.agua || 0; d.agua = clamp(before + n, 0, 30); if (d.agua > before) d.aguaLast = hhmm(now()); }); }
function changeCnt(id, dir) {
  const c = counterById(id); if (!c) return;
  const tk = logicalDate(), day = DATA.days[tk], mine = day && day.c ? day.c[id] || 0 : 0;
  if (dir < 0 && !mine) { if (cntTask(day, tk, id)) toast('Isso veio de uma tarefa. Pra tirar, desmarque a tarefa.'); return; }
  commit(d => { d.c = d.c || {}; d.c[id] = clamp(mine + dir * (c.step || 1), 0, 100000); if (!d.c[id]) delete d.c[id]; });
}

/* ===================== Tela Hoje ===================== */
function markMore(el) { el.classList.toggle('more', el.scrollHeight - el.scrollTop - el.clientHeight > 4); }
document.addEventListener('scroll', e => { if (e.target.classList && e.target.classList.contains('plist')) markMore(e.target); }, true);
const expanded = {};
let HOJE_SIG = '';
function renderHoje() {
  Dash.apply();
  const n = now(), tk = logicalDate(n), day = DATA.days[tk] || { done: {}, agua: 0 }, nm = nowMin(n), st = ST();
  const occ = occurrencesFor(tk);
  const S = Game.summary(), lv = Game.level(S.xp), xpHoje = Game.dayXP(DATA.days[tk], tk);
  $('#dateLabel').textContent = dateLabel(tk);
  $('#clockLabel').textContent = hhmm(n);
  BackupNag.paint();
  $('#streakTop').textContent = S.streak + (S.streak === 1 ? ' dia' : ' dias');

  const doses = occ.filter(o => o.time).map(o => ({ o, st: doseStatus(o, day, nm) }));
  const pending = k => ['aguardando', 'janela', 'atrasado'].includes(k);
  const nextDose = doses.find(d => pending(d.st.k));
  $('#nextLabel').textContent = nextDose ? 'próxima: ' + nextDose.o.label.toLowerCase() + ' às ' + nextDose.o.time : 'sem horários pendentes hoje';

  // Linha do tempo
  const ws = toMin(st.wake), we = sleepMin(), span = Math.max(60, we - ws);
  const pos = m => clamp((m - ws) / span * 100, 0, 100);
  const b1 = pos(720), b2 = pos(1080);
  let tl = `<div class="band" style="left:0;width:${b1}%;background:color-mix(in srgb,var(--xp) 9%,transparent)"></div>
    <div class="band" style="left:${b1}%;width:${b2 - b1}%;background:color-mix(in srgb,var(--ok) 7%,transparent)"></div>
    <div class="band" style="left:${b2}%;width:${100 - b2}%;background:color-mix(in srgb,var(--nt) 9%,transparent)"></div>
    ${b1 > 6 ? `<span class="blab" style="left:10px;color:var(--xp)">MANHÃ</span>` : ''}${b2 - b1 > 6 ? `<span class="blab" style="left:calc(${b1}% + 10px);color:var(--ok)">DIA</span>` : ''}${100 - b2 > 6 ? `<span class="blab" style="left:calc(${b2}% + 10px);color:var(--nt)">NOITE</span>` : ''}<div class="line"></div>`;
  for (const o of occ) { const v = day.done[o.oid]; if (!o.time && isDone(v)) tl += `<span class="dot" style="left:${pos(toMinL(v))}%" title="${esc(o.label)} · ${v}"></span>`; }
  const pillCls = { tomado: 'ok', tomadoAtraso: 'warn', janela: 'warn', atrasado: 'bad', esquecido: 'bad', aguardando: 'wait', pulado: 'skip' };
  for (const d of doses) { const p = pos(toMinL(d.o.time)); tl += `<div class="pill mono ${pillCls[d.st.k]}" style="left:${p}%;${p < 3 ? 'margin-left:0' : p > 97 ? 'margin-left:-60px' : ''}" title="${esc(d.o.label)}">${d.st.at || d.o.time}</div>`; }
  const np = pos(nm);
  tl += `<div class="now" style="left:${np}%"></div><span class="nowlab mono" style="left:${np}%;transform:translateX(${np > 96 ? '-100%' : np < 4 ? '0' : '-50%'})">AGORA</span>`;
  for (let m = Math.ceil(ws / 120) * 120; m <= we; m += 120) { const p = pos(m); tl += `<span class="tick mono" style="left:${p}%;transform:translateX(${p < 3 ? '0' : p > 97 ? '-100%' : '-50%'})">${Math.floor((m % 1440) / 60)}h</span>`; }
  $('#tl').innerHTML = tl;

  // Anéis: um por lista (até 4) e um da água. A legenda mostra todas as listas e os contadores.
  const LS = lists(), cnt = p => { const l = occ.filter(o => o.p === p); return [l.filter(o => isDone(day.done[o.oid])).length, l.length]; };
  const agua = aguaOf(day, tk), tc = taskCups(day, tk), meta = st.aguaMeta;
  const rl = LS.slice(0, 4), gapR = rl.length < 4 ? 13 : 11, svg = $('#ringSvg'), rsig = rl.map(l => l.id + ':' + l.c).join();
  if (svg.dataset.sig !== rsig) {
    svg.dataset.sig = rsig;
    svg.innerHTML = `<g transform="rotate(-90 75 75)" fill="none" stroke-width="${rl.length < 4 ? 10 : 9}" stroke-linecap="round">` + [...rl.map((l, i) => [l.id, lcolor(l.c), 66 - i * gapR]), ['agua', 'var(--wa)', 66 - rl.length * gapR]]
      .map(([id, c, r]) => `<circle cx="75" cy="75" r="${r}" stroke="var(--track)"/><circle data-ring="${esc(id)}" cx="75" cy="75" r="${r}" stroke="${c}"/>`).join('') + '</g>';
  }
  // Anel vazio fica escondido (com a ponta arredondada, 0% virava um pontinho).
  const ring = (id, p) => { const el = svg.querySelector(`[data-ring="${id}"]`); if (!el) return; const c = 2 * Math.PI * +el.getAttribute('r'); el.setAttribute('stroke-dasharray', (c * clamp(p, 0, 1)).toFixed(1) + ' ' + c.toFixed(1)); el.style.visibility = p > 0 ? '' : 'hidden'; };
  rl.forEach(l => { const [a, b] = cnt(l.id); ring(l.id, b ? a / b : 0); }); ring('agua', agua / meta);
  $('#overall').textContent = Math.round(Game.ratio(day, tk) * 100) + '%';
  $('#xpHoje').textContent = '+' + xpHoje + ' XP';
  $('#legend').innerHTML = [...LS.map(l => { const [a, b] = cnt(l.id); return [l.name, lcolor(l.c), a + '/' + b]; }), ['Água', 'var(--wa)', agua + '/' + meta], ...counters().map(c => [c.name, 'var(--mu)', cntOf(day, tk, c.id) + '/' + c.meta])]
    .map(([a, c, v]) => `<div class="it"><span class="sw" style="background:${c}"></span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a)}</span><span class="mono mu">${v}</span></div>`).join('');

  // Água
  const L = x => (x * st.copoMl / 1000).toFixed(1).replace('.', ',') + ' L';
  $('#aguaL').textContent = L(agua); $('#aguaMetaL').textContent = L(meta);
  $('#aguaSub').textContent = agua + ' de ' + meta + ' copos' + (tc ? ' · ' + tc + (tc === 1 ? ' veio' : ' vieram') + ' das tarefas' : '') + ' · copo de ' + st.copoMl + ' ml';
  const aok = agua >= meta;
  $('#aguaMeta').textContent = aok ? 'Meta batida · +' + CFG.xp.aguaMeta + ' XP' : 'Meta: +' + CFG.xp.aguaMeta + ' XP ao chegar em ' + meta + ' copos';
  $('#aguaMeta').style.color = aok ? 'var(--ok)' : 'var(--mu)';
  $('#waterRect').setAttribute('y', (8 + 144 * (1 - Math.min(agua, meta) / meta)).toFixed(1));

  // Horários
  const card = $('#medCard');
  // Sem alarme hoje, o quadro some e o espaço fica pros outros (no modo de edição ele aparece pra poder ser arrumado).
  Dash.blk('horarios').classList.toggle('auto-off', !doses.length);
  const resolved = d => ['tomado', 'tomadoAtraso', 'pulado'].includes(d.st.k), allDone = doses.length > 0 && doses.every(resolved), medDone = $('#medDone');
  medDone.hidden = !(allDone && !expanded.horarios); card.hidden = !medDone.hidden; Dash.blk('horarios').classList.toggle('shrunk', !medDone.hidden);
  if (allDone) medDone.innerHTML = `<span class="box" style="background:var(--ok);border-color:var(--ok);color:var(--okt)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L19 7"/></svg></span><span style="flex:1;font-weight:600">Horários</span><span class="mono xs mu">${doses.filter(d => isDone(day.done[d.o.oid])).length}/${doses.length} feitos</span>`;
  if (!doses.length) {
    card.style.borderColor = 'var(--ln)';
    card.innerHTML = `<h2 class="h">Horários</h2><div class="empty-card">Este quadro aparece sozinho quando o dia tem tarefa com horário, como um remédio. Crie uma em Configurações › Tarefas › Com horário.</div>`;
  } else {
    let focus = null; for (const k of ['janela', 'atrasado', 'esquecido', 'aguardando']) { focus = doses.find(d => d.st.k === k); if (focus) break; }
    if (!focus) focus = doses[doses.length - 1];
    const s = focus.st, fo = focus.o, ftm = toMinL(fo.time);
    const look = {
      aguardando: ['var(--ln)', 'aguardando', 'var(--sf2)', 'var(--mu)', 'var(--ln)', 'em ' + fmtDur(s.inMin || 0)],
      janela: ['var(--xp)', 'janela aberta', 'var(--xp)', 'var(--bg)', 'var(--xp)', 'a janela fecha em ' + (s.closes || 0) + ' min'],
      atrasado: ['var(--bad)', 'atrasado · ' + (s.late || 0) + ' min', 'var(--bad)', 'var(--bg)', 'var(--bad)', 'a janela fechou às ' + fmtMin(ftm + fo.tol)],
      esquecido: ['var(--bad)', 'esquecido', 'transparent', 'var(--bad)', 'var(--bad)', 'mais de ' + (CFG.esquecidoMin / 60) + 'h sem registro'],
      tomado: ['var(--ok)', 'no horário', 'var(--ok)', 'var(--okt)', 'var(--ok)', 'feito às ' + s.at],
      tomadoAtraso: ['var(--xp)', 'fora da janela', 'transparent', 'var(--xp)', 'var(--xp)', 'feito às ' + s.at],
      pulado: ['var(--ln)', 'pulado', 'var(--sf2)', 'var(--mu)', 'var(--ln)', 'registrado como pulado']
    }[s.k];
    const rowTxt = d => ({ aguardando: ['aguardando', 'var(--nt)'], janela: ['janela aberta', 'var(--xp)'], atrasado: ['atrasado', 'var(--bad)'], esquecido: ['esquecido', 'var(--bad)'], tomado: ['feito às ' + d.st.at, 'var(--ok)'], tomadoAtraso: ['às ' + d.st.at + ' · fora', 'var(--xp)'], pulado: ['pulado', 'var(--mu)'] })[d.st.k];
    const pq = punctuality(), showBtns = ['janela', 'atrasado', 'esquecido'].includes(s.k);
    card.style.borderColor = look[0];
    card.innerHTML = `<div class="between"><h2 class="h">${esc(fo.label)}</h2>${allDone ? '<button type="button" class="mini" data-expand="horarios" aria-label="Recolher horários" title="Recolher">−</button>' : ''}<span class="chipsm" style="background:${look[2]};color:${look[3]};border-color:${look[4]}">${look[1]}</span></div>
      <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span class="big mono">${fo.time}</span><span class="mu sm">${look[5]}</span></div>
      <div class="stack" style="gap:8px;max-height:132px;overflow:auto">${doses.map(d => { const [tx, c] = rowTxt(d); return `<div class="rowline"><span class="led" style="border:2px solid ${c};${isDone(day.done[d.o.oid]) ? 'background:' + c : ''}"></span><span style="flex:1">${doses.some(x => x.o.label !== d.o.label) ? esc(d.o.label) + ' ' : ''}${d.o.time} · ±${d.o.tol} min</span><span style="color:${c};font-weight:600">${tx}</span></div>`; }).join('')}</div>
      ${showBtns ? `<div class="btnrow" style="margin-top:auto"><button type="button" class="btn pri" data-take="${fo.oid}" style="flex:1;justify-content:center;min-height:46px">${s.k === 'janela' ? 'Feito agora' : 'Feito mesmo assim'} · +${fo.xp} XP</button><button type="button" class="btn" data-skip="${fo.oid}" style="min-height:46px">Pulei</button></div>`
        : `<div class="xs mu" style="margin-top:auto;padding:10px 12px;border-radius:10px;background:var(--sf2)">${pq.due ? pq.streak + ' seguidos no horário · ' + pq.pct + '% em 30 dias' : 'Nenhum horário registrado ainda'}</div>`}`;
  }

  // Tarefas
  const nextId = nextDose ? nextDose.o.oid : null, hl = nextDose ? (nextDose.st.k === 'aguardando' ? 'var(--nt)' : nextDose.st.k === 'janela' ? 'var(--xp)' : 'var(--bad)') : '';
  const keepScroll = {}; $$('#dash .plist').forEach(el => { keepScroll[el.dataset.p] = el.scrollTop; });
  let doneLists = '';
  LS.forEach(L => { const el = Dash.blk('p-' + L.id); if (!el) return; const p = L.id, name = esc(L.name), color = lcolor(L.c);
    const lst = occ.filter(o => o.p === p); el.classList.toggle('shrunk', lst.length > 0 && lst.every(o => isDone(day.done[o.oid])) && !expanded[p]);
    el.innerHTML = (() => {
    const list = occ.filter(o => o.p === p), done = list.filter(o => isDone(day.done[o.oid])).length, complete = list.length > 0 && done === list.length;
    // Lista concluída recolhe numa linha (toque pra abrir de novo).
    if (complete && !expanded[p]) { doneLists += p + ',';
      return `<button type="button" class="collapsed" data-expand="${p}" aria-expanded="false"><span class="box" style="background:var(--ok);border-color:var(--ok);color:var(--okt)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L19 7"/></svg></span><span style="flex:1;font-weight:600;color:${color}">${name}</span><span class="mono xs mu">${done}/${list.length} concluído</span></button>`;
    }
    return `<section class="card period" aria-label="${name}"><button type="button" class="phead" data-expand="${p}" ${complete ? 'aria-expanded="true" title="Recolher"' : 'tabindex="-1"'}><h2 class="h" style="color:${color}">${name}</h2><span class="mono sm mu">${done}/${list.length}</span></button>
      <div class="plist" data-p="${p}">${list.length ? '' : '<div class="empty-card">Nada nesta lista hoje.</div>'}
      ${list.map(o => {
        const v = day.done[o.oid], on = isDone(v), isNext = o.oid === nextId;
        let meta = '+' + o.xp + ' XP' + (o.w ? ' · <span class="cup">+1 copo</span>' : '');
        if (v === 'skip') meta = 'pulado';
        else if (on) meta = (o.time ? v + (onTime(v, o) ? ' · ok' : ' · fora') : v) + (o.w ? ' · <span class="cup">1 copo</span>' : '');
        return `<button type="button" class="task ${on ? 'on' : ''} ${isNext ? 'next' : ''}" style="${isNext ? '--hl:' + hl : ''}" data-task="${o.oid}" aria-pressed="${on}"><span class="box" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L19 7"/></svg></span><span class="lbl">${esc(o.label)}${o.time ? ' · ' + o.time : ''}</span>${isNext ? '<span class="selo">PRÓXIMA</span>' : ''}<span class="meta mono">${meta}</span></button>`;
      }).join('')}</div></section>`;
  })(); });
  // Contadores seus
  for (const c of counters()) {
    const el = Dash.blk('c-' + c.id); if (!el) continue;
    const v = cntOf(day, tk, c.id), ok = v >= c.meta, ft = cntTask(day, tk, c.id), un = esc(c.unit || '');
    el.innerHTML = `<section class="card stack cntcard" aria-label="${esc(c.name)}" style="gap:8px"><div class="between"><h2 class="h">${esc(c.name)}</h2>${c.xp ? `<span class="mono xs" style="color:${ok ? 'var(--ok)' : 'var(--xp)'}">${ok ? 'meta batida · ' : ''}+${c.xp} XP</span>` : ''}</div>
      <div class="big mono">${v}<span class="mu" style="font-size:16px"> / ${c.meta}${un ? ' ' + un : ''}</span></div>
      <div class="bar"><div style="width:${Math.min(100, v / c.meta * 100).toFixed(1)}%;background:${ok ? 'var(--ok)' : 'var(--xp)'}"></div></div>
      <span class="xs mu">${ok ? 'Meta de hoje batida' : 'Faltam ' + (c.meta - v) + (un ? ' ' + un : '')}${ft ? ' · ' + ft + ' das tarefas' : ''}${c.full ? ' · conta pro dia completo' : ''}</span>
      <div style="display:flex;gap:8px;margin-top:auto"><button type="button" class="btn" data-cnt="${c.id}" data-n="-1" aria-label="Tirar ${c.step} de ${esc(c.name)}" style="width:48px;height:46px;justify-content:center;font-size:22px">−</button><button type="button" class="btn pri" data-cnt="${c.id}" data-n="1" style="flex:1;height:46px;justify-content:center">+${c.step}${un ? ' ' + un : ''}</button></div></section>`;
  }
  // Agora: o que precisa de atenção neste momento. Sem nada, o quadro some.
  const ag = [];
  for (const d of doses) if (['janela', 'atrasado', 'esquecido'].includes(d.st.k)) ag.push([d.st.k === 'janela' ? 'var(--xp)' : 'var(--bad)', esc(d.o.label) + ' · ' + d.o.time, d.st.k === 'janela' ? 'janela aberta · fecha em ' + d.st.closes + ' min' : d.st.k === 'atrasado' ? 'atrasado · ' + fmtDur(d.st.late) : 'esquecido · mais de ' + (CFG.esquecidoMin / 60) + 'h', `<button type="button" class="btn sm pri" data-take="${d.o.oid}">Feito</button>`]);
  if (agua < meta) {
    const wk = toMin(st.wake), sl = sleepMin();
    if (nm > wk && nm < sl) {
      const exp = Math.floor(meta * (nm - wk) / (sl - wk)), al = aguaLastOf(day, tk), since = nm - Math.max(al ? toMinL(al) : wk, wk);
      if (exp - agua >= 2) ag.push(['var(--wa)', 'Água atrasada', agua + ' de ' + exp + ' copos esperados até agora', '<button type="button" class="btn sm" data-agua="1">+1 copo</button>']);
      else if (since >= st.aguaGap) ag.push(['var(--wa)', 'Hora de um copo d’água', 'o último foi há ' + fmtDur(since), '<button type="button" class="btn sm" data-agua="1">+1 copo</button>']);
    }
  }
  const nx = doses.find(d => d.st.k === 'aguardando');
  if (nx) ag.push(['var(--nt)', 'Próximo: ' + esc(nx.o.label) + ' às ' + nx.o.time, 'em ' + fmtDur(nx.st.inMin), '']);
  Dash.blk('agora').classList.toggle('auto-off', !ag.length);
  $('#agoraList').innerHTML = ag.length ? ag.map(([c, t, s, b]) => `<div class="agrow"><span class="led" style="background:${c};border-color:${c}"></span><div class="stack" style="gap:2px;flex:1;min-width:0"><b>${t}</b><span class="xs mu">${s}</span></div>${b}</div>`).join('')
    : '<div class="empty-card">Nada pendente agora. Este quadro aparece sozinho quando tem horário atrasado, água atrasada ou um próximo alarme.</div>';
  // Nota do dia
  const ni = $('#notaIn'); if (document.activeElement !== ni) ni.value = (DATA.days[tk] || {}).note || '';
  HOJE_SIG = doneLists + '|' + ag.length + '|' + allDone + '|' + counters().length;
  if (Dash.editing) Dash.paintEdit();
  $$('#dash .plist').forEach(el => { if (keepScroll[el.dataset.p]) el.scrollTop = keepScroll[el.dataset.p]; markMore(el); });

  // Sequência e mapa
  $('#streakBig').textContent = S.streak;
  $('#bestLine').textContent = 'Recorde: ' + S.best + (S.best === 1 ? ' dia' : ' dias') + ' · passar o recorde vale +' + CFG.xp.recorde + ' XP';
  $('#jokerLine').textContent = S.jokerWeek ? 'Coringa desta semana usado em ' + WD[weekday(S.jokerWeek)] + ', ' + dm(S.jokerWeek) : '1 coringa disponível nesta semana: um dia sem registro não quebra a sequência';
  const start = addDays(weekStart(tk), -15 * 7); let heat = '';
  for (let i = 0; i < 112; i++) {
    const k = addDays(start, i); let cls = '';
    if (k > tk) cls = 'fut';
    else { const r = Game.ratio(DATA.days[k], k); cls = r === 0 ? '' : r < .25 ? 'lv1' : r < .5 ? 'lv2' : r < .85 ? 'lv3' : 'lv4'; if (S.jokerDays.has(k)) cls += ' jk'; }
    heat += `<span class="cell ${cls}" title="${dm(k)}"></span>`;
  }
  // Tela estreita: o mapa fica no fim (hoje), a menos que a pessoa tenha arrastado pra ver semanas antigas.
  const hbox = $('#heat').parentElement;
  if (!hbox._seen) { hbox._seen = true; for (const ev of ['pointerdown', 'wheel', 'touchstart']) hbox.addEventListener(ev, () => { hbox._moved = true; }, { passive: true }); }
  const keep = hbox._moved && hbox.scrollLeft < hbox.scrollWidth - hbox.clientWidth - 2;
  $('#heat').innerHTML = heat;
  if (!keep) { hbox.scrollLeft = hbox.scrollWidth; hbox._moved = false; }

  // Nível e companheiro
  $('#lvN').textContent = lv.n; $('#lvName').textContent = lv.name;
  $('#lvBar').style.width = lv.pct.toFixed(1) + '%'; $('#lvLine').textContent = lv.line;
  Comp.setBase(S.tired ? 'tired' : 'idle', S.recovered);
  Layout.maybeRefit(Dash.sig() + '|' + doses.length + '|' + occ.length + '|' + window.innerWidth + 'x' + window.innerHeight + '|' + isNarrow() + '|' + HOJE_SIG);
}
