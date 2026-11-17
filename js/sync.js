// Hábitos · Juntar os dados de outro aparelho com os deste (usado pela sincronização com o Google).
'use strict';
const Sync = {
  // Junta os dados de outro aparelho (pela nuvem) com os deste. Em cada item vale a mudança mais recente; sem hora marcada
  // (dados antigos), junta sem apagar nada. O resultado é o mesmo nos dois aparelhos, seja qual for a ordem.
  merge(obj) {
    // Listas e contadores primeiro: o arranjo do painel e as tarefas apontam pra eles.
    const byId = (arr, inc) => { for (const x of inc || []) { const i = arr.findIndex(y => y.id === x.id); if (i < 0) arr.push(x); else if (newer(x, arr[i])) arr[i] = x; } };
    byId(DATA.lists, obj.lists); byId(DATA.counters, obj.counters); byId(DATA.tasks, obj.tasks);
    const gone = DATA.gone = DATA.gone || {}; for (const [id, at] of Object.entries(obj.gone || {})) if (at > (gone[id] || 0)) gone[id] = at;
    DATA.tasks = DATA.tasks.filter(t => !(gone[t.id] >= (t.updatedAt || 0)));
    if (obj.settings && newer(obj.settings, DATA.settings)) DATA.settings = cleanSettings(obj.settings);
    if (obj.dash) Dash.merge(obj.dash);
    if (obj.c && obj.c < DATA.createdAt) DATA.createdAt = obj.c;
    let added = 0; const today = logicalDate();
    for (const [k, sd] of Object.entries(obj.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
      let day = DATA.days[k]; const fresh = !day; if (!day) { day = DATA.days[k] = { done: {}, agua: 0 }; }
      const lt = day.t || {}, rt = sd.t || {}, sdone = sd.done || {}, take = key => { (day.t = day.t || {})[key] = rt[key]; };
      for (const oid of new Set([...Object.keys(sdone), ...Object.keys(rt).filter(x => x[0] !== '~')])) {
        const cur = day.done[oid], v = sdone[oid], a = lt[oid] || 0, b = rt[oid] || 0;
        if (b > a) { if (v) day.done[oid] = v; else delete day.done[oid]; take(oid); if (v !== cur) added++; }
        else if (b === a && v) {
          if (!cur || (cur === 'skip' && v !== 'skip')) { day.done[oid] = v; added++; }
          else if (isDone(cur) && isDone(v) && toMinL(v) < toMinL(cur)) day.done[oid] = v;
        }
      }
      const num = (key, mine, theirs, set) => { const a = lt[key] || 0, b = rt[key] || 0; if (b > a) { if (theirs !== mine) added++; set(theirs); take(key); } else if (b === a && theirs > mine) { set(theirs); added++; } };
      num('~agua', day.agua || 0, sd.agua || 0, v => { day.agua = v; });
      for (const id of new Set([...Object.keys(sd.c || {}), ...Object.keys(rt).filter(x => x.startsWith('~c:')).map(x => x.slice(3))]))
        num('~c:' + id, (day.c || {})[id] || 0, (sd.c || {})[id] || 0, v => { day.c = day.c || {}; if (v) day.c[id] = v; else delete day.c[id]; });
      if (sd.aguaLast && (!day.aguaLast || sd.aguaLast > day.aguaLast)) day.aguaLast = sd.aguaLast;
      if ((sd.nu || 0) > (day.nu || 0) || (sd.note && !day.note && (sd.nu || 0) === (day.nu || 0))) { if (sd.note) day.note = sd.note; else delete day.note; day.nu = sd.nu || 0; }
      // Retrato do dia (tarefas e metas que valiam): dia novo neste aparelho usa o que veio do outro; se os dois têm e são
      // diferentes, uma regra fixa escolhe o mesmo nos dois lados. O de hoje é refeito logo abaixo com as tarefas atuais.
      const snap = d => JSON.stringify([d.sched || [], d.meta || 0, d.cm || {}, d.af ?? 1]);
      if (fresh || !day.sched) { if (!day.sched) freezeDay(day, k); for (const f of ['sched', 'meta', 'cm', 'af']) if (sd[f] !== undefined) day[f] = sd[f]; }
      else if (k !== today && sd.sched && snap(sd) > snap(day)) for (const f of ['sched', 'meta', 'cm', 'af']) { if (sd[f] !== undefined) day[f] = sd[f]; else delete day[f]; }
    }
    touchToday(); saveData(); return added;
  }
};
