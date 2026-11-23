// همسة · the app. Data lives in Supabase and every read/write is checked by the database rules (setup.sql).
// Message content is end-to-end encrypted on the phone (crypto.js): the server only stores ciphertext.
const VERSION = '3.0';
const sb = supabase.createClient(HAMSA.url, HAMSA.key);
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const list = a => a.join(document.documentElement.dir === 'rtl' ? '، ' : ', ');

// ---------- icons (one consistent line set) ----------
const P = {
  back: 'M15 6l-6 6 6 6', fwd: 'M9 6l6 6-6 6', gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2 1.2L14.8 21h-4l-.3-2.2a7 7 0 0 1-2-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-2.4L4.6 9.9l2-3.4 1.9.7a7 7 0 0 1 2-1.2L10.8 3h4l.3 2.2a7 7 0 0 1 2 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 2.2z',
  group: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.5-3.5 3.2-6 6.5-6s6 2.5 6.5 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.3c2 .8 3.3 2.9 3.5 5.7',
  install: 'M12 3v12M7 10l5 5 5-5M5 21h14', info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7.5v.5',
  attach: 'M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9',
  mic: 'M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 0 0-7 0v5A3.5 3.5 0 0 0 12 15zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21', stop: 'M7 7h10v10H7z',
  send: 'M4 12l16-8-6 16-2.5-6.5z', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5', lock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4', palette: 'M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.4-1.1-1.6-1.1-2.8 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3zM7.5 12h.01M9.5 8h.01M14.5 8h.01',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.5 9h17M3.5 15h17M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3z',
  camera: 'M4 8h3l2-2.5h6L17 8h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', key: 'M14.5 9.5a4.5 4.5 0 1 1-1.3-3.2M13.2 6.3L21 14v3h-3v-2h-2v-2h-2',
  out: 'M10 4H5v16h5M14 8l4 4-4 4M18 12H9', shield: 'M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z', check: 'M5 12.5l4.5 4.5L19 7', search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  reply: 'M10 7L4 12l6 5M4 12h10a6 6 0 0 1 6 6', edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4', trash: 'M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13', copy: 'M8 8h11v12H8zM5 16V4h11'
};
// arrows point the other way in Arabic (mirrored inside the drawing, so it works everywhere)
const FLIP = ['back', 'fwd', 'send', 'reply'];
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[n]}"${FLIP.includes(n) && document.documentElement.dir === 'rtl' ? ' transform="matrix(-1 0 0 1 24 0)"' : ''}/></svg>`;

// ---------- language ----------
let lang = null; try { lang = localStorage.getItem('hamsa-lang'); } catch {}
const L = () => I18N[lang] || I18N.en;
const t = (k, v = {}) => String(L()[k] ?? I18N.en[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
const locale = () => lang === 'ar' ? 'ar' : lang === 'nl' ? 'nl-NL' : 'en-GB';
function applyLang() {
  document.documentElement.lang = lang || 'en'; document.documentElement.dir = L().dir;
  $$('[data-t]').forEach(e => e.textContent = t(e.dataset.t));
  $$('[data-tph]').forEach(e => e.placeholder = t(e.dataset.tph));
  $$('[data-ttl]').forEach(e => { e.title = t(e.dataset.ttl); e.setAttribute('aria-label', t(e.dataset.ttl)); });
  $$('[data-ic]').forEach(e => { e.querySelector('svg.ic')?.remove(); e.insertAdjacentHTML('afterbegin', ic(e.dataset.ic)); });
  if (mode) setMode(mode);
}
function setLang(l) { lang = l; try { localStorage.setItem('hamsa-lang', l); } catch {} HC.pref('lang', l).catch(() => {}); applyLang(); if (me) { renderChats(); loadFriends(); if (current) openChat(current.id, true); } }
const fmtTime = d => new Date(d).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' });
const fmtDay = d => { const x = new Date(d), n = new Date(), y = new Date(n); y.setDate(n.getDate() - 1);
  return x.toDateString() === n.toDateString() ? t('today') : x.toDateString() === y.toDateString() ? t('yesterday') : x.toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }); };
const short = d => { const x = new Date(d); return x.toDateString() === new Date().toDateString() ? fmtTime(d) : x.toLocaleDateString(locale(), { day: 'numeric', month: 'numeric' }); };
const toast = s => { const e = $('#toast'); e.textContent = s; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, Math.max(3000, s.length * 55)); };
const errText = e => { const m = (e && (e.message || e.error_description)) || String(e || '');
  if (/Invalid login/i.test(m)) return t('errLogin');
  if (/already registered|already exists|duplicate|Database error saving/i.test(m)) return t('errTaken');
  if (/Password should be|at least 8/i.test(m)) return t('errPass8');
  if (/rate limit/i.test(m)) return t('errRate');
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return t('errNet');
  console.warn('[hamsa]', m); return t('errGeneric'); };

// ---------- theme ----------
let theme = 'dark'; try { theme = localStorage.getItem('hamsa-theme') || 'dark'; } catch {}
const mq = matchMedia('(prefers-color-scheme: light)');
function applyTheme() { document.documentElement.dataset.theme = theme === 'auto' ? (mq.matches ? 'light' : 'dark') : theme; $('meta[name=theme-color]').content = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() || '#1A1D42'; }
mq.addEventListener?.('change', applyTheme);
const setTheme = v => { theme = v; try { localStorage.setItem('hamsa-theme', v); } catch {} applyTheme(); };
applyTheme();

// ---------- state ----------
let me = null, myDev = null, accessToken = null, nicks = new Map(), myPres = { visible: true, receipts: true };
const profiles = new Map(), members = new Map(), msgsById = new Map(), plain = new Map(), urlCache = new Map(), devPub = new Map(), devsByConv = new Map();
let convs = [], current = null, replyTo = null, friends = [];

// ---------- first screens: language → sign in ----------
let mode = null;
const setMode = m => { mode = m; $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  $('.auth-card').classList.toggle('in', m === 'in'); $('#authBtn').textContent = t(m === 'in' ? 'enter' : 'create');
  $('#fPass').autocomplete = m === 'in' ? 'current-password' : 'new-password'; $('#fPass').placeholder = m === 'up' ? t('passwordNew') : ''; $('#authMsg').textContent = ''; };
$$('.tabs button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
$$('#lang [data-lang]').forEach(b => b.onclick = () => { setLang(b.dataset.lang); $('#lang').hidden = true; sb.auth.getSession().then(({ data }) => { if (!data.session) $('#auth').hidden = false; }); });
$('#authForm').onsubmit = async e => {
  e.preventDefault(); const u = $('#fUser').value.trim().toLowerCase(), p = $('#fPass').value, name = $('#fName').value.trim().slice(0, 40), msg = $('#authMsg'), btn = $('#authBtn');
  if (!/^[a-z0-9_]{3,20}$/.test(u)) return msg.textContent = t('errUser');
  const email = `${u}@${HAMSA.emailDomain}`; btn.disabled = true; msg.textContent = '';
  try {
    if (mode === 'up') {
      if (!name) throw new Error(t('errName')); if (p.length < 8) throw new Error(t('errPass8'));
      const { error } = await sb.auth.signUp({ email, password: p, options: { data: { username: u, display_name: name } } }); if (error) throw error;
      const s = await sb.auth.getSession(); if (!s.data.session) { const r = await sb.auth.signInWithPassword({ email, password: p }); if (r.error) throw r.error; }
    } else { const { error } = await sb.auth.signInWithPassword({ email, password: p }); if (error) throw error; }
  } catch (x) { msg.textContent = [t('errName'), t('errPass8')].includes(x.message) ? x.message : errText(x); } finally { btn.disabled = false; }
};

sb.auth.onAuthStateChange((ev, session) => { accessToken = session ? session.access_token : null; setTimeout(() => session ? start(session.user) : stop(), 0); });
let starting = false;
async function start(user) {
  if ((me && me.id === user.id) || starting) return; starting = true;
  try {
    let p = null; for (let i = 0; i < 5 && !p; i++) { ({ data: p } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle()); if (!p) await sleep(600); }
    if (!p) { toast(t('errGeneric')); return; }
    me = p; profiles.set(p.id, p);
    $('#lang').hidden = true; $('#auth').hidden = true; $('#app').hidden = false; paintMe();
    await initDevice();
    const [{ data: nk }, { data: pr }] = await Promise.all([sb.from('contact_names').select('target,name'), sb.from('presence').select('*').eq('user_id', p.id).maybeSingle()]);
    nicks = new Map((nk || []).map(x => [x.target, x.name])); if (pr) myPres = { visible: pr.visible, receipts: pr.receipts };
    await Promise.all([loadChats(), loadFriends()]); await live(); syncClock(); viewing(false); delivered();
    const want = new URLSearchParams(location.search).get('c'); if (want && convs.some(c => c.id === want)) openChat(want);
    pushStart();
  } finally { starting = false; }
}
function stop() {
  me = null; myDev = null; nicks = new Map(); current = null; convs = []; friends = []; profiles.clear(); members.clear(); msgsById.clear(); plain.clear(); devsByConv.clear();
  sb.removeAllChannels(); $('#app').hidden = true; closeSettings(true); $('#room').hidden = true; $('#empty').hidden = false; $('#app').classList.remove('open');
  if (lang) $('#auth').hidden = false; else $('#lang').hidden = false;
}
function paintMe() { avatarInto($('#meAvatar'), me.id); }

// ---------- this device's encryption key ----------
async function initDevice() {
  myDev = await HC.device(me.id);
  const { data } = await sb.from('device_keys').select('device_id,revoked').eq('user_id', me.id).eq('device_id', myDev.id).maybeSingle();
  if (!data) { const { error } = await sb.from('device_keys').insert({ device_id: myDev.id, pub: myDev.pub }); if (error) console.warn('[hamsa] device key', error.message); }
  else if (data.revoked) { await HC.forget(); myDev = await HC.device(me.id); await sb.from('device_keys').insert({ device_id: myDev.id, pub: myDev.pub }); }
  devPub.set(myDev.id, { user: me.id, pub: myDev.pub });
}
async function devicesFor(convId, fresh) {   // every device of every member of a chat (including my own other devices)
  const c = devsByConv.get(convId); if (c && !fresh && Date.now() - c.at < 30000) return c.list;
  const ids = (members.get(convId) || []).map(m => m.user_id);
  const { data } = await sb.from('device_keys').select('user_id,device_id,pub').in('user_id', ids).eq('revoked', false);
  const list = data || []; list.forEach(d => devPub.set(d.device_id, { user: d.user_id, pub: d.pub }));
  devsByConv.set(convId, { at: Date.now(), list }); return list;
}
async function senderPub(m) {   // the sender's device key, and it must really belong to the sender
  const c = devPub.get(m.sender_device); if (c && c.user === m.sender_id) return c.pub;
  const { data } = await sb.from('device_keys').select('user_id,pub').eq('device_id', m.sender_device).eq('user_id', m.sender_id).maybeSingle();
  if (!data) throw new Error('unknown-device'); devPub.set(m.sender_device, { user: data.user_id, pub: data.pub }); return data.pub;
}
// → { text, kind, K, payload, old, fail }
async function reveal(m) {
  if (!m || m.deleted) return { text: '' };
  if (m.enc !== 1) return { text: m.body || '', old: true };
  const key = m.id + ':' + m.iv; if (plain.has(key)) return plain.get(key);
  let out; try { const r = await HC.open(m, myDev, await senderPub(m)); out = { text: r.payload.t || '', payload: r.payload, K: r.K }; } catch { out = { text: '', fail: true }; }
  plain.set(key, out); return out;
}

// ---------- people & faces ----------
async function needProfiles(ids) {
  const miss = [...new Set(ids)].filter(i => i && !profiles.has(i)); if (!miss.length) return;
  const { data } = await sb.from('profiles').select('*').in('id', miss); (data || []).forEach(p => profiles.set(p.id, p));
}
const nameOf = id => nicks.get(id) || (profiles.get(id) || {}).display_name || '…';
const COLORS = ['#7C6CF0', '#3FA7D6', '#E0607E', '#F2A541', '#45B39D', '#B86ADF', '#5C7CFA', '#D9825B'];
const colorOf = id => COLORS[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
function avatarHtml(id, { group = false, cls = '' } = {}) {
  if (group) return `<span class="av grp ${cls}" style="background:${colorOf(id)}">${ic('group')}</span>`;
  const p = profiles.get(id) || {};
  if (p.avatar_url) return `<span class="av ${cls}" style="background-image:url('${esc(p.avatar_url)}')"></span>`;
  return `<span class="av ${cls}" style="background:${colorOf(id)}">${esc(nameOf(id).trim().charAt(0) || '؟')}</span>`;
}
function avatarInto(el, id, group) { const tmp = document.createElement('div'); tmp.innerHTML = avatarHtml(id, { group }); const n = tmp.firstChild; el.className = n.className + (el.id === 'meAvatar' ? '' : ''); el.style.cssText = n.style.cssText; el.innerHTML = n.innerHTML; }

// ---------- chats list ----------
async function loadChats() {
  const { data: mine, error } = await sb.rpc('my_chats'); if (error) return toast(errText(error));
  const ids = (mine || []).map(m => m.id); members.clear();
  if (ids.length) { const { data: all } = await sb.from('members').select('conversation_id,user_id,role,delivered_at,seen_at,last_read').in('conversation_id', ids);
    (all || []).forEach(m => { if (!members.has(m.conversation_id)) members.set(m.conversation_id, []); members.get(m.conversation_id).push(m); });
    await needProfiles((all || []).map(m => m.user_id)); }
  convs = (mine || []).map(m => ({ id: m.id, is_group: m.is_group, name: m.name, last_at: m.last_at, last_read: m.last_read,
    last: m.last_id ? { id: m.last_id, conversation_id: m.id, sender_id: m.last_sender, kind: m.last_kind, body: m.last_body, deleted: m.last_deleted, created_at: m.last_created, enc: m.last_enc, ct: m.last_ct, iv: m.last_iv, keys: m.last_keys, sender_device: m.last_device } : null,
    unread: current && current.id === m.id ? 0 : Number(m.unread) || 0 }));
  await Promise.all(convs.map(async c => { if (c.last) c.lastText = (await reveal(c.last)); }));
  sortConvs(); renderChats();
}
const sortConvs = () => convs.sort((a, b) => new Date((b.last && b.last.created_at) || b.last_at) - new Date((a.last && a.last.created_at) || a.last_at));
const otherOf = c => ((members.get(c.id) || []).find(m => m.user_id !== me.id) || {}).user_id;
const convTitle = c => c.is_group ? c.name : nameOf(otherOf(c));
function preview(m, r) {
  if (!m) return t('startChat'); if (m.deleted) return t('deletedShort');
  if (m.kind === 'image') return t('photo'); if (m.kind === 'voice') return t('voice');
  if (r && r.fail) return t('cantOpen'); return (r && r.text) || '';
}
function renderChats() {
  if (!me) return; const q = $('#search').value.trim().toLowerCase(), list = $('#chatList');
  const shown = convs.filter(c => !q || convTitle(c).toLowerCase().includes(q));
  list.innerHTML = shown.map(c => { const ttl = convTitle(c), mineLast = c.last && c.last.sender_id === me.id && !c.last.deleted;
    const who = c.is_group && c.last && !c.last.deleted && !mineLast ? nameOf(c.last.sender_id) + ': ' : '';
    return `<li data-c="${c.id}" class="${current && current.id === c.id ? 'on' : ''}${c.unread ? ' unread' : ''}">${avatarHtml(c.is_group ? c.id : otherOf(c), { group: c.is_group })}
<div class="mid"><b>${esc(ttl)}</b><small>${mineLast ? trail(c.last, c.id) : ''}<span class="pv">${esc(who + preview(c.last, c.lastText))}</span></small></div><div class="end">${c.last ? short(c.last.created_at) : ''}${c.unread ? `<span class="pill">${c.unread}</span>` : ''}</div></li>`; }).join('')
    || `<p class="hint pad">${t(q ? 'noResults' : 'noChats')}</p>`;
  const u = convs.reduce((a, c) => a + c.unread, 0); $('#unreadAll').hidden = !u; $('#unreadAll').textContent = u;
}
$('#search').oninput = renderChats;
$('#chatList').onclick = e => { const li = e.target.closest('li[data-c]'); if (li) openChat(li.dataset.c); };
$$('.seg button').forEach(b => b.onclick = () => { $$('.seg button').forEach(x => x.classList.toggle('on', x === b)); $('#chatsView').hidden = b.dataset.view !== 'chats'; $('#friendsView').hidden = b.dataset.view !== 'friends'; });

// ---------- friends ----------
async function loadFriends() {
  if (!me) return; const { data } = await sb.from('friendships').select('*').order('created_at', { ascending: false }); friends = data || [];
  await needProfiles(friends.flatMap(f => [f.requester, f.addressee]));
  const other = f => f.requester === me.id ? f.addressee : f.requester, row = (id, extra) => { const p = profiles.get(id) || {};
    return `<div class="frow">${avatarHtml(id)}<div class="mid"><b>${esc(nameOf(id))}</b><small><span dir="ltr">@${esc(p.username)}</span>${nicks.has(id) ? ' · ' + esc(p.display_name) : ''}</small></div>${extra}</div>`; };
  const inc = friends.filter(f => f.status === 'pending' && f.addressee === me.id), out = friends.filter(f => f.status === 'pending' && f.requester === me.id), acc = friends.filter(f => f.status === 'accepted');
  $('#friendsBox').innerHTML = (inc.length ? `<div class="sec">${t('reqForYou')}</div>` + inc.map(f => row(f.requester, `<button class="btn small primary" data-acc="${f.id}">${t('accept')}</button><button class="btn small ghost" data-dec="${f.id}">${t('decline')}</button>`)).join('') : '')
    + `<div class="sec">${t('myFriends')}</div>` + (acc.map(f => row(other(f), `<button class="btn small primary" data-dm="${other(f)}">${t('message')}</button><button class="icon-btn" data-nick="${other(f)}" title="${t('renameHere')}">${ic('edit')}</button><button class="icon-btn danger" data-rm="${f.id}" title="${t('del')}">${ic('trash')}</button>`)).join('') || `<p class="hint pad">${t('noFriends')}</p>`)
    + (out.length ? `<div class="sec">${t('sentReqs')}</div>` + out.map(f => row(f.addressee, `<button class="btn small ghost" data-rm="${f.id}">${t('cancel')}</button>`)).join('') : '');
  $('#reqCount').hidden = !inc.length; $('#reqCount').textContent = inc.length;
}
$('#addFriend').onsubmit = async e => {
  e.preventDefault(); const u = $('#addUser').value.trim().toLowerCase().replace(/^@/, ''), msg = $('#addMsg'); msg.textContent = '';
  if (!u) return; if (u === me.username) return msg.textContent = t('thatsYou');
  const { data: p } = await sb.from('profiles').select('*').eq('username', u).maybeSingle(); if (!p) return msg.textContent = t('noUser');
  profiles.set(p.id, p);
  const ex = friends.find(f => (f.requester === p.id && f.addressee === me.id) || (f.requester === me.id && f.addressee === p.id));
  if (ex && ex.status === 'accepted') return msg.textContent = t('alreadyFriend');
  if (ex && ex.requester === p.id) { await sb.rpc('respond_friend', { fid: ex.id, accept: true }); msg.textContent = t('theyAsked'); }
  else if (ex) return msg.textContent = t('alreadyAsked');
  else { const { error } = await sb.from('friendships').insert({ addressee: p.id }); if (error) return msg.textContent = errText(error); msg.textContent = t('sentReq', { n: p.display_name }); }
  $('#addUser').value = ''; loadFriends();
};
$('#friendsBox').onclick = async e => { const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.acc) await sb.rpc('respond_friend', { fid: +b.dataset.acc, accept: true });
  if (b.dataset.dec) await sb.rpc('respond_friend', { fid: +b.dataset.dec, accept: false });
  if (b.dataset.nick) return rename(b.dataset.nick);
  if (b.dataset.rm) { if (!confirm(t('sure'))) return; await sb.from('friendships').delete().eq('id', +b.dataset.rm); }
  if (b.dataset.dm) { const { data, error } = await sb.rpc('start_dm', { other: b.dataset.dm }); if (error) return toast(errText(error)); await loadChats(); $('.seg button[data-view=chats]').click(); return openChat(data); }
  loadFriends(); };

// ---------- dialogs ----------
function dialog(html, onClose) { const d = $('#dlg'); $('#dlgBody').innerHTML = html; d.returnValue = ''; d.onclose = () => onClose && onClose(d.returnValue); d.showModal(); }
$('#newGroupBtn').onclick = () => {
  const acc = friends.filter(f => f.status === 'accepted').map(f => f.requester === me.id ? f.addressee : f.requester);
  if (!acc.length) return toast(t('addFriendsFirst'));
  dialog(`<h3>${t('newGroup')}</h3><input id="gName" placeholder="${t('groupName')}" maxlength="60"><div class="sec flush">${t('pickMembers')}</div><div class="scroll">${acc.map(id => `<label class="chk">${avatarHtml(id, { cls: 'sm' })}<span>${esc(nameOf(id))}</span><input type="checkbox" value="${id}"></label>`).join('')}</div>
<div class="row"><button value="x" class="btn ghost">${t('cancel')}</button><button value="ok" class="btn primary">${t('create2')}</button></div>`, async v => {
    if (v !== 'ok') return; const name = $('#gName').value.trim(), ids = $$('#dlgBody input[type=checkbox]:checked').map(i => i.value);
    if (!name) return toast(t('needGroupName')); const { data, error } = await sb.rpc('create_group', { gname: name, member_ids: ids }); if (error) return toast(errText(error));
    await loadChats(); openChat(data); });
};
$('#infoBtn').onclick = async () => {
  if (!current) return; const c = current, ms = members.get(c.id) || [], admin = ms.some(m => m.user_id === me.id && m.role === 'admin');
  const addable = friends.filter(f => f.status === 'accepted').map(f => f.requester === me.id ? f.addressee : f.requester).filter(id => !ms.some(m => m.user_id === id));
  let safety = '';
  if (!c.is_group) { const other = otherOf(c), devs = (await devicesFor(c.id, true)); const mine = devs.filter(d => d.user_id === me.id).map(d => d.pub), theirs = devs.filter(d => d.user_id === other).map(d => d.pub);
    if (mine.length && theirs.length) safety = `<div class="safety"><div class="sec flush">${ic('shield')} ${t('safety')}</div><div class="code" dir="ltr">${await HC.safety([...mine, ...theirs])}</div><p class="muted small">${t('safetyNote')}</p></div>`; }
  dialog(`<div class="info-head">${avatarHtml(c.is_group ? c.id : otherOf(c), { group: c.is_group, cls: 'xl' })}<h3>${esc(convTitle(c))}</h3></div>
<div class="sec flush">${t('members')}</div><div class="scroll">${ms.map(m => `<div class="frow flush">${avatarHtml(m.user_id, { cls: 'sm' })}<div class="mid"><b>${esc(nameOf(m.user_id))}${m.user_id === me.id ? ' · ' + t('you') : ''}</b><small dir="ltr">@${esc((profiles.get(m.user_id) || {}).username)}${m.role === 'admin' ? ' · ' + t('admin') : ''}</small></div></div>`).join('')}</div>
${c.is_group && admin && addable.length ? `<div class="sec flush">${t('addMembers')}</div>${addable.map(id => `<label class="chk">${avatarHtml(id, { cls: 'sm' })}<span>${esc(nameOf(id))}</span><input type="checkbox" value="${id}"></label>`).join('')}` : ''}
${safety}
<div class="row">${c.is_group ? `<button value="leave" class="btn ghost danger">${t('leaveGroup')}</button>` : `<button value="nick" class="btn ghost">${t('renameHere')}</button>`}<button value="x" class="btn ghost">${t('close')}</button>${c.is_group && admin && addable.length ? `<button value="ok" class="btn primary">${t('add')}</button>` : ''}</div>`, async v => {
    if (v === 'nick') return rename(otherOf(c));
    if (v === 'leave') { if (!confirm(t('leaveSure'))) return; await sb.from('members').delete().eq('conversation_id', c.id).eq('user_id', me.id); closeChat(); return loadChats(); }
    if (v === 'ok') { for (const i of $$('#dlgBody input[type=checkbox]:checked')) await sb.rpc('add_to_group', { c: c.id, uid: i.value }); devsByConv.delete(c.id); await loadChats(); openChat(c.id, true); }
  });
};
function rename(id) {
  if (!id) return; const p = profiles.get(id) || {};
  dialog(`<h3>${t('renameTitle')}</h3><p class="muted">${esc(t('renameNote', { n: p.display_name || '' }))}</p><input id="nickIn" maxlength="40" value="${esc(nicks.get(id) || '')}" placeholder="${esc(p.display_name || '')}">
<div class="row">${nicks.has(id) ? `<button value="reset" class="btn ghost">${t('resetName')}</button>` : ''}<button value="x" class="btn ghost">${t('cancel')}</button><button value="ok" class="btn primary">${t('save')}</button></div>`, async v => {
    if (v === 'reset') { await sb.from('contact_names').delete().eq('target', id); nicks.delete(id); return afterRename(); }
    if (v !== 'ok') return; const n = $('#nickIn').value.trim(); await sb.from('contact_names').delete().eq('target', id);
    if (n && n !== p.display_name) { const { error } = await sb.from('contact_names').insert({ target: id, name: n }); if (error) return toast(errText(error)); nicks.set(id, n); } else nicks.delete(id);
    afterRename(); toast(t('saved')); });
}
function afterRename() { loadFriends(); renderChats(); if (current) { $('#roomName').textContent = convTitle(current); updateStatus(); $$('.m').forEach(el => { const m = msgsById.get(+el.dataset.id); if (m) paintMsg(el, m); }); } }

// ---------- a chat ----------
async function openChat(id, quiet) {
  const c = convs.find(x => x.id === id); if (!c) return;
  if (!quiet && (!current || current.id !== id)) { if (history.state && history.state.v === 'chat') history.replaceState({ v: 'chat' }, ''); else history.pushState({ v: 'chat' }, ''); }
  current = c; c.unread = 0; replyTo = null; $('#replyBox').hidden = true; msgsById.clear(); typers.clear(); joinTyping(c.id);
  $('#empty').hidden = true; $('#room').hidden = false; $('#app').classList.add('open');
  $('#roomName').textContent = convTitle(c); avatarInto($('#roomAv'), c.is_group ? c.id : otherOf(c), c.is_group); $('#roomSub').textContent = subtitle(c); $('#roomSub').className = ''; updateStatus();
  renderChats(); $('#msgs').innerHTML = `<div class="day">${t('loading')}</div>`; devicesFor(c.id);
  const { data, error } = await sb.from('messages').select('*').eq('conversation_id', id).order('id', { ascending: false }).limit(150);
  if (current !== c) return; if (error) { $('#msgs').innerHTML = ''; return toast(errText(error)); }
  const rows = (data || []).reverse(); await Promise.all(rows.map(reveal)); if (current !== c) return;
  $('#msgs').innerHTML = ''; addMsg.bulk = true; rows.forEach(addMsg); addMsg.bulk = false; note(); scrollDown(); markRead(); viewing(true);
  if (!/Mobi|Android|iPhone|iPad/.test(navigator.userAgent)) $('#text').focus();
}
function closeChat(fromHistory) {
  stopTyping(); leaveTyping(); viewing(false); current = null; $('#app').classList.remove('open'); renderChats();
  setTimeout(() => { if (!current) { $('#room').hidden = true; $('#empty').hidden = false; } }, 260);
  if (!fromHistory && history.state && history.state.v === 'chat') history.back();
}
$('#backBtn').onclick = () => closeChat();
const scrollDown = () => { const b = $('#msgs'); b.scrollTop = b.scrollHeight; };
async function markRead() { if (!current) return; current.last_read = new Date().toISOString(); await sb.rpc('mark_read', { c: current.id, receipts: myPres.receipts }); }

function msgHtml(m) {
  const mine = m.sender_id === me.id, r = plain.get(m.id + ':' + m.iv) || (m.enc !== 1 ? { text: m.body || '', old: true } : { fail: true }), q = m.reply_to && msgsById.get(m.reply_to);
  let body = '';
  if (m.deleted) body = `<span class="gone">${t('deletedMsg')}</span>`;
  else if (r.fail) body = `<span class="gone">${t('cantOpen')}</span>`;
  else if (m.kind === 'image') body = `<img data-media="${esc(m.media_path)}" data-mid="${m.id}" alt="">` + (r.text ? `<div>${esc(r.text)}</div>` : '');
  else if (m.kind === 'voice') body = `<audio controls preload="none" data-media="${esc(m.media_path)}" data-mid="${m.id}"></audio>`;
  else body = esc(r.text);
  const qr = q && (plain.get(q.id + ':' + q.iv) || (q.enc !== 1 ? { text: q.body } : { fail: true }));
  return `${current.is_group && !mine ? `<div class="who" style="color:${colorOf(m.sender_id)}">${esc(nameOf(m.sender_id))}</div>` : ''}
${q ? `<div class="q" data-jump="${q.id}"><b>${esc(q.sender_id === me.id ? t('you') : nameOf(q.sender_id))}</b> ${esc(q.deleted ? t('deletedMsg') : preview(q, qr))}</div>` : ''}
<div class="body">${body}</div><div class="meta">${r.old && !m.deleted ? `<span class="old">${t('oldMsg')}</span>` : ''}${m.edited_at && !m.deleted ? `<span>${t('edited')}</span>` : ''}<span>${fmtTime(m.created_at)}</span>${mine && !m.deleted ? trail(m, current.id) : ''}</div>
${m.deleted || r.fail ? '' : `<div class="tools"><button data-act="reply" title="${t('reply')}">${ic('reply')}</button>${mine && m.kind === 'text' ? `<button data-act="edit" title="${t('edit')}">${ic('edit')}</button>` : ''}${mine ? `<button data-act="del" title="${t('del')}">${ic('trash')}</button>` : ''}${m.kind === 'text' ? `<button data-act="copy" title="${t('copy')}">${ic('copy')}</button>` : ''}</div>`}`;
}
function paintMsg(el, m) { el.className = 'm' + (m.sender_id === me.id ? ' mine' : '') + (m.deleted ? ' del' : ''); el.innerHTML = msgHtml(m); loadMedia(el); }
function addMsg(m) {
  const box = $('#msgs'), day = fmtDay(m.created_at);
  if (!box.querySelector('.m') || box.dataset.lastDay !== day) { box.insertAdjacentHTML('beforeend', `<div class="day">${day}</div>`); box.dataset.lastDay = day; }
  msgsById.set(m.id, m); const el = document.createElement('div'); el.dataset.id = m.id; paintMsg(el, m); box.appendChild(el); if (!addMsg.bulk) note();
}
async function updateMsg(m) { msgsById.set(m.id, m); await reveal(m); const el = $(`.m[data-id="${m.id}"]`); if (el) paintMsg(el, m); }
async function mediaUrl(m) {
  if (urlCache.has(m.media_path)) return urlCache.get(m.media_path);
  let u;
  if (m.enc === 1) {   // encrypted bytes: download, decrypt on the phone, show from memory
    const r = await reveal(m); if (!r.K || !r.payload || !r.payload.mi) return null;
    const { data, error } = await sb.storage.from('media').download(m.media_path); if (error) return null;
    const bytes = await HC.openBytes(r.K, r.payload.mi, new Uint8Array(await data.arrayBuffer()));
    u = URL.createObjectURL(new Blob([bytes], { type: r.payload.mt || (m.kind === 'image' ? 'image/jpeg' : 'audio/webm') }));
  } else { const { data } = await sb.storage.from('media').createSignedUrl(m.media_path, 300); u = data && data.signedUrl; if (u) setTimeout(() => urlCache.delete(m.media_path), 240000); }
  if (u) urlCache.set(m.media_path, u); return u;
}
function loadMedia(el) { el.querySelectorAll('[data-media]').forEach(async x => { const m = msgsById.get(+x.dataset.mid); const u = m && await mediaUrl(m); if (u) { x.src = u; if (x.tagName === 'IMG') x.onload = () => { const b = $('#msgs'); if (b.scrollHeight - b.scrollTop - b.clientHeight < 400) scrollDown(); }; } }); }

$('#msgs').onclick = async e => {
  const el = e.target.closest('.m'); if (!el) return; const m = msgsById.get(+el.dataset.id), r = m && plain.get(m.id + ':' + m.iv);
  $$('.m.show').forEach(x => x !== el && x.classList.remove('show')); el.classList.toggle('show');
  const jump = e.target.closest('[data-jump]'); if (jump) { const x = $(`.m[data-id="${jump.dataset.jump}"]`); if (x) { x.scrollIntoView({ block: 'center', behavior: 'smooth' }); x.classList.add('flash'); setTimeout(() => x.classList.remove('flash'), 1500); } return; }
  if (e.target.tagName === 'IMG' && e.target.src) { const v = document.createElement('div'); v.className = 'viewer'; const im = document.createElement('img'); im.src = e.target.src; v.appendChild(im); v.onclick = () => v.remove(); document.body.appendChild(v); return; }
  const act = e.target.closest('[data-act]'); if (!act || !m) return; const a = act.dataset.act, text = r ? r.text : (m.body || '');
  if (a === 'reply') { replyTo = m; $('#replyText').textContent = (m.sender_id === me.id ? t('you') : nameOf(m.sender_id)) + ': ' + preview(m, r); $('#replyBox').hidden = false; $('#text').focus(); }
  if (a === 'copy') { try { await navigator.clipboard.writeText(text); toast(t('copied')); } catch {} }
  if (a === 'edit') { const n = prompt(t('editTitle'), text); if (n == null || !n.trim() || n === text) return; await editMsg(m, n.trim()); }
  if (a === 'del') { if (!confirm(t('delSure'))) return; const { error } = await sb.from('messages').update({ deleted: true }).eq('id', m.id); if (error) toast(errText(error)); }
};
$('#replyX').onclick = () => { replyTo = null; $('#replyBox').hidden = true; };

// ---------- sending (everything is encrypted before it leaves the phone) ----------
const ta = $('#text');
ta.oninput = e => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; if (e) ta.value.trim() ? typing() : stopTyping(); };
ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !/Mobi/.test(navigator.userAgent)) { e.preventDefault(); $('#composer').requestSubmit(); } };
async function recipients(c) {   // every device that must be able to open the message
  let devs = await devicesFor(c.id, true);
  const missing = (members.get(c.id) || []).map(m => m.user_id).filter(u => u !== me.id && !devs.some(d => d.user_id === u));
  if (!devs.some(d => d.device_id === myDev.id)) devs = [...devs, { user_id: me.id, device_id: myDev.id, pub: myDev.pub }];
  return { devs, missing };
}
async function send({ kind = 'text', text = '', media = null }) {
  const c = current; if (!c || !myDev) return;
  const { devs, missing } = await recipients(c);
  if (!c.is_group && missing.length) return toast(t('needsUpdate', { n: nameOf(missing[0]) }));
  if (c.is_group && missing.length) toast(t('someNoKey', { n: list(missing.map(nameOf)) }));
  const K = HC.newKey(), payload = { t: text, k: kind }; let path = null;
  if (media) { const sealed = await HC.sealBytes(K, new Uint8Array(await media.blob.arrayBuffer())); path = `${c.id}/${crypto.randomUUID()}`;
    const { error } = await sb.storage.from('media').upload(path, new Blob([sealed.data], { type: 'application/octet-stream' }), { contentType: 'application/octet-stream' }); if (error) throw error;
    payload.mi = sealed.iv; payload.mt = media.type; }
  const box = await HC.seal(payload, myDev, devs, K);
  const row = { conversation_id: c.id, kind, reply_to: replyTo ? replyTo.id : null, media_path: path, enc: 1, ct: box.ct, iv: box.iv, keys: box.keys, sender_device: myDev.id };
  replyTo = null; $('#replyBox').hidden = true;
  const { data, error } = await sb.from('messages').insert(row).select().single(); if (error) return toast(t('notSent', { e: errText(error) }));
  plain.set(data.id + ':' + data.iv, { text, payload, K });
  if (!msgsById.has(data.id) && current && current.id === data.conversation_id) { addMsg(data); scrollDown(); }
  bumpConv(data);
  sb.functions.invoke('push', { body: { message_id: data.id } }).catch(() => {});
}
async function editMsg(m, text) {
  const c = current; const { devs } = await recipients(c), old = plain.get(m.id + ':' + m.iv) || {};
  const box = await HC.seal({ ...(old.payload || {}), t: text, k: m.kind }, myDev, devs);
  const { error } = await sb.from('messages').update({ ct: box.ct, iv: box.iv, keys: box.keys, edited_at: new Date().toISOString() }).eq('id', m.id);
  if (error) return toast(errText(error)); plain.set(m.id + ':' + box.iv, { text, payload: { ...(old.payload || {}), t: text } });
}
$('#composer').onsubmit = e => { e.preventDefault(); const s = ta.value.trim(); if (!s) return; stopTyping(); ta.value = ''; ta.oninput(); send({ text: s }).catch(x => toast(t('notSent', { e: errText(x) }))); };
$('#attachBtn').onclick = () => $('#fileIn').click();
$('#fileIn').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f || !current) return;
  if (!/^image\/(png|jpeg|webp|gif|heic|heif)$/i.test(f.type) && !/^image\//.test(f.type)) return; if (f.size > 10 * 1024 * 1024) return toast(t('imgBig'));
  toast(t('sendingImg')); try { await send({ kind: 'image', media: await shrink(f) }); } catch (x) { toast(t('notSent', { e: errText(x) })); } };
async function shrink(f) {   // redraw every picture: smaller, and no hidden location data
  const bmp = await createImageBitmap(f), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
  return { blob: await new Promise(r => c.toBlob(r, 'image/jpeg', .85)), type: 'image/jpeg' };
}
let rec = null, chunks = [];
$('#micBtn').onclick = async () => {
  if (rec) { rec.stop(); return; } if (!current) return;
  try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(x => window.MediaRecorder && MediaRecorder.isTypeSupported(x)) || '';
    rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined); chunks = []; const conv = current.id, started = Date.now();
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = async () => { stream.getTracks().forEach(x => x.stop()); $('#micBtn').classList.remove('rec'); $('#micBtn').innerHTML = ic('mic'); const r = rec; rec = null;
      if (Date.now() - started < 800 || !current || current.id !== conv) return;
      const base = (r.mimeType || 'audio/webm').split(';')[0], blob = new Blob(chunks, { type: base }); if (blob.size > 10 * 1024 * 1024) return toast(t('imgBig'));
      try { toast(t('sendingVoice')); await send({ kind: 'voice', media: { blob, type: base } }); } catch (x) { toast(t('notSent', { e: errText(x) })); } };
    rec.start(); $('#micBtn').classList.add('rec'); $('#micBtn').innerHTML = ic('stop'); toast(t('recording'));
  } catch { toast(t('allowMic')); }
};

// ---------- live updates ----------
function bumpConv(m) { const c = convs.find(x => x.id === m.conversation_id); if (!c) return loadChats();
  c.last = m; c.lastText = plain.get(m.id + ':' + m.iv) || (m.enc !== 1 ? { text: m.body } : null); if (!(current && current.id === c.id) && m.sender_id !== me.id) c.unread++;
  sortConvs(); renderChats(); }
async function live() {
  for (const ch of sb.getChannels().filter(x => x.topic.endsWith('hamsa-live'))) await sb.removeChannel(ch);
  sb.channel('hamsa-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async ({ new: m }) => {
      await needProfiles([m.sender_id]); if (m.sender_id !== me.id) delivered(); await reveal(m);
      if (current && current.id === m.conversation_id && !msgsById.has(m.id)) { const b = $('#msgs'), near = b.scrollHeight - b.scrollTop - b.clientHeight < 200; addMsg(m); if (near || m.sender_id === me.id) scrollDown(); if (!document.hidden) markRead(); }
      bumpConv(m); typers.delete(m.sender_id);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, async ({ new: m }) => {
      if (current && current.id === m.conversation_id) await updateMsg(m); const c = convs.find(x => x.id === m.conversation_id);
      if (c && c.last && c.last.id === m.id) { c.last = m; c.lastText = await reveal(m); renderChats(); } })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, async ({ eventType, new: f }) => {
      await loadFriends();
      if (eventType === 'INSERT' && f.addressee === me.id) toast(t('newReq', { n: nameOf(f.requester) }));
      if (eventType === 'UPDATE' && f.status === 'accepted' && f.requester === me.id) toast(t('accepted', { n: nameOf(f.addressee) }));
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'members', filter: `user_id=eq.${me.id}` }, () => loadChats())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'members' }, ({ new: r }) => {
      const list = members.get(r.conversation_id); const x = list && list.find(m => m.user_id === r.user_id); if (!x || r.user_id === me.id) return;
      Object.assign(x, { delivered_at: r.delivered_at, seen_at: r.seen_at, last_read: r.last_read }); refreshTrail(r.conversation_id); })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, ({ new: p }) => { if (profiles.has(p.id)) { profiles.set(p.id, p); if (p.id === me.id) { me = p; paintMe(); } renderChats(); } })
    .subscribe();
}

// ---------- staying in sync (phones pause the live connection in the background) ----------
let lastSync = 0;
const liveCh = () => sb.getChannels().find(x => x.topic.endsWith('hamsa-live'));
async function resync() {
  if (!me || Date.now() - lastSync < 3000) return; lastSync = Date.now();
  const ch = liveCh(); if (!ch || ch.state !== 'joined') await live();
  if (current && (!typingCh || typingCh.state !== 'joined')) joinTyping(current.id);
  await Promise.all([loadChats(), loadFriends()]); delivered();
  if (current) { const lastId = Math.max(0, ...[...msgsById.keys()]);
    const { data } = await sb.from('messages').select('*').eq('conversation_id', current.id).gt('id', lastId).order('id');
    for (const m of data || []) { await reveal(m); if (!msgsById.has(m.id)) addMsg(m); } if (data && data.length) { scrollDown(); markRead(); } }
}
// presence: always reported (the server needs "inside this chat" to skip notifications). If you hide your status,
// the database itself stops friends from reading it (rule presence_read).
const viewing = on => me ? sb.rpc('touch_presence', { c: on && current ? current.id : null, on_line: true }).then(() => {}) : null;
function goOffline() { if (!me || !accessToken) return; try { fetch(HAMSA.url + '/rest/v1/rpc/touch_presence', { method: 'POST', keepalive: true, headers: { apikey: HAMSA.key, Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ c: null, on_line: false }) }).catch(() => {}); } catch {} }
let skew = 0; async function syncClock() { const t0 = Date.now(), { data } = await sb.rpc('server_now'); if (data) skew = new Date(data).getTime() - (t0 + Date.now()) / 2; }
const srvNow = () => Date.now() + skew;
let delT = 0, delPend = null;
function delivered() { if (!me) return; const wait = 2000 - (Date.now() - delT); if (wait > 0) { if (!delPend) delPend = setTimeout(() => { delPend = null; delivered(); }, wait); return; } delT = Date.now(); sb.rpc('mark_delivered').then(() => {}); }
setInterval(() => { if (me && !document.hidden) viewing(!!current); }, 10000);
setInterval(() => { if (me && !document.hidden) { const ch = liveCh(); if (!ch || ch.state !== 'joined') resync(); } }, 8000);
setInterval(() => { if (me && !document.hidden) resync(); }, 45000);
document.addEventListener('visibilitychange', () => { if (document.hidden) { goOffline(); stopTyping(); } else { if (current) { markRead(); updateStatus(); } viewing(!!current); delivered(); resync(); checkUpdate(); } });
addEventListener('pagehide', goOffline);
addEventListener('online', () => resync());
addEventListener('focus', () => resync());

// ---------- the whisper's trail: 1 dot sent · 2 reached their phone · 3 read ----------
function stateOf(m, convId) {
  const others = (members.get(convId) || []).filter(x => x.user_id !== me.id), tm = new Date(m.created_at).getTime(), at = v => v && new Date(v).getTime() >= tm;
  const seen = others.filter(x => at(x.seen_at)), got = others.filter(x => at(x.delivered_at) || at(x.seen_at));
  const s = !others.length ? 1 : myPres.receipts && seen.length === others.length ? 3 : got.length === others.length ? 2 : 1;
  return { s, others, seen, got, at };
}
function trail(m, convId) { const { s } = stateOf(m, convId); return `<span class="trail s${s}" data-trail="${m.id}" title="${t(['', 'sentS', 'deliveredS', 'readS'][s])}"><i></i><i></i><i></i></span>`; }
function refreshTrail(convId) {
  if (current && current.id === convId) $$('.m.mine').forEach(el => { const m = msgsById.get(+el.dataset.id), old = el.querySelector('.trail'); if (!m || !old) return;
    const before = old.className; old.outerHTML = trail(m, convId); const now = el.querySelector('.trail'); if (now.className !== before) now.classList.add('lit'); });
  note(); renderChats();
}
function note() {
  const box = $('#msgs'); if (!box || !current) return; box.querySelector('.dnote')?.remove();
  const last = [...msgsById.values()].filter(m => !m.deleted).pop(); if (!last || last.sender_id !== me.id) return;
  const { s, others, seen, got } = stateOf(last, current.id), age = (srvNow() - new Date(last.created_at)) / 1000, lastSeen = seen.map(x => x.seen_at).sort().pop();
  let text = '', cls = '';
  if (s === 3) { text = current.is_group ? t('readAll') : t('readAt', { t: fmtTime(lastSeen) }); cls = 'seen'; }
  else if (current.is_group && myPres.receipts && seen.length) text = t('readSome', { a: seen.length, b: others.length });
  else if (s === 2) text = current.is_group ? t('deliveredAll') : t('deliveredS');
  else if (age > 25) { text = current.is_group ? t('notDeliveredGroup', { a: got.length, b: others.length }) : t('notDelivered'); cls = 'wait'; }
  else text = t('sentS');
  box.insertAdjacentHTML('beforeend', `<div class="dnote ${cls}">${esc(text)}</div>`);
}
setInterval(() => { if (current && !document.hidden) note(); }, 10000);
document.addEventListener('click', e => {
  const tr = e.target.closest('[data-trail]'); if (!tr || !current) return; e.stopPropagation();
  const m = msgsById.get(+tr.dataset.trail); if (!m) return; const { others, at } = stateOf(m, current.id), lines = [t('sentAt', { t: fmtTime(m.created_at) })];
  for (const x of others) lines.push((current.is_group ? nameOf(x.user_id) + ': ' : '') + (myPres.receipts && at(x.seen_at) ? t('readAt', { t: fmtTime(x.seen_at) }) : at(x.delivered_at) ? t('deliveredAt', { t: fmtTime(x.delivered_at) }) : t('notYet')));
  toast(lines.join('\n'));
}, true);

// ---------- the line under the name: typing / in the chat / online / last seen ----------
function subtitle(c) { return c.is_group ? list((members.get(c.id) || []).map(m => m.user_id === me.id ? t('you') : nameOf(m.user_id))) : '@' + ((profiles.get(otherOf(c)) || {}).username || ''); }
const ago = d => { const s = (srvNow() - new Date(d)) / 1000; if (s < 60) return t('justNow'); if (s < 3600) { const m = Math.round(s / 60); return m === 1 ? t('minAgo') : t('minsAgo', { n: m }); }
  return new Date(d).toDateString() === new Date().toDateString() ? t('todayAt', { t: fmtTime(d) }) : fmtDay(d) + ' ' + fmtTime(d); };
async function updateStatus() {
  const c = current; if (!c || !me) return; const el = $('#roomSub'); if (typers.size) return showTyping();
  if (!myPres.visible) { el.textContent = subtitle(c); el.className = ''; return; }
  const ids = (members.get(c.id) || []).map(m => m.user_id).filter(id => id !== me.id);
  const { data } = await sb.from('presence').select('user_id,last_seen,viewing_conv,viewing_at,online').in('user_id', ids); if (current !== c || typers.size) return;
  const now = srvNow(), on = p => p.online && p.last_seen && now - new Date(p.last_seen) < 25000, inChat = (data || []).filter(p => on(p) && p.viewing_conv === c.id && p.viewing_at), online = (data || []).filter(on);
  if (!c.is_group) { const p = (data || [])[0];
    el.textContent = inChat.length ? t('inChat') : online.length ? t('online') : p && p.last_seen ? t('lastSeen', { t: ago(p.last_seen) }) : subtitle(c);
  } else el.textContent = inChat.length ? t('inChatList', { n: list(inChat.map(p => nameOf(p.user_id))) }) : online.length ? t('onlineList', { n: list(online.map(p => nameOf(p.user_id))) }) : subtitle(c);
  el.className = inChat.length ? 'live' : online.length ? 'on' : '';
}
setInterval(() => { if (current && !document.hidden) updateStatus(); }, 6000);
let typingCh = null, typingConv = null, lastTyping = 0; const typers = new Map();
function joinTyping(convId) {   // private channel: only members of this chat can join it (rule typing_members)
  leaveTyping(); typingConv = convId;
  typingCh = sb.channel('typing-' + convId, { config: { private: true, broadcast: { self: false } } })
    .on('broadcast', { event: 'typing' }, ({ payload }) => { if (!payload || payload.u === me.id || typingConv !== convId) return; if (payload.stop) typers.delete(payload.u); else typers.set(payload.u, Date.now() + 4500); showTyping(); })
    .subscribe();
}
function leaveTyping() { if (typingCh) { sb.removeChannel(typingCh); typingCh = null; } typingConv = null; typers.clear(); }
function typing() { if (!typingCh || Date.now() - lastTyping < 2500) return; lastTyping = Date.now(); typingCh.send({ type: 'broadcast', event: 'typing', payload: { u: me.id } }); }
function stopTyping() { if (!typingCh || !lastTyping) return; lastTyping = 0; typingCh.send({ type: 'broadcast', event: 'typing', payload: { u: me.id, stop: true } }); }
function showTyping() { const now = Date.now(); for (const [u, x] of typers) if (x < now) typers.delete(u); if (!current) return; if (!typers.size) return updateStatus();
  const el = $('#roomSub'); el.textContent = current.is_group ? t('isTyping', { n: list([...typers.keys()].map(nameOf)) }) : t('typing'); el.className = 'live'; }
setInterval(() => { if (typers.size) showTyping(); }, 1000);

// ---------- settings: a real settings screen with its own pages ----------
const stPages = [];
function openSettings(page = 'main', push = true) {
  $('#settings').hidden = false; requestAnimationFrame(() => $('#settings').classList.add('open'));
  if (push) history.pushState({ v: 'settings', page }, '');
  stPages.push(page); renderSettings(page);
}
function closeSettings(silent) { const s = $('#settings'); s.classList.remove('open'); stPages.length = 0; setTimeout(() => { if (!stPages.length) s.hidden = true; }, 260); if (!silent && history.state && history.state.v === 'settings') history.back(); }
$('#settingsBtn').onclick = () => openSettings('main');
$('#stBack').onclick = () => history.back();
const row = (page, icon, label, value = '') => `<button class="st-row" data-page="${page}"><span class="st-ic">${ic(icon)}</span><span class="st-label">${label}</span><span class="st-val">${value}</span>${ic('fwd', 'chev')}</button>`;
const toggle = (id, label, note, on) => `<label class="st-toggle"><span><b>${label}</b>${note ? `<small>${note}</small>` : ''}</span><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i class="sw"></i></label>`;
const radio = (name, value, label, on) => `<label class="st-radio"><span>${label}</span><input type="radio" name="${name}" value="${value}" ${on ? 'checked' : ''}><i>${ic('check')}</i></label>`;
async function renderSettings(page) {
  const b = $('#stBody'), title = { main: 'settings', profile: 'profile', account: 'account', privacy: 'privacy', notif: 'notifications', look: 'appearance', lang: 'language', about: 'about' }[page];
  $('#stTitle').textContent = t(title); b.className = 'st-body page-in'; void b.offsetWidth; b.classList.add('go');
  const notifOn = pushOK() && Notification.permission === 'granted';
  if (page === 'main') b.innerHTML = `<button class="st-me" data-page="profile">${avatarHtml(me.id, { cls: 'xl' })}<span><b>${esc(me.display_name)}</b><small dir="ltr">@${esc(me.username)}</small></span>${ic('fwd', 'chev')}</button>
<div class="st-group">${row('account', 'key', t('account'))}${row('privacy', 'lock', t('privacy'))}${row('notif', 'bell', t('notifications'), notifOn ? '✓' : '')}</div>
<div class="st-group">${row('look', 'palette', t('appearance'), t(theme))}${row('lang', 'globe', t('language'), L().langName)}</div>
<div class="st-group">${row('about', 'info', t('about'), 'v' + VERSION)}</div>
<div class="st-group"><button class="st-row danger" id="stLogout"><span class="st-ic">${ic('out')}</span><span class="st-label">${t('logout')}</span></button></div>`;
  if (page === 'profile') b.innerHTML = `<div class="st-photo">${avatarHtml(me.id, { cls: 'xxl' })}<label class="cam">${ic('camera')}<input type="file" accept="image/*" id="photoIn" hidden></label></div>
<div class="st-group pad"><button class="btn ghost full" id="photoBtn">${t('changePhoto')}</button>${me.avatar_url ? `<button class="btn ghost full danger" id="photoDel">${t('removePhoto')}</button>` : ''}</div>
<div class="st-group pad"><label class="st-field"><span>${t('name')}</span><input id="sName" maxlength="40" value="${esc(me.display_name)}"></label><button class="btn primary full" id="nameSave">${t('save')}</button></div>
<div class="st-group pad"><label class="st-field"><span>${t('usernameFixed')}</span><input value="@${esc(me.username)}" dir="ltr" disabled></label></div>`;
  if (page === 'account') b.innerHTML = `<div class="st-group pad"><div class="st-h">${t('changePass')}</div><label class="st-field"><span>${t('currentPass')}</span><input type="password" id="pOld" dir="ltr" autocomplete="current-password"></label>
<label class="st-field"><span>${t('newPass')}</span><input type="password" id="pNew" dir="ltr" minlength="8" autocomplete="new-password"></label><button class="btn primary full" id="passSave">${t('save')}</button></div>
<div class="st-group"><button class="st-row danger" id="stLogout"><span class="st-ic">${ic('out')}</span><span class="st-label">${t('logout')}</span></button></div>`;
  if (page === 'privacy') b.innerHTML = `<div class="st-group">${toggle('tVis', t('showOnline'), t('showOnlineNote'), myPres.visible)}${toggle('tRec', t('readReceipts'), t('readReceiptsNote'), myPres.receipts)}</div>
<div class="st-group pad e2e"><div class="st-h">${ic('shield')} ${t('e2e')}</div><p class="muted">${t('e2eNote')}</p><p class="muted small">${t('thisDevice')}: <span dir="ltr">${esc((myDev && myDev.id || '').slice(0, 10))}</span></p></div>`;
  if (page === 'notif') b.innerHTML = `<div class="st-group">${toggle('tPush', t('newNotif'), t('notifNote'), notifOn)}</div>${installEvt || (isIOS && !installed()) ? `<div class="st-group">${row('install', 'install', t('installApp'))}</div>` : ''}`;
  if (page === 'look') b.innerHTML = `<div class="st-group">${radio('theme', 'dark', t('dark'), theme === 'dark')}${radio('theme', 'light', t('light'), theme === 'light')}${radio('theme', 'auto', t('auto'), theme === 'auto')}</div>`;
  if (page === 'lang') b.innerHTML = `<div class="st-group">${Object.entries(I18N).map(([k, v]) => radio('lang', k, v.langName, lang === k)).join('')}</div>`;
  if (page === 'about') b.innerHTML = `<div class="st-about"><img src="icon.svg" alt=""><b>همسة · Hamsa</b><span>${t('version', { v: VERSION })}</span><p class="muted">${t('aboutText')}</p><button class="btn ghost" id="updBtn">${t('checkUpdate')}</button></div>`;
}
$('#stBody').addEventListener('click', async e => {
  const r = e.target.closest('[data-page]'); if (r) { if (r.dataset.page === 'install') return installNow(); return openSettings(r.dataset.page); }
  if (e.target.closest('#stLogout')) return logout();
  if (e.target.closest('#photoBtn')) return $('#photoIn').click();
  if (e.target.closest('#photoDel')) return setPhoto(null);
  if (e.target.closest('#nameSave')) { const n = $('#sName').value.trim().slice(0, 40); if (!n) return; const { error } = await sb.from('profiles').update({ display_name: n }).eq('id', me.id); if (error) return toast(errText(error)); me.display_name = n; profiles.set(me.id, me); paintMe(); return toast(t('saved')); }
  if (e.target.closest('#passSave')) { const o = $('#pOld').value, n = $('#pNew').value; if (n.length < 8) return toast(t('errPass8'));
    const chk = await sb.auth.signInWithPassword({ email: `${me.username}@${HAMSA.emailDomain}`, password: o }); if (chk.error) return toast(t('wrongPass'));
    const { error } = await sb.auth.updateUser({ password: n }); if (error) return toast(errText(error)); await sb.auth.signOut({ scope: 'others' }); $('#pOld').value = $('#pNew').value = ''; return toast(t('passChanged')); }
  if (e.target.closest('#updBtn')) { const had = await checkUpdate(true); if (!had) toast(t('upToDate')); }
});
$('#stBody').addEventListener('change', async e => {
  const x = e.target;
  if (x.id === 'photoIn' && x.files[0]) return setPhoto(x.files[0]);
  if (x.id === 'tVis' || x.id === 'tRec') { myPres = { visible: $('#tVis').checked, receipts: $('#tRec').checked }; await sb.from('presence').upsert({ visible: myPres.visible, receipts: myPres.receipts }, { onConflict: 'user_id' }); if (current) { updateStatus(); refreshTrail(current.id); } return; }
  if (x.id === 'tPush') { if (x.checked) await enablePush(); else await disablePush(); renderSettings('notif'); return; }
  if (x.name === 'theme') return setTheme(x.value);
  if (x.name === 'lang') { setLang(x.value); renderSettings('lang'); }
});
async function setPhoto(file) {
  try {
    const old = me.avatar_url && me.avatar_url.split('/avatars/')[1];
    let url = null;
    if (file) { const bmp = await createImageBitmap(file), s = Math.min(bmp.width, bmp.height), c = document.createElement('canvas'); c.width = c.height = 384;
      c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 384, 384);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .86)), path = `${me.id}/${Date.now()}.jpg`;
      const { error } = await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' }); if (error) throw error;
      url = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl; }
    const { error } = await sb.from('profiles').update({ avatar_url: url }).eq('id', me.id); if (error) throw error;
    if (old) sb.storage.from('avatars').remove([decodeURIComponent(old)]).then(() => {});
    me.avatar_url = url; profiles.set(me.id, me); paintMe(); renderChats(); renderSettings('profile'); toast(t('photoSaved'));
  } catch (x) { toast(errText(x)); }
}
async function logout() {
  if (!confirm(t('logoutSure'))) return;
  try { await sb.rpc('touch_presence', { c: null, on_line: false }); await disablePush(true); if (myDev) { await sb.from('device_keys').update({ revoked: true }).eq('user_id', me.id).eq('device_id', myDev.id); await HC.forget(); } } catch {}
  closeSettings(true); await sb.auth.signOut();
}

// ---------- back button / swipe back: one step at a time, like a real app ----------
addEventListener('popstate', () => {
  if (stPages.length) { stPages.pop(); if (stPages.length) return renderSettings(stPages[stPages.length - 1]); return closeSettings(true); }
  if ($('#dlg').open) return $('#dlg').close();
  if (current) return closeChat(true);
});

// ---------- install as an app + phone notifications ----------
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pushOK = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('#installBtn').hidden = false; });
addEventListener('appinstalled', () => { $('#installBtn').hidden = true; toast(t('installed')); });
if (isIOS && !installed()) $('#installBtn').hidden = false;
const iosHelp = () => dialog(`<h3>${t('iosTitle')}</h3><ol class="steps"><li>${t('ios1')}</li><li>${t('ios2')}</li><li>${t('ios3')}</li><li>${t('ios4')}</li></ol><p class="muted">${t('iosNote')}</p><div class="row"><button value="x" class="btn primary">${t('ok')}</button></div>`);
async function installNow() { if (installEvt) { installEvt.prompt(); await installEvt.userChoice; installEvt = null; $('#installBtn').hidden = true; } else if (isIOS) iosHelp(); }
$('#installBtn').onclick = installNow;
const b64u = s => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
async function subscribe(quiet) {
  const reg = await Promise.race([navigator.serviceWorker.ready, sleep(8000).then(() => { throw new Error('sw'); })]);
  const { publicKey } = await fetch(HAMSA.url + '/functions/v1/push', { headers: { apikey: HAMSA.key } }).then(r => r.json()); if (!publicKey) throw new Error('key');
  let sub = await reg.pushManager.getSubscription();
  for (let i = 0; i < 2; i++) {
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(publicKey) });
    const j = sub.toJSON(); await sb.from('push_subscriptions').delete().eq('endpoint', j.endpoint);
    const { error } = await sb.from('push_subscriptions').insert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, device_id: myDev ? myDev.id : null });
    if (!error) break; await sub.unsubscribe(); sub = null; if (i) throw error;
  }
  if (!quiet) toast(t('pushOn'));
}
async function enablePush() {
  if (!pushOK()) return isIOS && !installed() ? iosHelp() : toast(t('pushUnsupported'));
  const p = await new Promise(res => { let d = false; const fin = v => { if (!d) { d = true; res(v); } }; try { const r = Notification.requestPermission(fin); if (r && r.then) r.then(fin, () => fin('denied')); } catch { fin('denied'); } });
  if (p !== 'granted') return toast(t('pushBlocked'));
  try { await subscribe(false); } catch (x) { toast(errText(x)); } $('#pushBar').hidden = true;
}
async function disablePush(quiet) { try { const reg = await navigator.serviceWorker.getRegistration(), sub = reg && await reg.pushManager.getSubscription(); if (sub) { await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); } } catch {} if (!quiet) toast(t('pushOff')); }
$('#pushYes').onclick = enablePush;
$('#pushNo').onclick = () => { $('#pushBar').hidden = true; try { localStorage.setItem('hamsa-push-later', Date.now()); } catch {} };
function pushStart() {
  if (!pushOK()) { $('#pushBar').hidden = true; return; }
  if (Notification.permission === 'granted') return subscribe(true).catch(() => {});
  let later = 0; try { later = +localStorage.getItem('hamsa-push-later') || 0; } catch {}
  $('#pushBar').hidden = Notification.permission !== 'default' || Date.now() - later < 3 * 864e5;
}

// ---------- updates arrive by themselves ----------
let swReg = null, reloading = false;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => { swReg = r; r.update().catch(() => {}); }).catch(() => {});
  navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.open && me) openChat(e.data.open); });
  navigator.serviceWorker.addEventListener('controllerchange', () => {   // a new version took over: reload when it will not interrupt you
    if (reloading) return; const go = () => { reloading = true; try { sessionStorage.setItem('hamsa-updated', '1'); } catch {} location.reload(); };
    if (!ta.value.trim() && !rec && !$('#dlg').open) go(); else { const u = $('#updBar'); u.textContent = t('updateReady'); u.hidden = false; u.onclick = go; }
  });
}
async function checkUpdate(manual) { if (!swReg) return false; try { await swReg.update(); } catch {} return !!(swReg.installing || swReg.waiting); }
setInterval(() => { if (!document.hidden) checkUpdate(); }, 30 * 60000);
try { if (sessionStorage.getItem('hamsa-updated')) { sessionStorage.removeItem('hamsa-updated'); setTimeout(() => toast(t('updated')), 800); } } catch {}

// ---------- first screen ----------
applyLang(); setMode('in');
sb.auth.getSession().then(({ data }) => { if (!data.session) { if (!lang) $('#lang').hidden = false; else $('#auth').hidden = false; } });
