// Hábitos · Sincronização automática com a conta Google (Firebase): login, envio e recebimento dos dados.
'use strict';
// Identificadores do projeto no Firebase. Não são senha: quem protege os dados é o login e a regra do banco,
// que só deixa cada pessoa ler e gravar em usuarios/<o próprio id>.
const NUVEM_CFG = {
  apiKey: 'AIzaSyAauapUYBEwMMrO8ITUQeodEpYgwSNZ2dE',
  authDomain: 'habitos-1d886.firebaseapp.com',
  projectId: 'habitos-1d886',
  storageBucket: 'habitos-1d886.firebasestorage.app',
  messagingSenderId: '784433059744',
  appId: '1:784433059744:web:942044a3ee3a06b79ab6c5'
};
const NKEY = 'habitos.nuvem';   // '1' = este aparelho sincroniza
// Texto igual pra dados iguais, seja qual for a ordem em que os campos foram criados (pra comparar sem falso "mudou").
const canon = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((a, x) => { a[x] = v[x]; return a; }, {}) : v);

// Como fica guardado: usuarios/<id>/dados/base (tarefas, listas, contadores, configurações, painel) e
// usuarios/<id>/meses/<ano-mês> (os dias daquele mês). Cada documento é um texto JSON no campo "j".
// As imagens do companheiro e as preferências de tela ficam só no aparelho.
const Nuvem = {
  user: null, db: null, ref: null, pronto: false, remoto: {}, enviado: {}, veio: {}, parar_: [], _t: 0, _sdk: null, ultima: '', erro: '',
  disponivel() { return /^https?:$/.test(location.protocol); },
  ativa() { try { return localStorage.getItem(NKEY) === '1'; } catch (e) { return false; } },
  // A biblioteca do Firebase (515 KB) só é carregada quando a sincronização está ligada ou a pessoa clica em Entrar.
  carregar() {
    if (this._sdk) return this._sdk;
    const um = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('sem-biblioteca')); document.head.appendChild(s); });
    this._sdk = (async () => {
      for (const n of ['app', 'auth', 'firestore']) await um('vendor/firebase/firebase-' + n + '-compat.js');
      firebase.initializeApp(NUVEM_CFG); this.db = firebase.firestore();
      firebase.auth().onAuthStateChanged(u => this.mudouUsuario(u));
    })();
    this._sdk.catch(() => { this._sdk = null; });
    return this._sdk;
  },
  async entrar() {
    if (!this.disponivel()) return;
    try {
      this.erro = ''; await this.carregar();
      try { localStorage.setItem(NKEY, '1'); } catch (e) {}
      if (firebase.auth().currentUser) this.mudouUsuario(firebase.auth().currentUser);
      else await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
    } catch (e) {
      const c = e && e.code || e && e.message || '';
      if (typeof firebase === 'undefined' || !firebase.auth || !firebase.auth().currentUser) { try { localStorage.removeItem(NKEY); } catch (x) {} }
      if (/popup-closed|cancelled-popup/.test(c)) toast('Login cancelado.');
      else if (/popup-blocked/.test(c)) toast('O navegador bloqueou a janela de login. Permita pop-ups pra este site e tente de novo.');
      else if (/sem-biblioteca|network/.test(c)) toast('Sem internet pra entrar agora. Tente de novo quando tiver conexão.');
      else { this.erro = c; toast('Não consegui entrar com o Google.'); }
    }
    this.paint();
  },
  async sair() {
    this.desligar(); try { localStorage.removeItem(NKEY); } catch (e) {}
    try { if (this._sdk) { await this._sdk; await firebase.auth().signOut(); } } catch (e) {}
    this.user = null; this.paint(); toast('Sincronização desligada neste aparelho. Seus dados continuam aqui.');
  },
  mudouUsuario(u) {
    this.desligar(); this.user = u ? { uid: u.uid, email: u.email || '' } : null;
    // Login vencido ou removido: volta a mostrar o botão Entrar.
    if (!u && this.ativa()) { try { localStorage.removeItem(NKEY); } catch (e) {} }
    if (u && this.ativa()) this.ligar(this.db, u.uid);
    this.paint();
  },
  // Começa a ouvir os documentos da pessoa. Nada é enviado antes de chegar a primeira resposta dos dois lugares:
  // assim este aparelho sempre junta o que está na nuvem antes de gravar por cima.
  ligar(db, uid) {
    this.desligar(); this.db = db; this.ref = db.collection('usuarios').doc(uid); this.remoto = {}; this.enviado = {}; this.veio = {}; this.pronto = false;
    const falha = e => { this.erro = e && e.code || 'erro'; this.paint(); };
    this.parar_.push(this.ref.collection('dados').doc('base').onSnapshot(s => {
      if (s.metadata && s.metadata.hasPendingWrites) return;
      const d = s.exists ? s.data() : null; if (d && typeof d.j === 'string') this.remoto.base = d.j; else delete this.remoto.base;
      this.veio.base = true; this.chegou();
    }, falha));
    this.parar_.push(this.ref.collection('meses').onSnapshot(s => {
      if (s.metadata && s.metadata.hasPendingWrites) return;
      s.docChanges().forEach(c => { const id = 'm:' + c.doc.id, d = c.doc.data(); if (c.type === 'removed' || !d || typeof d.j !== 'string') delete this.remoto[id]; else this.remoto[id] = d.j; });
      this.veio.meses = true; this.chegou();
    }, falha));
  },
  desligar() { for (const f of this.parar_) { try { f(); } catch (e) {} } this.parar_ = []; this.pronto = false; clearTimeout(this._t); },
  // Os dados deste aparelho, repartidos nos mesmos documentos da nuvem.
  docs() {
    const out = { base: canon({ c: DATA.createdAt, tasks: DATA.tasks, lists: DATA.lists, counters: DATA.counters, settings: DATA.settings, dash: Dash.get(), gone: DATA.gone || {} }) }, by = {};
    for (const k of Object.keys(DATA.days)) (by[k.slice(0, 7)] = by[k.slice(0, 7)] || {})[k] = DATA.days[k];
    for (const m of Object.keys(by)) out['m:' + m] = canon(by[m]);
    return out;
  },
  // Chegou algo da nuvem: se for diferente do que está aqui, junta (passando pela mesma validação do backup) e redesenha.
  chegou() {
    if (!this.veio.base || !this.veio.meses) return;
    this.pronto = true; this.erro = '';
    const meu = this.docs(), dif = Object.keys(this.remoto).filter(id => this.remoto[id] !== meu[id]);
    if (dif.length) {
      let base = null; const days = {};
      for (const id of dif) {
        let o; try { o = JSON.parse(this.remoto[id]); } catch (e) { continue; }
        if (!o || typeof o !== 'object') continue;
        if (id === 'base') base = o; else Object.assign(days, o);
      }
      const b = base || {};
      Sync.merge({ c: okDate(b.c) ? b.c : null, tasks: (Array.isArray(b.tasks) ? b.tasks : []).map(cleanTask).filter(Boolean), lists: (Array.isArray(b.lists) ? b.lists : []).map(cleanList).filter(Boolean),
        counters: (Array.isArray(b.counters) ? b.counters : []).map(cleanCnt).filter(Boolean), settings: b.settings ? cleanSettings(b.settings) : null, dash: b.dash && typeof b.dash === 'object' ? b.dash : null,
        gone: cleanGone(b.gone), days: cleanDays(days) });
      if (typeof applyTheme === 'function') applyTheme();
      renderAll();
    }
    this.ultima = hhmm(new Date()); this.enviar(); this.paint();
  },
  agendar() { if (!this.pronto) return; clearTimeout(this._t); this._t = setTimeout(() => this.enviar(), 1500); },
  // Grava só os documentos que mudaram. Um mesmo conteúdo nunca é enviado duas vezes seguidas, então dois aparelhos
  // não ficam respondendo um ao outro sem parar.
  enviar() {
    clearTimeout(this._t); if (!this.pronto || !this.ref) return;
    const meu = this.docs(); let n = 0;
    for (const id of Object.keys(meu)) {
      if (meu[id] === this.remoto[id] || meu[id] === this.enviado[id]) continue;
      this.enviado[id] = meu[id]; n++;
      const doc = id === 'base' ? this.ref.collection('dados').doc('base') : this.ref.collection('meses').doc(id.slice(2));
      Promise.resolve(doc.set({ j: meu[id], em: Date.now() })).catch(e => { delete this.enviado[id]; this.erro = e && e.code || 'erro'; this.paint(); });
    }
    if (n) { this.ultima = hhmm(new Date()); this.paint(); }
  },
  paint() {
    const info = $('#nvInfo'); if (!info) return;
    const entrar = $('#nvIn'), sair = $('#nvOut');
    entrar.hidden = this.ativa(); sair.hidden = !entrar.hidden; entrar.disabled = !this.disponivel();
    if (!this.disponivel()) info.textContent = 'Só funciona pelo endereço https do app (o login do Google não aceita o arquivo aberto com dois cliques). Abra https://ayablack.github.io/habitos/ e entre por lá.';
    else if (!entrar.hidden) info.textContent = 'Entre com a sua conta Google no PC e no celular: o que você marcar num aparelho aparece no outro em segundos. Tarefas, registros, listas, contadores, notas e configurações vão junto; as imagens do companheiro ficam só no aparelho.';
    else if (!this.user) info.textContent = this.erro ? 'Sem internet agora: o app continua funcionando e sincroniza quando a conexão voltar.' : 'Conectando à sua conta…';
    else if (this.erro === 'permission-denied') info.textContent = 'Entrou como ' + this.user.email + ', mas o banco recusou o acesso. Saia e entre de novo.';
    else if (this.erro) info.textContent = 'Entrou como ' + this.user.email + '. Sem conexão com a nuvem agora: o app continua funcionando e sincroniza quando a internet voltar.';
    else info.textContent = 'Sincronizando como ' + this.user.email + '.' + (this.pronto ? ' Última troca às ' + this.ultima + '.' : ' Conectando…');
  },
  init() {
    $('#nvIn').addEventListener('click', () => this.entrar());
    $('#nvOut').addEventListener('click', () => this.sair());
    this.paint();
    // Com a sincronização ligada, conecta sozinho um instante depois de o app abrir (o login fica guardado no navegador).
    if (this.ativa() && this.disponivel()) setTimeout(() => this.carregar().catch(() => { this.erro = 'offline'; this.paint(); }), 1200);
    window.addEventListener('online', () => { if (this.ativa() && !this._sdk) this.carregar().catch(() => {}); });
  }
};
