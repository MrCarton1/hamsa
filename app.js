// همسة · chat app. Data lives in Supabase; every read and write is checked by the database rules (setup.sql).
const sb = supabase.createClient(HAMSA.url, HAMSA.key);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = ['#00a884', '#53bdeb', '#e26a6a', '#f2a541', '#a77bf3', '#e66aa8', '#3fb6a8', '#7f9cf5'];
const colorOf = id => COLORS[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const avatar = (el, name, id) => { el.textContent = (name || '؟').trim().charAt(0); el.style.background = colorOf(id || name); };
const toast = t => { const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, 3200); };
const fmtTime = d => new Date(d).toLocaleTimeString('ar', { hour: 'numeric', minute: '2-digit' });
const fmtDay = d => { const x = new Date(d), t = new Date(); const y = new Date(t); y.setDate(t.getDate() - 1);
  return x.toDateString() === t.toDateString() ? 'اليوم' : x.toDateString() === y.toDateString() ? 'أمس' : x.toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' }); };
const short = d => { const x = new Date(d); return x.toDateString() === new Date().toDateString() ? fmtTime(d) : x.toLocaleDateString('ar', { day: 'numeric', month: 'numeric' }); };
const errText = e => { const m = (e && (e.message || e.error_description)) || String(e);
  if (/Invalid login/i.test(m)) return 'اسم المستخدم أو كلمة السر غلط';
  if (/already registered|already exists|duplicate|Database error saving/i.test(m)) return 'اسم المستخدم هذا مأخوذ، اختر غيره';
  if (/Password should be/i.test(m)) return 'كلمة السر لازم تكون 6 حروف أو أكثر';
  if (/rate limit/i.test(m)) return 'محاولات كثيرة، انتظر شوي وجرب';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'ما فيه اتصال بالإنترنت';
  return m; };

let me = null, profiles = new Map(), convs = [], members = new Map(), current = null, replyTo = null, msgsById = new Map(), urlCache = new Map();

// ---------- theme ----------
try { const t = localStorage.getItem('hamsa-theme'); if (t) document.documentElement.dataset.theme = t; } catch {}
$('#themeBtn').onclick = () => { const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = t; try { localStorage.setItem('hamsa-theme', t); } catch {} };

// ---------- sign in / sign up ----------
let mode = 'in';
const setMode = m => { mode = m; document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  $('.auth-card').classList.toggle('in', m === 'in'); $('#authBtn').textContent = m === 'in' ? 'دخول' : 'إنشاء الحساب'; $('#fPass').autocomplete = m === 'in' ? 'current-password' : 'new-password'; $('#authMsg').textContent = ''; };
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => setMode(b.dataset.mode)); setMode('in');
$('#authForm').onsubmit = async e => {
  e.preventDefault(); const u = $('#fUser').value.trim().toLowerCase(), p = $('#fPass').value, name = $('#fName').value.trim(), msg = $('#authMsg'), btn = $('#authBtn');
  if (!/^[a-z0-9_]{3,20}$/.test(u)) return msg.textContent = 'اسم المستخدم: من 3 إلى 20 حرف إنجليزي صغير أو رقم أو _';
  const email = `${u}@${HAMSA.emailDomain}`; btn.disabled = true; msg.textContent = '';
  try {
    if (mode === 'up') {
      if (!name) throw new Error('اكتب اسمك');
      const { error } = await sb.auth.signUp({ email, password: p, options: { data: { username: u, display_name: name } } }); if (error) throw error;
      const s = await sb.auth.getSession(); if (!s.data.session) { const r = await sb.auth.signInWithPassword({ email, password: p }); if (r.error) throw r.error; }
    } else { const { error } = await sb.auth.signInWithPassword({ email, password: p }); if (error) throw error; }
  } catch (x) { msg.textContent = errText(x); } finally { btn.disabled = false; }
};
$('#logoutBtn').onclick = async () => { if (confirm('تبي تسجل خروج؟')) await sb.auth.signOut(); };

sb.auth.onAuthStateChange((ev, session) => { setTimeout(() => session ? start(session.user) : stop(), 0); });

async function start(user) {
  if (me && me.id === user.id) return;
  let p = null; for (let i = 0; i < 5 && !p; i++) { ({ data: p } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle()); if (!p) await new Promise(r => setTimeout(r, 600)); }
  if (!p) { toast('ما لقيت ملفك الشخصي'); return; }
  me = p; profiles.set(p.id, p);
  $('#auth').hidden = true; $('#app').hidden = false;
  $('#meName').textContent = p.display_name; $('#meUser').textContent = '@' + p.username; avatar($('#meAvatar'), p.display_name, p.id);
  await Promise.all([loadChats(), loadFriends()]); await live();
}
function stop() { me = null; current = null; convs = []; profiles.clear(); members.clear(); sb.removeAllChannels(); $('#app').hidden = true; $('#auth').hidden = false; $('#room').hidden = true; $('#empty').hidden = false; }

// ---------- people ----------
async function needProfiles(ids) {
  const miss = [...new Set(ids)].filter(i => i && !profiles.has(i)); if (!miss.length) return;
  const { data } = await sb.from('profiles').select('*').in('id', miss); (data || []).forEach(p => profiles.set(p.id, p));
}
const nameOf = id => (profiles.get(id) || {}).display_name || '…';

// ---------- chats list ----------
async function loadChats() {
  const { data: mine, error } = await sb.from('members').select('conversation_id,last_read,conversations(id,is_group,name,last_at)').eq('user_id', me.id);
  if (error) return toast(errText(error));
  const ids = (mine || []).map(m => m.conversation_id);
  members.clear();
  if (ids.length) { const { data: all } = await sb.from('members').select('conversation_id,user_id,role').in('conversation_id', ids);
    (all || []).forEach(m => { if (!members.has(m.conversation_id)) members.set(m.conversation_id, []); members.get(m.conversation_id).push(m); });
    await needProfiles((all || []).map(m => m.user_id)); }
  convs = await Promise.all((mine || []).filter(m => m.conversations).map(async m => {
    const c = { ...m.conversations, last_read: m.last_read };
    const { data: last } = await sb.from('messages').select('id,sender_id,kind,body,deleted,created_at').eq('conversation_id', c.id).order('id', { ascending: false }).limit(1);
    c.last = last && last[0];
    const { count } = await sb.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', c.id).neq('sender_id', me.id).gt('created_at', c.last_read);
    c.unread = current && current.id === c.id ? 0 : count || 0; return c; }));
  convs.sort((a, b) => new Date((b.last && b.last.created_at) || b.last_at) - new Date((a.last && a.last.created_at) || a.last_at));
  renderChats();
}
const convTitle = c => c.is_group ? c.name : nameOf(((members.get(c.id) || []).find(m => m.user_id !== me.id) || {}).user_id);
const preview = m => !m ? 'ابدأ المحادثة' : m.deleted ? '🚫 رسالة محذوفة' : m.kind === 'image' ? '📷 صورة' : m.kind === 'voice' ? '🎤 رسالة صوتية' : m.body;
function renderChats() {
  const q = $('#search').value.trim().toLowerCase(), list = $('#chatList');
  const shown = convs.filter(c => !q || convTitle(c).toLowerCase().includes(q));
  list.innerHTML = shown.map(c => { const t = convTitle(c), other = c.is_group ? c.id : ((members.get(c.id) || []).find(m => m.user_id !== me.id) || {}).user_id;
    const who = c.is_group && c.last && !c.last.deleted ? (c.last.sender_id === me.id ? 'أنت: ' : nameOf(c.last.sender_id) + ': ') : c.last && c.last.sender_id === me.id ? '✓ ' : '';
    return `<li data-c="${c.id}" class="${current && current.id === c.id ? 'on' : ''}"><span class="av" style="background:${colorOf(other)}">${c.is_group ? '👥' : esc(t.charAt(0))}</span>
<div class="mid"><b>${esc(t)}</b><small>${esc(who + preview(c.last))}</small></div><div class="end">${c.last ? short(c.last.created_at) : ''}${c.unread ? `<br><span class="pill">${c.unread}</span>` : ''}</div></li>`; }).join('')
    || `<p class="hint" style="padding:18px">${q ? 'ما فيه نتائج' : 'ما عندك محادثات للحين. روح «الأصدقاء» وأضف صديق.'}</p>`;
  const u = convs.reduce((a, c) => a + c.unread, 0); $('#unreadAll').hidden = !u; $('#unreadAll').textContent = u;
}
$('#search').oninput = renderChats;
$('#chatList').onclick = e => { const li = e.target.closest('li[data-c]'); if (li) openChat(li.dataset.c); };
document.querySelectorAll('.seg button').forEach(b => b.onclick = () => { document.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x === b));
  $('#chatsView').hidden = b.dataset.view !== 'chats'; $('#friendsView').hidden = b.dataset.view !== 'friends'; });

// ---------- friends ----------
let friends = [];
async function loadFriends() {
  const { data } = await sb.from('friendships').select('*').order('created_at', { ascending: false }); friends = data || [];
  await needProfiles(friends.flatMap(f => [f.requester, f.addressee]));
  const other = f => f.requester === me.id ? f.addressee : f.requester, row = (id, extra) => { const p = profiles.get(id) || {};
    return `<div class="frow"><span class="av" style="background:${colorOf(id)}">${esc((p.display_name || '؟').charAt(0))}</span><div class="mid"><b>${esc(p.display_name)}</b><small dir="ltr">@${esc(p.username)}</small></div>${extra}</div>`; };
  const inc = friends.filter(f => f.status === 'pending' && f.addressee === me.id), out = friends.filter(f => f.status === 'pending' && f.requester === me.id), acc = friends.filter(f => f.status === 'accepted');
  $('#friendsBox').innerHTML = (inc.length ? '<div class="sec">طلبات صداقة لك</div>' + inc.map(f => row(f.requester, `<button class="btn small primary" data-acc="${f.id}">قبول</button><button class="btn small danger" data-dec="${f.id}">رفض</button>`)).join('') : '')
    + '<div class="sec">أصدقائي</div>' + (acc.map(f => row(other(f), `<button class="btn small primary" data-dm="${other(f)}">مراسلة</button><button class="btn small danger" data-rm="${f.id}" title="حذف الصديق">✕</button>`)).join('') || '<p class="hint">ما عندك أصدقاء للحين. اكتب اسم مستخدم صديقك فوق.</p>')
    + (out.length ? '<div class="sec">طلبات أرسلتها</div>' + out.map(f => row(f.addressee, `<button class="btn small" data-rm="${f.id}">إلغاء</button>`)).join('') : '');
  $('#reqCount').hidden = !inc.length; $('#reqCount').textContent = inc.length;
}
$('#addFriend').onsubmit = async e => {
  e.preventDefault(); const u = $('#addUser').value.trim().toLowerCase().replace(/^@/, ''), msg = $('#addMsg'); msg.textContent = '';
  if (!u) return; if (u === me.username) return msg.textContent = 'هذا أنت 🙂';
  const { data: p } = await sb.from('profiles').select('*').eq('username', u).maybeSingle();
  if (!p) return msg.textContent = 'ما فيه أحد بهذا الاسم';
  profiles.set(p.id, p);
  const ex = friends.find(f => (f.requester === p.id && f.addressee === me.id) || (f.requester === me.id && f.addressee === p.id));
  if (ex && ex.status === 'accepted') return msg.textContent = 'هو صديقك من قبل';
  if (ex && ex.requester === p.id) { await sb.rpc('respond_friend', { fid: ex.id, accept: true }); msg.textContent = 'كان أرسل لك طلب، وقبلته ✅'; }
  else if (ex) return msg.textContent = 'أرسلت له طلب من قبل، انتظر يقبله';
  else { const { error } = await sb.from('friendships').insert({ addressee: p.id }); if (error) return msg.textContent = errText(error); msg.textContent = `أرسلت طلب صداقة لـ ${p.display_name} ✅`; }
  $('#addUser').value = ''; loadFriends();
};
$('#friendsBox').onclick = async e => { const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.acc) await sb.rpc('respond_friend', { fid: +b.dataset.acc, accept: true });
  if (b.dataset.dec) await sb.rpc('respond_friend', { fid: +b.dataset.dec, accept: false });
  if (b.dataset.rm) { if (!confirm('متأكد؟')) return; await sb.from('friendships').delete().eq('id', +b.dataset.rm); }
  if (b.dataset.dm) { const { data, error } = await sb.rpc('start_dm', { other: b.dataset.dm }); if (error) return toast(errText(error)); await loadChats(); document.querySelector('.seg button[data-view=chats]').click(); return openChat(data); }
  loadFriends(); };

// ---------- groups ----------
$('#newGroupBtn').onclick = () => {
  const acc = friends.filter(f => f.status === 'accepted').map(f => f.requester === me.id ? f.addressee : f.requester);
  if (!acc.length) return toast('أضف أصدقاء أول، بعدين سوّ قروب');
  dialog(`<h3>قروب جديد</h3><input id="gName" placeholder="اسم القروب" maxlength="60"><div class="sec" style="padding:10px 0 4px">اختر الأعضاء</div><div class="scroll">${acc.map(id => `<label class="chk"><input type="checkbox" value="${id}"> ${esc(nameOf(id))}</label>`).join('')}</div>
<div class="row"><button value="x" class="btn">إلغاء</button><button value="ok" class="btn primary">إنشاء</button></div>`, async () => {
    const name = $('#gName').value.trim(), ids = [...document.querySelectorAll('#dlgBody input[type=checkbox]:checked')].map(i => i.value);
    if (!name) return toast('اكتب اسم القروب'); const { data, error } = await sb.rpc('create_group', { gname: name, member_ids: ids }); if (error) return toast(errText(error));
    await loadChats(); openChat(data); });
};
function dialog(html, onOk) { const d = $('#dlg'); $('#dlgBody').innerHTML = html; d.onclose = () => { if (d.returnValue === 'ok' && onOk) onOk(); }; d.returnValue = ''; d.showModal(); }
$('#infoBtn').onclick = () => {
  if (!current) return; const ms = members.get(current.id) || [], admin = ms.some(m => m.user_id === me.id && m.role === 'admin');
  const addable = friends.filter(f => f.status === 'accepted').map(f => f.requester === me.id ? f.addressee : f.requester).filter(id => !ms.some(m => m.user_id === id));
  dialog(`<h3>${esc(convTitle(current))}</h3><div class="scroll">${ms.map(m => `<div class="frow" style="padding:6px 0"><span class="av" style="background:${colorOf(m.user_id)}">${esc(nameOf(m.user_id).charAt(0))}</span><div class="mid"><b>${esc(nameOf(m.user_id))}${m.user_id === me.id ? ' (أنت)' : ''}</b><small dir="ltr">@${esc((profiles.get(m.user_id) || {}).username)}${m.role === 'admin' ? ' · مشرف' : ''}</small></div></div>`).join('')}</div>
${current.is_group && admin && addable.length ? `<div class="sec" style="padding:10px 0 4px">إضافة أعضاء</div>${addable.map(id => `<label class="chk"><input type="checkbox" value="${id}"> ${esc(nameOf(id))}</label>`).join('')}` : ''}
<div class="row">${current.is_group ? '<button value="leave" class="btn danger">مغادرة القروب</button>' : ''}<button value="x" class="btn">إغلاق</button>${current.is_group && admin && addable.length ? '<button value="ok" class="btn primary">إضافة</button>' : ''}</div>`, async () => {
    for (const i of document.querySelectorAll('#dlgBody input[type=checkbox]:checked')) await sb.rpc('add_to_group', { c: current.id, uid: i.value });
    await loadChats(); openChat(current.id); });
  const d = $('#dlg'), prev = d.onclose; d.onclose = async () => { if (d.returnValue === 'leave') { if (!confirm('تبي تطلع من القروب؟')) return; await sb.from('members').delete().eq('conversation_id', current.id).eq('user_id', me.id); closeChat(); loadChats(); } else prev(); };
};

// ---------- a chat ----------
async function openChat(id) {
  const c = convs.find(x => x.id === id); if (!c) return;
  current = c; c.unread = 0; replyTo = null; $('#replyBox').hidden = true; msgsById.clear();
  $('#empty').hidden = true; $('#room').hidden = false; $('#app').classList.add('open');
  const t = convTitle(c); $('#roomName').textContent = t; $('#roomAv').textContent = c.is_group ? '👥' : t.charAt(0);
  $('#roomAv').style.background = colorOf(c.is_group ? c.id : ((members.get(c.id) || []).find(m => m.user_id !== me.id) || {}).user_id);
  $('#roomSub').textContent = c.is_group ? (members.get(c.id) || []).map(m => m.user_id === me.id ? 'أنت' : nameOf(m.user_id)).join('، ') : '@' + ((profiles.get(((members.get(c.id) || []).find(m => m.user_id !== me.id) || {}).user_id) || {}).username || '');
  renderChats(); $('#msgs').innerHTML = '<div class="day">جاري التحميل…</div>';
  const { data, error } = await sb.from('messages').select('*').eq('conversation_id', id).order('id', { ascending: false }).limit(150);
  if (current !== c) return; if (error) return toast(errText(error));
  $('#msgs').innerHTML = ''; (data || []).reverse().forEach(m => addMsg(m)); scrollDown(); markRead(); $('#text').focus();
}
function closeChat() { current = null; $('#app').classList.remove('open'); $('#room').hidden = true; $('#empty').hidden = false; renderChats(); }
$('#backBtn').onclick = closeChat;
const scrollDown = () => { const b = $('#msgs'); b.scrollTop = b.scrollHeight; };
async function markRead() { if (!current) return; const now = new Date().toISOString(); current.last_read = now; await sb.from('members').update({ last_read: now }).eq('conversation_id', current.id).eq('user_id', me.id); }

function msgHtml(m) {
  const mine = m.sender_id === me.id, q = m.reply_to && msgsById.get(m.reply_to);
  let body = m.deleted ? '🚫 تم حذف هذه الرسالة' : m.kind === 'text' ? esc(m.body) : '';
  if (!m.deleted && m.kind === 'image') body = `<img data-media="${esc(m.media_path)}" alt="صورة">` + (m.body ? `<div>${esc(m.body)}</div>` : '');
  if (!m.deleted && m.kind === 'voice') body = `<audio controls preload="none" data-media="${esc(m.media_path)}"></audio>`;
  return `${current.is_group && !mine ? `<div class="who" style="color:${colorOf(m.sender_id)}">${esc(nameOf(m.sender_id))}</div>` : ''}
${q ? `<div class="q" data-jump="${q.id}"><b>${esc(q.sender_id === me.id ? 'أنت' : nameOf(q.sender_id))}</b>: ${esc(q.deleted ? 'رسالة محذوفة' : preview(q))}</div>` : ''}
<div class="body">${body}</div><div class="meta">${m.edited_at && !m.deleted ? 'معدّلة · ' : ''}${fmtTime(m.created_at)}</div>
${m.deleted ? '' : `<div class="tools"><button data-act="reply" title="رد">↩</button>${mine && m.kind === 'text' ? '<button data-act="edit" title="تعديل">✏️</button>' : ''}${mine ? '<button data-act="del" title="حذف">🗑</button>' : ''}${m.kind === 'text' ? '<button data-act="copy" title="نسخ">📋</button>' : ''}</div>`}`;
}
let lastDay = '';
function addMsg(m) {
  const box = $('#msgs'), day = fmtDay(m.created_at);
  if (!box.lastElementChild || box.dataset.lastDay !== day) { box.insertAdjacentHTML('beforeend', `<div class="day">${day}</div>`); box.dataset.lastDay = day; }
  msgsById.set(m.id, m); const el = document.createElement('div'); el.className = 'm' + (m.sender_id === me.id ? ' mine' : '') + (m.deleted ? ' del' : ''); el.dataset.id = m.id; el.innerHTML = msgHtml(m);
  box.appendChild(el); loadMedia(el);
}
function updateMsg(m) { msgsById.set(m.id, m); const el = document.querySelector(`.m[data-id="${m.id}"]`); if (!el) return; el.className = 'm' + (m.sender_id === me.id ? ' mine' : '') + (m.deleted ? ' del' : ''); el.innerHTML = msgHtml(m); loadMedia(el); }
async function signed(path) { if (urlCache.has(path)) return urlCache.get(path); const { data } = await sb.storage.from('media').createSignedUrl(path, 3600); const u = data && data.signedUrl; if (u) urlCache.set(path, u); return u; }
function loadMedia(el) { el.querySelectorAll('[data-media]').forEach(async x => { const u = await signed(x.dataset.media); if (u) { x.src = u; if (x.tagName === 'IMG') x.onload = () => { const b = $('#msgs'); if (b.scrollHeight - b.scrollTop - b.clientHeight < 400) scrollDown(); }; } }); }

$('#msgs').onclick = async e => {
  const m = e.target.closest('.m'); if (!m) return; const msg = msgsById.get(+m.dataset.id);
  document.querySelectorAll('.m.show').forEach(x => x !== m && x.classList.remove('show')); m.classList.toggle('show');
  const jump = e.target.closest('[data-jump]'); if (jump) { const t = document.querySelector(`.m[data-id="${jump.dataset.jump}"]`); if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1500); } return; }
  if (e.target.tagName === 'IMG' && e.target.src) { const v = document.createElement('div'); v.className = 'viewer'; v.innerHTML = `<img src="${e.target.src}">`; v.onclick = () => v.remove(); document.body.appendChild(v); return; }
  const act = e.target.closest('[data-act]'); if (!act || !msg) return; const a = act.dataset.act;
  if (a === 'reply') { replyTo = msg; $('#replyText').textContent = (msg.sender_id === me.id ? 'أنت' : nameOf(msg.sender_id)) + ': ' + preview(msg); $('#replyBox').hidden = false; $('#text').focus(); }
  if (a === 'copy') { try { await navigator.clipboard.writeText(msg.body); toast('نسخت الرسالة'); } catch {} }
  if (a === 'edit') { const t = prompt('عدّل رسالتك:', msg.body); if (t == null || !t.trim() || t === msg.body) return;
    const { error } = await sb.from('messages').update({ body: t.trim(), edited_at: new Date().toISOString() }).eq('id', msg.id); if (error) toast(errText(error)); }
  if (a === 'del') { if (!confirm('تحذف الرسالة عند الكل؟')) return; const { error } = await sb.from('messages').update({ deleted: true, body: null }).eq('id', msg.id); if (error) toast(errText(error)); }
};
$('#replyX').onclick = () => { replyTo = null; $('#replyBox').hidden = true; };

// ---------- sending ----------
const ta = $('#text');
ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; };
ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !/Mobi/.test(navigator.userAgent)) { e.preventDefault(); $('#composer').requestSubmit(); } };
async function send(row) {
  if (!current) return; const r = { conversation_id: current.id, reply_to: replyTo ? replyTo.id : null, ...row };
  replyTo = null; $('#replyBox').hidden = true;
  const { data, error } = await sb.from('messages').insert(r).select().single(); if (error) return toast('ما انرسلت: ' + errText(error));
  if (!msgsById.has(data.id) && current && current.id === data.conversation_id) { addMsg(data); scrollDown(); }
  bumpConv(data);
}
$('#composer').onsubmit = e => { e.preventDefault(); const t = ta.value.trim(); if (!t) return; ta.value = ''; ta.oninput(); send({ kind: 'text', body: t }); };
async function upload(blob, ext, type) {
  const path = `${current.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('media').upload(path, blob, { contentType: type }); if (error) throw error; return path;
}
$('#attachBtn').onclick = () => $('#fileIn').click();
$('#fileIn').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f || !current) return;
  if (f.size > 10 * 1024 * 1024) return toast('الصورة أكبر من 10 ميجا');
  toast('جاري إرسال الصورة…');
  try { const img = await shrink(f), path = await upload(img.blob, img.ext, img.type); await send({ kind: 'image', media_path: path }); } catch (x) { toast('ما انرسلت الصورة: ' + errText(x)); } };
async function shrink(f) {   // big photos are resized to save the free storage
  if (!/image\/(png|jpeg|webp)/.test(f.type)) return { blob: f, ext: (f.type.split('/')[1] || 'png'), type: f.type };
  const bmp = await createImageBitmap(f), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .85)); return { blob, ext: 'jpg', type: 'image/jpeg' };
}
// voice notes: tap to start, tap again to send
let rec = null, chunks = [];
$('#micBtn').onclick = async () => {
  if (rec) { rec.stop(); return; }
  if (!current) return;
  try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined); chunks = []; const conv = current.id, started = Date.now();
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = async () => { stream.getTracks().forEach(t => t.stop()); $('#micBtn').classList.remove('rec'); $('#micBtn').textContent = '🎤'; const r = rec; rec = null;
      if (Date.now() - started < 800 || !current || current.id !== conv) return;
      const base = (r.mimeType || 'audio/webm').split(';')[0], ext = base.includes('mp4') ? 'm4a' : base.includes('ogg') ? 'ogg' : 'webm';
      try { toast('جاري إرسال الرسالة الصوتية…'); const path = await upload(new Blob(chunks, { type: base }), ext, base); await send({ kind: 'voice', media_path: path }); } catch (x) { toast('ما انرسلت: ' + errText(x)); } };
    rec.start(); $('#micBtn').classList.add('rec'); $('#micBtn').textContent = '⏹'; toast('يسجل الحين… اضغط ⏹ للإرسال');
  } catch { toast('اسمح للمتصفح يستخدم المايك'); }
};

// ---------- live updates ----------
function bumpConv(m) { const c = convs.find(x => x.id === m.conversation_id); if (!c) return loadChats();
  c.last = m; if (!(current && current.id === c.id) && m.sender_id !== me.id) c.unread++;
  convs.sort((a, b) => new Date((b.last && b.last.created_at) || b.last_at) - new Date((a.last && a.last.created_at) || a.last_at)); renderChats(); }
async function live() {
  await sb.removeAllChannels();   // must finish first, or it also removes the new channel
  sb.channel('hamsa-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async ({ new: m }) => {
      await needProfiles([m.sender_id]);
      if (current && current.id === m.conversation_id && !msgsById.has(m.id)) { const b = $('#msgs'), near = b.scrollHeight - b.scrollTop - b.clientHeight < 200; addMsg(m); if (near || m.sender_id === me.id) scrollDown(); if (!document.hidden) markRead(); }
      bumpConv(m);
      if (m.sender_id !== me.id && document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification(nameOf(m.sender_id), { body: preview(m), icon: 'icon.svg' });
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, ({ new: m }) => { if (current && current.id === m.conversation_id) updateMsg(m); const c = convs.find(x => x.id === m.conversation_id); if (c && c.last && c.last.id === m.id) { c.last = m; renderChats(); } })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => loadFriends())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'members', filter: `user_id=eq.${me.id}` }, () => loadChats())
    .subscribe();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && current) markRead(); });
document.addEventListener('click', () => { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }, { once: true });

// first screen
sb.auth.getSession().then(({ data }) => { if (!data.session) { $('#auth').hidden = false; } });
