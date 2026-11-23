// همسة · chat app. Data lives in Supabase; every read and write is checked by the database rules (setup.sql).
const sb = supabase.createClient(HAMSA.url, HAMSA.key);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = ['#00a884', '#53bdeb', '#e26a6a', '#f2a541', '#a77bf3', '#e66aa8', '#3fb6a8', '#7f9cf5'];
const colorOf = id => COLORS[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const avatar = (el, name, id) => { el.textContent = (name || '؟').trim().charAt(0); el.style.background = colorOf(id || name); };
const toast = t => { const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, Math.max(3200, t.length * 60)); };
const fmtTime = d => new Date(d).toLocaleTimeString('ar', { hour: 'numeric', minute: '2-digit' });
const fmtDay = d => { const x = new Date(d), t = new Date(); const y = new Date(t); y.setDate(t.getDate() - 1);
  return x.toDateString() === t.toDateString() ? 'اليوم' : x.toDateString() === y.toDateString() ? 'أمس' : x.toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' }); };
const short = d => { const x = new Date(d); return x.toDateString() === new Date().toDateString() ? fmtTime(d) : x.toLocaleDateString('ar', { day: 'numeric', month: 'numeric' }); };
// our own Arabic messages pass through; every other error becomes a generic message (the details go to the console only)
const uiErr = t => Object.assign(new Error(t), { ui: true });
const errText = e => { if (e && e.ui) return e.message; const m = (e && (e.message || e.error_description)) || String(e); console.error(e);
  if (/Invalid login/i.test(m)) return 'اسم المستخدم أو كلمة السر غلط';
  if (/already registered|already exists|duplicate|Database error saving/i.test(m)) return 'اسم المستخدم هذا مأخوذ، اختر غيره';
  if (/Password should be/i.test(m)) return 'كلمة السر لازم تكون 8 حروف أو أكثر';
  if (/rate limit/i.test(m)) return 'محاولات كثيرة، انتظر شوي وجرب';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'ما فيه اتصال بالإنترنت';
  return 'صار خطأ، جرب مرة ثانية'; };

let me = null, nicks = new Map(), myPres = { visible: true, receipts: true }, profiles = new Map(), convs = [], members = new Map(), current = null, replyTo = null, msgsById = new Map(), urlCache = new Map();

// ---------- theme ----------
try { const t = localStorage.getItem('hamsa-theme'); if (t) document.documentElement.dataset.theme = t; } catch {}
const setTheme = t => { document.documentElement.dataset.theme = t; try { localStorage.setItem('hamsa-theme', t); } catch {} };

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
      if (!name) throw uiErr('اكتب اسمك');
      if (name.length > 40) throw uiErr('الاسم أطول من 40 حرف');
      if (p.length < 8) throw uiErr('كلمة السر لازم تكون 8 حروف أو أكثر');
      const { error } = await sb.auth.signUp({ email, password: p, options: { data: { username: u, display_name: name } } }); if (error) throw error;
      const s = await sb.auth.getSession(); if (!s.data.session) { const r = await sb.auth.signInWithPassword({ email, password: p }); if (r.error) throw r.error; }
    } else { const { error } = await sb.auth.signInWithPassword({ email, password: p }); if (error) throw error; }
  } catch (x) { msg.textContent = errText(x); } finally { btn.disabled = false; }
};
async function logout() { if (!confirm('تبي تسجل خروج؟')) return; await sb.rpc('touch_presence', { c: null, on_line: false });
  try { const reg = await navigator.serviceWorker?.getRegistration(), sub = reg && await reg.pushManager.getSubscription(); if (sub) { await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); } } catch {}
  await sb.auth.signOut(); }

let accessToken = null;
sb.auth.onAuthStateChange((ev, session) => { accessToken = session ? session.access_token : null; setTimeout(() => session ? start(session.user) : stop(), 0); });

// start() can be called twice at once (INITIAL_SESSION + SIGNED_IN). The guard stops two sets of channels and double unread counts.
let busyUid = null;
async function start(user) {
  if ((me && me.id === user.id) || busyUid === user.id) return;
  busyUid = user.id;
  try { await startNow(user); } finally { busyUid = null; }
}
async function startNow(user) {
  let p = null; for (let i = 0; i < 5 && !p; i++) { ({ data: p } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle()); if (!p) await new Promise(r => setTimeout(r, 600)); }
  if (!p) { toast('ما لقيت ملفك الشخصي'); return; }
  me = p; profiles.set(p.id, p);
  $('#auth').hidden = true; $('#app').hidden = false;
  $('#meName').textContent = p.display_name; $('#meUser').textContent = '@' + p.username; avatar($('#meAvatar'), p.display_name, p.id);
  const [{ data: nk }, { data: pr }] = await Promise.all([sb.from('contact_names').select('target,name'), sb.from('presence').select('*').eq('user_id', p.id).maybeSingle()]);
  nicks = new Map((nk || []).map(x => [x.target, x.name])); if (pr) myPres = { visible: pr.visible, receipts: pr.receipts };
  await Promise.all([loadChats(), loadFriends()]); await live(); syncClock(); viewing(false); delivered();
  const want = new URLSearchParams(location.search).get('c'); if (want && convs.some(c => c.id === want)) openChat(want);
  pushStart();
}
function stop() { me = null; nicks = new Map(); current = null; convs = []; friends = []; profiles.clear(); members.clear(); msgsById.clear(); sb.removeAllChannels(); $('#app').classList.remove('open'); $('#app').hidden = true; $('#auth').hidden = false; $('#room').hidden = true; $('#empty').hidden = false; }

// ---------- people ----------
async function needProfiles(ids) {
  const miss = [...new Set(ids)].filter(i => i && !profiles.has(i)); if (!miss.length) return;
  const { data } = await sb.from('profiles').select('*').in('id', miss); (data || []).forEach(p => profiles.set(p.id, p));
}
const nameOf = id => nicks.get(id) || (profiles.get(id) || {}).display_name || '…';

// ---------- chats list ----------
async function loadChats() {   // one database call for all chats (last message + unread count), then one for the members
  const { data: mine, error } = await sb.rpc('my_chats');
  if (error) return toast(errText(error));
  const ids = (mine || []).map(m => m.id);
  members.clear();
  if (ids.length) { const { data: all } = await sb.from('members').select('conversation_id,user_id,role,delivered_at,seen_at,last_read').in('conversation_id', ids);
    (all || []).forEach(m => { if (!members.has(m.conversation_id)) members.set(m.conversation_id, []); members.get(m.conversation_id).push(m); });
    await needProfiles((all || []).map(m => m.user_id)); }
  convs = (mine || []).map(m => ({ id: m.id, is_group: m.is_group, name: m.name, last_at: m.last_at, last_read: m.last_read,
    last: m.last_id ? { id: m.last_id, conversation_id: m.id, sender_id: m.last_sender, kind: m.last_kind, body: m.last_body, deleted: m.last_deleted, created_at: m.last_created } : null,
    unread: current && current.id === m.id ? 0 : Number(m.unread) || 0 }));
  convs.sort((a, b) => new Date((b.last && b.last.created_at) || b.last_at) - new Date((a.last && a.last.created_at) || a.last_at));
  renderChats();
}
const convTitle = c => c.is_group ? c.name : nameOf(((members.get(c.id) || []).find(m => m.user_id !== me.id) || {}).user_id);
const preview = m => !m ? 'ابدأ المحادثة' : m.deleted ? '🚫 رسالة محذوفة' : m.kind === 'image' ? '📷 صورة' : m.kind === 'voice' ? '🎤 رسالة صوتية' : m.body;
function renderChats() {
  const q = $('#search').value.trim().toLowerCase(), list = $('#chatList');
  const shown = convs.filter(c => !q || convTitle(c).toLowerCase().includes(q));
  list.innerHTML = shown.map(c => { const t = convTitle(c), other = c.is_group ? c.id : ((members.get(c.id) || []).find(m => m.user_id !== me.id) || {}).user_id;
    const mineLast = c.last && c.last.sender_id === me.id && !c.last.deleted, who = c.is_group && c.last && !c.last.deleted && !mineLast ? nameOf(c.last.sender_id) + ': ' : '';
    return `<li data-c="${c.id}" class="${current && current.id === c.id ? 'on' : ''}${c.unread ? ' unread' : ''}"><span class="av" style="background:${colorOf(other)}">${c.is_group ? '👥' : esc(t.charAt(0))}</span>
<div class="mid"><b>${esc(t)}</b><small>${mineLast ? trail(c.last, c.id) : ''}<span class="pv">${esc(who + preview(c.last))}</span></small></div><div class="end">${c.last ? short(c.last.created_at) : ''}${c.unread ? `<span class="pill">${c.unread}</span>` : ''}</div></li>`; }).join('')
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
    return `<div class="frow"><span class="av" style="background:${colorOf(id)}">${esc(nameOf(id).charAt(0))}</span><div class="mid"><b>${esc(nameOf(id))}</b><small><span dir="ltr">@${esc(p.username)}</span>${nicks.has(id) ? ' · ' + esc(p.display_name) : ''}</small></div>${extra}</div>`; };
  const inc = friends.filter(f => f.status === 'pending' && f.addressee === me.id), out = friends.filter(f => f.status === 'pending' && f.requester === me.id), acc = friends.filter(f => f.status === 'accepted');
  $('#friendsBox').innerHTML = (inc.length ? '<div class="sec">طلبات صداقة لك</div>' + inc.map(f => row(f.requester, `<button class="btn small primary" data-acc="${f.id}">قبول</button><button class="btn small danger" data-dec="${f.id}">رفض</button>`)).join('') : '')
    + '<div class="sec">أصدقائي</div>' + (acc.map(f => row(other(f), `<button class="btn small primary" data-dm="${other(f)}">مراسلة</button><button class="btn small" data-nick="${other(f)}" title="غيّر اسمه عندك">✏️</button><button class="btn small danger" data-rm="${f.id}" title="حذف الصديق">✕</button>`)).join('') || '<p class="hint">ما عندك أصدقاء للحين. اكتب اسم مستخدم صديقك فوق.</p>')
    + (out.length ? '<div class="sec">طلبات أرسلتها</div>' + out.map(f => row(f.addressee, `<button class="btn small" data-rm="${f.id}">إلغاء</button>`)).join('') : '');
  $('#reqCount').hidden = !inc.length; $('#reqCount').textContent = inc.length;
}
$('#addFriend').onsubmit = async e => {
  e.preventDefault(); const u = $('#addUser').value.trim().toLowerCase().replace(/^@/, ''), msg = $('#addMsg'); msg.textContent = '';
  if (!u) return; if (u === me.username) return msg.textContent = 'هذا أنت 🙂';
  const { data: p } = await sb.from('profiles').select('*').eq('username', u).maybeSingle();
  if (!p) return msg.textContent = 'ما قدرنا نضيف هذا الحساب، تأكد من اسم المستخدم';
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
  if (b.dataset.nick) return rename(b.dataset.nick);
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
<div class="row">${current.is_group ? '<button value="leave" class="btn danger">مغادرة القروب</button>' : '<button value="nick" class="btn">✏️ غيّر اسمه عندي</button>'}<button value="x" class="btn">إغلاق</button>${current.is_group && admin && addable.length ? '<button value="ok" class="btn primary">إضافة</button>' : ''}</div>`, async () => {
    for (const i of document.querySelectorAll('#dlgBody input[type=checkbox]:checked')) await sb.rpc('add_to_group', { c: current.id, uid: i.value });
    await loadChats(); openChat(current.id); });
  const d = $('#dlg'), prev = d.onclose; d.onclose = async () => { if (d.returnValue === 'nick') return rename(((members.get(current.id) || []).find(m => m.user_id !== me.id) || {}).user_id); if (d.returnValue === 'leave') { if (!confirm('تبي تطلع من القروب؟')) return; await sb.from('members').delete().eq('conversation_id', current.id).eq('user_id', me.id); closeChat(); loadChats(); } else prev(); };
};

// ---------- a chat ----------
async function openChat(id) {
  const c = convs.find(x => x.id === id); if (!c) return;
  current = c; c.unread = 0; replyTo = null; $('#replyBox').hidden = true; msgsById.clear();
  $('#empty').hidden = true; $('#room').hidden = false; $('#app').classList.add('open');
  const t = convTitle(c); $('#roomName').textContent = t; $('#roomAv').textContent = c.is_group ? '👥' : t.charAt(0);
  $('#roomAv').style.background = colorOf(c.is_group ? c.id : ((members.get(c.id) || []).find(m => m.user_id !== me.id) || {}).user_id);
  typers.clear(); joinTyping(c.id); $('#roomSub').textContent = subtitle(c); $('#roomSub').className = ''; updateStatus();
  renderChats(); $('#msgs').innerHTML = '<div class="day">جاري التحميل…</div>';
  const { data, error } = await sb.from('messages').select('*').eq('conversation_id', id).order('id', { ascending: false }).limit(150);
  if (current !== c) return;
  if (error) { $('#msgs').innerHTML = ''; return toast(errText(error)); }   // no more stuck "loading" text
  $('#msgs').innerHTML = ''; addMsg.bulk = true; (data || []).reverse().forEach(m => addMsg(m)); addMsg.bulk = false; note(); scrollDown(); markRead(); viewing(true);
  if (!/Mobi|Android|iPhone|iPad/.test(navigator.userAgent)) $('#text').focus();
}
function closeChat() { stopTyping(); leaveTyping(); viewing(false); current = null; $('#app').classList.remove('open'); $('#room').hidden = true; $('#empty').hidden = false; renderChats(); }
$('#backBtn').onclick = closeChat;
const scrollDown = () => { const b = $('#msgs'); b.scrollTop = b.scrollHeight; };
async function markRead() { if (!current) return; const now = new Date().toISOString(); current.last_read = now;
  await sb.rpc('mark_read', { c: current.id, receipts: myPres.receipts }); }   // the server's clock, not the phone's

function msgHtml(m) {
  const mine = m.sender_id === me.id, q = m.reply_to && msgsById.get(m.reply_to);
  let body = m.deleted ? '🚫 تم حذف هذه الرسالة' : m.kind === 'text' ? esc(m.body) : '';
  if (!m.deleted && m.kind === 'image') body = `<img data-media="${esc(m.media_path)}" alt="صورة">` + (m.body ? `<div>${esc(m.body)}</div>` : '');
  if (!m.deleted && m.kind === 'voice') body = `<audio controls preload="none" data-media="${esc(m.media_path)}"></audio>`;
  return `${current.is_group && !mine ? `<div class="who" style="color:${colorOf(m.sender_id)}">${esc(nameOf(m.sender_id))}</div>` : ''}
${q ? `<div class="q" data-jump="${q.id}"><b>${esc(q.sender_id === me.id ? 'أنت' : nameOf(q.sender_id))}</b>: ${esc(q.deleted ? 'رسالة محذوفة' : preview(q))}</div>` : ''}
<div class="body">${body}</div><div class="meta">${m.edited_at && !m.deleted ? '<span>معدّلة</span>' : ''}<span>${fmtTime(m.created_at)}</span>${mine && !m.deleted ? trail(m, current.id) : ''}</div>
${m.deleted ? '' : `<div class="tools"><button data-act="reply" title="رد">↩</button>${mine && m.kind === 'text' ? '<button data-act="edit" title="تعديل">✏️</button>' : ''}${mine ? '<button data-act="del" title="حذف">🗑</button>' : ''}${m.kind === 'text' ? '<button data-act="copy" title="نسخ">📋</button>' : ''}</div>`}`;
}
let lastDay = '';
function addMsg(m) {
  const box = $('#msgs'), day = fmtDay(m.created_at);
  if (!box.lastElementChild || box.dataset.lastDay !== day) { box.insertAdjacentHTML('beforeend', `<div class="day">${day}</div>`); box.dataset.lastDay = day; }
  msgsById.set(m.id, m); const el = document.createElement('div'); el.className = 'm' + (m.sender_id === me.id ? ' mine' : '') + (m.deleted ? ' del' : ''); el.dataset.id = m.id; el.innerHTML = msgHtml(m);
  box.appendChild(el); loadMedia(el); if (!addMsg.bulk) note();
}
function updateMsg(m) { msgsById.set(m.id, m); const el = document.querySelector(`.m[data-id="${m.id}"]`); if (!el) return; el.className = 'm' + (m.sender_id === me.id ? ' mine' : '') + (m.deleted ? ' del' : ''); el.innerHTML = msgHtml(m); loadMedia(el); }
// signed links live 5 minutes only (a screenshot or a copied link stops working soon); a new one is made when it expires
async function signed(path) { const hit = urlCache.get(path); if (hit && Date.now() - hit.t < 240000) return hit.u; const { data } = await sb.storage.from('media').createSignedUrl(path, 300); const u = data && data.signedUrl; if (u) urlCache.set(path, { u, t: Date.now() }); return u; }
function loadMedia(el) { el.querySelectorAll('[data-media]').forEach(async x => { const u = await signed(x.dataset.media); if (u) { x.src = u; if (x.tagName === 'IMG') x.onload = () => { const b = $('#msgs'); if (b.scrollHeight - b.scrollTop - b.clientHeight < 400) scrollDown(); }; } }); }

$('#msgs').onclick = async e => {
  const m = e.target.closest('.m'); if (!m) return; const msg = msgsById.get(+m.dataset.id);
  document.querySelectorAll('.m.show').forEach(x => x !== m && x.classList.remove('show')); m.classList.toggle('show');
  const jump = e.target.closest('[data-jump]'); if (jump) { const t = document.querySelector(`.m[data-id="${jump.dataset.jump}"]`); if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1500); } return; }
  // the picture viewer builds its element with the DOM (no HTML string), so the link is never read as markup
  if (e.target.tagName === 'IMG' && e.target.src) { const v = document.createElement('div'), img = document.createElement('img'); v.className = 'viewer'; img.src = e.target.src; v.appendChild(img); v.onclick = () => v.remove(); document.body.appendChild(v); return; }
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
ta.oninput = e => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; if (e) ta.value.trim() ? typing() : stopTyping(); };
ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !/Mobi/.test(navigator.userAgent)) { e.preventDefault(); $('#composer').requestSubmit(); } };
async function send(row) {
  if (!current) return; const r = { conversation_id: current.id, reply_to: replyTo ? replyTo.id : null, ...row };
  replyTo = null; $('#replyBox').hidden = true;
  const { data, error } = await sb.from('messages').insert(r).select().single(); if (error) return toast('ما انرسلت: ' + errText(error));
  if (!msgsById.has(data.id) && current && current.id === data.conversation_id) { addMsg(data); scrollDown(); }
  bumpConv(data);
  sb.functions.invoke('push', { body: { message_id: data.id } }).catch(() => {});   // notify the others' phones
}
$('#composer').onsubmit = e => { e.preventDefault(); const t = ta.value.trim(); if (!t) return; stopTyping(); ta.value = ''; ta.oninput(); send({ kind: 'text', body: t }); };
async function upload(blob, ext, type) {
  const path = `${current.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('media').upload(path, blob, { contentType: type }); if (error) throw error; return path;
}
$('#attachBtn').onclick = () => $('#fileIn').click();
$('#fileIn').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f || !current) return;
  // only PNG, JPEG and WebP: they are redrawn on a canvas below (this drops EXIF location data and blocks SVG / HTML files)
  if (!/image\/(png|jpeg|webp)/.test(f.type)) return toast('الصور المدعومة: PNG أو JPEG أو WebP');
  if (f.size > 10 * 1024 * 1024) return toast('الصورة أكبر من 10 ميجا');
  toast('جاري إرسال الصورة…');
  try { const img = await shrink(f), path = await upload(img.blob, img.ext, img.type); await send({ kind: 'image', media_path: path }); } catch (x) { toast('ما انرسلت الصورة: ' + errText(x)); } };
async function shrink(f) {   // every photo is redrawn as a new JPEG: smaller file, and no hidden metadata
  const bmp = await createImageBitmap(f), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);   // transparent PNG parts would turn black in JPEG without this
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
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
      try { toast('جاري إرسال الرسالة الصوتية…'); const blob = new Blob(chunks, { type: base });
        if (blob.size > 10 * 1024 * 1024) throw uiErr('الرسالة الصوتية أطول من اللازم');
        const path = await upload(blob, ext, base); await send({ kind: 'voice', media_path: path }); } catch (x) { toast('ما انرسلت: ' + errText(x)); } };
    rec.start(); $('#micBtn').classList.add('rec'); $('#micBtn').textContent = '⏹'; toast('يسجل الحين… اضغط ⏹ للإرسال');
  } catch { toast('اسمح للمتصفح يستخدم المايك'); }
};

// ---------- live updates ----------
function bumpConv(m) { const c = convs.find(x => x.id === m.conversation_id); if (!c) return loadChats();
  c.last = m; if (!(current && current.id === c.id) && m.sender_id !== me.id) c.unread++;
  convs.sort((a, b) => new Date((b.last && b.last.created_at) || b.last_at) - new Date((a.last && a.last.created_at) || a.last_at)); renderChats(); }
async function live() {
  for (const ch of sb.getChannels().filter(x => x.topic.endsWith('hamsa-live'))) await sb.removeChannel(ch);   // must finish first
  sb.channel('hamsa-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async ({ new: m }) => {
      await needProfiles([m.sender_id]); if (m.sender_id !== me.id) delivered();
      if (current && current.id === m.conversation_id && !msgsById.has(m.id)) { const b = $('#msgs'), near = b.scrollHeight - b.scrollTop - b.clientHeight < 200; addMsg(m); if (near || m.sender_id === me.id) scrollDown(); if (!document.hidden) markRead(); }
      bumpConv(m);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, ({ new: m }) => { if (current && current.id === m.conversation_id) updateMsg(m); const c = convs.find(x => x.id === m.conversation_id); if (c && c.last && c.last.id === m.id) { c.last = m; renderChats(); } })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, async ({ eventType, new: f }) => {
      await loadFriends();
      if (eventType === 'INSERT' && f.addressee === me.id) toast(`📩 طلب صداقة جديد من ${nameOf(f.requester)}، شوفه في «الأصدقاء»`);
      if (eventType === 'UPDATE' && f.status === 'accepted' && f.requester === me.id) toast(`✅ ${nameOf(f.addressee)} قبل طلب صداقتك`);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'members', filter: `user_id=eq.${me.id}` }, () => loadChats())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'members' }, ({ new: r }) => {   // someone received / read: light the trail
      const list = members.get(r.conversation_id); const x = list && list.find(m => m.user_id === r.user_id); if (!x || r.user_id === me.id) return;
      Object.assign(x, { delivered_at: r.delivered_at, seen_at: r.seen_at, last_read: r.last_read }); refreshTrail(r.conversation_id); })
    .subscribe();
}

// ---------- staying up to date (phones pause the live connection in the background) ----------
let lastSync = 0;
async function resync() {
  if (!me || Date.now() - lastSync < 3000) return; lastSync = Date.now();
  const ch = liveCh(); if (!ch || ch.state !== 'joined') await live();
  if (current && (!typingCh || typingCh.state !== 'joined')) joinTyping(current.id);
  await Promise.all([loadChats(), loadFriends()]); delivered();
  if (current) {   // messages that arrived while the connection was asleep
    const lastId = Math.max(0, ...[...msgsById.keys()]);
    const { data } = await sb.from('messages').select('*').eq('conversation_id', current.id).gt('id', lastId).order('id');
    (data || []).forEach(m => { if (!msgsById.has(m.id)) addMsg(m); }); if (data && data.length) { scrollDown(); markRead(); }
  }
}
// presence: "online" and "inside this chat". The server also uses it to skip phone notifications for a chat you have open.
// when "show my status" is off, nothing about being online or inside a chat is sent at all (not just hidden on screen)
// always sent: the server needs "inside this chat" to skip phone notifications. When you hide your status,
// the database itself stops your friends from reading it (rule presence_read in setup.sql).
async function presence(row) { if (!me) return; await sb.from('presence').upsert(row, { onConflict: 'user_id' }); }
// times come from the server's clock: a phone whose clock is a bit wrong would otherwise break "online"
const viewing = on => me && myPres.visible ? sb.rpc('touch_presence', { c: on && current ? current.id : null, on_line: true }).then(() => {}) : null;
// leaving the app: "offline" at once. keepalive lets the request finish even while the phone closes the app.
function goOffline() {
  if (!me || !accessToken || !myPres.visible) return;
  try { fetch(HAMSA.url + '/rest/v1/rpc/touch_presence', { method: 'POST', keepalive: true, headers: { apikey: HAMSA.key, Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ c: null, on_line: false }) }).catch(() => {}); } catch {}
}
let skew = 0;   // server time minus phone time
async function syncClock() { const t0 = Date.now(), { data } = await sb.rpc('server_now'); if (data) skew = new Date(data).getTime() - (t0 + Date.now()) / 2; }
const srvNow = () => Date.now() + skew;
setInterval(() => { if (me && !document.hidden) viewing(!!current); }, 10000);
// "delivered": my phone got the new messages (all my chats at once, at most every 2 seconds).
// If a call comes too soon, it is run again when the 2 seconds are over, so the last message is also delivered.
let delT = 0, delPend = null;
function delivered() {
  if (!me) return;
  const wait = 2000 - (Date.now() - delT);
  if (wait > 0) { if (!delPend) delPend = setTimeout(() => { delPend = null; delivered(); }, wait); return; }
  delT = Date.now(); sb.rpc('mark_delivered').then(() => {});
}

// the line under the name: inside the chat now / online / last seen
function subtitle(c) { return c.is_group ? (members.get(c.id) || []).map(m => m.user_id === me.id ? 'أنت' : nameOf(m.user_id)).join('، ') : '@' + ((profiles.get(((members.get(c.id) || []).find(m => m.user_id !== me.id) || {}).user_id) || {}).username || ''); }
const ago = d => { const s = (srvNow() - new Date(d)) / 1000; if (s < 60) return 'قبل لحظات'; if (s < 3600) { const m = Math.round(s / 60); return m === 1 ? 'قبل دقيقة' : m === 2 ? 'قبل دقيقتين' : m <= 10 ? `قبل ${m} دقائق` : `قبل ${m} دقيقة`; } if (new Date(d).toDateString() === new Date().toDateString()) return 'اليوم ' + fmtTime(d); return fmtDay(d) + ' ' + fmtTime(d); };
async function updateStatus() {
  const c = current; if (!c || !me) return; const el = $('#roomSub'); if (typers.size) return showTyping();
  if (!myPres.visible) { el.textContent = subtitle(c); el.className = ''; return; }   // you hide yours, so you don't see others'
  const ids = (members.get(c.id) || []).map(m => m.user_id).filter(id => id !== me.id);
  const { data } = await sb.from('presence').select('user_id,last_seen,viewing_conv,viewing_at,online').in('user_id', ids); if (current !== c) return;
  const now = srvNow(), on = p => p.online && p.last_seen && now - new Date(p.last_seen) < 25000, inChat = (data || []).filter(p => on(p) && p.viewing_conv === c.id && p.viewing_at), online = (data || []).filter(on);
  if (!c.is_group) {
    const p = (data || [])[0];
    el.textContent = inChat.length ? '● داخل المحادثة الحين' : online.length ? '● متصل' : p && p.last_seen ? 'آخر ظهور ' + ago(p.last_seen) : subtitle(c);
    el.className = inChat.length ? 'live' : online.length ? 'on' : '';
  } else {
    el.textContent = inChat.length ? `● داخل المحادثة: ${inChat.map(p => nameOf(p.user_id)).join('، ')}` : online.length ? `● متصل: ${online.map(p => nameOf(p.user_id)).join('، ')}` : subtitle(c);
    el.className = inChat.length ? 'live' : online.length ? 'on' : '';
  }
}
setInterval(() => { if (current && !document.hidden) updateStatus(); }, 6000);

// ---------- my own name for a person (only on my phone; they never know) ----------
function rename(id) {
  if (!id) return; const p = profiles.get(id) || {};
  dialog(`<h3>اسمه عندك</h3><p class="muted">الاسم يتغير عندك بس. ${esc(p.display_name || '')} ما يدري ولا يشوف الاسم اللي تختاره.</p><input id="nickIn" maxlength="40" value="${esc(nicks.get(id) || '')}" placeholder="${esc(p.display_name || '')}">
<div class="row">${nicks.has(id) ? '<button value="reset" class="btn">رجّع اسمه الأصلي</button>' : ''}<button value="x" class="btn">إلغاء</button><button value="ok" class="btn primary">حفظ</button></div>`, async () => {
    const n = $('#nickIn').value.trim(); await sb.from('contact_names').delete().eq('target', id);
    if (n && n !== p.display_name) { const { error } = await sb.from('contact_names').insert({ target: id, name: n }); if (error) return toast(errText(error)); nicks.set(id, n); } else nicks.delete(id);
    afterRename(); toast('تم ✅'); });
  const d = $('#dlg'), prev = d.onclose; d.onclose = async () => { if (d.returnValue === 'reset') { await sb.from('contact_names').delete().eq('target', id); nicks.delete(id); afterRename(); } else prev(); };
}
function afterRename() { loadFriends(); renderChats(); if (current) { $('#roomName').textContent = convTitle(current); $('#roomSub').textContent = subtitle(current); updateStatus(); document.querySelectorAll('.m').forEach(el => { const m = msgsById.get(+el.dataset.id); if (m) updateMsg(m); }); } }

// ---------- settings ----------
$('#settingsBtn').onclick = () => {
  const dark = document.documentElement.dataset.theme !== 'light', notif = subOn;   // notif = this phone is getting push notifications now
  dialog(`<h3>⚙️ الإعدادات</h3><div class="scroll set">
<div class="sec">حسابي</div>
<label>اسمك (يظهر لأصدقائك)<input id="sName" maxlength="40" value="${esc(me.display_name)}"></label>
<p class="muted">اسم المستخدم: <span dir="ltr">@${esc(me.username)}</span> (ما يتغير)</p>
<div class="sec">الإشعارات</div>
<label class="chk"><input type="checkbox" id="sNotif" ${notif ? 'checked' : ''}> إشعارات الرسائل على جوالي</label>
<div class="sec">الخصوصية</div>
<label class="chk"><input type="checkbox" id="sVis" ${myPres.visible ? 'checked' : ''}> أصدقائي يشوفون إني متصل أو داخل المحادثة</label>
<label class="chk"><input type="checkbox" id="sRec" ${myPres.receipts ? 'checked' : ''}> أصدقائي يعرفون إني قريت رسايلهم</label>
<p class="muted">إذا قفلت وحدة منهم، أنت بعد ما تشوفها عند أصدقائك.</p>
<div class="sec">المظهر</div>
<label class="chk"><input type="radio" name="sTheme" value="dark" ${dark ? 'checked' : ''}> داكن</label><label class="chk"><input type="radio" name="sTheme" value="light" ${dark ? '' : 'checked'}> فاتح</label>
<div class="sec">كلمة السر</div>
<input id="sPass" type="password" dir="ltr" placeholder="كلمة سر جديدة (8 حروف أو أكثر، واتركها فاضية إذا ما تبي تغيرها)" autocomplete="new-password">
<label id="sOldWrap" hidden>كلمة السر الحالية (مطلوبة للتغيير)<input id="sOld" type="password" dir="ltr" autocomplete="current-password"></label>
</div><div class="row"><button value="logout" class="btn danger">تسجيل الخروج</button><button value="x" class="btn">إلغاء</button><button value="ok" class="btn primary">حفظ</button></div>`, async () => {
    const name = $('#sName').value.trim(), vis = $('#sVis').checked, rec = $('#sRec').checked, theme = document.querySelector('input[name=sTheme]:checked').value, pass = $('#sPass').value, wantNotif = $('#sNotif').checked;
    if (name.length > 40) return toast('الاسم أطول من 40 حرف');
    setTheme(theme);
    if (name && name !== me.display_name) { const { error } = await sb.from('profiles').update({ display_name: name }).eq('id', me.id); if (error) return toast(errText(error)); me.display_name = name; profiles.set(me.id, me); $('#meName').textContent = name; avatar($('#meAvatar'), name, me.id); }
    if (vis !== myPres.visible || rec !== myPres.receipts) { myPres = { visible: vis, receipts: rec }; await presence({ visible: vis, receipts: rec }); if (!vis) sb.rpc('touch_presence', { c: null, on_line: false }).then(() => {}); if (current) { updateStatus(); refreshTrail(current.id); } }
    if (pass) {
      if (pass.length < 8) return toast('كلمة السر لازم 8 حروف أو أكثر');
      const old = $('#sOld').value;
      if (!old) return toast('اكتب كلمة السر الحالية عشان تغيّرها');
      const { error: e1 } = await sb.auth.signInWithPassword({ email: `${me.username}@${HAMSA.emailDomain}`, password: old });   // re-checks the old password first
      if (e1) return toast('كلمة السر الحالية غلط');
      const { error } = await sb.auth.updateUser({ password: pass }); if (error) return toast(errText(error));
      await sb.auth.signOut({ scope: 'others' });   // logs out every other device that still has the old session
    }
    if (wantNotif && !notif) await enablePush();
    if (!wantNotif && notif) await turnOff();
    toast('تم حفظ الإعدادات ✅'); });
  $('#sPass').oninput = () => { $('#sOldWrap').hidden = !$('#sPass').value; };
  const d = $('#dlg'), prev = d.onclose; d.onclose = () => d.returnValue === 'logout' ? logout() : prev();
};
const liveCh = () => sb.getChannels().find(x => x.topic.endsWith('hamsa-live'));
setInterval(() => { if (me && !document.hidden) { const ch = liveCh(); if (!ch || ch.state !== 'joined') resync(); } }, 8000);
setInterval(() => { if (me && !document.hidden) resync(); }, 45000);
document.addEventListener('visibilitychange', () => { if (document.hidden) { goOffline(); stopTyping(); } else { if (current) { markRead(); updateStatus(); } viewing(!!current); delivered(); resync(); } });
addEventListener('pagehide', goOffline);
addEventListener('blur', () => { if (document.hidden) goOffline(); });
addEventListener('online', () => resync());
addEventListener('focus', () => resync());

// first screen
sb.auth.getSession().then(({ data }) => { if (!data.session) { $('#auth').hidden = false; } });

// ---------- install as an app + phone notifications ----------
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pushOK = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
navigator.serviceWorker?.addEventListener('message', e => { if (e.data && e.data.open && me) openChat(e.data.open); });
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('#installBtn').hidden = false; });
addEventListener('appinstalled', () => { $('#installBtn').hidden = true; toast('تم تثبيت همسة ✅'); });
if (isIOS && !installed()) $('#installBtn').hidden = false;
const iosHelp = () => dialog(`<h3>ثبّت همسة على جوالك</h3><ol class="steps"><li>افتح هالصفحة في <b>Safari</b>.</li><li>اضغط زر المشاركة <b>⬆️</b> تحت.</li><li>اختر <b>«إضافة إلى الشاشة الرئيسية»</b> ثم <b>إضافة</b>.</li><li>افتح همسة من الأيقونة الجديدة، وفعّل الإشعارات 🔔.</li></ol><p class="muted">في الآيفون الإشعارات تشتغل بس بعد ما تثبّته بهالطريقة.</p><div class="row"><button value="x" class="btn primary">تمام</button></div>`);
$('#installBtn').onclick = async () => { if (installEvt) { installEvt.prompt(); await installEvt.userChoice; installEvt = null; $('#installBtn').hidden = true; } else if (isIOS) iosHelp(); };

// Push state: subOn = this phone has an active push subscription right now.
// PUSH_OFF = the user turned notifications off on this phone; the app then does not turn them back on by itself on the next open.
const PUSH_OFF = 'hamsa-push-off';
let subOn = false;
const b64 = s => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
// asks the browser for permission. Call it straight from a tap (no await before it), or the browser blocks the popup.
function askPermission() {
  return new Promise(resolve => {
    let done = false; const fin = p => { if (!done) { done = true; resolve(p); } };
    try { const r = Notification.requestPermission(fin); if (r && typeof r.then === 'function') r.then(fin, () => fin('denied')); }
    catch { fin('denied'); }
  });
}
async function subscribe(quiet) {
  const reg = await withTimeout(navigator.serviceWorker.ready, 8000, 'التطبيق ما جهز بعد، سكّره وافتحه من جديد وجرب');
  const res = await withTimeout(fetch(HAMSA.url + '/functions/v1/push', { headers: { apikey: HAMSA.key } }), 8000, 'ما قدرت أوصل للخادم، تأكد من الإنترنت').catch(x => { throw x; });
  const { publicKey } = await res.json().catch(() => ({}));
  if (!publicKey) throw new Error('ما وصل مفتاح الإشعارات من الخادم، جرب بعد شوي');
  let sub = await reg.pushManager.getSubscription();
  for (let i = 0; i < 2; i++) {
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) });
    const j = sub.toJSON(); await sb.from('push_subscriptions').delete().eq('endpoint', j.endpoint);
    const { error } = await sb.from('push_subscriptions').insert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
    if (!error) break;
    await sub.unsubscribe(); sub = null;   // this browser was linked to another account: make a fresh link
    if (i) throw error;
  }
  try { localStorage.removeItem(PUSH_OFF); } catch {}
  subOn = true; bell(); if (!quiet) toast('تم تفعيل الإشعارات ✅ بتوصلك الرسائل حتى والتطبيق مقفل');
}
// turns notifications off on this phone: removes the server link first, so no push is sent to this phone anymore
async function turnOff() {
  try {
    const reg = await withTimeout(navigator.serviceWorker.ready, 8000, 'التطبيق ما جهز بعد، جرب بعد شوي');
    const sub = await reg.pushManager.getSubscription();
    if (sub) { const { error } = await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); if (error) throw error; await sub.unsubscribe(); }
  } catch (x) { return toast('ما قدرت أوقف الإشعارات: ' + errText(x)); }
  try { localStorage.setItem(PUSH_OFF, '1'); } catch {}
  subOn = false; bell(); toast('وقفت الإشعارات على هالجوال. تقدر تفعّلها متى تبي');
}
async function enablePush() {
  if (!pushOK()) return isIOS && !installed() ? iosHelp() : toast(isIOS ? 'ثبّت همسة على الشاشة الرئيسية عشان تفعّل الإشعارات' : 'هالمتصفح ما يدعم الإشعارات');
  const p = await askPermission();   // this line runs right away from the tap
  bell();
  if (p !== 'granted') return toast(p === 'denied' ? 'الإشعارات مقفلة من المتصفح. افتح إعدادات الموقع لهمسة وفعّل الإشعارات، وبعدين ارجع جرب' : 'ما وافقت على الإشعارات، تقدر تجرب مرة ثانية');
  try { await subscribe(false); } catch (x) { toast('ما قدرت أفعّل الإشعارات: ' + errText(x)); }
  $('#pushBar').hidden = true;
}
// the bell shows the real state: on / off / blocked / needs install (iPhone) / not supported
function bell() {
  const ok = pushOK(), perm = ok ? Notification.permission : 'unsupported', on = subOn && perm === 'granted';
  let tip = 'فعّل الإشعارات';
  if (on) tip = 'الإشعارات شغالة. اضغط عشان توقفها على هالجوال';
  else if (perm === 'denied') tip = 'الإشعارات مقفلة من المتصفح';
  else if (!ok) tip = isIOS && !installed() ? 'ثبّت همسة على الشاشة الرئيسية عشان تفعّل الإشعارات' : 'المتصفح ما يدعم الإشعارات';
  $('#bellBtn').textContent = on ? '🔔' : '🔕'; $('#bellBtn').title = tip;
}
$('#bellBtn').onclick = () => {
  // on -> off (tap again to turn off). Off -> on: asks for permission right away from the tap if needed.
  if (subOn) { if (!confirm('توقف الإشعارات على هالجوال؟')) return; return turnOff(); }
  if (pushOK() && Notification.permission === 'granted') return subscribe(false).catch(x => toast('ما قدرت أفعّل الإشعارات: ' + errText(x)));
  enablePush();
};
$('#pushYes').onclick = enablePush;
$('#pushNo').onclick = () => { $('#pushBar').hidden = true; try { localStorage.setItem('hamsa-push-later', Date.now()); } catch {} };
function pushStart() {
  bell();
  if (!pushOK()) { $('#pushBar').hidden = true; return; }   // not supported (or iPhone not installed yet): no bar
  if (Notification.permission === 'granted') {
    let off = false; try { off = !!localStorage.getItem(PUSH_OFF); } catch {}
    if (off) { subOn = false; bell(); return; }   // the user turned it off on this phone: keep it off
    return subscribe(true).catch(() => { subOn = false; bell(); });
  }
  let later = 0; try { later = +localStorage.getItem('hamsa-push-later') || 0; } catch {}
  $('#pushBar').hidden = Notification.permission !== 'default' || Date.now() - later < 3 * 864e5;
}
// ---------- "typing…": short live signals inside the chat (nothing is saved) ----------
let typingCh = null, typingConv = null, lastTyping = 0;
const typers = new Map();   // user id → time the signal expires
function joinTyping(convId) {
  leaveTyping(); typingConv = convId;
  typingCh = sb.channel('typing-' + convId, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'typing' }, ({ payload }) => { if (!payload || payload.u === me.id || typingConv !== convId) return;
      if (payload.stop) typers.delete(payload.u); else typers.set(payload.u, Date.now() + 4500); showTyping(); })
    .subscribe();
}
function leaveTyping() { if (typingCh) { sb.removeChannel(typingCh); typingCh = null; } typingConv = null; typers.clear(); }
function typing() { if (!typingCh || Date.now() - lastTyping < 2500) return; lastTyping = Date.now(); typingCh.send({ type: 'broadcast', event: 'typing', payload: { u: me.id } }); }
function stopTyping() { if (!typingCh || !lastTyping) return; lastTyping = 0; typingCh.send({ type: 'broadcast', event: 'typing', payload: { u: me.id, stop: true } }); }
function showTyping() {
  const now = Date.now(); for (const [u, t] of typers) if (t < now) typers.delete(u);
  const el = $('#roomSub'); if (!current) return;
  if (!typers.size) return updateStatus();
  el.textContent = current.is_group ? [...typers.keys()].map(nameOf).join('، ') + ' يكتب…' : 'يكتب…'; el.className = 'live';
}
setInterval(() => { if (typers.size) showTyping(); }, 1000);
// ---------- the whisper's trail (instead of ✓✓) ----------
// 1 dot: it left your phone · 2: it reached their phone (app open, or the notification arrived) · 3: they read it
function stateOf(m, convId) {
  const others = (members.get(convId) || []).filter(x => x.user_id !== me.id), t = new Date(m.created_at).getTime(), at = v => v && new Date(v).getTime() >= t;
  const seen = others.filter(x => at(x.seen_at)), got = others.filter(x => at(x.delivered_at) || at(x.seen_at));
  const s = !others.length ? 1 : myPres.receipts && seen.length === others.length ? 3 : got.length === others.length ? 2 : 1;
  return { s, others, seen, got };
}
const stateWords = ['', 'انرسلت', 'وصلت لجواله', 'قراها'];
function trail(m, convId) { const { s } = stateOf(m, convId); return `<span class="trail s${s}" data-trail="${m.id}" title="${stateWords[s]}"><i></i><i></i><i></i></span>`; }
function refreshTrail(convId) {
  if (current && current.id === convId) document.querySelectorAll('.m.mine').forEach(el => {
    const m = msgsById.get(+el.dataset.id), old = el.querySelector('.trail'); if (!m || !old) return;
    const before = old.className; old.outerHTML = trail(m, convId); const now = el.querySelector('.trail');
    if (now.className !== before) now.classList.add('lit');
  });
  note(); renderChats();
}
// one plain sentence under your last message, so you never have to decode dots
function note() {
  const box = $('#msgs'); if (!box || !current) return; box.querySelector('.dnote')?.remove();
  const last = [...msgsById.values()].filter(m => !m.deleted).pop(); if (!last || last.sender_id !== me.id) return;
  const { s, others, seen, got } = stateOf(last, current.id), age = (srvNow() - new Date(last.created_at)) / 1000;
  const lastSeen = seen.map(x => x.seen_at).sort().pop();
  let text = '', cls = '';
  if (s === 3) { text = current.is_group ? 'قراها الكل' : 'قراها ' + fmtTime(lastSeen); cls = 'seen'; }
  else if (current.is_group && myPres.receipts && seen.length) text = `قراها ${seen.length} من ${others.length}`;
  else if (s === 2) text = current.is_group ? 'وصلت للكل' : 'وصلت لجواله';
  else if (age > 25) { text = current.is_group ? `وصلت لـ ${got.length} من ${others.length}، الباقين جوالاتهم مقفلة أو بدون نت` : 'ما وصلت لجواله للحين، يمكن جواله مقفل أو بدون نت'; cls = 'wait'; }
  else text = 'انرسلت';
  box.insertAdjacentHTML('beforeend', `<div class="dnote ${cls}">${esc(text)}</div>`);
}
setInterval(() => { if (current && !document.hidden) note(); }, 10000);
// tap the dots: the full story of that message
document.addEventListener('click', e => {
  const t = e.target.closest('[data-trail]'); if (!t || !current) return; e.stopPropagation();
  const m = msgsById.get(+t.dataset.trail); if (!m) return; const { others } = stateOf(m, current.id), tm = new Date(m.created_at).getTime(), at = v => v && new Date(v).getTime() >= tm;
  const lines = ['انرسلت ' + fmtTime(m.created_at)];
  for (const x of others) { const who = current.is_group ? nameOf(x.user_id) + ': ' : '';
    lines.push(who + (myPres.receipts && at(x.seen_at) ? 'قراها ' + fmtTime(x.seen_at) : at(x.delivered_at) ? 'وصلت ' + fmtTime(x.delivered_at) : 'ما وصلت للحين')); }
  toast(lines.join('\n'));
}, true);