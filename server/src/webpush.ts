// Web Push with VAPID (RFC 8292) and aes128gcm payload encryption (RFC 8291),
// implemented on WebCrypto so it runs natively in Workers.
import type { Env } from './env';

export type PushSubscriptionRow = { id: number; endpoint: string; p256dh: string; auth: string };

const enc = new TextEncoder();

const b64urlToBytes = (s: string) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

const bytesToB64url = (bytes: Uint8Array) => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};

const hmac = async (key: Uint8Array, data: Uint8Array) => {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
};

// HKDF with a single output block (all outputs here are <= 32 bytes).
const hkdf = async (salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) => {
  const prk = await hmac(salt, ikm);
  return (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, length);
};

const vapidSigningKey = (env: Env) => {
  const pub = b64urlToBytes(env.VAPID_PUBLIC_KEY);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID_PUBLIC_KEY must be an uncompressed P-256 key');
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC', crv: 'P-256',
      x: bytesToB64url(pub.slice(1, 33)),
      y: bytesToB64url(pub.slice(33, 65)),
      d: env.VAPID_PRIVATE_KEY,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
};

const vapidJwt = async (env: Env, audience: string) => {
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = bytesToB64url(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: env.VAPID_SUBJECT || 'mailto:admin@example.com',
  })));
  const unsigned = `${header}.${claims}`;
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, await vapidSigningKey(env), enc.encode(unsigned),
  );
  return `${unsigned}.${bytesToB64url(new Uint8Array(sig))}`;
};

const encryptPayload = async (sub: PushSubscriptionRow, payload: Uint8Array) => {
  const uaPublic = b64urlToBytes(sub.p256dh);
  const authSecret = b64urlToBytes(sub.auth);

  const local = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', local.publicKey)) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as SubtleCryptoDeriveKeyAlgorithm, local.privateKey, 256),
  );

  const ikm = await hkdf(authSecret, ecdhSecret, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plaintext = concat(payload, new Uint8Array([2])); // 0x02 = last-record delimiter
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext));

  const recordSize = new Uint8Array([0, 0, 0x10, 0]); // 4096, big-endian
  return concat(salt, recordSize, new Uint8Array([asPublic.length]), asPublic, ciphertext);
};

/** Sends one notification. Returns the push service's HTTP status. */
export const sendPush = async (env: Env, sub: PushSubscriptionRow, data: unknown) => {
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(data)));
  const jwt = await vapidJwt(env, new URL(sub.endpoint).origin);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'normal',
    },
    body,
  });
  return res.status;
};

/** Notifies every subscribed browser; prunes subscriptions the push service reports as gone. */
export const broadcastPush = async (env: Env, data: unknown) => {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return { sent: 0, failed: 0, removed: 0 };

  const { results } = await env.DB.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions')
    .all<PushSubscriptionRow>();
  let sent = 0, failed = 0, removed = 0;

  await Promise.all(results.map(async (sub) => {
    try {
      const status = await sendPush(env, sub, data);
      if (status >= 200 && status < 300) sent++;
      else if (status === 404 || status === 410) {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(sub.id).run();
        removed++;
      } else failed++;
    } catch (err) {
      console.error('push failed', sub.endpoint, err);
      failed++;
    }
  }));
  return { sent, failed, removed };
};
