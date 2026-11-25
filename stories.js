// همسة · stories (like Snapchat). Text or a photo, seen only by your friends, gone after the time you chose in Settings.
// Each status is encrypted on the phone for the devices of your friends (and your own), like a message.
const stories = new Map();   // user id → [rows], oldest first
let seenSt = new Set(), stTimer = null;
const BGS = ['#7C6CF0', '#E0607E', '#3FA7D6', '#45B39D', '#F2A541', '#B86ADF', '#2B2F66', '#D9825B'];

async function loadStatuses() {
  if (!me) return;
  const [{ data }, { data: v }] = await Promise.all([
    sb.from('statuses').select('*').gt('expires_at', new Date(srvNow()).toISOString()).order('created_at'),
    sb.from('status_views').select('status_id').eq('viewer', me.id)]);
  stories.clear(); for (const r of data || []) { if (!stories.has(r.user_id)) stories.set(r.user_id, []); stories.get(r.user_id).push(r); }
  seenSt = new Set((v || []).map(x => x.status_id)); await needProfiles([...stories.keys()]); renderStrip();
}
const loadStatusesSoon = () => { clearTimeout(stTimer); stTimer = setTimeout(loadStatuses, 700); };
const unseen = id => (stories.get(id) || []).some(r => !seenSt.has(r.id));
function stripOrder() { return [...stories.keys()].filter(id => id !== me.id).sort((a, b) => (unseen(b) - unseen(a)) || (new Date(stories.get(b)[stories.get(b).length - 1].created_at) - new Date(stories.get(a)[stories.get(a).length - 1].created_at))); }
function renderStrip() {   // the stories page (its own tab, like Snapchat)
  const box = $('#stories'); if (!box || !me) return; const mine = stories.get(me.id) || [], order = stripOrder();
  const last = id => { const l = stories.get(id) || []; return l.length ? ago(l[l.length - 1].created_at) : ''; };
  const row = id => `<button class="sp-row" data-su="${id}"><span class="ring${unseen(id) ? ' new' : ''}">${avatarHtml(id)}</span><span class="mid"><b>${esc(nameOf(id))}</b><small>${last(id)}</small></span></button>`;
  const fresh = order.filter(unseen), old = order.filter(id => !unseen(id));
  box.innerHTML = `<div class="sp-me"><button class="sp-mine" data-su="${me.id}"><span class="ring${mine.length ? ' own' : ''}">${avatarHtml(me.id)}${mine.length ? '' : `<i class="plus-b">${ic('plus')}</i>`}</span><span class="mid"><b>${t('myStatus')}</b><small>${mine.length ? last(me.id) : t('tapToAdd')}</small></span></button><button class="sp-add" data-add="1" title="${t('addStatus')}">${ic('camera')}</button></div>`
    + (fresh.length ? `<div class="sp-sec">${t('newStories')}</div><div class="sp-list">${fresh.map(row).join('')}</div>` : '')
    + (old.length ? `<div class="sp-sec">${t('seenStories')}</div><div class="sp-list seen">${old.map(row).join('')}</div>` : '')
    + (order.length ? '' : `<p class="sp-empty">${t('noStories')}</p>`);
  const dot = $('#stDot'); if (dot) dot.hidden = !fresh.length;
}
$('#stories').onclick = e => { if (e.target.closest('[data-add]')) return makeStatus(); const b = e.target.closest('[data-su]'); if (!b) return; const id = b.dataset.su;
  if (id === me.id && !(stories.get(me.id) || []).length) return makeStatus(); openStory(id); };
// the two tabs at the bottom: chats and stories
function setTab(tab) { const V = { chats: '#chatsView', stories: '#storiesView', me: '#meView' }, was = Object.keys(V).find(k => !$(V[k]).hidden);
  for (const k in V) $(V[k]).hidden = k !== tab; $('#side').classList.toggle('on-me', tab === 'me'); if (tab === 'me') renderMe();
  if (was !== tab) { const v = $(V[tab]); v.classList.remove('tab-in'); void v.offsetWidth; v.classList.add('tab-in'); } $$('.tabbar [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab)); if (tab === 'stories') renderStrip(); }
$('.tabbar').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); };

// ---- making a story: a full screen like Snapchat (camera, photos, or words on a colour) ----
const VMAX = 60;   // seconds
function makeStatus() {
  if ($('#smake')) return;
  let mode = null, bg = BGS[Math.floor(Math.random() * BGS.length)], photo = null, vid = null, busy = false;
  const el = document.createElement('section'); el.id = 'smake'; el.className = 'smake';
  el.innerHTML = `<div class="sm-stage" id="smStage">
  <div class="sm-pick" id="smPick"><b>${t('smPick')}</b>
    <div class="sm-opts"><button type="button" data-src="cam"><span>${ic('camera')}</span><small>${t('smCamera')}</small></button>
    <button type="button" data-src="gal"><span>${ic('photo')}</span><small>${t('smGallery')}</small></button>
    <button type="button" data-src="txt"><span>${ic('text')}</span><small>${t('statusText')}</small></button></div>
    <p>${t('statusDurNote')} (${hoursLabel(prefs.status_hours)})</p></div>
  <textarea id="smTxt" class="sm-txt" maxlength="400" dir="auto" placeholder="${esc(t('typeStatus'))}" hidden></textarea>
  <img id="smImg" class="sm-media" alt="" hidden><video id="smVid" class="sm-media" playsinline muted loop hidden></video>
  <input id="smCap" class="sm-cap" maxlength="200" dir="auto" placeholder="${esc(t('caption'))}" hidden>
  <div id="smProg" class="sm-prog2" hidden></div></div>
<div class="sm-top"><button type="button" class="sm-x" id="smX" title="${t('close')}">${ic('x')}</button><span class="sm-sp"></span>
  <button type="button" class="sm-tool" id="smAgain" title="${t('smGallery')}" hidden>${ic('photo')}</button></div>
<div class="sm-bot" id="smBot" hidden><div class="sm-bgs2" id="smBg" hidden>${BGS.map(c => `<button type="button" data-bg="${c}" style="background:${c}" class="${c === bg ? 'on' : ''}"></button>`).join('')}</div>
  <p id="smVnote" class="sm-vnote" hidden>${t('videoLong')}</p>
  <button type="button" class="sm-post" id="smPost">${avatarHtml(me.id, { cls: 'sm' })}<b>${t('myStatus')}</b>${ic('send')}</button></div>`;
  document.body.appendChild(el); el.style.background = '#000'; requestAnimationFrame(() => el.classList.add('open'));
  const pick = (accept, cam) => new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; if (cam) i.setAttribute('capture', 'environment'); i.onchange = () => res(i.files[0] || null); i.click(); });
  const show = m => { mode = m; const has = !!m;
    $('#smPick').hidden = has; $('#smBot').hidden = !has; $('#smTxt').hidden = m !== 'text'; $('#smBg').hidden = m !== 'text';
    $('#smImg').hidden = m !== 'photo'; const sv = $('#smVid'); sv.hidden = m !== 'video'; if (m === 'video') sv.play().catch(() => {}); else sv.pause();
    $('#smCap').hidden = !(m === 'photo' || m === 'video'); $('#smAgain').hidden = !(m === 'photo' || m === 'video'); $('#smVnote').hidden = !(m === 'video' && vid && vid.long);
    el.style.background = m === 'text' ? bg : '#000'; if (m === 'text') $('#smTxt').focus(); };
  const useFile = async f => { if (!f) return;
    if (/^video\//.test(f.type)) { try { vid = await prepVideo(f); const sv = $('#smVid'); sv.classList.toggle('fill', vid.el.videoHeight / (vid.el.videoWidth || 1) > 1.25); sv.src = vid.url; photo = null; show('video'); } catch (x) { toast(x.msg || t('cantOpen')); } return; }
    try { photo = await shrink(f); const im = $('#smImg'); im.onload = () => im.classList.toggle('fill', im.naturalHeight / im.naturalWidth > 1.25); im.src = URL.createObjectURL(photo.blob); vid = null; show('photo'); } catch { toast(t('cantOpen')); } };
  const close = () => { if (busy) return; const sv = $('#smVid'); sv.pause(); if (vid && vid.url) URL.revokeObjectURL(vid.url); el.classList.remove('open'); setTimeout(() => el.remove(), 220); document.removeEventListener('keydown', esc_); };
  const dirty = () => (mode === 'text' && $('#smTxt').value.trim()) || mode === 'photo' || mode === 'video';
  const esc_ = e => { if (e.key === 'Escape') $('#smX').click(); }; document.addEventListener('keydown', esc_);
  $('#smX').onclick = () => { if (busy) return; if (dirty() && !confirm(t('smDiscard'))) return; close(); };
  $('#smPick').onclick = async e => { const b = e.target.closest('[data-src]'); if (!b) return;
    if (b.dataset.src === 'txt') return show('text');
    useFile(await pick('image/*,video/*', b.dataset.src === 'cam')); };
  $('#smAgain').onclick = async () => useFile(await pick('image/*,video/*'));
  $('#smBg').onclick = e => { const b = e.target.closest('[data-bg]'); if (!b) return; bg = b.dataset.bg; $$('#smBg button').forEach(x => x.classList.toggle('on', x === b)); el.style.background = bg; };
  $('#smTxt').oninput = () => { const n = $('#smTxt').value.length; $('#smTxt').style.fontSize = (n > 160 ? 22 : n > 70 ? 27 : 34) + 'px'; };
  $('#smPost').onclick = async () => {
    if (busy) return; const text = (mode === 'text' ? $('#smTxt').value : $('#smCap').value).trim();
    if (mode === 'text' && !text) return toast(t('writeSomething'));
    busy = true; el.classList.add('busy'); const pg = $('#smProg'); pg.hidden = false; pg.textContent = t('uploading');
    try {
      if (mode === 'video' && vid.needs) { const out = await recodeVideo(vid, p => pg.textContent = t('videoPrep', { p: Math.round(p * 100) })); Object.assign(vid, out, { needs: false }); pg.textContent = t('uploading'); }
      await postStatus({ text, bg, photo: mode === 'photo' ? photo : null, video: mode === 'video' ? vid : null });
      busy = false; close(); toast(t('statusPosted'));
    } catch (x) { console.warn(x); busy = false; el.classList.remove('busy'); pg.hidden = true; toast(x.msg || errText(x)); }
  };
}
// look at a chosen video: how long, how big, and can every phone play it as it is?
async function prepVideo(f) {
  const url = URL.createObjectURL(f), el = document.createElement('video'); el.preload = 'auto'; el.playsInline = true; el.src = url;
  await new Promise((ok, no) => { el.onloadedmetadata = ok; el.onerror = () => no(new Error('video')); setTimeout(() => no(new Error('video')), 15000); });
  if (!isFinite(el.duration)) {   // some recordings do not say how long they are until you jump to the end
    await new Promise(ok => { const done = () => { if (isFinite(el.duration)) { el.ontimeupdate = el.ondurationchange = null; ok(); } }; el.ondurationchange = el.ontimeupdate = done; el.currentTime = 1e101; setTimeout(ok, 4000); });
    el.currentTime = 0; }
  const d = isFinite(el.duration) ? el.duration : 0, plain = /^video\/(mp4|webm)$/.test(f.type);
  const needs = !plain || f.size > 15 * 1024 * 1024 || d > VMAX + .5 || Math.max(el.videoWidth, el.videoHeight) > 1280;
  const canRecode = !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);
  if (needs && !canRecode) { if (f.size > 45 * 1024 * 1024 || d > VMAX + .5) throw Object.assign(new Error('big'), { msg: t('videoTooBig') }); }
  return { file: f, blob: f, type: f.type || 'video/mp4', url, el, d: Math.min(d, VMAX), long: d > VMAX + .5, needs: needs && canRecode };
}
// shrink a video on the phone: redraw it at up to 720p, keep the sound, stop after one minute
async function recodeVideo(v, onProg, max = VMAX) {   // max: how many seconds to keep (stories: 60, chat videos: 180)
  const el = v.el; el.currentTime = 0; el.muted = false;
  const k = Math.min(1, 720 / Math.max(el.videoWidth, el.videoHeight)), w = Math.max(2, Math.round(el.videoWidth * k / 2) * 2), h = Math.max(2, Math.round(el.videoHeight * k / 2) * 2);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), stream = c.captureStream(30);
  let ac = null; try { ac = new (window.AudioContext || window.webkitAudioContext)(); const src = ac.createMediaElementSource(el), dst = ac.createMediaStreamDestination(); src.connect(dst); dst.stream.getAudioTracks().forEach(tr => stream.addTrack(tr)); } catch {}
  const type = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'].find(tp => MediaRecorder.isTypeSupported(tp)) || '';
  const rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 1600000, audioBitsPerSecond: 96000 }), chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  await el.play(); rec.start(500);
  const limit = Math.min(max, v.d || max);
  await new Promise(res => { const draw = () => { if (el.ended || el.currentTime >= limit) return res(); x.drawImage(el, 0, 0, w, h); onProg(Math.min(1, el.currentTime / limit)); requestAnimationFrame(draw); }; el.onended = res; draw(); });
  el.pause(); const stopped = new Promise(r => rec.onstop = r); rec.stop(); await stopped; stream.getTracks().forEach(tr => tr.stop()); if (ac) ac.close().catch(() => {});
  const mt = (rec.mimeType || type || 'video/webm').split(';')[0], blob = new Blob(chunks, { type: mt });
  if (blob.size > 48 * 1024 * 1024) throw Object.assign(new Error('big'), { msg: t('videoTooBig') });
  return { blob, type: mt, d: Math.min(limit, el.currentTime || limit) };
}
async function postStatus({ text, bg, photo, video }) {
  const fids = friends.filter(f => f.status === 'accepted').map(f => f.requester === me.id ? f.addressee : f.requester);
  const { data: devs } = await sb.from('device_keys').select('user_id,device_id,pub').in('user_id', [me.id, ...fids]).eq('revoked', false);
  const list = devs || []; if (!list.some(d => d.device_id === myDev.id)) list.push({ user_id: me.id, device_id: myDev.id, pub: myDev.pub });
  const K = HC.newKey(), payload = { t: text, bg }, media = photo || video; let path = null;
  if (media) {
    const sealed = await HC.sealBytes(K, new Uint8Array(await media.blob.arrayBuffer())); path = `${me.id}/${crypto.randomUUID()}`;
    const up = await sb.storage.from('status').upload(path, new Blob([sealed.data], { type: 'application/octet-stream' }), { contentType: 'application/octet-stream' }); if (up.error) throw up.error;
    payload.mi = sealed.iv; payload.mt = media.type; if (video) payload.d = Math.round(video.d * 10) / 10; }
  const box = await HC.seal(payload, myDev, list, K);
  const { error } = await sb.from('statuses').insert({ kind: video ? 'video' : photo ? 'image' : 'text', media_path: path, ct: box.ct, iv: box.iv, keys: box.keys, sender_device: myDev.id,
    expires_at: new Date(srvNow() + prefs.status_hours * 3600e3).toISOString() });
  if (error) { if (path) sb.storage.from('status').remove([path]); throw error; }
  if (video && video.url) URL.revokeObjectURL(video.url);
  await loadStatuses();
}

// ---- watching statuses ----
const SV = { uid: null, i: 0, start: 0, left: 0, paused: false, raf: 0, cache: new Map() };
async function openStatusRow(r) {
  if (SV.cache.has(r.id)) return SV.cache.get(r.id);
  let out; try { const x = await HC.open(r, myDev, await senderPub({ sender_device: r.sender_device, sender_id: r.user_id }));
    out = { t: x.payload.t || '', bg: x.payload.bg, video: r.kind === 'video', d: x.payload.d };
    if (r.kind === 'image' || r.kind === 'video') { const { data, error } = await sb.storage.from('status').download(r.media_path); if (error) throw error;
      out.url = URL.createObjectURL(new Blob([await HC.openBytes(x.K, x.payload.mi, new Uint8Array(await data.arrayBuffer()))], { type: x.payload.mt || 'image/jpeg' })); }
  } catch { out = { fail: true }; }
  SV.cache.set(r.id, out); return out;
}
function openStory(uid) {
  const list = stories.get(uid); if (!list || !list.length) return;
  SV.uid = uid; SV.i = uid === me.id ? 0 : Math.max(0, list.findIndex(r => !seenSt.has(r.id))); if (SV.i < 0) SV.i = 0;
  const s = $('#story'); if (s.hidden) history.pushState({ v: 'story' }, ''); s.hidden = false; requestAnimationFrame(() => s.classList.add('open'));
  avatarInto($('#svAv'), uid); $('#svName').textContent = uid === me.id ? t('myStatus') : nameOf(uid); $('#svAdd').hidden = uid !== me.id;
  showStory();
}
async function showStory() {
  const list = stories.get(SV.uid) || [], r = list[SV.i]; if (!r) return nextUser();
  cancelAnimationFrame(SV.raf); SV.paused = false; stopVid();
  $('#svBars').innerHTML = list.map((x, k) => `<i><b style="width:${k < SV.i ? 100 : 0}%"></b></i>`).join('');
  $('#svTime').textContent = ago(r.created_at); const body = $('#svBody'); body.innerHTML = '<div class="sv-load"></div>'; $('#svFoot').innerHTML = '';
  const o = await openStatusRow(r); if (SV.uid !== r.user_id || (stories.get(SV.uid) || [])[SV.i] !== r) return;
  if (o.fail) body.innerHTML = `<div class="sv-text" style="background:#2B2F66"><span>${esc(t('cantOpen'))}</span></div>`;
  else if (o.video) body.innerHTML = `<video class="sv-img" playsinline preload="auto" src="${o.url}"></video>${o.t ? `<div class="sv-cap">${esc(o.t)}</div>` : ''}`;
  else if (o.url) body.innerHTML = `<img class="sv-img" src="${o.url}" alt="">${o.t ? `<div class="sv-cap">${esc(o.t)}</div>` : ''}`;
  else body.innerHTML = `<div class="sv-text" style="background:${esc(o.bg || BGS[0])}"><span dir="auto">${esc(o.t)}</span></div>`;
  if (r.user_id === me.id) { const { data } = await sb.from('status_views').select('viewer,seen_at').eq('status_id', r.id); const v = data || [];
    $('#svFoot').innerHTML = `<button class="sv-views" data-views="${r.id}">${ic('eye')} ${v.length}</button><button class="sv-del" data-sdel="${r.id}">${ic('trash')}</button>`; SV.views = v; }
  else if (!seenSt.has(r.id)) { seenSt.add(r.id); sb.from('status_views').insert({ status_id: r.id }).then(() => {}); renderStrip(); }
  $('#svReply').hidden = r.user_id === me.id || !!o.fail; if (r.user_id === me.id) $('#svRtext').value = '';
  const media = body.querySelector('.sv-img'); if (media) { const fit = () => { const w = media.videoWidth || media.naturalWidth, h = media.videoHeight || media.naturalHeight; media.classList.toggle('fill', !!w && h / w > 1.25); };
    media.addEventListener(media.tagName === 'VIDEO' ? 'loadedmetadata' : 'load', fit); fit(); }
  SV.dur = o.url ? 7000 : 5500; SV.acc = 0; SV.start = performance.now(); SV.paused = false; SV.video = null; $('#svMute').hidden = true;
  if (o.video && !o.fail) { const v = body.querySelector('video'); SV.video = v; SV.vd = o.d || 0; v.muted = !!SV.muted; v.onended = () => SV.video === v && goStory(1);
    try { await v.play(); } catch { v.muted = true; SV.muted = true; v.play().catch(() => {}); }
    $('#svMute').hidden = false; paintMute(); }
  tickStory();
}
function tickStory() {
  cancelAnimationFrame(SV.raf); const bar = $$('#svBars b')[SV.i]; if (!bar) return;
  const step = now => { if ($('#story').hidden) return;
    if (SV.video) { const v = SV.video, d = isFinite(v.duration) && v.duration ? v.duration : SV.vd || 1; bar.style.width = Math.min(100, v.currentTime / d * 100) + '%'; SV.raf = requestAnimationFrame(step); return; }
    const f = Math.min(1, (SV.acc + (SV.paused ? 0 : now - SV.start)) / SV.dur); bar.style.width = f * 100 + '%';
    if (f >= 1) return goStory(1); SV.raf = requestAnimationFrame(step); };
  SV.raf = requestAnimationFrame(step);
}
function stopVid() { if (SV.video) { SV.video.onended = null; SV.video.pause(); SV.video.removeAttribute('src'); SV.video = null; } }
function paintMute() { const b = $('#svMute'); b.innerHTML = ic(SV.muted ? 'soundOff' : 'sound'); b.title = t(SV.muted ? 'tapSound' : 'mute'); }
$('#svMute').onclick = () => { SV.muted = !SV.muted; if (SV.video) { SV.video.muted = SV.muted; SV.video.play().catch(() => {}); } paintMute(); };
function pauseStory(on) { if (SV.video) { if (on) SV.video.pause(); else SV.video.play().catch(() => {}); } if (on === SV.paused) return; const now = performance.now(); if (on) { SV.acc += now - SV.start; SV.paused = true; } else { SV.start = now; SV.paused = false; } }
function goStory(d) { const list = stories.get(SV.uid) || []; SV.i += d; if (SV.i < 0) SV.i = 0; if (SV.i >= list.length) return nextUser(); showStory(); }
function nextUser() { const order = stripOrder(), k = order.indexOf(SV.uid), nx = SV.uid !== me.id && k >= 0 ? order.slice(k + 1).find(unseen) : null;
  if (nx) { SV.uid = nx; SV.i = Math.max(0, (stories.get(nx) || []).findIndex(r => !seenSt.has(r.id))); avatarInto($('#svAv'), nx); $('#svName').textContent = nameOf(nx); $('#svAdd').hidden = true; return showStory(); }
  closeStory(); }
function closeStory(fromHistory) { const s = $('#story'); if (s.hidden) return; cancelAnimationFrame(SV.raf); stopVid(); s.classList.remove('open'); setTimeout(() => { s.hidden = true; $('#svBody').innerHTML = ''; }, 220);
  if (!fromHistory && history.state && history.state.v === 'story') history.back(); }
$('#svClose').onclick = () => closeStory();
$('#svAdd').onclick = () => { closeStory(); setTimeout(makeStatus, 250); };
$('#svFoot').onclick = async e => {
  const v = e.target.closest('[data-views]'), d = e.target.closest('[data-sdel]');
  if (v) { pauseStory(true); await needProfiles((SV.views || []).map(x => x.viewer));
    dialog(`<h3>${t('seenBy', { n: (SV.views || []).length })}</h3><div class="scroll">${(SV.views || []).map(x => `<div class="frow flush">${avatarHtml(x.viewer, { cls: 'sm' })}<div class="mid"><b>${esc(nameOf(x.viewer))}</b><small>${ago(x.seen_at)}</small></div></div>`).join('') || `<p class="muted">${t('noViews')}</p>`}</div><div class="row"><button value="x" class="btn primary">${t('close')}</button></div>`, () => pauseStory(false)); }
  if (d) { pauseStory(true); if (!confirm(t('delStatus'))) return pauseStory(false); const r = (stories.get(me.id) || []).find(x => x.id === +d.dataset.sdel);
    await sb.from('statuses').delete().eq('id', +d.dataset.sdel); if (r && r.media_path) sb.storage.from('status').remove([r.media_path]);
    await loadStatuses(); if ((stories.get(me.id) || []).length) { SV.i = Math.min(SV.i, stories.get(me.id).length - 1); showStory(); } else closeStory(); }
};
// tap the start side to go back, the end side to go forward; hold to pause; swipe down to close (like Snapchat)
(() => { const b = $('#svBody'), sv = $('#story'); let down = 0, timer = null, y0 = 0, x0 = 0, dy = 0, moved = false;
  const reset = () => { sv.style.transform = ''; sv.style.transition = ''; sv.style.borderRadius = ''; };
  b.addEventListener('pointerdown', e => { down = Date.now(); y0 = e.clientY; x0 = e.clientX; dy = 0; moved = false; timer = setTimeout(() => pauseStory(true), 180); });
  b.addEventListener('pointermove', e => { if (!down) return; const d = e.clientY - y0;
    if (Math.abs(d) > 10 || Math.abs(e.clientX - x0) > 10) { moved = true; clearTimeout(timer); pauseStory(true); }
    dy = Math.max(0, d); if (dy) { sv.style.transition = 'none'; sv.style.transform = `translateY(${dy}px) scale(${1 - Math.min(dy, 400) / 2000})`; sv.style.borderRadius = '24px'; } });
  b.addEventListener('pointerup', e => { clearTimeout(timer); const held = Date.now() - down > 250; down = 0;
    if (moved) { if (dy > 110) { reset(); return closeStory(); } sv.style.transition = 'transform .2s'; sv.style.transform = ''; setTimeout(reset, 220); return pauseStory(false); }
    pauseStory(false); if (held) return;
    const r = b.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, rtl = document.documentElement.dir === 'rtl', back = rtl ? x > .7 : x < .3; goStory(back ? -1 : 1); });
  b.addEventListener('pointercancel', () => { clearTimeout(timer); down = 0; reset(); pauseStory(false); });
})();
// reply to a friend's story: it arrives in your chat with them
$('#svRtext').addEventListener('focus', () => pauseStory(true));
$('#svRtext').addEventListener('blur', () => { if (!$('#story').hidden) setTimeout(() => { if (document.activeElement !== $('#svRtext')) pauseStory(false); }, 150); });
$('#svReply').onsubmit = async e => { e.preventDefault(); const inp = $('#svRtext'), s = inp.value.trim(), uid = SV.uid; if (!s || !uid || uid === me.id) return;
  inp.value = ''; inp.blur(); const conv = await dmWith(uid); if (!conv) return;
  send({ text: `📸 ${t('storyReplyTag')}\n${s}`, conv }); toast(t('storySent')); };
document.addEventListener('visibilitychange', () => { if (!$('#story').hidden) pauseStory(document.hidden); });
