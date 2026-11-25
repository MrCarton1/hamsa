// همسة · emoji reactions and the long-press menu (like WhatsApp / Snapchat).
// Hold a message: it lifts up, emojis appear above it and the actions below it. Reactions are encrypted like
// messages, so the server only knows "someone reacted", never which emoji.
const RX = new Map();   // message id → Map(user id → emoji)
const RX_QUICK = ['❤️', '😂', '😮', '😢', '🙏', '👍'];
const RX_MORE = ['😍', '🥰', '😘', '😊', '😁', '🤣', '😅', '😉', '😎', '🤩', '🥳', '🤔', '🫡', '😴', '😐', '🙄', '😬', '😭', '😱', '🥺', '😡', '🤯', '🤲', '👏', '🙌', '💪', '🤝', '👌', '✌️', '🙈', '🤦', '🤷', '🔥', '✨', '🎉', '💯', '✅', '❌', '👀', '🌹', '💔', '🤍', '💙', '💚', '☕', '🍕', '⚽', '🌙'];

async function rxOpenRow(row) {
  const pub = await senderPub({ sender_device: row.sender_device, sender_id: row.user_id });
  try { return (await HC.open(row, myDev, pub)).payload; }
  catch (x) { const r = window.bkOpenRow ? await bkOpenRow(row, pub).catch(() => null) : null; if (r) return r.payload; throw x; }
}
async function rxApply(row) {
  try { const p = await rxOpenRow(row), e = String(p.e || '').slice(0, 16); if (!e) return;
    if (!RX.has(row.message_id)) RX.set(row.message_id, new Map()); RX.get(row.message_id).set(row.user_id, e); } catch {}
}
function rxPaint(id) { const el = $(`.m[data-id="${id}"]`), m = msgsById.get(id); if (el && m) paintMsg(el, m); }
async function rxLoad(convId, rows) {   // when a chat opens: the reactions of the messages on screen
  const ids = rows.filter(m => m.id > 0 && !m.deleted).map(m => m.id); if (!ids.length) return;
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await sb.from('reactions').select('*').eq('conversation_id', convId).in('message_id', ids.slice(i, i + 150));
    if (error || !current || current.id !== convId) return; await Promise.all((data || []).map(rxApply));
  }
  ids.forEach(id => RX.has(id) && rxPaint(id));
}
async function rxOn(p) {   // someone reacted (live)
  if (!p || !current || current.id !== p.c || !msgsById.has(p.m)) return;
  if (p.del) { const x = RX.get(p.m); if (x) x.delete(p.u); return rxPaint(p.m); }
  const { data } = await sb.from('reactions').select('*').eq('message_id', p.m).eq('user_id', p.u).maybeSingle();
  if (data) { await rxApply(data); rxPaint(p.m); }
}
async function rxSet(m, emoji) {   // my reaction: tap the same emoji again to take it back
  const c = current; if (!c || !m || m.id <= 0) return; if (!RX.has(m.id)) RX.set(m.id, new Map());
  const map = RX.get(m.id), before = map.get(me.id);
  if (before === emoji) { map.delete(me.id); rxPaint(m.id); const { error } = await sb.from('reactions').delete().eq('message_id', m.id).eq('user_id', me.id); if (error) { map.set(me.id, before); rxPaint(m.id); toast(errText(error)); } return; }
  map.set(me.id, emoji); rxPaint(m.id);
  try {
    const { devs } = await recipients(c), box = await HC.seal({ e: emoji }, myDev, devs);
    const { error } = await sb.from('reactions').upsert({ message_id: m.id, user_id: me.id, conversation_id: c.id, ct: box.ct, iv: box.iv, keys: box.keys, sender_device: myDev.id, updated_at: new Date().toISOString() }, { onConflict: 'message_id,user_id' });
    if (error) throw error;
  } catch (x) { if (before) map.set(me.id, before); else map.delete(me.id); rxPaint(m.id); toast(errText(x)); }
}
function rxHtml(m) {   // the little pill under a bubble
  const x = RX.get(m.id); if (!x || !x.size || m.deleted) return '';
  const count = new Map(); for (const e of x.values()) count.set(e, (count.get(e) || 0) + 1);
  const mine = x.get(me.id), top = [...count].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return `<button type="button" class="rx${mine ? ' has-mine' : ''}" data-rx="${m.id}" aria-label="${esc(t('rxWho'))}">${top.map(([e]) => `<span>${e}</span>`).join('')}${x.size > 1 ? `<b>${x.size}</b>` : ''}</button>`;
}
function rxWho(id) {   // who reacted with what; my own row takes it back
  const m = msgsById.get(id), x = RX.get(id); if (!m || !x || !x.size) return;
  const rows = [...x].sort((a, b) => (b[0] === me.id) - (a[0] === me.id)).map(([u, e]) => u === me.id
    ? `<button value="mine" class="sheet-opt rx-row">${avatarHtml(u, { cls: 'sm' })}<span><b>${t('you')}</b><small>${t('rxTapRemove')}</small></span><i>${e}</i></button>`
    : `<div class="sheet-opt rx-row">${avatarHtml(u, { cls: 'sm' })}<span><b>${esc(nameOf(u))}</b></span><i>${e}</i></div>`).join('');
  dialog(`<div class="sheet-head"><b>${t('rxWho')}</b><span class="muted">${x.size}</span></div>${rows}`, v => { if (v === 'mine') rxSet(m, x.get(me.id)); });
  sheetize();
}
$('#msgs').addEventListener('click', e => { const b = e.target.closest('[data-rx]'); if (!b) return; e.stopPropagation(); rxWho(+b.dataset.rx); }, true);

// ---------- the long-press menu ----------
let mmOpen = null;
function closeMsgMenu(now) {
  const w = mmOpen; if (!w) return; mmOpen = null; document.removeEventListener('keydown', mmKey);
  if (w.held) w.held.classList.remove('held'); w.classList.remove('open');
  if (now) w.remove(); else setTimeout(() => w.remove(), 180);
}
const mmKey = e => { if (e.key === 'Escape') closeMsgMenu(); };
function openMsgMenu(el) {
  const m = msgsById.get(+el.dataset.id); if (!m || m.deleted || m.pending) return;
  closeMsgMenu(true); if (navigator.vibrate) navigator.vibrate(15); holdAt = Date.now();
  const r = plain.get(m.id + ':' + m.iv) || {}, mine = m.sender_id === me.id, myE = RX.get(m.id) && RX.get(m.id).get(me.id), canReact = m.id > 0 && !r.fail;
  const acts = [], a = (k, icon, label, cls = '') => acts.push(`<button type="button" data-mm="${k}" class="${cls}"><span>${label}</span>${ic(icon)}</button>`);
  a('reply', 'reply', t('reply'));
  if (m.kind === 'text' && !r.fail) a('copy', 'copy', t('copy'));
  if (mine && m.kind === 'text' && !r.fail) a('edit', 'edit', t('edit'));
  if (m.expires_at && m.id > 0) a('keep', m.kept ? 'kept' : 'save', t(m.kept ? 'unkeep' : 'keep'));
  if (m.kind === 'sticker') a('savestk', 'save', t('saveSticker')); else if (m.kind === 'image' && m.enc === 1) a('mkstk', 'smile', t('makeSticker'));
  if (mine && m.id > 0) a('info', 'info', mi('info'));
  if (mine) a('del', 'trash', t('del'), 'danger');
  const w = document.createElement('div'); w.className = 'mm'; w.held = el;
  w.innerHTML = `<div class="mm-bg"></div><div class="mm-box${mine ? ' mine' : ''}">${canReact ? `<div class="mm-emo">${RX_QUICK.map(e => `<button type="button" data-e="${e}"${e === myE ? ' class="on"' : ''}>${e}</button>`).join('')}<button type="button" class="mm-more" data-more aria-label="${esc(t('rxMore'))}">${ic('plus')}</button></div>` : ''}<div class="mm-msg"></div><div class="mm-act">${acts.join('')}</div></div>`;
  const rect = el.getBoundingClientRect(), clone = el.cloneNode(true);
  clone.classList.remove('held', 'show', 'flash', 'sw-reply', 'sw-info'); clone.querySelector('.tools')?.remove(); clone.querySelector('.rx')?.remove();
  clone.style.cssText = `transform:none;transition:none;width:${rect.width}px;max-width:${rect.width}px;margin:0`; w.querySelector('.mm-msg').appendChild(clone);
  document.body.appendChild(w); mmOpen = w; el.classList.add('held'); document.addEventListener('keydown', mmKey);
  const box = w.querySelector('.mm-box'), place = () => {   // the bubble stays where it was; the whole card is pushed inside the screen when needed
    const emo = box.querySelector('.mm-emo'), up = emo ? emo.offsetHeight + 8 : 0, h = box.offsetHeight, pad = 12;
    const topSafe = pad + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0);
    box.style.top = Math.max(topSafe, Math.min(rect.top - up, innerHeight - h - pad - 8)) + 'px'; };
  place(); requestAnimationFrame(() => w.classList.add('open'));
  w.addEventListener('click', e => {
    if (e.target.classList.contains('mm-bg')) return closeMsgMenu();
    const eb = e.target.closest('[data-e]'); if (eb) { closeMsgMenu(); return rxSet(m, eb.dataset.e); }
    if (e.target.closest('[data-more]')) { const emo = box.querySelector('.mm-emo'); emo.classList.add('all');
      emo.innerHTML = [...RX_QUICK, ...RX_MORE].map(x => `<button type="button" data-e="${x}"${x === myE ? ' class="on"' : ''}>${x}</button>`).join(''); place(); return; }
    const ab = e.target.closest('[data-mm]'); if (ab) { closeMsgMenu(); return msgAct(ab.dataset.mm, m, el); }
  });
}
