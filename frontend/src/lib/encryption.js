const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

export async function generateKey() {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function exportKey(key) {
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function importKey(base64Key) {
  const keyData = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw', keyData,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptMessage(text, base64Key) {
  try {
    const key = await importKey(base64Key);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = new TextEncoder().encode(text);

    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      encoded
    );

    const combined = new Uint8Array(iv.length + encrypted.length);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (e) {
    console.error('[E2EE] Encrypt error:', e);
    return text;
  }
}

export async function decryptMessage(encryptedBase64, base64Key) {
  try {
    const key = await importKey(base64Key);
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    const iv = combined.slice(0, IV_LENGTH);
    const encrypted = combined.slice(IV_LENGTH);

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error('[E2EE] Decrypt error:', e);
    return '[Encrypted message]';
  }
}

export async function generateKeyPair() {
  try {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      ['deriveKey', 'deriveBits']
    );
    return keyPair;
  } catch (e) {
    console.error('[E2EE] Key pair generation error:', e);
    return null;
  }
}

export async function deriveSharedKey(privateKey, publicKeyRaw) {
  try {
    const publicKey = await crypto.subtle.importKey(
      'raw', publicKeyRaw,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );

    const sharedKey = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: publicKey },
      privateKey,
      { name: ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );

    return sharedKey;
  } catch (e) {
    console.error('[E2EE] Key derivation error:', e);
    return null;
  }
}

export function isE2EESupported() {
  return typeof crypto !== 'undefined' && crypto.subtle !== undefined;
}

export const E2EE_STATUS = {
  ENABLED: '🔒',
  DISABLED: '🔓',
  LOCKED: '🔐',
  ERROR: '⚠️'
};
