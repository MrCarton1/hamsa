// همسة · voice and video calls, phone to phone (WebRTC).
// The connection details (SDP) are encrypted for the other person's phone with the same keys as messages, and the
// call itself is encrypted by WebRTC (DTLS-SRTP). The server only learns that a call happened, never what was said.
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
let ICE_EXTRA = [], iceAt = 0;   // relay servers (TURN) from our server: calls then connect on any network
window.loadIce = async function loadIce() {
  if (!accessToken || Date.now() - iceAt < 6 * 3600e3) return;
  try { const r = await fetch(HAMSA.url + '/functions/v1/push?ice=1', { headers: { apikey: HAMSA.key, Authorization: 'Bearer ' + accessToken } });
    const j = await r.json(); if (Array.isArray(j.iceServers)) { ICE_EXTRA = j.iceServers; iceAt = Date.now(); } } catch {}
};
setInterval(() => { if (!document.hidden) loadIce(); }, 3600e3);
let call = null;   // { id, conv, peer, video, role: 'out'|'in', state, pc, local, row, t0 }
const callOK = () => !!(window.RTCPeerConnection && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
const FINISHED = ['declined', 'busy', 'missed', 'ended'];

function getMedia(video, facing = 'user') {
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: video ? { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } } : false });
}
function iceDone(pc) {   // send as soon as this phone has a way to be reached from outside (not the full 2.5 s every time)
  return new Promise(res => {
    const want = ICE_EXTRA.length > 0; let t = null, over = false;
    const done = () => { if (over) return; over = true; clearTimeout(t); clearTimeout(max); clearInterval(poll); res(); };
    const check = () => { const k = pc._kinds || {}; if (pc.iceGatheringState === 'complete') return done();
      if (k.relay || (!want && k.srflx)) { if (!t) t = setTimeout(done, 250); } else if (k.srflx && !t) t = setTimeout(done, 1200); };
    const poll = setInterval(check, 50), max = setTimeout(done, 2500); check(); });
}
function newPC() {
  const c = call, pc = new RTCPeerConnection({ iceServers: [...ICE, ...ICE_EXTRA] }); c.pc = pc; pc._kinds = {};
  pc.addEventListener('icecandidate', e => { if (!e.candidate) return; const ty = e.candidate.type || (/ typ (\w+)/.exec(e.candidate.candidate) || [])[1]; if (ty) pc._kinds[ty] = true; });
  pc.ontrack = e => { const v = $('#callRemote'), st = e.streams[0] || new MediaStream([e.track]); if (v.srcObject !== st) v.srcObject = st; v.play().catch(() => {}); paintCall(); };
  const watch = () => { if (call !== c) return; const st = pc.connectionState || pc.iceConnectionState;
    if (st === 'connected' || st === 'completed') { if (!c.t0) { c.t0 = Date.now(); tone(null); c.tick = setInterval(paintCall, 1000); } c.state = 'live'; paintCall(); }
    else if (st === 'failed') endCall('ended', t('callFailed'));
    else if (st === 'disconnected') { c.state = 'reconnecting'; paintCall(); setTimeout(() => { if (call === c && (pc.connectionState || pc.iceConnectionState) === 'disconnected') endCall('ended', t('callFailed')); }, 9000); } };
  pc.onconnectionstatechange = watch; pc.oniceconnectionstatechange = watch;
  return pc;
}

// ---- calling someone ----
async function startCall(convId, video) {
  if (call) return toast(t('inAnotherCall'));
  if (!callOK()) return toast(t('callUnsupported'));
  const conv = convs.find(x => x.id === convId); if (!conv || conv.is_group) return toast(t('callsDmOnly'));
  const peer = otherOf(conv), c = call = { conv: conv.id, peer, video, role: 'out', state: 'calling' };
  showCall(); tone('back');
  try {
    const devs = (await devicesFor(conv.id, true)).filter(d => d.user_id === peer);
    if (!devs.length) throw Object.assign(new Error('nokey'), { msg: t('needsUpdate', { n: nameOf(peer) }) });
    c.local = await getMedia(video); if (call !== c) return c.local.getTracks().forEach(x => x.stop()); paintLocal();
    const pc = newPC(); c.local.getTracks().forEach(tr => pc.addTrack(tr, c.local));
    await pc.setLocalDescription(await pc.createOffer()); await iceDone(pc); if (call !== c) return;
    const box = await HC.seal({ sdp: pc.localDescription.sdp }, myDev, devs);
    const { data, error } = await sb.from('calls').insert({ conversation_id: conv.id, callee: peer, video, offer: { ...box, sender_device: myDev.id } }).select().single();
    if (error) throw error; if (call !== c) return sb.from('calls').update({ state: 'missed' }).eq('id', data.id).then(() => {});
    c.id = data.id; c.state = 'ringing'; paintCall();
    sb.functions.invoke('push', { body: { call: data.id } }).catch(() => {});
    c.noAnswer = setTimeout(() => { if (call === c && !c.t0 && !c.answered) { c.result = 'missed'; endCall('missed', t('noAnswer')); } }, 45000);
  } catch (x) { console.warn('[hamsa] call', x); if (call === c) endCall(c.id ? 'ended' : null, x.msg || (x.name === 'NotAllowedError' || x.name === 'NotFoundError' ? t('allowCam') : t('callFailed'))); }
}

// ---- someone is calling me ----
async function checkRinging() {
  if (!me || call) return;
  const since = new Date(srvNow() - 50000).toISOString();
  const { data } = await sb.from('calls').select('*').eq('callee', me.id).eq('state', 'ringing').gt('created_at', since).order('created_at', { ascending: false }).limit(1);
  if (data && data[0]) onCallRow(data[0], 'INSERT');
}
async function onCallRow(r, ev) {
  if (!me) return;
  if (ev === 'INSERT' && r.callee === me.id && r.state === 'ringing') {
    if (srvNow() - new Date(r.created_at).getTime() > 50000) return;
    if (call) { if (call.id !== r.id) sb.from('calls').update({ state: 'busy' }).eq('id', r.id).then(() => {}); return; }
    await needProfiles([r.caller]);
    call = { id: r.id, conv: r.conversation_id, peer: r.caller, video: r.video, role: 'in', state: 'incoming', row: r };
    showCall(); tone('ring');
    call.pre = (async () => { const spub = await senderPub({ sender_device: r.offer.sender_device, sender_id: r.caller }); const { payload } = await HC.open(r.offer, myDev, spub); return { spub, payload }; })().catch(() => null);
    call.noAnswer = setTimeout(() => { if (call && call.id === r.id && call.state === 'incoming') endCall(null); }, 50000);
    return;
  }
  const c = call; if (!c || c.id !== r.id || ev !== 'UPDATE') return;
  if (c.role === 'out' && r.state === 'accepted' && r.answer && !c.answered) {
    c.answered = true; clearTimeout(c.noAnswer); c.state = 'connecting'; tone(null); paintCall();
    try { const { payload } = await HC.open(r.answer, myDev, await senderPub({ sender_device: r.answer.sender_device, sender_id: r.callee }));
      await c.pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp }); }
    catch (x) { console.warn('[hamsa] answer', x); endCall('ended', t('callFailed')); }
  } else if (c.role === 'in' && r.state === 'accepted' && c.state === 'incoming') endCall(null);   // answered on my other phone
  else if (FINISHED.includes(r.state)) {
    if (c.role === 'out') { c.result = r.state === 'declined' ? 'declined' : r.state === 'busy' ? 'busy' : null; endCall(null, t(r.state === 'declined' ? 'callDeclined' : r.state === 'busy' ? 'callBusy' : 'callEnded')); }
    else endCall(null, c.t0 ? t('callEnded') : '');
  }
}
async function acceptCall() {
  const c = call; if (!c || c.state !== 'incoming') return; c.state = 'connecting'; tone(null); clearTimeout(c.noAnswer); paintCall();
  try {
    if (!callOK()) throw Object.assign(new Error('x'), { msg: t('callUnsupported') });
    const [media, pre] = await Promise.all([getMedia(c.video), c.pre || null]);
    c.local = media; if (call !== c) return c.local.getTracks().forEach(x => x.stop()); paintLocal();
    const spub = pre ? pre.spub : await senderPub({ sender_device: c.row.offer.sender_device, sender_id: c.peer });
    const { payload } = pre ? pre : await HC.open(c.row.offer, myDev, spub);
    const pc = newPC(); c.local.getTracks().forEach(tr => pc.addTrack(tr, c.local));
    await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp }); await pc.setLocalDescription(await pc.createAnswer()); await iceDone(pc); if (call !== c) return;
    const box = await HC.seal({ sdp: pc.localDescription.sdp }, myDev, [{ device_id: c.row.offer.sender_device, pub: spub }]);
    const { error } = await sb.from('calls').update({ state: 'accepted', answer: { ...box, sender_device: myDev.id } }).eq('id', c.id).eq('state', 'ringing'); if (error) throw error;
  } catch (x) { console.warn('[hamsa] accept', x); if (call === c) endCall('ended', x.msg || (x.name === 'NotAllowedError' || x.name === 'NotFoundError' ? t('allowCam') : t('callFailed'))); }
}
function declineCall() { const c = call; if (!c) return; endCall('declined'); }

// ---- ending: the caller writes one line in the chat, so both see the call there ----
function endCall(state, msg) {
  const c = call; if (!c) return; call = null; tone(null); clearTimeout(c.noAnswer); clearInterval(c.tick);
  try { c.pc && c.pc.close(); } catch {} (c.local ? c.local.getTracks() : []).forEach(x => x.stop());
  if (c.id && state) sb.from('calls').update({ state }).eq('id', c.id).then(() => {});
  if (c.role === 'out' && c.id) { const d = c.t0 ? Math.round((Date.now() - c.t0) / 1000) : 0;
    send({ kind: 'call', conv: c.conv, extra: { v: !!c.video, d, r: c.t0 ? 'done' : c.result || 'missed' } }); }
  hideCall(msg);
}
addEventListener('pagehide', () => { if (call && call.id) { const st = call.t0 || call.role === 'in' ? 'ended' : 'missed';
  try { fetch(HAMSA.url + '/rest/v1/calls?id=eq.' + call.id, { method: 'PATCH', keepalive: true, headers: { apikey: HAMSA.key, Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ state: st }) }); } catch {} } });

// ---- the call screen ----
function showCall() {
  const c = call, s = $('#call'); s.hidden = false; s.className = 'call' + (c.video ? ' is-video' : ''); avatarInto($('#callAv'), c.peer);
  $('#callAv').classList.add('xl'); $('#callName').textContent = nameOf(c.peer); $('#callRemote').srcObject = null; $('#callLocal').srcObject = null; $('#callLocal').hidden = true;
  const bgUrl = (profiles.get(c.peer) || {}).avatar_url; s.style.setProperty('--bg', bgUrl ? `url('${bgUrl}')` : 'none');
  paintCall(); requestAnimationFrame(() => s.classList.add('open'));
}
function paintLocal() { const c = call; if (!c || !c.video || !c.local) return; const v = $('#callLocal'); v.srcObject = c.local; v.hidden = false; v.play().catch(() => {}); }
function paintCall() {
  const c = call; if (!c) return; const s = $('#call');
  const st = { calling: t('calling'), ringing: t('ringingS'), connecting: t('connecting'), reconnecting: t('reconnecting'), incoming: t(c.video ? 'incomingVideo' : 'incomingVoice') }[c.state];
  $('#callState').textContent = c.state === 'live' ? fmtDur((Date.now() - c.t0) / 1000) : st || '';
  $('#callIn').hidden = c.state !== 'incoming'; $('#callCtl').hidden = c.state === 'incoming';
  $('#callCam').hidden = $('#callFlip').hidden = !c.video;
  const rv = $('#callRemote'), hasVideo = c.video && rv.srcObject && rv.srcObject.getVideoTracks().some(x => x.readyState === 'live');
  s.classList.toggle('has-video', !!(hasVideo && c.state === 'live')); s.classList.toggle('live', c.state === 'live');
  $('#callMute').classList.toggle('on', !!c.muted); $('#callCam').classList.toggle('on', !!c.camOff);
}
function hideCall(msg) { const s = $('#call'); s.classList.remove('open'); setTimeout(() => { if (!call) { s.hidden = true; $('#callRemote').srcObject = null; $('#callLocal').srcObject = null; } }, 260); if (msg) toast(msg); }
$('#callYes').onclick = acceptCall;
$('#callNo').onclick = declineCall;
$('#callEnd').onclick = () => { const c = call; if (!c) return; endCall(c.role === 'out' && !c.t0 ? 'missed' : 'ended'); };
$('#callMute').onclick = () => { const c = call; if (!c || !c.local) return; c.muted = !c.muted; c.local.getAudioTracks().forEach(x => x.enabled = !c.muted); paintCall(); };
$('#callCam').onclick = () => { const c = call; if (!c || !c.local) return; c.camOff = !c.camOff; c.local.getVideoTracks().forEach(x => x.enabled = !c.camOff); paintCall(); };
$('#callFlip').onclick = async () => {
  const c = call; if (!c || !c.local || !c.pc) return; c.facing = c.facing === 'environment' ? 'user' : 'environment';
  try { const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: c.facing, width: { ideal: 640 }, height: { ideal: 480 } } }), nt = s.getVideoTracks()[0];
    const snd = c.pc.getSenders().find(x => x.track && x.track.kind === 'video'); if (snd) await snd.replaceTrack(nt);
    c.local.getVideoTracks().forEach(x => { x.stop(); c.local.removeTrack(x); }); c.local.addTrack(nt); nt.enabled = !c.camOff; paintLocal();
  } catch { toast(t('allowCam')); }
};
$('#callRemote').addEventListener('resize', paintCall); $('#callRemote').addEventListener('playing', paintCall);

// ---- sounds: ring for incoming, a soft tone while waiting for them to answer ----
let toneCtx = null, toneT = null;
function tone(kind) {
  clearInterval(toneT); toneT = null; if (toneCtx) { toneCtx.close().catch(() => {}); toneCtx = null; } if (navigator.vibrate) navigator.vibrate(0); if (!kind) return;
  try { toneCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  const beep = (f1, f2, dur, vol) => { const x = toneCtx; if (!x) return; const g = x.createGain(), t0 = x.currentTime; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + .03); g.gain.setValueAtTime(vol, t0 + dur - .05); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); g.connect(x.destination);
    [f1, f2].forEach(f => { const o = x.createOscillator(); o.frequency.value = f; o.connect(g); o.start(t0); o.stop(t0 + dur); }); };
  const play = () => { if (toneCtx && toneCtx.state === 'suspended') toneCtx.resume().catch(() => {});
    if (kind === 'ring') { [[1046.5, 0], [1318.5, 180], [1568, 360], [1318.5, 620], [1568, 800], [2093, 980]].forEach(([f, at]) => setTimeout(() => beep(f, f * 1.5, .2, .18), at)); if (navigator.vibrate) navigator.vibrate([400, 200, 400]); }
    else beep(440, 480, 1.4, .06); };
  play(); toneT = setInterval(play, kind === 'ring' ? 2400 : 4000);
}
