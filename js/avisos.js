// Hábitos · Som, confete, notificações, lembretes e o arquivo .ics pro calendário.
'use strict';
/* ===================== Som, confete e avisos ===================== */
const Sound = {
  ctx: null,
  play(freqs, dur = 0.12, force = false) {
    if (!ST().som && !force) return;
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      const c = this.ctx; let t = c.currentTime + 0.01;
      for (const f of freqs) {
        const o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02); t += dur * 0.9;
      }
    } catch (e) {}
  },
  tick() { this.play([880], 0.08); },
  fanfare() { this.play([523, 659, 784, 1047], 0.14); },
  alert() { this.play([988, 740, 988], 0.15); }
};
function confetti() {
  if (!ST().confete || reduced()) return;
  const box = document.createElement('div'); box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
  const colors = ['#3DDC97', '#F5B83D', '#5AA9FF', '#B49CFF', '#FF7A7A'];
  for (let i = 0; i < 48; i++) { const p = document.createElement('i'); p.style.left = Math.random() * 100 + '%'; p.style.background = colors[i % colors.length]; p.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's'; box.appendChild(p); }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2600);
}
let SWREG = null;
const Banner = { show(title, body) { $('#bannerText').textContent = title + (body ? ' — ' + body : ''); $('#banner').hidden = false; } };
async function notify(title, body, tag = title) {
  Sound.alert();
  let sys = false;
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      if (SWREG && SWREG.showNotification) await SWREG.showNotification(title, { body, tag, renotify: true, icon: 'icon-192.png' });
      else new Notification(title, { body, tag });
      sys = true;
    } catch (e) {}
  }
  // Com a página na tela, o aviso aparece aqui dentro também: se o sistema segurar a notificação, ele não se perde.
  if (!sys || document.visibilityState === 'visible') Banner.show(title, body);
  return sys;
}
async function testNotify() {
  if ('Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) {} Settings.paint(); }
  const sys = await notify('Teste de aviso', 'É assim que os lembretes vão aparecer.', 'teste-' + Date.now());
  toast(sys ? 'Enviado pro sistema também. Se não apareceu nada fora da página, veja a nota logo abaixo do botão.' : 'O navegador não liberou notificações: o aviso aparece só aqui dentro. Veja a nota abaixo do botão.');
}
const Remind = {
  sent: (() => { try { return new Set(JSON.parse(sessionStorage.getItem('habitos.avisos') || '[]')); } catch (e) { return new Set(); } })(),
  mark(k) { this.sent.add(k); try { sessionStorage.setItem('habitos.avisos', JSON.stringify([...this.sent].slice(-200))); } catch (e) {} },
  tick() {
    const st = ST(); if (!st.notif) return;
    const t = logicalDate(), nm = nowMin(), day = DATA.days[t] || { done: {}, agua: 0 };
    if (st.notifDose) for (const o of occurrencesFor(t).filter(o => o.time)) {
      if (day.done[o.oid]) continue;
      const s = toMinL(o.time), open = s - o.tol, k1 = t + '|' + o.oid + '|antes', k2 = t + '|' + o.oid + '|janela';
      if (st.doseLead > 0 && nm >= open - st.doseLead && nm < open && !this.sent.has(k1)) { this.mark(k1); notify(o.label + ' às ' + o.time, 'A janela abre em ' + (open - nm) + ' min.'); }
      else if (nm >= open && nm <= s + o.tol && !this.sent.has(k2)) { this.mark(k2); this.mark(k1); notify('Hora: ' + o.label + ' · ' + o.time, 'Janela até ' + fmtMin(s + o.tol) + '.'); }
    }
    if (st.notifAgua && aguaOf(day, t) < metaOf(day)) {
      const wake = toMin(st.wake), sl = sleepMin();
      if (nm >= wake && nm <= sl) {
        const al = aguaLastOf(day, t), last = Math.max(al ? toMinL(al) : wake, wake), slot = Math.floor((nm - last) / st.aguaGap);
        const k = t + '|agua|' + last + '|' + slot;
        if (slot >= 1 && !this.sent.has(k)) { this.mark(k); notify('Hora de um copo d’água', aguaOf(day, t) + ' de ' + metaOf(day) + ' copos até agora.'); }
      }
    }
  }
};
function notifStatus() {
  if (!('Notification' in window)) return 'este navegador não tem notificações: o aviso aparece dentro da página';
  if (Notification.permission === 'granted') return 'permitidas · funcionam com a página aberta';
  if (Notification.permission === 'denied') return 'bloqueadas no navegador: o aviso aparece dentro da página';
  return 'com a página aberta · o navegador vai pedir permissão';
}
function buildICS() {
  const t = logicalDate(), st = ST(), stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const escI = s => String(s).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Habitos//PT-BR', 'CALSCALE:GREGORIAN'];
  let n = 0;
  for (const task of sortTasks(DATA.tasks)) {
    if (task.type !== 'horario' || (task.end && task.end < t)) continue;
    const start = task.start && task.start > t ? task.start : t;
    const days = Array.isArray(task.days) && task.days.length ? task.days : ALLDAYS;
    for (const tm of task.times) {
      const begin = toMin(tm) - (task.tol ?? 10), dayKey = begin < 0 ? addDays(start, -1) : start;
      let rule = days.length === 7 ? 'RRULE:FREQ=DAILY' : 'RRULE:FREQ=WEEKLY;BYDAY=' + days.map(d => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d]).join(',');
      if (task.end) rule += ';UNTIL=' + task.end.replace(/-/g, '') + 'T235959';
      L.push('BEGIN:VEVENT', 'UID:' + task.id + '-' + tm.replace(':', '') + '@habitos', 'DTSTAMP:' + stamp,
        'DTSTART:' + dayKey.replace(/-/g, '') + 'T' + fmtMin(begin).replace(':', '') + '00', 'DURATION:PT' + (2 * (task.tol ?? 10) || 1) + 'M', rule,
        'SUMMARY:' + escI(task.label + ' · ' + tm), 'DESCRIPTION:' + escI('Janela de ±' + (task.tol ?? 10) + ' min. Marque no app Hábitos.'),
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + escI(task.label), 'TRIGGER:-PT' + (st.doseLead || 0) + 'M', 'END:VALARM', 'END:VEVENT');
      n++;
    }
  }
  L.push('END:VCALENDAR');
  return { text: L.join('\r\n') + '\r\n', n };
}
