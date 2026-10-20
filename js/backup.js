// Hábitos · Backup: exportar, compartilhar e importar.
'use strict';
/* ===================== Backup geral ===================== */
// Imagens do companheiro em texto (data URL), na ordem da configuração. Imagens sem arquivo neste navegador ficam de fora.
async function compImagesOut(cfg, set) {
  const out = [];
  for (const im of cfg.images) { const sh = set.get(im.id); if (sh && sh.blob) out.push({ id: im.id, name: im.name, dataURL: await blobToDataURL(sh.blob) }); }
  return out;
}
function savedImageStats() { let bytes = 0, n = 0; for (const im of CC.images) { const sh = SAVED.get(im.id); if (sh && sh.blob) { bytes += sh.blob.size; n++; } } return { bytes, n }; }
function paintBackupSize() {
  const base = JSON.stringify({ data: DATA, companion: { config: CC } }).length, { bytes, n } = savedImageStats(), total = base + Math.ceil(bytes * 4 / 3);
  $('#bkImg').disabled = !n;
  $('#bkImgL').textContent = n > 1 ? `Incluir as ${n} imagens do companheiro no backup` : 'Incluir a imagem do companheiro no backup';
  if (!n) { $('#bkSize').textContent = `Tamanho aproximado: ${fmtBytes(base)}. Nenhuma imagem de companheiro salva.`; return; }
  $('#bkSize').innerHTML = esc(`Com ${n > 1 ? 'as imagens' : 'a imagem'}: ~${fmtBytes(total)}. Sem: ~${fmtBytes(base)} (aí o companheiro chega sem ${n > 1 ? 'as imagens' : 'a imagem'} no outro aparelho). As imagens viram texto e ficam cerca de 33% maiores que os PNGs.`)
    + ($('#bkImg').checked && total > BIG_FILE ? ' <span class="warn">Arquivo grande: pode demorar pra compartilhar ou abrir no celular.</span>' : '');
}
async function backupText(withImages) {
  const out = { type: 'habitos-backup', v: 3, exportedAt: new Date().toISOString(), data: DATA, companion: { config: CC, images: withImages ? await compImagesOut(CC, SAVED) : [] } };
  return JSON.stringify(out);
}
async function exportBackup() { download('backup-habitos-' + logicalDate() + '.json', await backupText($('#bkImg').checked)); }
async function shareBackup() {
  const txt = await backupText($('#bkImg').checked), name = 'backup-habitos-' + logicalDate() + '.json';
  try {
    const file = new File([txt], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Backup do Hábitos' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  download(name, txt); toast('Este navegador não compartilha arquivos: o backup foi baixado.');
}
async function importBackup(file) {
  if (!file) return;
  let obj; try { obj = JSON.parse(await readText(file)); } catch (e) { toast('Arquivo inválido.'); return; }
  const data = obj && obj.type === 'habitos-backup' ? migrate(obj.data) : null;
  if (!data) { toast('Esse arquivo não é um backup do app.'); return; }
  if (!confirm('Importar este backup substitui os registros e o companheiro deste navegador. Continuar?')) return;
  DATA = data; if (DATA.days[logicalDate()]) touchToday(); saveData();
  let r = null;
  if (obj.companion && obj.companion.config) r = await applyCompanion(obj.companion.config, obj.companion.images || obj.companion.image);
  applyTheme(); renderAll();
  toast(r && r.missing ? `Backup importado, mas ${r.missing === 1 ? '1 imagem do companheiro não veio' : r.missing + ' imagens do companheiro não vieram'} no arquivo. Escolha o arquivo de novo em Configurações › Companheiro.` : 'Backup importado.');
}
// Troca o companheiro salvo pelo de um arquivo (exportação ou backup). Aceita o formato antigo (uma imagem) e o novo (várias).
async function applyCompanion(config, images) {
  const c = sanitizeComp(config);
  const list = Array.isArray(images) ? images : images && images.dataURL ? [Object.assign({}, images, { id: images.id || (c.images[0] && c.images[0].id) })] : [];
  const set = new SheetSet(); let bad = 0, fail = false;
  for (const it of list) {
    if (!it || typeof it.dataURL !== 'string' || !c.images.some(im => im.id === it.id) || set.has(it.id)) continue;
    try { await set.load(it.id, dataURLToBlob(it.dataURL)); } catch (e) { bad++; }
  }
  // Imagens que não vieram no arquivo: aproveita as que este navegador já tem, se forem as mesmas.
  for (const im of c.images) {
    if (set.has(im.id)) continue;
    const s = SAVED.get(im.id), old = CC.images.find(x => x.id === im.id);
    if (s && s.img && old && old.name === im.name && s.w === im.w && s.h === im.h) { set.put(im.id, s); continue; }
    if (im.id === 'i1') { try { const b = await IDB.get('companion.image'); if (b) { const sh = new SheetImage(); await sh.load(b); if (sh.w === im.w && sh.h === im.h) set.put(im.id, sh); } } catch (e) {} }
  }
  for (const im of c.images) { const s = set.get(im.id); if (s && s.blob) { try { await IDB.set(imgDbKey(im.id), s.blob); } catch (e) { fail = true; } } }
  for (const im of CC.images) if (!set.has(im.id)) { try { await IDB.del(imgDbKey(im.id)); } catch (e) {} }
  CC = c; saveComp(); SAVED.adopt(set); Ed.reset(); Comp.player.restart(); Comp.paint(); paintBackupSize();
  const missing = c.images.filter(im => !set.has(im.id)).length;
  return { images: c.images.length, missing, bad, fail };
}
