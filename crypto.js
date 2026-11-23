// همسة · end-to-end encryption (works in the page and in the service worker).
// Every phone/browser has its own ECDH P-256 key pair. The private key is created NON-extractable and kept in
// IndexedDB: no code (not even ours) can read it out, it can only be used on this device.
// A message is encrypted once with a random AES-256-GCM key K; K is then wrapped for every device of every member,
// with a key derived from ECDH(sender device, receiver device) + HKDF. The server only ever sees ciphertext.
(function (root) {
  const te = new TextEncoder(), td = new TextDecoder(), S = crypto.subtle;
  const b64 = buf => { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
  const ub64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));

  // ---- tiny key store (IndexedDB) ----
  function idb() { return new Promise((ok, no) => { const r = indexedDB.open('hamsa-keys', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }); }
  async function op(mode, f) { const d = await idb(); return new Promise((ok, no) => { const tx = d.transaction('k', mode), st = tx.objectStore('k'), r = f(st); tx.oncomplete = () => ok(r && r.result); tx.onerror = () => no(tx.error); }); }
  const kget = k => op('readonly', s => s.get(k)), kput = (k, v) => op('readwrite', s => s.put(v, k)), kdel = k => op('readwrite', s => s.delete(k));

  // this device's identity for a user: { id, user, priv (CryptoKey), pub (JWK) }
  async function device(user, slot = 'device') {
    let d = await kget(slot);
    if (d && d.user !== user) d = null;   // another account used this browser before
    if (!d) {
      const kp = await S.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
      d = { id: 'd' + b64(rnd(12)).replace(/[+/=]/g, ''), user, priv: kp.privateKey, pub: await S.exportKey('jwk', kp.publicKey), at: Date.now() };
      await kput(slot, d); d.fresh = true;
    }
    return d;
  }
  const forget = (slot = 'device') => kdel(slot);
  const current = (slot = 'device') => kget(slot);   // the stored device, without creating one (used by the service worker)
  const pref = (k, v) => v === undefined ? kget('pref:' + k) : kput('pref:' + k, v);

  async function wrapKey(priv, peerJwk, salt) {
    const pub = await S.importKey('jwk', { kty: peerJwk.kty, crv: peerJwk.crv, x: peerJwk.x, y: peerJwk.y }, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const bits = await S.deriveBits({ name: 'ECDH', public: pub }, priv, 256);
    const hk = await S.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
    return S.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: te.encode('hamsa-wrap-v1') }, hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const aes = (raw, use) => S.importKey('raw', raw, 'AES-GCM', false, [use]);

  // encrypt a payload object for a list of devices [{device_id, pub}] → { ct, iv, keys }
  async function seal(payload, me, devices, K = rnd(32)) {
    const iv = rnd(12), ct = await S.encrypt({ name: 'AES-GCM', iv }, await aes(K, 'encrypt'), te.encode(JSON.stringify(payload)));
    const keys = {};
    for (const d of devices) { try { const wi = rnd(12), wk = await wrapKey(me.priv, d.pub, iv); keys[d.device_id] = { w: b64(await S.encrypt({ name: 'AES-GCM', iv: wi }, wk, K)), i: b64(wi) }; } catch (x) { /* a broken public key: skip that device */ } }
    return { ct: b64(ct), iv: b64(iv), keys };
  }
  // decrypt a row {ct, iv, keys} sent by a device whose public key is senderPub → { payload, K }
  async function open(row, me, senderPub) {
    const e = row.keys && row.keys[me.id]; if (!e) throw new Error('not-for-this-device');
    const iv = ub64(row.iv), wk = await wrapKey(me.priv, senderPub, iv);
    const K = new Uint8Array(await S.decrypt({ name: 'AES-GCM', iv: ub64(e.i) }, wk, ub64(e.w)));
    const pt = await S.decrypt({ name: 'AES-GCM', iv }, await aes(K, 'decrypt'), ub64(row.ct));
    return { payload: JSON.parse(td.decode(pt)), K };
  }
  // pictures / voice: the bytes are encrypted with the message key K and their own iv
  async function sealBytes(K, bytes) { const iv = rnd(12); return { iv: b64(iv), data: new Uint8Array(await S.encrypt({ name: 'AES-GCM', iv }, await aes(K, 'encrypt'), bytes)) }; }
  async function openBytes(K, ivB64, bytes) { return new Uint8Array(await S.decrypt({ name: 'AES-GCM', iv: ub64(ivB64) }, await aes(K, 'decrypt'), bytes)); }
  const newKey = () => rnd(32);
  // a short "safety code" two people can compare to be sure nobody swapped keys
  async function safety(jwks) {
    const s = jwks.map(j => j.x + '.' + j.y).sort().join('|'), h = new Uint8Array(await S.digest('SHA-256', te.encode(s)));
    return Array.from(h.slice(0, 15)).map(n => String(n % 100).padStart(2, '0')).join('').match(/.{5}/g).join(' ');
  }
  root.HC = { device, forget, current, pref, seal, open, sealBytes, openBytes, newKey, safety, b64, ub64 };
})(self);
