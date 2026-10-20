// Hábitos · Listas suas, contadores e nota do dia.
'use strict';
/* ===================== Listas suas e contadores ===================== */
const uid = p => p + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5);
// Quadro novo entra no fim do painel (e o arranjo vai junto no QR).
function dashAppend(id, w) { const d = Dash.get(); if (!d.blocks.some(b => b.id === id)) d.blocks.push({ id, w, on: true }); else { const b = d.blocks.find(x => x.id === id); b.on = true; } d.updatedAt = Date.now(); }

const Lists = {
  deleting: null,
  create(name) {
    // Cor livre, deixando o azul da água por último.
    const order = DATA.lists.reduce((m, l) => Math.max(m, l.order ?? 0), -1) + 1, used = new Set(lists().map(l => l.c)), pref = [...LCOLORS.filter(x => x[0] !== 'wa'), LCOLORS.find(x => x[0] === 'wa')];
    const c = (pref.find(x => !used.has(x[0])) || pref[order % pref.length])[0];
    const l = { id: uid('l'), name: String(name).trim().slice(0, 30) || 'Lista', c, order, updatedAt: Date.now() };
    DATA.lists.push(l); saveData(); dashAppend('p-' + l.id, 'm'); saveData(); renderAll(); return l;
  },
  touch(l) { l.updatedAt = Date.now(); saveData(); },
  // Tarefas que usam a lista (simples, “manhã e noite” e com horário escolhido nela).
  users(id) { const t = logicalDate(); return DATA.tasks.filter(x => (!x.end || x.end >= t) && (x.p === id || x.p2 === id || (!x.p && x.type !== 'horario' && id === lists()[0].id))); },
  remove(id, to) {
    const l = DATA.lists.find(x => x.id === id); if (!l || lists().length < 2) return;
    for (const t of DATA.tasks) { let ch = false; if (t.p === id) { t.p = t.type === 'horario' && !to ? null : to; ch = true; } if (t.p2 === id) { t.p2 = to; ch = true; } if (ch) t.updatedAt = Date.now(); }
    l.del = 1; l.updatedAt = Date.now(); this.deleting = null; touchToday(); saveData(); this.render(); Tasks.render();
    toast('Lista “' + l.name + '” apagada.' + (to ? ' As tarefas foram pra “' + listName(to) + '”.' : ''));
  },
  move(id, dir) {
    const L = lists(), i = L.findIndex(l => l.id === id), j = i + dir; if (i < 0 || j < 0 || j >= L.length) return;
    L.forEach((l, k) => { l.order = k; }); [L[i].order, L[j].order] = [L[j].order, L[i].order]; L[i].updatedAt = L[j].updatedAt = Date.now(); saveData(); this.render();
  },
  render() {
    const L = lists();
    $('#listRows').innerHTML = L.map((l, i) => {
      const n = this.users(l.id).length, del = this.deleting === l.id, others = L.filter(x => x.id !== l.id);
      return `<div class="lrow stack" data-lid="${l.id}"><div class="lline">
        <button type="button" class="swatch" data-lcolor="${l.id}" style="background:${lcolor(l.c)}" aria-label="Trocar a cor de ${esc(l.name)}" title="Trocar a cor"></button>
        <input type="text" data-lname="${l.id}" value="${esc(l.name)}" maxlength="30" aria-label="Nome da lista">
        <span class="xs mu" style="white-space:nowrap;margin-left:auto">${n} ${n === 1 ? 'tarefa' : 'tarefas'}</span>
        <button type="button" class="mini" data-lmv="-1" aria-label="Subir ${esc(l.name)}" ${i === 0 ? 'disabled' : ''}>▲</button><button type="button" class="mini" data-lmv="1" aria-label="Descer ${esc(l.name)}" ${i === L.length - 1 ? 'disabled' : ''}>▼</button>
        <button type="button" class="mini x" data-ldel aria-label="Apagar ${esc(l.name)}" title="${L.length < 2 ? 'Precisa ter pelo menos uma lista' : 'Apagar'}" ${L.length < 2 ? 'disabled' : ''}>×</button></div>
        ${del ? `<div class="ldel">${n ? `Mover as ${n} ${n === 1 ? 'tarefa' : 'tarefas'} pra <select data-lto>${others.map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select>` : '<span>Apagar esta lista?</span>'}
          <button type="button" class="btn sm danger" data-lyes>Apagar lista</button><button type="button" class="btn sm" data-lno>Cancelar</button>
          <span class="xs mu" style="flex-basis:100%">O histórico dos dias que passaram não muda.</span></div>` : ''}</div>`;
    }).join('');
  },
  init() {
    $('#listNew').addEventListener('click', () => { const l = this.create('Nova lista'); this.render(); const el = $(`[data-lname="${l.id}"]`); if (el) { el.focus(); el.select(); } });
    const box = $('#listRows');
    box.addEventListener('click', e => {
      const row = e.target.closest('[data-lid]'); if (!row) return; const id = row.dataset.lid, l = DATA.lists.find(x => x.id === id), q = s => e.target.closest(s);
      if (q('[data-lcolor]')) { const i = LCOLORS.findIndex(c => c[0] === l.c); l.c = LCOLORS[(i + 1) % LCOLORS.length][0]; this.touch(l); this.render(); }
      else if (q('[data-lmv]')) this.move(id, +q('[data-lmv]').dataset.lmv);
      else if (q('[data-ldel]')) { this.deleting = id; this.render(); }
      else if (q('[data-lno]')) { this.deleting = null; this.render(); }
      else if (q('[data-lyes]')) { const sel = row.querySelector('[data-lto]'); this.remove(id, sel ? sel.value : lists().find(x => x.id !== id).id); }
    });
    box.addEventListener('change', e => {
      const id = e.target.dataset.lname; if (!id) return; const l = DATA.lists.find(x => x.id === id), v = e.target.value.trim().slice(0, 30);
      if (!v) { e.target.value = l.name; return; } if (v !== l.name) { l.name = v; this.touch(l); Tasks.render(); }
    });
  }
};

const Counters = {
  create(o) {
    const order = DATA.counters.reduce((m, c) => Math.max(m, c.order ?? 0), -1) + 1;
    const c = sanitizeCnt(Object.assign({ id: uid('c'), xp: 10, full: false }, o, { order, updatedAt: Date.now() }));
    DATA.counters.push(c); touchToday(); saveData(); dashAppend('c-' + c.id, 's'); saveData(); renderAll(); return c;
  },
  remove(id) {
    const c = DATA.counters.find(x => x.id === id); if (!c) return;
    const n = DATA.tasks.filter(t => t.cnt === id).length;
    if (!confirm('Apagar o contador “' + c.name + '”?' + (n ? ' ' + n + (n === 1 ? ' tarefa deixa' : ' tarefas deixam') + ' de somar nele.' : '') + ' Os dias que passaram não mudam.')) return;
    for (const t of DATA.tasks) if (t.cnt === id) { t.cnt = null; t.updatedAt = Date.now(); }
    c.del = 1; c.updatedAt = Date.now(); touchToday(); saveData(); this.render(); Tasks.render(); toast('Contador apagado.');
  },
  render() {
    const C = counters();
    $('#cntRows').innerHTML = C.length ? C.map(c => `<div class="cntbox stack" data-cid="${c.id}">
      <div class="lline"><input type="text" data-cf="name" value="${esc(c.name)}" maxlength="30" aria-label="Nome do contador" style="flex:1;min-width:0"><button type="button" class="mini x" data-cdel aria-label="Apagar ${esc(c.name)}" title="Apagar">×</button></div>
      <div class="nums4"><label>Meta por dia<input type="number" data-cf="meta" min="1" max="100000" value="${c.meta}"></label><label>Cada toque soma<input type="number" data-cf="step" min="1" max="1000" value="${c.step}"></label>
        <label>Unidade<input type="text" data-cf="unit" maxlength="16" value="${esc(c.unit)}" placeholder="opcional"></label><label>XP na meta<input type="number" data-cf="xp" min="0" max="100" value="${c.xp}"></label></div>
      <label class="check"><input type="checkbox" data-cf="full" ${c.full ? 'checked' : ''}> Conta pro dia completo (dia perfeito e mapa só fecham com a meta batida)</label></div>`).join('')
      : '<div class="empty-card">Nenhum contador seu ainda. Ex.: páginas lidas, flexões, minutos de leitura.</div>';
  },
  init() {
    $('#cntNew').addEventListener('click', () => { const c = this.create({ name: 'Novo contador', meta: 10, step: 1 }); this.render(); const el = $(`[data-cid="${c.id}"] [data-cf="name"]`); if (el) { el.focus(); el.select(); } });
    const box = $('#cntRows');
    box.addEventListener('click', e => { const d = e.target.closest('[data-cdel]'); if (d) this.remove(d.closest('[data-cid]').dataset.cid); });
    box.addEventListener('change', e => {
      const f = e.target.dataset.cf; if (!f) return; const i = DATA.counters.findIndex(x => x.id === e.target.closest('[data-cid]').dataset.cid); if (i < 0) return;
      const c = DATA.counters[i], v = f === 'full' ? e.target.checked : e.target.value;
      if (f === 'name' && !String(v).trim()) { e.target.value = c.name; return; }
      const nc = DATA.counters[i] = sanitizeCnt(Object.assign({}, c, { [f]: v, updatedAt: Date.now() }));
      // Sem redesenhar o cartão (o campo ainda pode estar em foco): só mostra o valor que ficou valendo.
      if (f !== 'full') e.target.value = nc[f];
      touchToday(); saveData(); Tasks.render();
    });
  }
};

/* ===================== Nota do dia ===================== */
const Nota = {
  _t: 0,
  save() {
    clearTimeout(this._t);
    const v = $('#notaIn').value.replace(/\s+/g, ' ').trim().slice(0, 140), tk = logicalDate(), cur = (DATA.days[tk] || {}).note || '';
    if (v === cur) return;
    const day = touchToday(); if (v) day.note = v; else delete day.note; day.nu = Date.now(); saveData();
    $('#notaInfo').textContent = 'salvo às ' + hhmm(now());
  },
  init() {
    const el = $('#notaIn');
    el.addEventListener('input', () => { $('#notaInfo').textContent = ''; clearTimeout(this._t); this._t = setTimeout(() => this.save(), 600); });
    el.addEventListener('change', () => this.save());
    el.addEventListener('keydown', e => { if (e.key === 'Enter') { this.save(); el.blur(); } });
  }
};
