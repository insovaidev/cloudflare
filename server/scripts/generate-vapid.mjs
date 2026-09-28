// Generates a VAPID key pair for Web Push. Run: npm run vapid
// Then: npx wrangler secret put VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
const { subtle } = globalThis.crypto;
const b64url = (buf) => Buffer.from(buf).toString('base64url');

const { publicKey, privateKey } = await subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'],
);
const raw = await subtle.exportKey('raw', publicKey);
const jwk = await subtle.exportKey('jwk', privateKey);

console.log(`VAPID_PUBLIC_KEY=${b64url(raw)}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
