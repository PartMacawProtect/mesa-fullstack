export async function generateKeyPair(): Promise<{ publicKeyJwk: JsonWebKey; privateKeyJwk: JsonWebKey }> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);
  return { publicKeyJwk, privateKeyJwk };
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256"
    },
    true,
    ["encrypt"]
  );
}

export async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256"
    },
    true,
    ["decrypt"]
  );
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  encryptedKeyForRecipient: string;
  encryptedKeyForSender: string;
}

export async function encryptMessage(
  text: string,
  recipientPublicKeyJwk: JsonWebKey,
  senderPublicKeyJwk: JsonWebKey
): Promise<EncryptedPayload> {
  // Generate AES-GCM 256 key
  const aesKey = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256
    },
    true,
    ["encrypt", "decrypt"]
  );

  // Encrypt with AES
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encryptedTextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    aesKey,
    encoder.encode(text)
  );

  // Export raw AES key
  const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

  // Import RSA keys
  const rsaRecipientPub = await importPublicKey(recipientPublicKeyJwk);
  const rsaSenderPub = await importPublicKey(senderPublicKeyJwk);

  // Encrypt raw AES key with both RSA keys
  const encKeyForRecipientBuffer = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    rsaRecipientPub,
    rawAesKey
  );

  const encKeyForSenderBuffer = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    rsaSenderPub,
    rawAesKey
  );

  return {
    ciphertext: arrayBufferToBase64(encryptedTextBuffer),
    iv: arrayBufferToBase64(iv),
    encryptedKeyForRecipient: arrayBufferToBase64(encKeyForRecipientBuffer),
    encryptedKeyForSender: arrayBufferToBase64(encKeyForSenderBuffer)
  };
}

export async function decryptMessage(
  ciphertextBase64: string,
  ivBase64: string,
  encryptedKeyBase64: string,
  privateKeyJwk: JsonWebKey
): Promise<string> {
  const rsaPrivate = await importPrivateKey(privateKeyJwk);

  const encryptedKeyBuffer = base64ToArrayBuffer(encryptedKeyBase64);
  const decRawKeyBuffer = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    rsaPrivate,
    encryptedKeyBuffer
  );

  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    decRawKeyBuffer,
    "AES-GCM",
    true,
    ["decrypt"]
  );

  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
  const ciphertextBuffer = base64ToArrayBuffer(ciphertextBase64);
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    aesKey,
    ciphertextBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}
