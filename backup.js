// همسة · encrypted backup (like WhatsApp's encrypted backup): get your old messages back on a new phone,
// or after removing the app from the home screen.
// How it works: each person has ONE backup key pair. Its PUBLIC half is listed in device_keys like a phone, so every
// new message is also locked for it. Its PRIVATE half is locked on the phone with the person's backup password
// (PBKDF2-SHA256, 600k rounds → AES-256-GCM) and only then stored in key_backups. The server never sees the password
// or the open key. Messages from before the backup existed get a copy of their key in msg_keys (locked for the backup).
const BK = { id: null, pub: null, priv: null, row: null, checked: false, sweeping: false, swept: 0 };
const BK_ITERS = 600000, bkEnc = new TextEncoder(), bkDec = new TextDecoder();
const bkShelf = new Map();   // message id → shelf row {w, i, dev} | null (none) | true (being saved)

async function bkPassKey(pass, salt, iters) {
  const base = await crypto.subtle.importKey('raw', bkEnc.encode(String(pass).normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iters }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const bkRand = n => crypto.getRandomValues(new Uint8Array(n));

// what the server knows about my backup, and whether THIS phone has it unlocked
async function bkInfo(fresh) {
  if (!me) return null; if (BK.checked && !fresh) return BK.row;
  const { data, error } = await sb.from('key_backups').select('*').eq('user_id', me.id).maybeSingle();
  if (error) { BK.checked = false; return null; }   // the database is not updated yet: behave as "no backup"
  BK.row = data || null; BK.checked = true; BK.id = data ? data.device_id : null; BK.pub = null;
  if (data) { const { data: d } = await sb.from('device_keys').select('pub,revoked').eq('user_id', me.id).eq('device_id', data.device_id).maybeSingle();
    BK.pub = d && !d.revoked ? d.pub : null; if (BK.pub) devPub.set(BK.id, { user: me.id, pub: BK.pub }); }
  const local = await HC.current('backup').catch(() => null);
  BK.priv = local && local.user === me.id && local.id === BK.id ? local.priv : null;
  return BK.row;
}
async function bkLock(pass, payload) {
  const salt = bkRand(16), iv = bkRand(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await bkPassKey(pass, salt, BK_ITERS), bkEnc.encode(JSON.stringify(payload)));
  return { salt: HC.b64(salt), iv: HC.b64(iv), ct: HC.b64(ct), iters: BK_ITERS };
}
async function bkUnlockRow(pass, row) {
  try { const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: HC.ub64(row.iv) }, await bkPassKey(pass, HC.ub64(row.salt), row.iters), HC.ub64(row.ct)); return JSON.parse(bkDec.decode(pt)); }
  catch { throw Object.assign(new Error(t('bkWrong')), { wrong: true }); }
}
const bkImport = jwk => crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);   // usable, never readable again

// make a (new) backup with this password
async function bkCreate(pass) {
  const old = await bkInfo(true);
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey), pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const id = 'bk' + HC.b64(bkRand(12)).replace(/[+/=]/g, '');
  const locked = await bkLock(pass, { v: 1, id, jwk });
  let { error } = await sb.from('device_keys').insert({ device_id: id, pub }); if (error) throw error;
  ({ error } = await sb.from('key_backups').upsert({ user_id: me.id, device_id: id, ...locked, updated_at: new Date().toISOString() }));
  if (error) { await sb.from('device_keys').update({ revoked: true }).eq('user_id', me.id).eq('device_id', id); throw error; }
  if (old && old.device_id !== id) {   // the old backup key is retired, and its saved copies are useless now
    await sb.from('device_keys').update({ revoked: true }).eq('user_id', me.id).eq('device_id', old.device_id);
    await sb.from('msg_keys').delete().eq('user_id', me.id); }
  await HC.store('backup', { id, user: me.id, priv: await bkImport(jwk) });
  bkShelf.clear(); devsByConv.clear(); try { localStorage.removeItem('hamsa-bk-swept'); } catch {}
  await bkInfo(true); bkSweep();
}
// on a new phone: the password opens the backup key, and old messages open again
async function bkRestore(pass) {
  const row = await bkInfo(true); if (!row) throw new Error(t('bkNone'));
  const o = await bkUnlockRow(pass, row);
  await HC.store('backup', { id: o.id, user: me.id, priv: await bkImport(o.jwk) });
  await bkInfo(true);
  for (const [k, v] of plain) if (v && v.fail) plain.delete(k);   // try the ones that would not open before
  bkShelf.clear(); myStk = null;
  await loadChats(); if (current) openChat(current.id, true);
  bkSweep();
}
async function bkChange(oldPass, newPass) {
  const row = await bkInfo(true); if (!row) throw new Error(t('bkNone'));
  const o = await bkUnlockRow(oldPass, row), locked = await bkLock(newPass, o);
  const { error } = await sb.from('key_backups').update({ ...locked, updated_at: new Date().toISOString() }).eq('user_id', me.id); if (error) throw error;
  await bkInfo(true);
}
async function bkOff() {
  const row = await bkInfo(true);
  if (row) { await sb.from('device_keys').update({ revoked: true }).eq('user_id', me.id).eq('device_id', row.device_id);
    await sb.from('msg_keys').delete().eq('user_id', me.id); await sb.from('key_backups').delete().eq('user_id', me.id); }
  await HC.forget('backup'); bkShelf.clear(); devsByConv.clear(); await bkInfo(true);
}

// ---- opening a message with the backup (when this phone's own key cannot) ----
async function bkDevPub(dev) {
  const c = devPub.get(dev); if (c && c.user === me.id) return c.pub;
  const { data } = await sb.from('device_keys').select('pub').eq('user_id', me.id).eq('device_id', dev).maybeSingle();
  if (!data) throw new Error('unknown-device'); devPub.set(dev, { user: me.id, pub: data.pub }); return data.pub;
}
async function bkOpenRow(row, senderPubJwk) {   // any row locked like a message: {ct, iv, keys}
  if (!BK.priv || !BK.id || !row || !row.keys || !row.keys[BK.id]) return null;
  return HC.open(row, { id: BK.id, priv: BK.priv }, senderPubJwk);
}
async function bkOpen(m) {
  if (!BK.priv || !BK.id || !m || m.enc !== 1) return null;
  if (m.keys && m.keys[BK.id]) return HC.open(m, { id: BK.id, priv: BK.priv }, await senderPub(m));
  let s = bkShelf.get(m.id);
  if (s === undefined) { const { data } = await sb.from('msg_keys').select('message_id,w,i,dev').eq('user_id', me.id).eq('message_id', m.id).maybeSingle(); s = data || null; bkShelf.set(m.id, s); }
  if (!s || s === true) return null;
  return HC.open({ ct: m.ct, iv: m.iv, keys: { [BK.id]: { w: s.w, i: s.i } } }, { id: BK.id, priv: BK.priv }, await bkDevPub(s.dev));
}
// before opening a chat: fetch the saved copies for the messages this phone cannot open by itself (one request, not 150)
async function bkPrefetch(rows) {
  if (!BK.priv || !BK.id || !myDev) return;
  const ids = rows.filter(m => m.enc === 1 && m.id > 0 && m.keys && !m.keys[myDev.id] && !m.keys[BK.id] && !bkShelf.has(m.id)).map(m => m.id);
  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100), { data } = await sb.from('msg_keys').select('message_id,w,i,dev').eq('user_id', me.id).in('message_id', part);
    const got = new Map((data || []).map(r => [r.message_id, r])); part.forEach(id => bkShelf.set(id, got.get(id) || null));
  }
}

// ---- keeping the backup complete: messages that are not locked for the backup key get a saved copy ----
let bkQueue = [], bkTimer = null;
async function bkShelve(m, K) {
  if (!BK.id || !BK.pub || !myDev || !m || m.id <= 0 || !K || (m.keys && m.keys[BK.id]) || bkShelf.has(m.id)) return;
  bkShelf.set(m.id, true);
  try { const w = await HC.wrapFor(myDev, BK.pub, m.iv, K); bkQueue.push({ user_id: me.id, message_id: m.id, w: w.w, i: w.i, dev: myDev.id }); } catch { bkShelf.delete(m.id); return; }
  if (bkQueue.length >= 50) return bkFlush(); clearTimeout(bkTimer); bkTimer = setTimeout(bkFlush, 1500);
}
async function bkFlush() {
  clearTimeout(bkTimer); const rows = bkQueue; bkQueue = []; if (!rows.length) return;
  const { error } = await sb.from('msg_keys').upsert(rows, { onConflict: 'user_id,message_id', ignoreDuplicates: true });
  if (error) rows.forEach(r => bkShelf.delete(r.message_id)); else BK.swept += rows.length;
  bkProgress();
}
// once per phone (and again after a new backup): go through the chats and save a copy for every older message
async function bkSweep() {
  if (BK.sweeping || !BK.id || !BK.pub || !myDev) return; const mark = BK.id + ':' + myDev.id;
  try { if (localStorage.getItem('hamsa-bk-swept') === mark) return; } catch {}
  BK.sweeping = true; BK.swept = 0; bkProgress();
  try {
    for (const c of [...convs]) {
      for (let from = 0; ; from += 200) {
        if (!me || !BK.id) return;
        const { data, error } = await sb.from('messages').select('id,conversation_id,sender_id,sender_device,enc,ct,iv,keys,deleted').eq('conversation_id', c.id).eq('enc', 1).eq('deleted', false).order('id', { ascending: false }).range(from, from + 199);
        if (error) throw error; const rows = data || [];
        for (const m of rows) {
          if (!m.keys || m.keys[BK.id] || !m.keys[myDev.id] || bkShelf.has(m.id)) continue;
          try { const r = await HC.open(m, myDev, await senderPub(m)); await bkShelve(m, r.K); } catch {}
        }
        await bkFlush(); await sleep(60);
        if (rows.length < 200) break;
      }
    }
    try { localStorage.setItem('hamsa-bk-swept', mark); } catch {}
  } catch (x) { console.warn('[hamsa] backup sweep', x); }
  finally { BK.sweeping = false; bkProgress(); }
}
function bkProgress() { const n = $('#bkProg'); if (!n) return; n.hidden = !BK.sweeping; n.textContent = t('bkSaving', { n: BK.swept }); }

// ---- after signing in: offer to restore (new phone) or to make a backup (nobody has one yet) ----
async function bkStart() {
  Object.assign(BK, { id: null, pub: null, priv: null, row: null, checked: false, swept: 0 }); bkShelf.clear(); bkQueue = [];
  const row = await bkInfo(true); if (!me) return;
  const later = k => { try { return Date.now() - (+localStorage.getItem(k) || 0) < 3 * 864e5; } catch { return false; } };
  if (row && BK.priv) return setTimeout(bkSweep, 5000);
  if (row && !BK.priv) { setTimeout(bkSweep, 5000); if (!later('hamsa-bk-later')) setTimeout(() => bkAsk(), 1200); return; }
  if (!row && BK.checked && !later('hamsa-bk-nudge')) setTimeout(() => { if (me && !BK.row && !$('#dlg').open) bkNudge(); }, 25000);
}
function bkAsk() {   // "you have a backup: type its password to bring your old messages back"
  if (!me || $('#dlg').open) return;
  dialog(`<h3>${ic('shield')} ${t('bkRestoreTitle')}</h3><p class="muted">${t('bkRestoreNote')}</p>
<label class="st-field"><span>${t('bkPass')}</span><input type="password" id="bkAskPass" dir="ltr" autocomplete="current-password"></label><p id="bkAskMsg" class="err"></p>
<div class="row"><button value="later" class="btn ghost">${t('later')}</button><button value="ok" class="btn primary" id="bkAskBtn">${t('bkRestore')}</button></div>`, v => { if (v === 'later') { try { localStorage.setItem('hamsa-bk-later', Date.now()); } catch {} } });
  $('#bkAskBtn').addEventListener('click', async e => {
    e.preventDefault(); const p = $('#bkAskPass').value, b = $('#bkAskBtn'); if (!p) return; b.disabled = true; b.textContent = t('bkWait'); $('#bkAskMsg').textContent = '';
    try { await bkRestore(p); $('#dlg').close('done'); toast(t('bkRestored')); } catch (x) { $('#bkAskMsg').textContent = x.wrong ? t('bkWrong') : errText(x); b.disabled = false; b.textContent = t('bkRestore'); }
  });
}
function bkNudge() {
  dialog(`<h3>${ic('shield')} ${t('bkNudgeTitle')}</h3><p class="muted">${t('bkNudgeNote')}</p><div class="row"><button value="later" class="btn ghost">${t('later')}</button><button value="go" class="btn primary">${t('bkNudgeYes')}</button></div>`,
    v => { try { localStorage.setItem('hamsa-bk-nudge', Date.now()); } catch {} if (v === 'go') openSettings('backup'); });
}

// ---- Settings → Backup ----
async function bkPage(b) {
  $('#stTitle').textContent = t('bkTitle');
  b.innerHTML = `<p class="st-note">${t('bkWait')}</p>`; const row = await bkInfo(true);
  if (stPages[stPages.length - 1] !== 'backup') return;
  const field = (id, label, ac = 'new-password') => `<label class="st-field"><span>${label}</span><input type="password" id="${id}" dir="ltr" autocomplete="${ac}"></label>`;
  if (!row) {
    b.innerHTML = `<div class="st-group pad"><div class="st-h">${ic('shield')} ${t('bkTitle')}</div><p class="muted">${t('bkIntro')}</p></div>
<div class="st-group pad">${field('bkP1', t('bkPass'))}${field('bkP2', t('bkPass2'))}<p class="bk-warn">${t('bkForgetWarn')}</p><p id="bkMsg" class="err"></p><button class="btn primary full" id="bkMake">${t('bkCreate')}</button></div>`;
    $('#bkMake').onclick = async () => { const p1 = $('#bkP1').value, p2 = $('#bkP2').value, msg = $('#bkMsg'), btn = $('#bkMake'); msg.textContent = '';
      if (p1.length < 8) return msg.textContent = t('bkShort'); if (p1 !== p2) return msg.textContent = t('bkMismatch');
      btn.disabled = true; btn.textContent = t('bkWait');
      try { await bkCreate(p1); toast(t('bkCreated')); bkPage(b); } catch (x) { msg.textContent = errText(x); btn.disabled = false; btn.textContent = t('bkCreate'); } };
    return;
  }
  const when = row.updated_at ? fmtDay(row.updated_at) + ' ' + fmtTime(row.updated_at) : '';
  b.innerHTML = `<div class="st-group pad bk-on"><div class="st-h">${ic('shield')} ${t('bkOn')}</div><p class="muted">${t('bkOnNote')}</p><p class="muted small">${t('bkUpdated', { t: when })}</p><p class="muted small" id="bkProg" hidden></p></div>
${BK.priv ? '' : `<div class="st-group pad"><div class="st-h">${t('bkRestoreTitle')}</div><p class="muted">${t('bkRestoreNote')}</p>${field('bkR', t('bkPass'), 'current-password')}<p id="bkRMsg" class="err"></p><button class="btn primary full" id="bkRBtn">${t('bkRestore')}</button></div>`}
<div class="st-group pad"><div class="st-h">${t('bkChange')}</div>${field('bkO', t('bkOldPass'), 'current-password')}${field('bkN', t('bkNewPass'))}<p id="bkCMsg" class="err"></p><button class="btn ghost full" id="bkCBtn">${t('save')}</button></div>
<div class="st-group pad"><p class="muted small">${t('bkForgot')}</p><button class="btn ghost full" id="bkNew">${t('bkMakeNew')}</button><button class="btn ghost full danger" id="bkOffBtn">${t('bkOff')}</button></div>`;
  bkProgress();
  const busy = (btn, on, label) => { btn.disabled = on; btn.textContent = on ? t('bkWait') : label; };
  if ($('#bkRBtn')) $('#bkRBtn').onclick = async () => { const p = $('#bkR').value, btn = $('#bkRBtn'); if (!p) return; busy(btn, true); $('#bkRMsg').textContent = '';
    try { await bkRestore(p); toast(t('bkRestored')); bkPage(b); } catch (x) { $('#bkRMsg').textContent = x.wrong ? t('bkWrong') : errText(x); busy(btn, false, t('bkRestore')); } };
  $('#bkCBtn').onclick = async () => { const o = $('#bkO').value, n = $('#bkN').value, btn = $('#bkCBtn'); $('#bkCMsg').textContent = '';
    if (n.length < 8) return $('#bkCMsg').textContent = t('bkShort'); busy(btn, true);
    try { await bkChange(o, n); toast(t('bkChanged')); bkPage(b); } catch (x) { $('#bkCMsg').textContent = x.wrong ? t('bkWrong') : errText(x); busy(btn, false, t('save')); } };
  $('#bkNew').onclick = () => { if (!confirm(t('bkMakeNewSure'))) return; bkMakeNew(b); };
  $('#bkOffBtn').onclick = async () => { if (!confirm(t('bkOffSure'))) return; try { await bkOff(); toast(t('bkOffDone')); bkPage(b); } catch (x) { toast(errText(x)); } };
}
function bkMakeNew(b) {   // forgot the password: a brand-new backup (older messages that only the old backup had are lost)
  b.innerHTML = `<div class="st-group pad"><div class="st-h">${t('bkMakeNew')}</div><p class="muted">${t('bkMakeNewNote')}</p>
<label class="st-field"><span>${t('bkPass')}</span><input type="password" id="bkP1" dir="ltr" autocomplete="new-password"></label><label class="st-field"><span>${t('bkPass2')}</span><input type="password" id="bkP2" dir="ltr" autocomplete="new-password"></label>
<p class="bk-warn">${t('bkForgetWarn')}</p><p id="bkMsg" class="err"></p><button class="btn primary full" id="bkMake">${t('bkCreate')}</button></div>`;
  $('#bkMake').onclick = async () => { const p1 = $('#bkP1').value, p2 = $('#bkP2').value, msg = $('#bkMsg'), btn = $('#bkMake'); msg.textContent = '';
    if (p1.length < 8) return msg.textContent = t('bkShort'); if (p1 !== p2) return msg.textContent = t('bkMismatch');
    btn.disabled = true; btn.textContent = t('bkWait');
    try { await bkCreate(p1); toast(t('bkCreated')); bkPage(b); } catch (x) { msg.textContent = errText(x); btn.disabled = false; btn.textContent = t('bkCreate'); } };
}
