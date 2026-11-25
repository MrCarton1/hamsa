// همسة · the app. Data lives in Supabase and every read/write is checked by the database rules (setup.sql).
// Message content is end-to-end encrypted on the phone (crypto.js): the server only stores ciphertext.
const VERSION = '3.4.1';
// If the phone still shows an older page with these newer files, refresh everything once instead of breaking.
if (!document.getElementById('peopleBtn') || !document.getElementById('stkPanel') || !document.getElementById('call') || !document.getElementById('stories') || !document.getElementById('svMute')) {
  (async () => { try { const n = +sessionStorage.getItem('hamsa-fix') || 0; if (n > 2) return; sessionStorage.setItem('hamsa-fix', n + 1);
    if (self.caches) for (const k of await caches.keys()) await caches.delete(k);
    await Promise.all(['./', './index.html', './style.css', './app.js', './i18n.js', './crypto.js', './config.js', './sw.js'].map(u => fetch(u, { cache: 'reload' }).catch(() => {})));
    const r = await navigator.serviceWorker?.getRegistration(); if (r) await r.update().catch(() => {});
  } finally { location.reload(); } })();
  throw new Error('[hamsa] old page in cache, refreshing');
}
try { sessionStorage.removeItem('hamsa-fix'); } catch {}
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
  userPlus: 'M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 21c.7-4 3.6-6.5 7-6.5 1.4 0 2.7.4 3.8 1.1M19 14v6M16 17h6',
  smile: 'M14 21H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v6zM14 21v-2.5a4.5 4.5 0 0 1 4.5-4.5H21M8.5 13.5c.9 1 2 1.5 3.5 1.5M9 9v.5M15 9v.5',
  play: 'M8 5.5v13l11-6.5z', pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z', plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18',
  save: 'M6 3h12v18l-6-4-6 4zM12 7v6M9 10h6', kept: 'M6 3h12v18l-6-4-6 4z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z', video: 'M3 7h12v10H3zM15 10.5l6-3.5v10l-6-3.5',
  micOff: 'M9 9v2.5a3 3 0 0 0 5 2.2M15 10V6.5a3 3 0 0 0-5.7-1.3M5.5 11a6.5 6.5 0 0 0 10.6 5M18.5 11c0 .8-.1 1.5-.4 2.2M12 17.5V21M3 3l18 18',
  camOff: 'M3 7h12v10H3zM15 10.5l6-3.5v10l-6-3.5M3 3l18 18', flip: 'M4 9h12l-3-3M20 15H8l3 3', timer: 'M7 3h10M7 21h10M8 3v3l4 6-4 6v3M16 3v3l-4 6 4 6v3',
  chat: 'M4 5h16v11H9l-5 4z', eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  status: 'M12 3a9 9 0 0 1 0 18M12 21a9 9 0 0 1-6.4-2.6M3.6 15.5A9 9 0 0 1 3 12M3.6 8.5A9 9 0 0 1 5.6 5.6M8.5 3.6A9 9 0 0 1 12 3M12 8v8M8 12h8',
  sound: 'M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11', soundOff: 'M4 9h4l5-4v14l-5-4H4zM16 9l5 6M21 9l-5 6',
  photo: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9.5v.01', text: 'M5 6h14M12 6v13',
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
const blobCache = new Map(), profiles = new Map(), members = new Map(), msgsById = new Map(), plain = new Map(), urlCache = new Map(), devPub = new Map(), devsByConv = new Map();
let convs = [], current = null, replyTo = null, friends = [], prefs = { msg_timer: 0, status_hours: 24 };
async function loadPrefs() { const { data } = await sb.from('user_prefs').select('msg_timer,status_hours').maybeSingle(); if (data) prefs = data; }
async function savePrefs(ch) { Object.assign(prefs, ch); const { data } = await sb.from('user_prefs').update(ch).eq('user_id', me.id).select('user_id');
  if (!data || !data.length) { const { error } = await sb.from('user_prefs').insert({ msg_timer: prefs.msg_timer, status_hours: prefs.status_hours }); if (error) toast(errText(error)); } }

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
  if (me && me.id === user.id) return; if (starting) { start.next = user; return; } starting = true;
  try {
    let p = null, err = null; for (let i = 0; i < 5 && !p; i++) { ({ data: p, error: err } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle()); if (!p) await sleep(600); }
    if (!p) { if (!err) { await sb.auth.signOut(); return; } toast(t('errGeneric')); return; }   // no profile at all: an old, removed account
    me = p; profiles.set(p.id, p);
    $('#lang').hidden = true; $('#auth').hidden = true; $('#app').hidden = false; paintMe();
    await initDevice();
    const [{ data: nk }, { data: pr }] = await Promise.all([sb.from('contact_names').select('target,name'), sb.from('presence').select('*').eq('user_id', p.id).maybeSingle()]);
    nicks = new Map((nk || []).map(x => [x.target, x.name])); if (pr) myPres = { visible: pr.visible, receipts: pr.receipts };
    await Promise.all([loadChats(), loadFriends(), loadPrefs()]); await live(); inbox(); if (window.loadIce) loadIce(); syncClock(); viewing(false); delivered(); loadStatuses(); checkRinging();
    const qs = new URLSearchParams(location.search), want = qs.get('c'); if (want && convs.some(c => c.id === want)) openChat(want);
    if (qs.get('people')) openSettings('people');
    pushStart();
  } finally { starting = false; const n = start.next; start.next = null; if (n && (!me || me.id !== n.id)) start(n); }
}
function stop() {
  if (call) endCall('ended'); closeStory(true); stories.clear();
  me = null; myDev = null; myStk = null; nicks = new Map(); current = null; convs = []; friends = []; profiles.clear(); members.clear(); msgsById.clear(); plain.clear(); devsByConv.clear();
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
  if (group) { const gc = convs.find(x => x.id === id); if (gc && gc.avatar_url) return `<span class="av ${cls}" style="background-image:url('${esc(gc.avatar_url)}')"></span>`; }
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
  if (ids.length) { const { data: all } = await sb.from('members').select('*').in('conversation_id', ids);
    (all || []).forEach(m => { if (!members.has(m.conversation_id)) members.set(m.conversation_id, []); members.get(m.conversation_id).push(m); });
    await needProfiles((all || []).map(m => m.user_id)); }
  convs = (mine || []).map(m => ({ id: m.id, is_group: m.is_group, name: m.name, last_at: m.last_at, last_read: m.last_read,
    last: m.last_id ? { id: m.last_id, conversation_id: m.id, sender_id: m.last_sender, kind: m.last_kind, body: m.last_body, deleted: m.last_deleted, created_at: m.last_created, enc: m.last_enc, ct: m.last_ct, iv: m.last_iv, keys: m.last_keys, sender_device: m.last_device } : null,
    unread: current && current.id === m.id ? 0 : Number(m.unread) || 0 }));
  await Promise.all([loadGroupInfo().catch(() => {}), ...convs.map(async c => { if (c.last) c.lastText = (await reveal(c.last)); })]);
  sortConvs(); renderChats();
}
const sortConvs = () => convs.sort((a, b) => new Date((b.last && b.last.created_at) || b.last_at) - new Date((a.last && a.last.created_at) || a.last_at));
const otherOf = c => ((members.get(c.id) || []).find(m => m.user_id !== me.id) || {}).user_id;
const convTitle = c => c.is_group ? c.name : nameOf(otherOf(c));
function preview(m, r) {
  if (!m) return t('startChat'); if (m.deleted) return t('deletedShort'); if (gone(m)) return '⏳';
  if (m.kind === 'image') return t('photo'); if (m.kind === 'voice') return t('voice'); if (m.kind === 'sticker') return t('sticker'); if (m.kind === 'call') return t('callPrev');
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

// ---------- friends ----------
async function loadFriends() {
  if (!me) return; const { data } = await sb.from('friendships').select('*').order('created_at', { ascending: false }); friends = data || [];
  await needProfiles(friends.flatMap(f => [f.requester, f.addressee]));
  const other = f => f.requester === me.id ? f.addressee : f.requester, row = (id, extra) => { const p = profiles.get(id) || {};
    return `<div class="frow"><button class="pf-link" data-user="${id}">${avatarHtml(id)}</button><div class="mid pf-link" data-user="${id}"><b>${esc(nameOf(id))}</b><small><span dir="ltr">@${esc(p.username)}</span>${nicks.has(id) ? ' · ' + esc(p.display_name) : ''}</small></div>${extra}</div>`; };
  const inc = friends.filter(f => f.status === 'pending' && f.addressee === me.id), out = friends.filter(f => f.status === 'pending' && f.requester === me.id), acc = friends.filter(f => f.status === 'accepted');
  $('#reqCount').hidden = !inc.length; $('#reqCount').textContent = inc.length;
  const box = $('#peopleLists'); if (!box) return;
  box.innerHTML = (inc.length ? `<div class="st-sec">${t('reqForYou')}</div><div class="st-group">` + inc.map(f => row(f.requester, `<button class="btn small primary" data-acc="${f.id}">${t('accept')}</button><button class="btn small ghost" data-dec="${f.id}">${t('decline')}</button>`)).join('') + '</div>' : '')
    + `<div class="st-sec">${t('myFriends')}</div><div class="st-group">` + (acc.map(f => row(other(f), `<button class="btn small primary" data-dm="${other(f)}">${t('message')}</button><button class="icon-btn" data-nick="${other(f)}" title="${t('renameHere')}">${ic('edit')}</button><button class="icon-btn danger" data-rm="${f.id}" title="${t('del')}">${ic('trash')}</button>`)).join('') || `<p class="hint pad">${t('noFriends')}</p>`) + '</div>'
    + (out.length ? `<div class="st-sec">${t('sentReqs')}</div><div class="st-group">` + out.map(f => row(f.addressee, `<button class="btn small ghost" data-rm="${f.id}">${t('cancel')}</button>`)).join('') + '</div>' : '');
}
$('#peopleBtn').onclick = () => openSettings('people');
async function goChat(id) {   // leave the friends sheet and open the chat in its place
  await loadChats();
  if (stPages.length) { closeSettings(true); history.replaceState({ v: 'chat' }, ''); openChat(id, true); } else openChat(id);
}
async function addFriend() {
  const u = $('#pfUser').value.trim().toLowerCase().replace(/^@/, ''), msg = $('#pfMsg'); msg.textContent = '';
  if (!u) return; if (u === me.username) return msg.textContent = t('thatsYou');
  const { data: found } = await sb.rpc('find_user', { u }); const p = found && found[0]; if (!p) return msg.textContent = t('noUser');
  profiles.set(p.id, p);
  const ex = friends.find(f => (f.requester === p.id && f.addressee === me.id) || (f.requester === me.id && f.addressee === p.id));
  if (ex && ex.status === 'accepted') return msg.textContent = t('alreadyFriend');
  if (ex && ex.requester === p.id) { await sb.rpc('respond_friend', { fid: ex.id, accept: true }); msg.textContent = t('theyAsked'); sb.functions.invoke('push', { body: { friend: ex.id } }).catch(() => {}); }
  else if (ex) return msg.textContent = t('alreadyAsked');
  else { const { data: fr, error } = await sb.from('friendships').insert({ addressee: p.id }).select('id').single(); if (error) return msg.textContent = errText(error); msg.textContent = t('sentReq', { n: p.display_name });
    sb.functions.invoke('push', { body: { friend: fr.id } }).catch(() => {}); }
  $('#pfUser').value = ''; loadFriends();
}
async function friendAction(b) {
  if (b.dataset.acc) { await sb.rpc('respond_friend', { fid: +b.dataset.acc, accept: true }); sb.functions.invoke('push', { body: { friend: +b.dataset.acc } }).catch(() => {}); }
  if (b.dataset.dec) await sb.rpc('respond_friend', { fid: +b.dataset.dec, accept: false });
  if (b.dataset.nick) return rename(b.dataset.nick);
  if (b.dataset.rm) { if (!confirm(t('sure'))) return; await sb.from('friendships').delete().eq('id', +b.dataset.rm); }
  if (b.dataset.dm) { const { data, error } = await sb.rpc('start_dm', { other: b.dataset.dm }); if (error) return toast(errText(error)); return goChat(data); }
  loadFriends(); }

// ---------- dialogs ----------
function dialog(html, onClose) { const d = $('#dlg'); $('#dlgBody').onclick = $('#dlgBody').onchange = null; $('#dlgBody').innerHTML = html; d.returnValue = ''; d.onclose = () => onClose && onClose(d.returnValue); d.showModal(); }
function newGroup() {
  const acc = friends.filter(f => f.status === 'accepted').map(f => f.requester === me.id ? f.addressee : f.requester);
  if (!acc.length) return toast(t('addFriendsFirst'));
  dialog(`<h3>${t('newGroup')}</h3><input id="gName" placeholder="${t('groupName')}" maxlength="60"><div class="sec flush">${t('pickMembers')}</div><div class="scroll">${acc.map(id => `<label class="chk">${avatarHtml(id, { cls: 'sm' })}<span>${esc(nameOf(id))}</span><input type="checkbox" value="${id}"></label>`).join('')}</div>
<div class="row"><button value="x" class="btn ghost">${t('cancel')}</button><button value="ok" class="btn primary">${t('create2')}</button></div>`, async v => {
    if (v !== 'ok') return; const name = $('#gName').value.trim(), ids = $$('#dlgBody input[type=checkbox]:checked').map(i => i.value);
    if (!name) return toast(t('needGroupName')); const { data, error } = await sb.rpc('create_group', { gname: name, member_ids: ids }); if (error) return toast(errText(error));
    goChat(data); });
}
$('#infoBtn').onclick = async () => {
  if (!current) return; if (current.is_group) return groupInfo(convs.find(x => x.id === current.id) || current); const c = current, ms = members.get(c.id) || [], admin = ms.some(m => m.user_id === me.id && m.role === 'admin');
  const addable = friends.filter(f => f.status === 'accepted').map(f => f.requester === me.id ? f.addressee : f.requester).filter(id => !ms.some(m => m.user_id === id));
  let safety = '';
  if (!c.is_group) { const other = otherOf(c), devs = (await devicesFor(c.id, true)); const mine = devs.filter(d => d.user_id === me.id).map(d => d.pub), theirs = devs.filter(d => d.user_id === other).map(d => d.pub);
    if (mine.length && theirs.length) safety = `<div class="safety"><div class="sec flush">${ic('shield')} ${t('safety')}</div><div class="code" dir="ltr">${await HC.safety([...mine, ...theirs])}</div><p class="muted small">${t('safetyNote')}</p></div>`; }
  dialog(`<div class="info-head">${avatarHtml(c.is_group ? c.id : otherOf(c), { group: c.is_group, cls: 'xl' })}<h3>${esc(convTitle(c))}</h3></div>
<div class="sec flush">${t('members')}</div><div class="scroll">${ms.map(m => `<div class="frow flush${m.user_id !== me.id ? ' pf-open' : ''}" data-uopen="${m.user_id}">${avatarHtml(m.user_id, { cls: 'sm' })}<div class="mid"><b>${esc(nameOf(m.user_id))}${m.user_id === me.id ? ' · ' + t('you') : ''}</b><small dir="ltr">@${esc((profiles.get(m.user_id) || {}).username)}${m.role === 'admin' ? ' · ' + t('admin') : ''}</small></div></div>`).join('')}</div>
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

// ---------- groups: owner (who made it), leaders, settings ----------
P.crown = 'M3 18h18M4 15L3 7l5 4 4-7 4 7 5-4-1 8z';
const GT = {
  ar: { groupInfo: 'معلومات القروب', groupN: 'قروب · {n} أعضاء', addDesc: 'أضف وصف أو غيّر الصورة والاسم', msgPrivate: 'مراسلة {n}', owner: 'المالك', leader: 'قائد', membersN: '{n} أعضاء', editInfo: 'تعديل اسم وصورة القروب', addPeople: 'إضافة أعضاء', groupSettings: 'إعدادات القروب',
    sendT: 'الإرسال للقادة فقط', sendN: 'إذا شغّلته، القادة بس يقدرون يرسلون رسائل', editT: 'تعديل المعلومات للقادة فقط', editN: 'الاسم والوصف والصورة', addT: 'إضافة الأعضاء للقادة فقط', addN: '',
    mute: 'كتم الإشعارات', muteN: 'ما يجيك إشعار على الجوال من هذا القروب', viewProfile: 'عرض الملف', makeLeader: 'تعيينه قائد', unLeader: 'إلغاء القيادة', kick: 'إخراج من القروب',
    makeOwner: 'نقل ملكية القروب له', kickSure: 'متأكد تبي تخرج {n} من القروب؟', ownerSure: 'بتصير {n} مالك القروب، وأنت بتصير قائد. متأكد؟',
    ownerLeave: 'أنت مالك القروب. إذا طلعت، أقدم قائد (أو أقدم عضو) يصير المالك. متأكد؟', gName: 'اسم القروب', gDesc: 'وصف القروب (اختياري)', gPhoto: 'تغيير الصورة', gNoPhoto: 'شيل الصورة',
    onlyLeadersSend: 'القادة بس يقدرون يرسلون في هذا القروب', noFriendsToAdd: 'كل أصدقائك موجودين في القروب', pickToAdd: 'اختر الأصدقاء اللي تبي تضيفهم', saved: 'تم الحفظ ✅', needSql: 'هذي الميزة تحتاج تحديث قاعدة البيانات أول' },
  en: { groupInfo: 'Group info', groupN: 'Group · {n} members', addDesc: 'Add a description or change photo & name', msgPrivate: 'Message {n}', owner: 'Owner', leader: 'Leader', membersN: '{n} members', editInfo: 'Edit group name & photo', addPeople: 'Add members', groupSettings: 'Group settings',
    sendT: 'Only leaders can send', sendN: 'When on, only leaders can send messages', editT: 'Only leaders can edit info', editN: 'Name, description and photo', addT: 'Only leaders can add members', addN: '',
    mute: 'Mute notifications', muteN: 'No phone notifications from this group', viewProfile: 'View profile', makeLeader: 'Make leader', unLeader: 'Remove as leader', kick: 'Remove from group',
    makeOwner: 'Make group owner', kickSure: 'Remove {n} from the group?', ownerSure: '{n} becomes the owner and you become a leader. Sure?',
    ownerLeave: 'You own this group. If you leave, the oldest leader (or member) becomes the owner. Sure?', gName: 'Group name', gDesc: 'Group description (optional)', gPhoto: 'Change photo', gNoPhoto: 'Remove photo',
    onlyLeadersSend: 'Only leaders can send messages in this group', noFriendsToAdd: 'All your friends are already in the group', pickToAdd: 'Choose friends to add', saved: 'Saved ✅', needSql: 'This needs the database update first' },
  nl: { groupInfo: 'Groepsinfo', groupN: 'Groep · {n} leden', addDesc: 'Beschrijving toevoegen of foto en naam wijzigen', msgPrivate: 'Bericht aan {n}', owner: 'Eigenaar', leader: 'Leider', membersN: '{n} leden', editInfo: 'Groepsnaam en foto wijzigen', addPeople: 'Leden toevoegen', groupSettings: 'Groepsinstellingen',
    sendT: 'Alleen leiders mogen sturen', sendN: 'Als dit aan staat, kunnen alleen leiders berichten sturen', editT: 'Alleen leiders wijzigen info', editN: 'Naam, beschrijving en foto', addT: 'Alleen leiders voegen leden toe', addN: '',
    mute: 'Meldingen dempen', muteN: 'Geen meldingen van deze groep', viewProfile: 'Profiel bekijken', makeLeader: 'Leider maken', unLeader: 'Geen leider meer', kick: 'Uit groep verwijderen',
    makeOwner: 'Eigenaar maken', kickSure: '{n} uit de groep verwijderen?', ownerSure: '{n} wordt eigenaar en jij wordt leider. Zeker?',
    ownerLeave: 'Jij bent eigenaar. Als je weggaat, wordt de oudste leider (of het oudste lid) eigenaar. Zeker?', gName: 'Groepsnaam', gDesc: 'Beschrijving (optioneel)', gPhoto: 'Foto wijzigen', gNoPhoto: 'Foto verwijderen',
    onlyLeadersSend: 'Alleen leiders kunnen in deze groep sturen', noFriendsToAdd: 'Al je vrienden zitten al in de groep', pickToAdd: 'Kies vrienden om toe te voegen', saved: 'Opgeslagen ✅', needSql: 'Hiervoor is eerst de database-update nodig' }
};
const gt = (k, v = {}) => String((GT[lang] || GT.en)[k] ?? GT.en[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
const roleOf = (c, uid) => ((members.get(c.id) || []).find(m => m.user_id === uid) || {}).role || 'member';
const isLeader = r => r === 'owner' || r === 'admin';
const rankOf = r => r === 'owner' ? 0 : r === 'admin' ? 1 : 2;
const gErr = e => toast(/function .* does not exist|could not find the function|column .* does not exist/i.test(e.message || '') ? gt('needSql') : errText(e));
async function loadGroupInfo() {   // photo, description and settings of my groups
  const ids = convs.filter(c => c.is_group).map(c => c.id); if (!ids.length) return;
  const { data } = await sb.from('conversations').select('id,avatar_url,description,only_admins_send,only_admins_edit,only_admins_add').in('id', ids);
  for (const g of data || []) { const c = convs.find(x => x.id === g.id); if (c) Object.assign(c, g); if (current && current.id === g.id) Object.assign(current, g); }
}
function lockComposer() {
  const c = current, lock = !!(c && c.is_group && c.only_admins_send && !isLeader(roleOf(c, me.id)));
  $('#composer').hidden = lock; let n = $('#lockNote');
  if (lock && !n) { n = document.createElement('div'); n.id = 'lockNote'; n.className = 'lock-note'; $('#composer').after(n); }
  if (n) { n.hidden = !lock; n.textContent = gt('onlyLeadersSend'); }
}
let convT = null;
function convChanged() { clearTimeout(convT); convT = setTimeout(async () => {
  await loadChats(); if (!current) return;
  const nc = convs.find(x => x.id === current.id); if (!nc) { closeChat(); return; }
  Object.assign(current, { name: nc.name, avatar_url: nc.avatar_url, description: nc.description, only_admins_send: nc.only_admins_send, only_admins_edit: nc.only_admins_edit, only_admins_add: nc.only_admins_add });
  $('#roomName').textContent = convTitle(current); avatarInto($('#roomAv'), current.is_group ? current.id : otherOf(current), current.is_group); lockComposer(); redrawGroupPage();
}, 400); }
async function refreshGroup(c) {
  await loadChats(); const nc = convs.find(x => x.id === c.id);
  if (!nc) { closeSettings(); if (current && current.id === c.id) closeChat(); return; }
  if (current && current.id === c.id) Object.assign(current, nc); lockComposer(); redrawGroupPage();
}
const groupPage = p => /^(group|gadd|gedit):/.test(p || '');
function redrawGroupPage() { const top = stPages[stPages.length - 1]; if (groupPage(top)) renderSettings(top); }
const groupOf = id => convs.find(x => x.id === id) || (current && current.id === id ? current : null);
function groupInfo(c) { openSettings('group:' + c.id); }

// the group page: full screen, like WhatsApp
function renderGroup(b, id, kind) {
  const c = groupOf(id); if (!c) return closeSettings();
  const ms = (members.get(c.id) || []).slice().sort((a, b2) => (a.user_id === me.id ? -1 : b2.user_id === me.id ? 1 : 0) || rankOf(a.role) - rankOf(b2.role) || nameOf(a.user_id).localeCompare(nameOf(b2.user_id)));
  const mine = roleOf(c, me.id), lead = isLeader(mine), canEdit = lead || c.only_admins_edit === false, canAdd = lead || c.only_admins_add === false, meRow = ms.find(m => m.user_id === me.id) || {};
  const badge = r => r === 'owner' ? `<span class="gbadge own">${gt('owner')}</span>` : r === 'admin' ? `<span class="gbadge">${gt('leader')}</span>` : '';
  if (kind === 'group') {
    $('#stTitle').textContent = gt('groupInfo');
    b.innerHTML = `<div class="pf-head"><button class="pf-photo" ${c.avatar_url ? `data-gphoto="${c.id}"` : ''}>${avatarHtml(c.id, { group: true, cls: 'xxl' })}</button><h2>${esc(c.name)}</h2><small>${gt('groupN', { n: ms.length })}</small></div>
${c.description || canEdit ? `<div class="st-group">${c.description ? `<div class="gdesc-box">${esc(c.description)}</div>` : ''}${canEdit ? `<button class="st-row" data-gpage="gedit:${c.id}"><span class="st-ic">${ic('edit')}</span><span class="st-label">${gt(c.description ? 'editInfo' : 'addDesc')}</span>${ic('fwd', 'chev')}</button>` : ''}</div>` : ''}
<div class="st-group">${toggle('gMute', gt('mute'), gt('muteN'), !!meRow.muted)}</div>
${lead ? `<div class="st-sec">${gt('groupSettings')}</div><div class="st-group">${toggle('gSend', gt('sendT'), gt('sendN'), !!c.only_admins_send)}${toggle('gEdit', gt('editT'), gt('editN'), c.only_admins_edit !== false)}${toggle('gAdd', gt('addT'), '', c.only_admins_add !== false)}</div>` : ''}
<div class="st-sec">${gt('membersN', { n: ms.length })}</div><div class="st-group">
${canAdd ? `<button class="st-row" data-gpage="gadd:${c.id}"><span class="st-ic">${ic('userPlus')}</span><span class="st-label">${gt('addPeople')}</span></button>` : ''}
${ms.map(m => `<button class="st-row gmem" data-gm="${m.user_id}">${avatarHtml(m.user_id, { cls: 'sm' })}<span class="st-label"><b>${m.user_id === me.id ? t('you') : esc(nameOf(m.user_id))}</b><small dir="ltr">@${esc((profiles.get(m.user_id) || {}).username || '')}</small></span>${badge(m.role)}</button>`).join('')}</div>
<div class="st-group"><button class="st-row danger" data-gleave="${c.id}"><span class="st-ic">${ic('out')}</span><span class="st-label">${t('leaveGroup')}</span></button></div>`;
  }
  if (kind === 'gedit') {
    $('#stTitle').textContent = gt('editInfo');
    b.innerHTML = `<div class="pf-head"><label class="gph">${avatarHtml(c.id, { group: true, cls: 'xxl' })}<input type="file" accept="image/*" id="gPhotoIn" hidden><span class="cam">${ic('camera')}</span></label>
${c.avatar_url ? `<button class="btn ghost small" id="gDrop">${gt('gNoPhoto')}</button>` : ''}</div>
<div class="st-group pad"><label class="st-field"><span>${gt('gName')}</span><input id="gNameIn" maxlength="60" value="${esc(c.name || '')}"></label>
<label class="st-field"><span>${gt('gDesc')}</span><textarea id="gDescIn" maxlength="300" rows="4">${esc(c.description || '')}</textarea></label></div>
<button class="btn primary gwide" id="gSave" data-g="${c.id}">${t('save')}</button>`;
    b._gfile = null; b._gdrop = false;
  }
  if (kind === 'gadd') {
    $('#stTitle').textContent = gt('addPeople');
    const addable = friends.filter(f => f.status === 'accepted').map(f => f.requester === me.id ? f.addressee : f.requester).filter(x => !ms.some(m => m.user_id === x));
    b.innerHTML = addable.length ? `<p class="st-note">${gt('pickToAdd')}</p><div class="st-group">${addable.map(x => `<label class="st-row gpick">${avatarHtml(x, { cls: 'sm' })}<span class="st-label">${esc(nameOf(x))}</span><input type="checkbox" value="${x}"><i class="gtick">${ic('check')}</i></label>`).join('')}</div>
<button class="btn primary gwide" id="gAddGo" data-g="${c.id}">${t('add')}</button>` : `<p class="st-note">${gt('noFriendsToAdd')}</p>`;
  }
}
$('#stBody').addEventListener('click', async e => {
  const pg = e.target.closest('[data-gpage]'); if (pg) return openSettings(pg.dataset.gpage);
  const top = stPages[stPages.length - 1] || '', c = groupPage(top) ? groupOf(top.split(':')[1]) : null; if (!c) return;
  const gm = e.target.closest('[data-gm]'); if (gm) { if (gm.dataset.gm !== me.id) memberMenu(c, gm.dataset.gm); return; }
  if (e.target.closest('[data-gphoto]')) return c.avatar_url && openPhotoUrl(c.avatar_url);
  if (e.target.closest('[data-gleave]')) { if (!confirm(roleOf(c, me.id) === 'owner' ? gt('ownerLeave') : t('leaveSure'))) return;
    const { error } = await sb.from('members').delete().eq('conversation_id', c.id).eq('user_id', me.id); if (error) return gErr(error); closeSettings(); if (current && current.id === c.id) closeChat(); return loadChats(); }
  if (e.target.id === 'gDrop') { const b = $('#stBody'); b._gdrop = true; b._gfile = null; const av = b.querySelector('.gph .av'); av.style.backgroundImage = 'none'; e.target.hidden = true; return; }
  if (e.target.id === 'gAddGo') { const btn = e.target; btn.disabled = true;
    for (const i of $$('#stBody .gpick input:checked')) { const { error } = await sb.rpc('add_to_group', { c: c.id, uid: i.value }); if (error) { gErr(error); break; } }
    devsByConv.delete(c.id); await refreshGroup(c); return history.back(); }
  if (e.target.id === 'gSave') { const b = $('#stBody'), btn = e.target, name = $('#gNameIn').value.trim(), desc = $('#gDescIn').value.trim(); if (!name) return toast(t('needGroupName'));
    btn.disabled = true; let url = b._gdrop ? '' : (c.avatar_url || '');
    try {
      if (b._gfile) { const bmp = await createImageBitmap(b._gfile), s = Math.min(bmp.width, bmp.height), cv = document.createElement('canvas'); cv.width = cv.height = 512;
        cv.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 512, 512);
        const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', .86)), path = `${me.id}/g-${c.id}-${Date.now()}.jpg`;
        const { error } = await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' }); if (error) throw error;
        url = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl; }
      const { error } = await sb.rpc('group_set_info', { c: c.id, gname: name, gdesc: desc, gavatar: url }); if (error) throw error;
      toast(gt('saved')); await refreshGroup(c); return history.back();
    } catch (x) { btn.disabled = false; gErr(x); } }
});
$('#stBody').addEventListener('change', async e => {
  const top = stPages[stPages.length - 1] || '', c = groupPage(top) ? groupOf(top.split(':')[1]) : null; if (!c) return; const id = e.target.id;
  if (id === 'gPhotoIn') { const f = e.target.files[0]; if (!f) return; const b = $('#stBody'); b._gfile = f; b._gdrop = false; const av = b.querySelector('.gph .av'); av.className = 'av xxl'; av.innerHTML = ''; av.style.background = ''; av.style.backgroundImage = `url('${URL.createObjectURL(f)}')`; return; }
  if (id === 'gMute') { const { error } = await sb.from('members').update({ muted: e.target.checked }).eq('conversation_id', c.id).eq('user_id', me.id); if (error) { e.target.checked = !e.target.checked; return gErr(error); }
    const r = (members.get(c.id) || []).find(m => m.user_id === me.id); if (r) r.muted = e.target.checked; return; }
  if (!['gSend', 'gEdit', 'gAdd'].includes(id)) return;
  const s = { s_send: $('#gSend').checked, s_edit: $('#gEdit').checked, s_add: $('#gAdd').checked };
  const { error } = await sb.rpc('group_set_settings', { c: c.id, ...s }); if (error) { e.target.checked = !e.target.checked; return gErr(error); }
  const v = { only_admins_send: s.s_send, only_admins_edit: s.s_edit, only_admins_add: s.s_add }; Object.assign(c, v); if (current && current.id === c.id) Object.assign(current, v); lockComposer();
});
function openPhotoUrl(u) { dialog(`<img src="${esc(u)}" alt="" class="gbig"><div class="row"><button value="x" class="btn ghost">${t('close')}</button></div>`); }
// tapping a member: a small menu from the bottom, like WhatsApp
function memberMenu(c, uid) {
  const mine = roleOf(c, me.id), his = roleOf(c, uid), n = nameOf(uid), opts = [`<button value="profile" class="sheet-opt">${ic('user')}<span>${gt('viewProfile')}</span></button>`];
  if (friends.some(f => f.status === 'accepted' && (f.requester === uid || f.addressee === uid))) opts.push(`<button value="msg" class="sheet-opt">${ic('chat')}<span>${gt('msgPrivate', { n })}</span></button>`);
  if (mine === 'owner') opts.push(`<button value="${his === 'admin' ? 'unlead' : 'lead'}" class="sheet-opt">${ic('shield')}<span>${gt(his === 'admin' ? 'unLeader' : 'makeLeader')}</span></button>`, `<button value="own" class="sheet-opt">${ic('crown')}<span>${gt('makeOwner')}</span></button>`);
  if (his !== 'owner' && (mine === 'owner' || (mine === 'admin' && his === 'member'))) opts.push(`<button value="kick" class="sheet-opt danger">${ic('trash')}<span>${gt('kick')}</span></button>`);
  dialog(`<div class="sheet-head">${avatarHtml(uid, { cls: 'sm' })}<b>${esc(n)}</b>${his !== 'member' ? `<span class="gbadge${his === 'owner' ? ' own' : ''}">${gt(his === 'owner' ? 'owner' : 'leader')}</span>` : ''}</div>${opts.join('')}`, async v => {
    let r = null;
    if (v === 'profile') return openSettings('user:' + uid);
    if (v === 'msg') { const id = await dmWith(uid); return id && goChat(id); }
    if (v === 'lead' || v === 'unlead') r = await sb.rpc('group_set_admin', { c: c.id, uid, make: v === 'lead' });
    else if (v === 'own') { if (!confirm(gt('ownerSure', { n }))) return; r = await sb.rpc('group_transfer', { c: c.id, uid }); }
    else if (v === 'kick') { if (!confirm(gt('kickSure', { n }))) return; r = await sb.rpc('group_remove', { c: c.id, uid }); devsByConv.delete(c.id); }
    else return;
    if (r && r.error) gErr(r.error); return refreshGroup(c);
  });
  $('#dlg').classList.add('sheet'); const d = $('#dlg'), off = () => { d.classList.remove('sheet'); d.onclick = null; d.removeEventListener('close', off); }; d.addEventListener('close', off);
  d.onclick = e => { if (e.target === d) d.close(''); };
}

// ---------- a chat ----------
async function openChat(id, quiet) {
  const c = convs.find(x => x.id === id); if (!c) return;
  if (!quiet && (!current || current.id !== id)) { if (history.state && history.state.v === 'chat') history.replaceState({ v: 'chat' }, ''); else history.pushState({ v: 'chat' }, ''); }
  current = c; c.unread = 0; replyTo = null; $('#stkPanel').hidden = true; $('#stkBtn').classList.remove('on'); $('#replyBox').hidden = true; msgsById.clear(); typers.clear(); joinTyping(c.id);
  $('#empty').hidden = true; $('#room').hidden = false; $('#app').classList.add('open');
  $('#voiceBtn').hidden = $('#videoBtn').hidden = !!c.is_group; lockComposer();
  $('#roomName').textContent = convTitle(c); avatarInto($('#roomAv'), c.is_group ? c.id : otherOf(c), c.is_group); $('#roomSub').textContent = subtitle(c); $('#roomSub').className = ''; updateStatus();
  renderChats(); $('#msgs').innerHTML = `<div class="day">${t('loading')}</div>`; devicesFor(c.id);
  const { data, error } = await sb.from('messages').select('*').eq('conversation_id', id).order('id', { ascending: false }).limit(150);
  if (current !== c) return; if (error) { $('#msgs').innerHTML = ''; return toast(errText(error)); }
  const rows = (data || []).reverse(); await Promise.all(rows.map(reveal)); if (current !== c) return;
  $('#msgs').innerHTML = ''; addMsg.bulk = true; rows.forEach(addMsg); addMsg.bulk = false; note(); scrollDown(); markRead(); viewing(true);
  if (!/Mobi|Android|iPhone|iPad/.test(navigator.userAgent)) $('#text').focus();
}
function closeChat(fromHistory) {
  stopTyping(); leaveTyping(); viewing(false); if (R.on) endRec(false); player.pause(); current = null; $('#app').classList.remove('open'); renderChats();
  setTimeout(() => { if (!current) { $('#room').hidden = true; $('#empty').hidden = false; } }, 260);
  if (!fromHistory && history.state && history.state.v === 'chat') history.back();
}
$('#backBtn').onclick = () => closeChat();
$('#roomTitle').onclick = $('#roomAv').onclick = () => { if (!current) return; if (current.is_group) return $('#infoBtn').click(); openSettings('user:' + otherOf(current)); };
$('#voiceBtn').onclick = () => current && startCall(current.id, false);
$('#videoBtn').onclick = () => current && startCall(current.id, true);
const scrollDown = () => { const b = $('#msgs'); b.scrollTop = b.scrollHeight; };
async function markRead() { if (!current) return; current.last_read = new Date().toISOString(); await sb.rpc('mark_read', { c: current.id, receipts: myPres.receipts }); }

function msgHtml(m) {
  const mine = m.sender_id === me.id, r = plain.get(m.id + ':' + m.iv) || (m.enc !== 1 ? { text: m.body || '', old: true } : { fail: true }), q = m.reply_to && msgsById.get(m.reply_to), P = r.payload || {};
  let body = '';
  if (m.deleted) body = `<span class="gone">${t('deletedMsg')}</span>`;
  else if (r.fail) body = `<span class="gone">${t('cantOpen')}</span>`;
  else if (m.kind === 'image') body = `<img data-media="${esc(m.media_path)}" data-mid="${m.id}" alt="">` + (r.text ? `<div>${esc(r.text)}</div>` : '');
  else if (m.kind === 'sticker') body = `<img class="stk" data-media="${esc(m.media_path)}" data-mid="${m.id}" alt="">`;
  else if (m.kind === 'voice') body = voiceHtml(m, P);
  else if (m.kind === 'call') { const lbl = P.r === 'done' ? t(P.v ? 'callVideoDone' : 'callVoiceDone') + ' · ' + fmtDur(P.d) : P.r === 'declined' ? t('callDeclined') : P.r === 'busy' ? t('callBusy') : mine ? t('noAnswer') : t(P.v ? 'missedVideo' : 'missedCall');
    body = `<button type="button" class="callmsg${P.r === 'done' ? '' : ' miss'}" data-callback="${P.v ? 1 : 0}">${ic(P.v ? 'video' : 'phone')}<span>${esc(lbl)}</span></button>`; }
  else body = esc(r.text);
  const qr = q && (plain.get(q.id + ':' + q.iv) || (q.enc !== 1 ? { text: q.body } : { fail: true }));
  const state = !mine || m.deleted ? '' : m.pending === 1 ? `<span class="trail s0" title="${t('sending')}"><i></i><i></i><i></i></span>` : m.pending === 2 ? `<span class="failed">${t('notSentTap')}</span>` : trail(m, current.id);
  const stkBtn = m.kind === 'sticker' ? `<button data-act="savestk" title="${t('saveSticker')}">${ic('save')}</button>` : m.kind === 'image' && m.enc === 1 ? `<button data-act="mkstk" title="${t('makeSticker')}">${ic('smile')}</button>` : '';
  const tools = m.deleted || r.fail || m.pending ? '' : `<div class="tools"><button data-act="reply" title="${t('reply')}">${ic('reply')}</button>${mine && m.kind === 'text' ? `<button data-act="edit" title="${t('edit')}">${ic('edit')}</button>` : ''}${stkBtn}${m.expires_at && m.id > 0 ? `<button data-act="keep" title="${t(m.kept ? 'unkeep' : 'keep')}">${ic(m.kept ? 'kept' : 'save', m.kept ? 'fill' : '')}</button>` : ''}${mine ? `<button data-act="del" title="${t('del')}">${ic('trash')}</button>` : ''}${m.kind === 'text' ? `<button data-act="copy" title="${t('copy')}">${ic('copy')}</button>` : ''}</div>`;
  return `${current.is_group && !mine ? `<div class="who" style="color:${colorOf(m.sender_id)}">${esc(nameOf(m.sender_id))}</div>` : ''}
${q ? `<div class="q" data-jump="${q.id}"><b>${esc(q.sender_id === me.id ? t('you') : nameOf(q.sender_id))}</b> ${esc(q.deleted ? t('deletedMsg') : preview(q, qr))}</div>` : ''}
<div class="body">${body}</div><div class="meta">${r.old && !m.deleted ? `<span class="old">${t('oldMsg')}</span>` : ''}${m.edited_at && !m.deleted ? `<span>${t('edited')}</span>` : ''}${m.expires_at && !m.deleted ? (m.kept ? `<span class="kmark" title="${esc(t('keptBy', { n: m.kept_by === me.id ? t('you') : nameOf(m.kept_by) }))}">${ic('kept', 'tiny fill')}</span>` : `<span class="tmark" title="${t('disappears')}">${ic('timer', 'tiny')}</span>`) : ''}<span>${fmtTime(m.created_at)}</span>${state}</div>
${tools}`;
}
function paintMsg(el, m) {
  el.className = 'm' + (m.sender_id === me.id ? ' mine' : '') + (m.deleted ? ' del' : '') + (m.pending ? ' pend' + m.pending : '') + (!m.deleted && m.kind === 'sticker' ? ' stkmsg' : '') + (!m.deleted && m.kind === 'voice' ? ' vmsg' : '');
  el.innerHTML = msgHtml(m); loadMedia(el); if (m.id === playing) paintPlayer();
}
const gone = m => m.expires_at && !m.kept && new Date(m.expires_at).getTime() < srvNow();
setInterval(() => { if (!current) return; for (const m of [...msgsById.values()]) if (gone(m)) { msgsById.delete(m.id); $(`.m[data-id="${m.id}"]`)?.remove(); } }, 15000);
function addMsg(m) {
  if (gone(m)) return;
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
    const blob = new Blob([bytes], { type: r.payload.mt || (m.kind === 'voice' ? 'audio/webm' : 'image/jpeg') }); blobCache.set(m.media_path, blob); u = URL.createObjectURL(blob);
  } else { const { data } = await sb.storage.from('media').createSignedUrl(m.media_path, 300); u = data && data.signedUrl; if (u) setTimeout(() => urlCache.delete(m.media_path), 240000); }
  if (u) urlCache.set(m.media_path, u); return u;
}
function loadMedia(el) { el.querySelectorAll('[data-media]').forEach(async x => { const m = msgsById.get(+x.dataset.mid); const u = m && await mediaUrl(m); if (u) { x.src = u; if (x.tagName === 'IMG') x.onload = () => { const b = $('#msgs'); if (b.scrollHeight - b.scrollTop - b.clientHeight < 400) scrollDown(); }; } }); }

$('#msgs').onclick = async e => {
  const el = e.target.closest('.m'); if (!el) return; const m = msgsById.get(+el.dataset.id), r = m && plain.get(m.id + ':' + m.iv);
  if (m && m.pending === 2) return m.job && m.job();
  const cb = e.target.closest('[data-callback]'); if (cb && current) return startCall(current.id, cb.dataset.callback === '1');
  const vp = e.target.closest('[data-vplay]'), vs = e.target.closest('[data-vspeed]'), vw = e.target.closest('[data-wave]');
  if (vp && m) return playVoice(m.id);
  if (vs) { vSpeed = vSpeed === 1 ? 1.5 : vSpeed === 1.5 ? 2 : 1; try { localStorage.setItem('hamsa-vspeed', vSpeed); } catch {} player.playbackRate = vSpeed; $$('[data-vspeed]').forEach(x => x.textContent = vSpeed + '×'); return; }
  if (vw && m) { const b = vw.getBoundingClientRect(), rtl = document.documentElement.dir === 'rtl', f = Math.max(0, Math.min(1, rtl ? (b.right - e.clientX) / b.width : (e.clientX - b.left) / b.width));
    if (playing === m.id) { const d = voiceDur(m); if (d) player.currentTime = f * d; paintPlayer(); } else playVoice(m.id, f); return; }
  $$('.m.show').forEach(x => x !== el && x.classList.remove('show')); el.classList.toggle('show');
  const jump = e.target.closest('[data-jump]'); if (jump) { const x = $(`.m[data-id="${jump.dataset.jump}"]`); if (x) { x.scrollIntoView({ block: 'center', behavior: 'smooth' }); x.classList.add('flash'); setTimeout(() => x.classList.remove('flash'), 1500); } return; }
  if (e.target.tagName === 'IMG' && e.target.src && !e.target.classList.contains('stk')) { const v = document.createElement('div'); v.className = 'viewer'; const im = document.createElement('img'); im.src = e.target.src; v.appendChild(im); v.onclick = () => v.remove(); document.body.appendChild(v); return; }
  const act = e.target.closest('[data-act]'); if (!act || !m) return; const a = act.dataset.act, text = r ? r.text : (m.body || '');
  if (a === 'reply') { replyTo = m; $('#replyText').textContent = (m.sender_id === me.id ? t('you') : nameOf(m.sender_id)) + ': ' + preview(m, r); $('#replyBox').hidden = false; $('#text').focus(); }
  if (a === 'copy') { try { await navigator.clipboard.writeText(text); toast(t('copied')); } catch {} }
  if (a === 'edit') { const n = prompt(t('editTitle'), text); if (n == null || !n.trim() || n === text) return; await editMsg(m, n.trim()); }
  if (a === 'keep') { el.classList.remove('show'); const { error } = await sb.rpc('keep_message', { mid: m.id, keep: !m.kept }); if (error) return toast(errText(error)); return toast(t(m.kept ? 'unkeptMsg' : 'keptMsg')); }
  if (a === 'savestk' || a === 'mkstk') { const bl = blobCache.get(m.media_path); if (!bl) return toast(t('cantOpen')); el.classList.remove('show');
    return a === 'savestk' ? addSticker(bl, (r && r.payload && r.payload.sh)).catch(x => toast(errText(x))) : stickerMaker(bl); }
  if (a === 'del') { if (!confirm(t('delSure'))) return; const { error } = await sb.from('messages').update({ deleted: true }).eq('id', m.id); if (error) toast(errText(error)); }
};
$('#replyX').onclick = () => { replyTo = null; $('#replyBox').hidden = true; };

// ---------- sending (everything is encrypted before it leaves the phone) ----------
const ta = $('#text');
ta.oninput = e => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; if (e) ta.value.trim() ? typing() : stopTyping(); updateComposer(); };
ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !/Mobi/.test(navigator.userAgent)) { e.preventDefault(); $('#composer').requestSubmit(); } };
async function recipients(c) {   // every device that must be able to open the message (kept fresh in the background)
  const users = (members.get(c.id) || []).map(m => m.user_id), miss = devs => users.filter(u => u !== me.id && !devs.some(d => d.user_id === u));
  let devs = await devicesFor(c.id), missing = miss(devs);
  if (missing.length) { devs = await devicesFor(c.id, true); missing = miss(devs); }
  else { const x = devsByConv.get(c.id); if (x && Date.now() - x.at > 8000) devicesFor(c.id, true); }
  if (!devs.some(d => d.device_id === myDev.id)) devs = [...devs, { user_id: me.id, device_id: myDev.id, pub: myDev.pub }];
  return { devs, missing };
}
// sending: the bubble shows at once, the encryption and upload happen behind it
let pendSeq = 0; const pendIv = new Set();
const known = m => msgsById.has(m.id) || pendIv.has(m.iv);
function send({ kind = 'text', text = '', media = null, extra = null, conv = null }) {
  const c = conv ? convs.find(x => x.id === conv) : current; if (!c || !myDev) return;
  const here = current === c;
  const n = ++pendSeq, payload = { t: text, k: kind, ...(extra || {}) };
  const tmp = { id: -n, pending: 1, conversation_id: c.id, sender_id: me.id, kind, reply_to: replyTo ? replyTo.id : null, created_at: new Date(srvNow()).toISOString(), enc: 1, iv: 'p' + n, media_path: media ? 'local:' + n : null };
  if (media) { urlCache.set(tmp.media_path, URL.createObjectURL(media.blob)); blobCache.set(tmp.media_path, media.blob); }
  plain.set(tmp.id + ':' + tmp.iv, { text, payload });
  if (here) { tmp.reply_to = replyTo ? replyTo.id : null; replyTo = null; $('#replyBox').hidden = true; addMsg(tmp); scrollDown(); } else tmp.reply_to = null;
  if (prefs.msg_timer) tmp.expires_at = new Date(srvNow() + prefs.msg_timer * 1000).toISOString();
  tmp.job = () => deliver(c, tmp, payload, media);
  return tmp.job();
}
function setPend(tmp, v) { tmp.pending = v; const el = $(`.m[data-id="${tmp.id}"]`); if (el) paintMsg(el, tmp); note(); }
async function deliver(c, tmp, payload, media) {
  if (tmp.pending === 2) setPend(tmp, 1);
  try {
    const { devs, missing } = await recipients(c);
    if (!c.is_group && missing.length) { $(`.m[data-id="${tmp.id}"]`)?.remove(); msgsById.delete(tmp.id); note(); return toast(t('needsUpdate', { n: nameOf(missing[0]) })); }
    if (c.is_group && missing.length) toast(t('someNoKey', { n: list(missing.map(nameOf)) }));
    const K = HC.newKey(); let path = null;
    if (media) { const sealed = await HC.sealBytes(K, new Uint8Array(await media.blob.arrayBuffer())); path = `${c.id}/${crypto.randomUUID()}`;
      const { error } = await sb.storage.from('media').upload(path, new Blob([sealed.data], { type: 'application/octet-stream' }), { contentType: 'application/octet-stream' }); if (error) throw error;
      payload.mi = sealed.iv; payload.mt = media.type; }
    const box = await HC.seal(payload, myDev, devs, K); pendIv.add(box.iv);
    const row = { conversation_id: c.id, kind: tmp.kind, reply_to: tmp.reply_to, media_path: path, enc: 1, ct: box.ct, iv: box.iv, keys: box.keys, sender_device: myDev.id, expires_at: tmp.expires_at || null };
    const { data, error } = await sb.from('messages').insert(row).select().single(); if (error) { pendIv.delete(box.iv); throw error; }
    plain.set(data.id + ':' + data.iv, { text: payload.t, payload, K });
    if (media) { urlCache.set(path, urlCache.get(tmp.media_path)); blobCache.set(path, media.blob); }
    const el = $(`.m[data-id="${tmp.id}"]`); msgsById.delete(tmp.id); if (playing === tmp.id) playing = data.id;
    if (current && current.id === data.conversation_id && !msgsById.has(data.id)) { msgsById.set(data.id, data); if (el) { el.dataset.id = data.id; paintMsg(el, data); } else addMsg(data); } else el?.remove();
    note(); bumpConv(data); setTimeout(() => pendIv.delete(data.iv), 60000);
    sb.functions.invoke('push', { body: { message_id: data.id } }).catch(() => {});
  } catch (x) { console.warn('[hamsa] send', x); setPend(tmp, 2); }
}
async function editMsg(m, text) {
  const c = current; const { devs } = await recipients(c), old = plain.get(m.id + ':' + m.iv) || {};
  const box = await HC.seal({ ...(old.payload || {}), t: text, k: m.kind }, myDev, devs);
  const { error } = await sb.from('messages').update({ ct: box.ct, iv: box.iv, keys: box.keys, edited_at: new Date().toISOString() }).eq('id', m.id);
  if (error) return toast(errText(error)); plain.set(m.id + ':' + box.iv, { text, payload: { ...(old.payload || {}), t: text } });
}
$('#composer').onsubmit = e => { e.preventDefault(); const s = ta.value.trim(); if (!s) return; stopTyping(); ta.value = ''; ta.oninput(); send({ text: s }); if (!/Mobi|Android|iPhone|iPad/.test(navigator.userAgent)) ta.focus(); };
function updateComposer() { const has = !!ta.value.trim(); $('#sendBtn').hidden = !has; $('#micBtn').hidden = has && !R.on; }
ta.addEventListener('focus', () => { if (!$('#stkPanel').hidden) { $('#stkPanel').hidden = true; $('#stkBtn').classList.remove('on'); } });
$('#attachBtn').onclick = () => $('#fileIn').click();
$('#fileIn').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f || !current) return;
  if (!/^image\/(png|jpeg|webp|gif|heic|heif)$/i.test(f.type) && !/^image\//.test(f.type)) return; if (f.size > 10 * 1024 * 1024) return toast(t('imgBig'));
  try { send({ kind: 'image', media: await shrink(f) }); } catch (x) { toast(t('notSent', { e: errText(x) })); } };
async function shrink(f) {   // redraw every picture: smaller, and no hidden location data
  const bmp = await createImageBitmap(f), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
  return { blob: await new Promise(r => c.toBlob(r, 'image/jpeg', .85)), type: 'image/jpeg' };
}
// voice: hold the mic to record, let go to send, slide toward the start to cancel, slide up to lock
const R = { on: false, down: false, locked: false, busy: false };
const mic = $('#micBtn'), fmtDur = x => { x = Math.max(0, Math.round(x || 0)); return Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0'); };
mic.oncontextmenu = e => e.preventDefault();
mic.onpointerdown = async e => {
  if (R.locked) return endRec(true);
  if (!current || R.on || R.busy || e.button > 0) return; e.preventDefault(); try { mic.setPointerCapture(e.pointerId); } catch {}
  Object.assign(R, { down: true, x0: e.clientX, y0: e.clientY, busy: true, conv: current.id });
  let ac = null; try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch { R.busy = false; R.down = false; if (ac) ac.close().catch(() => {}); return toast(t('allowMic')); }
  R.busy = false;
  if (!R.down || !current || current.id !== R.conv) { stream.getTracks().forEach(x => x.stop()); if (ac) ac.close().catch(() => {}); return toast(t('holdToRecord')); }
  startRec(stream, ac);
};
mic.onpointermove = e => {
  if (!R.on || R.locked || !R.down) return;
  const rtl = document.documentElement.dir === 'rtl', dx = e.clientX - R.x0, sl = Math.max(0, rtl ? dx : -dx), up = Math.max(0, R.y0 - e.clientY), h = $('#recHint');
  h.style.transform = `translateX(${(rtl ? 1 : -1) * sl * .6}px)`; h.style.opacity = 1 - Math.min(1, sl / 140);
  $('#recLock').style.transform = `translateY(${-Math.min(up, 50)}px)`;
  if (sl > 130) endRec(false, true); else if (up > 75) lockRec();
};
mic.onpointerup = mic.onpointercancel = () => { R.down = false; if (R.on && !R.locked) endRec(true); };
$('#recDel').onclick = () => endRec(false, true);
function startRec(stream, ac) {
  const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find(x => window.MediaRecorder && MediaRecorder.isTypeSupported(x)) || '';
  let rec; try { rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined); } catch { stream.getTracks().forEach(x => x.stop()); return toast(t('allowMic')); }
  Object.assign(R, { on: true, locked: false, stream, ac, rec, chunks: [], peaks: [], t0: Date.now(), an: null });
  rec.ondataavailable = e => e.data.size && R.chunks.push(e.data); rec.start(250);
  if (ac) try { const an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(stream).connect(an); if (ac.resume) ac.resume(); R.an = an; R.buf = new Uint8Array(an.fftSize); } catch {}
  R.tick = setInterval(() => { const sec = (Date.now() - R.t0) / 1000; $('#recTime').textContent = fmtDur(sec);
    if (R.an) { R.an.getByteTimeDomainData(R.buf); let pk = 0; for (const v of R.buf) pk = Math.max(pk, Math.abs(v - 128)); R.peaks.push(pk); }
    if (sec > 900) endRec(true); }, 80);
  $('#recTime').textContent = '0:00'; $('#composer').classList.add('recording'); $('#recBar').hidden = false; $('#recLock').hidden = false; $('#recDel').hidden = true; $('#recHint').hidden = false;
  mic.classList.add('hold'); mic.hidden = false; $('#sendBtn').hidden = true; stopTyping(); if (navigator.vibrate) navigator.vibrate(25);
}
function lockRec() {
  R.locked = true; $('#composer').classList.add('locked'); $('#recLock').hidden = true; $('#recDel').hidden = false; $('#recHint').hidden = true;
  mic.classList.remove('hold'); mic.classList.add('send'); mic.innerHTML = ic('send'); if (navigator.vibrate) navigator.vibrate(15);
}
function shapeWave(p) {   // the loudness of the recording, as 36 bars
  if (!p || p.length < 3) return null; const n = 36, out = [];
  for (let i = 0; i < n; i++) { const a = Math.floor(i * p.length / n), b = Math.max(a + 1, Math.floor((i + 1) * p.length / n)); let v = 0; for (let k = a; k < b && k < p.length; k++) v = Math.max(v, p[k]); out.push(v); }
  const mx = Math.max(14, ...out); return out.map(v => Math.max(10, Math.round(v / mx * 100)));
}
function endRec(doSend, cancelled) {
  if (!R.on) return; R.on = false; R.locked = false; clearInterval(R.tick);
  const { rec, stream, ac, chunks, peaks, t0, conv } = R, secs = (Date.now() - t0) / 1000;
  rec.onstop = () => { stream.getTracks().forEach(x => x.stop()); if (ac) ac.close().catch(() => {});
    if (!doSend) return cancelled && toast(t('voiceCancelled'));
    if (secs < .7) return toast(t('holdToRecord'));
    if (!current || current.id !== conv) return;
    const base = (rec.mimeType || 'audio/webm').split(';')[0], blob = new Blob(chunks, { type: base }); if (blob.size > 10 * 1024 * 1024) return toast(t('imgBig'));
    send({ kind: 'voice', media: { blob, type: base }, extra: { d: Math.round(secs * 10) / 10, w: shapeWave(peaks) } }); };
  try { rec.stop(); } catch { stream.getTracks().forEach(x => x.stop()); }
  $('#composer').classList.remove('recording', 'locked'); $('#recBar').hidden = true; $('#recLock').hidden = true; $('#recLock').style.transform = '';
  const h = $('#recHint'); h.style.transform = ''; h.style.opacity = ''; mic.classList.remove('hold', 'send'); mic.innerHTML = ic('mic'); updateComposer();
}

// ---------- the voice bubble: play, waveform, time, speed ----------
const player = new Audio(); let playing = null, vSpeed = 1; try { vSpeed = +localStorage.getItem('hamsa-vspeed') || 1; } catch {}
function waveOf(m, P) { if (Array.isArray(P.w) && P.w.length) return P.w; let x = Math.abs(m.id) * 7919 % 233280 + 1;
  return Array.from({ length: 36 }, () => (x = (x * 9301 + 49297) % 233280, 18 + Math.round(x / 233280 * 70))); }
const voiceDur = m => { const r = plain.get(m.id + ':' + m.iv), d = r && r.payload && r.payload.d; return d || (playing === m.id && isFinite(player.duration) ? player.duration : 0); };
function voiceHtml(m, P) {
  return `<div class="voice" data-vid="${m.id}"><button type="button" class="vplay" data-vplay aria-label="${t('voice')}">${ic('play', 'fill')}</button><div class="vmain"><div class="wave" data-wave>${waveOf(m, P).map(h => `<i style="height:${Math.min(100, Math.max(10, +h || 10))}%"></i>`).join('')}</div><div class="vrow"><span class="vtime">${P.d ? fmtDur(P.d) : '•:••'}</span><button type="button" class="vspeed" data-vspeed dir="ltr">${vSpeed}×</button></div></div></div>`;
}
const voiceEl = id => document.querySelector(`.voice[data-vid="${id}"]`);
async function playVoice(id, at) {
  if (playing === id && player.src) { if (player.paused) player.play().catch(() => {}); else player.pause(); return; }
  const prev = playing; player.pause(); playing = id; if (prev != null) resetVoice(prev);
  const m = msgsById.get(id), el = voiceEl(id); if (!m) return; if (el) el.classList.add('loading');
  const u = await mediaUrl(m); if (el) el.classList.remove('loading'); if (playing !== id) return; if (!u) { playing = null; return toast(t('cantOpen')); }
  player.src = u; player.playbackRate = vSpeed;
  if (at) { const d = voiceDur(m); if (d) player.addEventListener('loadedmetadata', () => { try { player.currentTime = at * d; } catch {} }, { once: true }); }
  try { await player.play(); } catch { } paintPlayer();
}
function paintPlayer() {
  const el = voiceEl(playing); if (!el) return; const m = msgsById.get(playing); if (!m) return;
  const d = voiceDur(m), f = d ? Math.min(1, player.currentTime / d) : 0, on = !player.paused;
  el.classList.toggle('on', on); const b = el.querySelector('.vplay'); if (b.dataset.st !== String(on)) { b.dataset.st = on; b.innerHTML = ic(on ? 'pause' : 'play', 'fill'); }
  const bars = el.querySelectorAll('.wave i'), n = Math.round(f * bars.length); bars.forEach((x, i) => x.classList.toggle('p', i < n));
  el.querySelector('.vtime').textContent = fmtDur(on || player.currentTime > 0 ? player.currentTime : d);
}
function resetVoice(id) { const el = voiceEl(id), m = msgsById.get(id); if (!el || !m) return; el.classList.remove('on'); const b = el.querySelector('.vplay'); b.dataset.st = ''; b.innerHTML = ic('play', 'fill');
  el.querySelectorAll('.wave i').forEach(x => x.classList.remove('p')); const d = voiceDur(m); el.querySelector('.vtime').textContent = d ? fmtDur(d) : '•:••'; }
player.ontimeupdate = player.onplay = player.onpause = paintPlayer;
player.onended = () => { const id = playing; playing = null; player.removeAttribute('src'); resetVoice(id); };

// ---------- stickers: your own, kept encrypted; only you have them until you send one ----------
let myStk = null, stkLoading = null, stkEditing = false;
async function myDevices() { const { data } = await sb.from('device_keys').select('user_id,device_id,pub').eq('user_id', me.id).eq('revoked', false); const d = data || [];
  if (!d.some(x => x.device_id === myDev.id)) d.push({ user_id: me.id, device_id: myDev.id, pub: myDev.pub }); return d; }
const hashHex = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
function loadStickers() {
  if (myStk) return Promise.resolve(myStk); if (stkLoading) return stkLoading;
  return stkLoading = (async () => {
    const [{ data }, devs] = await Promise.all([sb.from('stickers').select('*').order('id', { ascending: false }), myDevices()]);
    const got = await Promise.all((data || []).map(async s => { try {
      const r = await HC.open(s, myDev, await senderPub({ sender_device: s.sender_device, sender_id: me.id }));
      const { data: f, error } = await sb.storage.from('stickers').download(s.path); if (error) return null;
      const blob = new Blob([await HC.openBytes(r.K, r.payload.mi, new Uint8Array(await f.arrayBuffer()))], { type: r.payload.mt || 'image/png' });
      if (devs.some(d => !s.keys[d.device_id])) { const box = await HC.seal(r.payload, myDev, devs, r.K);   // let my other phones open it too
        sb.from('stickers').update({ ct: box.ct, iv: box.iv, keys: box.keys, sender_device: myDev.id }).eq('id', s.id).then(() => {}); }
      return { id: s.id, path: s.path, sh: r.payload.sh, blob, mt: blob.type, url: URL.createObjectURL(blob) };
    } catch { return null; } }));
    myStk = got.filter(Boolean); stkLoading = null; return myStk;
  })();
}
async function addSticker(blob, sh) {
  const stk = await loadStickers(), bytes = new Uint8Array(await blob.arrayBuffer()); sh = sh || await hashHex(bytes);
  if (stk.some(x => x.sh === sh)) return toast(t('alreadySaved')); if (stk.length >= 300) return toast(t('stickerFull'));
  const K = HC.newKey(), sealed = await HC.sealBytes(K, bytes), path = `${me.id}/${crypto.randomUUID()}`, mt = blob.type || 'image/png';
  const up = await sb.storage.from('stickers').upload(path, new Blob([sealed.data], { type: 'application/octet-stream' }), { contentType: 'application/octet-stream' }); if (up.error) throw up.error;
  const box = await HC.seal({ mi: sealed.iv, mt, sh }, myDev, await myDevices(), K);
  const { data, error } = await sb.from('stickers').insert({ path, ct: box.ct, iv: box.iv, keys: box.keys, sender_device: myDev.id }).select('id').single();
  if (error) { sb.storage.from('stickers').remove([path]); throw error; }
  stk.unshift({ id: data.id, path, sh, blob, mt, url: URL.createObjectURL(blob) }); if (!$('#stkPanel').hidden) renderStickers(); toast(t('stickerSaved'));
}
async function delSticker(id) { const s = myStk.find(x => x.id === id); if (!s || !confirm(t('delSticker'))) return;
  const { error } = await sb.from('stickers').delete().eq('id', id); if (error) return toast(errText(error)); sb.storage.from('stickers').remove([s.path]);
  myStk = myStk.filter(x => x.id !== id); renderStickers(); }
async function renderStickers() {
  const g = $('#stkGrid'); if (!myStk) { g.innerHTML = `<p class="hint stk-empty">${t('loading')}</p>`; await loadStickers(); }
  if (!myStk.length) stkEditing = false;
  g.innerHTML = `<button type="button" class="stk-add" data-stkadd title="${t('makeSticker')}">${ic('plus')}</button>` + myStk.map(x => `<button type="button" class="stk${stkEditing ? ' shake' : ''}" data-stk="${x.id}"><img src="${x.url}" alt="">${stkEditing ? `<span class="stk-x">${ic('x')}</span>` : ''}</button>`).join('')
    + (myStk.length ? '' : `<p class="hint stk-empty">${t('noStickers')}</p>`);
  $('#stkEdit').hidden = !myStk.length; $('#stkEdit').textContent = t(stkEditing ? 'done' : 'editStickers');
}
$('#stkBtn').onclick = () => { const p = $('#stkPanel'), open = p.hidden; p.hidden = !open; $('#stkBtn').classList.toggle('on', open); if (open) { ta.blur(); stkEditing = false; renderStickers(); } };
$('#stkEdit').onclick = () => { stkEditing = !stkEditing; renderStickers(); };
$('#stkGrid').onclick = e => {
  if (e.target.closest('[data-stkadd]')) return stickerMaker();
  const b = e.target.closest('[data-stk]'); if (!b) return; const s = myStk.find(x => x.id === +b.dataset.stk); if (!s) return;
  if (stkEditing) return delSticker(s.id);
  send({ kind: 'sticker', media: { blob: s.blob, type: s.mt }, extra: { sh: s.sh } });
};
// make a sticker from a photo: shape, white edge, optional words
function stickerMaker(file) {
  if (!file) { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => i.files[0] && stickerMaker(i.files[0]); i.click(); return; }
  createImageBitmap(file).then(bmp => {
    let shape = 'round';
    const draw = () => {
      const cv = $('#stkCv'), x = cv.getContext('2d'), S = 512, E = 16, txt = $('#stkTxt').value.trim(); x.clearRect(0, 0, S, S);
      const shapePath = (inset, r) => { x.beginPath(); const w = S - inset * 2;
        if (shape === 'circle') x.arc(S / 2, S / 2, w / 2, 0, Math.PI * 2); else if (x.roundRect) x.roundRect(inset, inset, w, w, r); else x.rect(inset, inset, w, w); };
      let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height, dx = E, dy = E, dw = S - E * 2, dh = S - E * 2;
      x.save(); x.shadowColor = 'rgba(0,0,0,.28)'; x.shadowBlur = 10; x.fillStyle = '#fff';
      if (shape === 'full') { const k = Math.min(dw / sw, dh / sh); dw = sw * k; dh = sh * k; dx = (S - dw) / 2; dy = (S - dh) / 2;
        x.beginPath(); if (x.roundRect) x.roundRect(dx - 10, dy - 10, dw + 20, dh + 20, 38); else x.rect(dx - 10, dy - 10, dw + 20, dh + 20); x.fill(); x.restore(); x.save();
        x.beginPath(); if (x.roundRect) x.roundRect(dx, dy, dw, dh, 28); else x.rect(dx, dy, dw, dh); x.clip(); }
      else { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m;
        shapePath(4, 110); x.fill(); x.restore(); x.save(); shapePath(E, 96); x.clip(); }
      x.drawImage(bmp, sx, sy, sw, sh, dx, dy, dw, dh); x.restore();
      if (txt) { let size = 70; const font = () => x.font = `700 ${size}px 'Readex Pro', Tahoma, sans-serif`; font(); while (x.measureText(txt).width > S - 56 && size > 26) { size -= 4; font(); }
        x.textAlign = 'center'; x.lineJoin = 'round'; x.lineWidth = Math.max(8, size / 5.5); x.strokeStyle = '#141634'; x.fillStyle = '#fff';
        x.strokeText(txt, S / 2, S - 44); x.fillText(txt, S / 2, S - 44); }
      return cv;
    };
    dialog(`<h3>${t('makeSticker')}</h3><p class="muted small">${t('stickerHow')}</p><canvas id="stkCv" class="stk-cv" width="512" height="512"></canvas>
<div class="chips" id="stkShape">${[['round', 'shapeRound'], ['circle', 'shapeCircle'], ['full', 'shapeFull']].map(([v, k]) => `<button type="button" data-shape="${v}" class="${v === shape ? 'on' : ''}">${t(k)}</button>`).join('')}</div>
<input id="stkTxt" maxlength="28" placeholder="${esc(t('stickerText'))}">
<div class="row"><button value="x" class="btn ghost">${t('cancel')}</button><button value="ok" class="btn primary">${t('save')}</button></div>`, async v => {
      if (v !== 'ok') return; const cv = draw();
      const blob = await new Promise(r => cv.toBlob(b => b && b.type === 'image/webp' ? r(b) : cv.toBlob(r, 'image/png'), 'image/webp', .9));
      try { await addSticker(blob); } catch (x) { toast(errText(x)); } });
    draw(); $('#stkTxt').oninput = draw;
    $('#stkShape').onclick = e => { const b = e.target.closest('[data-shape]'); if (!b) return; shape = b.dataset.shape; $$('#stkShape button').forEach(x => x.classList.toggle('on', x === b)); draw(); };
  }).catch(() => toast(t('cantOpen')));
}

// ---------- live updates ----------
function bumpConv(m) { const c = convs.find(x => x.id === m.conversation_id); if (!c) return loadChats();
  c.last = m; c.lastText = plain.get(m.id + ':' + m.iv) || (m.enc !== 1 ? { text: m.body } : null); if (!(current && current.id === c.id) && m.sender_id !== me.id) c.unread++;
  sortConvs(); renderChats(); }
const gotMsg = new Set();
async function onNewMsg(m) {
  if (!m || !m.id || gotMsg.has(m.id)) return; gotMsg.add(m.id); if (gotMsg.size > 3000) gotMsg.clear();
  if (pendIv.has(m.iv)) return;   // this phone sent it and is already showing it
  await needProfiles([m.sender_id]); if (m.sender_id !== me.id) delivered(); await reveal(m);
  const here = current && current.id === m.conversation_id;
  if (here && !known(m)) { const b = $('#msgs'), near = b.scrollHeight - b.scrollTop - b.clientHeight < 200; addMsg(m); if (near || m.sender_id === me.id) scrollDown(); if (!document.hidden) markRead(); }
  if (m.sender_id !== me.id && !document.hidden && m.kind !== 'call') hamsaSound(here ? 'soft' : 'msg');
  bumpConv(m); typers.delete(m.sender_id);
}
// my own private line: the server sends every new message and call here the moment it is saved (faster than the live feed)
const inboxCh = () => sb.getChannels().find(x => me && x.topic.endsWith('user:' + me.id));
async function inbox() {
  for (const ch of sb.getChannels().filter(x => /user:/.test(x.topic))) await sb.removeChannel(ch);
  sb.channel('user:' + me.id, { config: { private: true } })
    .on('broadcast', { event: 'msg' }, ({ payload }) => onNewMsg(payload))
    .on('broadcast', { event: 'conv' }, () => convChanged())
    .on('broadcast', { event: 'call' }, ({ payload }) => payload && payload.row && onCallRow(payload.row, payload.ev))
    .subscribe();
}
// ---------- the همسة sound: its own short "whisper" chime, so you know it is همسة without looking ----------
let sndCtx = null;
function hamsaSound(kind) {
  try { sndCtx = sndCtx || new (window.AudioContext || window.webkitAudioContext)(); if (sndCtx.state === 'suspended') sndCtx.resume(); } catch { return; }
  const x = sndCtx, t0 = x.currentTime + .01, vol = kind === 'soft' ? .07 : .16;
  const note = (f, at, dur) => { const o = x.createOscillator(), o2 = x.createOscillator(), g = x.createGain(); o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 2;
    g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(vol, t0 + at + .015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
    const g2 = x.createGain(); g2.gain.value = .25; o.connect(g); o2.connect(g2); g2.connect(g); g.connect(x.destination); o.start(t0 + at); o2.start(t0 + at); o.stop(t0 + at + dur + .05); o2.stop(t0 + at + dur + .05); };
  if (kind === 'soft') note(1318.5, 0, .18);                                // one quiet "tik" inside the open chat
  else { note(1046.5, 0, .22); note(1568, .11, .32); note(2093, .24, .45); }   // rising three-note whisper: do-sol-do
  if (kind !== 'soft' && navigator.vibrate) navigator.vibrate(60);
}
['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { try { sndCtx = sndCtx || new (window.AudioContext || window.webkitAudioContext)(); if (sndCtx.state === 'suspended') sndCtx.resume(); } catch {} }, { passive: true }));
async function live() {
  for (const ch of sb.getChannels().filter(x => x.topic.endsWith('hamsa-live'))) await sb.removeChannel(ch);
  sb.channel('hamsa-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ({ new: m }) => onNewMsg(m))
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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, ({ eventType, new: r }) => r && r.id && onCallRow(r, eventType))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'statuses' }, () => loadStatusesSoon())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, ({ new: p }) => { if (profiles.has(p.id)) { profiles.set(p.id, p); if (p.id === me.id) { me = p; paintMe(); } renderChats(); } })
    .subscribe();
}

// ---------- staying in sync (phones pause the live connection in the background) ----------
let lastSync = 0, forceLive = false;
const liveCh = () => sb.getChannels().find(x => x.topic.endsWith('hamsa-live'));
async function resync() {
  if (!me || Date.now() - lastSync < 3000) return; lastSync = Date.now();
  const ch = liveCh(), force = forceLive; forceLive = false; if (force || !ch || ch.state !== 'joined') await live();
  const ib = inboxCh(); if (force || !ib || ib.state !== 'joined') await inbox();
  if (current && (!typingCh || typingCh.state !== 'joined')) joinTyping(current.id);
  await Promise.all([loadChats(), loadFriends()]); delivered(); loadStatuses(); if (!call) checkRinging();
  if (current) { const lastId = Math.max(0, ...[...msgsById.keys()].filter(k => k > 0));
    const { data } = await sb.from('messages').select('*').eq('conversation_id', current.id).gt('id', lastId).order('id');
    for (const m of data || []) { await reveal(m); if (!known(m)) addMsg(m); } if (data && data.length) { scrollDown(); markRead(); } }
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
setInterval(() => { if (me && !document.hidden) { const ch = liveCh(), ib = inboxCh(); if (!ch || ch.state !== 'joined' || !ib || ib.state !== 'joined') resync(); } }, 5000);
setInterval(() => { if (me && !document.hidden) resync(); }, 45000);
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => { if (!document.hidden && me && hiddenAt && Date.now() - hiddenAt > 20000) { lastSync = 0; forceLive = true; } if (document.hidden) hiddenAt = Date.now(); if (document.hidden) { goOffline(); stopTyping(); if (R.on) endRec(true); } else { if (current) { markRead(); updateStatus(); } viewing(!!current); delivered(); resync(); checkUpdate(); } });
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
    if (m.pending) return; const before = old.className; old.outerHTML = trail(m, convId); const now = el.querySelector('.trail'); if (now.className !== before) now.classList.add('lit'); });
  note(); renderChats();
}
function note() {
  const box = $('#msgs'); if (!box || !current) return; box.querySelector('.dnote')?.remove();
  const last = [...msgsById.values()].filter(m => !m.deleted).pop(); if (!last || last.sender_id !== me.id || last.pending === 2) return;
  if (last.pending) return box.insertAdjacentHTML('beforeend', `<div class="dnote">${esc(t('sending'))}</div>`);
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
  const b = $('#stBody'), title = { main: 'settings', profile: 'profile', account: 'account', privacy: 'privacy', notif: 'notifications', look: 'appearance', lang: 'language', about: 'about', people: 'friendsTitle', timer: 'timerTitle', statusdur: 'statusDur' }[page] || (page.startsWith('user:') ? 'profileTitle' : 'settings');
  $('#stTitle').textContent = t(title); b.className = 'st-body page-in'; void b.offsetWidth; b.classList.add('go');
  const notifOn = pushOK() && Notification.permission === 'granted';
  if (page === 'main') b.innerHTML = `<button class="st-me" data-page="profile">${avatarHtml(me.id, { cls: 'xl' })}<span><b>${esc(me.display_name)}</b><small dir="ltr">@${esc(me.username)}</small></span>${ic('fwd', 'chev')}</button>
<div class="st-group">${row('account', 'key', t('account'))}${row('privacy', 'lock', t('privacy'))}${row('notif', 'bell', t('notifications'), notifOn ? '✓' : '')}</div>
<div class="st-group">${row('timer', 'timer', t('timerTitle'), timerLabel(prefs.msg_timer))}${row('statusdur', 'status', t('statusDur'), hoursLabel(prefs.status_hours))}</div>
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
  if (page === 'privacy') b.innerHTML = `<div class="st-group">${toggle('tVis', t('showOnline'), t('showOnlineNote'), myPres.visible)}${toggle('tRec', t('readReceipts'), t('readReceiptsNote'), myPres.receipts)}${toggle('tPhoto', t('photoOpen'), t('photoOpenNote'), me.photo_open !== false)}</div>
<div class="st-group">${row('timer', 'timer', t('timerTitle'), timerLabel(prefs.msg_timer))}</div>
<div class="st-group pad e2e"><div class="st-h">${ic('shield')} ${t('e2e')}</div><p class="muted">${t('e2eNote')}</p><p class="muted small">${t('thisDevice')}: <span dir="ltr">${esc((myDev && myDev.id || '').slice(0, 10))}</span></p></div>`;
  if (page === 'notif') b.innerHTML = `<div class="st-group">${toggle('tPush', t('newNotif'), t('notifNote'), notifOn)}</div>${installEvt || (isIOS && !installed()) ? `<div class="st-group">${row('install', 'install', t('installApp'))}</div>` : ''}`;
  if (page === 'look') b.innerHTML = `<div class="st-group">${radio('theme', 'dark', t('dark'), theme === 'dark')}${radio('theme', 'light', t('light'), theme === 'light')}${radio('theme', 'auto', t('auto'), theme === 'auto')}</div>`;
  if (page === 'lang') b.innerHTML = `<div class="st-group">${Object.entries(I18N).map(([k, v]) => radio('lang', k, v.langName, lang === k)).join('')}</div>`;
  if (page === 'people') { b.innerHTML = `<form id="pfForm" class="st-group pad addf"><div class="st-h">${ic('userPlus')} ${t('addFriends')}</div><div class="add"><input id="pfUser" dir="ltr" placeholder="${esc(t('addFriendPh'))}" maxlength="20" autocapitalize="off" autocomplete="off" spellcheck="false"><button class="btn primary">${t('add')}</button></div><p id="pfMsg" class="hint"></p></form>
<div class="st-group">${row('newgroup', 'group', t('newGroup'))}</div><div id="peopleLists"></div>`; loadFriends(); }
  if (page === 'timer') b.innerHTML = `<p class="st-note">${t('timerNote')}</p><div class="st-group">${TIMERS.map(([v, k]) => radio('timer', v, t(k), prefs.msg_timer === v)).join('')}</div>`;
  if (page === 'statusdur') b.innerHTML = `<p class="st-note">${t('statusDurNote')}</p><div class="st-group">${SHOURS.map(([v, k]) => radio('sdur', v, t(k), prefs.status_hours === v)).join('')}</div>`;
  if (page.startsWith('user:')) renderProfile(b, page.slice(5));
  if (groupPage(page)) renderGroup(b, page.slice(page.indexOf(':') + 1), page.slice(0, page.indexOf(':')));
  if (page === 'about') b.innerHTML = `<div class="st-about"><img src="icon.svg" alt=""><b>همسة · Hamsa</b><span>${t('version', { v: VERSION })}</span><p class="muted">${t('aboutText')}</p><button class="btn ghost" id="updBtn">${t('checkUpdate')}</button></div>`;
}
$('#stBody').addEventListener('click', async e => {
  const r = e.target.closest('[data-page]'); if (r) { if (r.dataset.page === 'install') return installNow(); if (r.dataset.page === 'newgroup') return newGroup(); return openSettings(r.dataset.page); }
  const fb = e.target.closest('[data-acc],[data-dec],[data-nick],[data-rm],[data-dm]'); if (fb) return friendAction(fb);
  const pu = e.target.closest('[data-user]'); if (pu) return openSettings('user:' + pu.dataset.user);
  const pf = e.target.closest('[data-pf]'); if (pf) return profileAction(pf.dataset.pf, pf.dataset.id);
  const ph = e.target.closest('[data-photo]'); if (ph) return openPhoto(ph.dataset.photo);
  if (e.target.closest('#stLogout')) return logout();
  if (e.target.closest('#photoBtn')) return $('#photoIn').click();
  if (e.target.closest('#photoDel')) return setPhoto(null);
  if (e.target.closest('#nameSave')) { const n = $('#sName').value.trim().slice(0, 40); if (!n) return; const { error } = await sb.from('profiles').update({ display_name: n }).eq('id', me.id); if (error) return toast(errText(error)); me.display_name = n; profiles.set(me.id, me); paintMe(); return toast(t('saved')); }
  if (e.target.closest('#passSave')) { const o = $('#pOld').value, n = $('#pNew').value; if (n.length < 8) return toast(t('errPass8'));
    const chk = await sb.auth.signInWithPassword({ email: `${me.username}@${HAMSA.emailDomain}`, password: o }); if (chk.error) return toast(t('wrongPass'));
    const { error } = await sb.auth.updateUser({ password: n }); if (error) return toast(errText(error)); await sb.auth.signOut({ scope: 'others' }); $('#pOld').value = $('#pNew').value = ''; return toast(t('passChanged')); }
  if (e.target.closest('#updBtn')) { const had = await checkUpdate(true); if (!had) toast(t('upToDate')); }
});
$('#stBody').addEventListener('submit', e => { if (e.target.id === 'pfForm') { e.preventDefault(); addFriend(); } });
$('#stBody').addEventListener('change', async e => {
  const x = e.target;
  if (x.id === 'photoIn' && x.files[0]) return setPhoto(x.files[0]);
  if (x.id === 'tVis' || x.id === 'tRec') { myPres = { visible: $('#tVis').checked, receipts: $('#tRec').checked }; await sb.from('presence').upsert({ visible: myPres.visible, receipts: myPres.receipts }, { onConflict: 'user_id' }); if (current) { updateStatus(); refreshTrail(current.id); } return; }
  if (x.id === 'tPush') { if (x.checked) await enablePush(); else await disablePush(); renderSettings('notif'); return; }
  if (x.name === 'theme') return setTheme(x.value);
  if (x.name === 'timer') return savePrefs({ msg_timer: +x.value });
  if (x.name === 'sdur') return savePrefs({ status_hours: +x.value });
  if (x.id === 'tPhoto') { const on = x.checked, { error } = await sb.from('profiles').update({ photo_open: on }).eq('id', me.id); if (error) { x.checked = !on; return toast(errText(error)); }
    me.photo_open = on; profiles.set(me.id, me); if (!on && me.avatar_url) { const f = fullPath(me.avatar_url); if (f) sb.storage.from('avatars').remove([f]).then(() => {}); } return; }
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
      url = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      if (me.photo_open !== false) { const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height)), f = document.createElement('canvas'); f.width = Math.round(bmp.width * k); f.height = Math.round(bmp.height * k);
        f.getContext('2d').drawImage(bmp, 0, 0, f.width, f.height); const big = await new Promise(r => f.toBlob(r, 'image/jpeg', .88));
        await sb.storage.from('avatars').upload(path.replace(/\.jpg$/, '-full.jpg'), big, { contentType: 'image/jpeg' }); } }
    const { error } = await sb.from('profiles').update({ avatar_url: url }).eq('id', me.id); if (error) throw error;
    if (old) sb.storage.from('avatars').remove([decodeURIComponent(old), decodeURIComponent(old).replace(/\.jpg$/, '-full.jpg')]).then(() => {});
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
  if (!$('#story').hidden) return closeStory(true);
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
  navigator.serviceWorker.addEventListener('message', e => { const d = e.data || {}; if (!me) return; if (d.call) return checkRinging(); if (d.people) return openSettings('people'); if (d.open) openChat(d.open); });
  navigator.serviceWorker.addEventListener('controllerchange', () => {   // a new version took over: reload when it will not interrupt you
    if (reloading) return; const go = () => { reloading = true; try { sessionStorage.setItem('hamsa-updated', '1'); } catch {} location.reload(); };
    if (!ta.value.trim() && !R.on && player.paused && !call && $('#story').hidden && !$('#dlg').open) go(); else { const u = $('#updBar'); u.textContent = t('updateReady'); u.hidden = false; u.onclick = go; }
  });
}
async function checkUpdate(manual) { if (!swReg) return false; try { await swReg.update(); } catch {} return !!(swReg.installing || swReg.waiting); }
setInterval(() => { if (!document.hidden) checkUpdate(); }, 30 * 60000);
try { if (sessionStorage.getItem('hamsa-updated')) { sessionStorage.removeItem('hamsa-updated'); setTimeout(() => toast(t('updated')), 800); } } catch {}

// ---------- first screen ----------
applyLang(); setMode('in');
sb.auth.getSession().then(({ data }) => { if (!data.session) { if (!lang) $('#lang').hidden = false; else $('#auth').hidden = false; } });

// ---------- profiles ----------
const TIMERS = [[0, 'off'], [3600, 'h1'], [86400, 'h24'], [604800, 'd7'], [2592000, 'd30']];
const SHOURS = [[6, 'h6'], [12, 'h12'], [24, 'h24'], [48, 'h48'], [168, 'd7']];
const timerLabel = v => t((TIMERS.find(x => x[0] === v) || [0, 'off'])[1]);
const hoursLabel = v => t((SHOURS.find(x => x[0] === v) || [24, 'h24'])[1]);
const fullPath = url => { const p = url && url.split('/avatars/')[1]; return p ? decodeURIComponent(p).replace(/\.jpg$/, '-full.jpg') : null; };
$('#dlgBody').addEventListener('click', e => { const u = e.target.closest('[data-uopen]'); if (!u || u.dataset.uopen === me.id) return; $('#dlg').close(); openSettings('user:' + u.dataset.uopen); });
async function renderProfile(b, id) {
  const draw = () => { const p = profiles.get(id) || {}, mine = id === me.id, fr = friends.find(f => f.status === 'accepted' && (f.requester === id || f.addressee === id)), hasSt = (stories.get(id) || []).length;
    b.innerHTML = `<div class="pf-head"><button class="pf-photo" data-photo="${id}">${avatarHtml(id, { cls: 'xxl' })}</button><h2>${esc(nameOf(id))}</h2>
${nicks.has(id) ? `<small>${t('realName')}: ${esc(p.display_name || '')}</small>` : ''}<small dir="ltr">@${esc(p.username || '')}</small></div>
${mine ? `<div class="st-group">${row('profile', 'edit', t('editProfile'))}</div>` : `<div class="pf-actions"><button data-pf="msg" data-id="${id}">${ic('chat')}<span>${t('message')}</span></button><button data-pf="voice" data-id="${id}">${ic('phone')}<span>${t('voiceCall')}</span></button><button data-pf="video" data-id="${id}">${ic('video')}<span>${t('videoCall')}</span></button></div>
<div class="st-group"><button class="st-row" data-pf="nick" data-id="${id}"><span class="st-ic">${ic('edit')}</span><span class="st-label">${t('renameHere')}</span><span class="st-val">${nicks.has(id) ? esc(nicks.get(id)) : ''}</span>${ic('fwd', 'chev')}</button>
${hasSt ? `<button class="st-row" data-pf="status" data-id="${id}"><span class="st-ic">${ic('status')}</span><span class="st-label">${t('viewStatus')}</span>${ic('fwd', 'chev')}</button>` : ''}
${fr ? `<button class="st-row danger" data-pf="unfriend" data-id="${fr.id}"><span class="st-ic">${ic('trash')}</span><span class="st-label">${t('removeFriend')}</span></button>` : ''}</div>`}`; };
  draw(); const { data } = await sb.from('profiles').select('*').eq('id', id).maybeSingle(); if (data) { profiles.set(id, data); if (id === me.id) me = data; if (stPages[stPages.length - 1] === 'user:' + id) draw(); }
}
async function dmWith(id) { const c = convs.find(x => !x.is_group && otherOf(x) === id); if (c) return c.id; const { data, error } = await sb.rpc('start_dm', { other: id }); if (error) { toast(errText(error)); return null; } await loadChats(); return data; }
async function profileAction(a, id) {
  if (a === 'nick') return rename(id);
  if (a === 'status') return openStory(id);
  if (a === 'unfriend') { if (!confirm(t('sure'))) return; await sb.from('friendships').delete().eq('id', +id); await loadFriends(); return history.back(); }
  const conv = await dmWith(id); if (!conv) return;
  await goChat(conv); if (a === 'voice' || a === 'video') startCall(conv, a === 'video');
}
function openPhoto(id) {
  const p = profiles.get(id) || {}; if (!p.avatar_url) return;
  if (id !== me.id && p.photo_open === false) return toast(t('photoLocked', { n: nameOf(id) }));
  const v = document.createElement('div'); v.className = 'viewer'; const im = document.createElement('img'); im.src = p.avatar_url.replace(/\.jpg$/, '-full.jpg'); im.onerror = () => { im.onerror = null; im.src = p.avatar_url; };
  v.appendChild(im); v.onclick = () => v.remove(); document.body.appendChild(v);
}
