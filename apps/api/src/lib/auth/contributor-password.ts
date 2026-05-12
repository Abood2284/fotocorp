import { scryptAsync } from "@noble/hashes/scrypt.js";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const MAXMEM = 128 * 1024 * 1024;

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const NUM = "23456789";
const SYM = "#%^&*-_=+";
const POOL = UPPER + LOWER + NUM + SYM;
const MIN_TEMP_PASSWORD_LEN = 14;
const MIN_NEW_PASSWORD_LEN = 12;

interface ScryptEnvelope {
  n: number;
  r: number;
  p: number;
  salt: Uint8Array;
  hash: Uint8Array;
}

export async function hashPhotographerPortalPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(plain, salt, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    dkLen: SCRYPT_KEYLEN,
    maxmem: MAXMEM,
  });

  return `$scrypt$n=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${bytesToBase64Url(salt)}$${bytesToBase64Url(derived)}`;
}

export async function verifyPhotographerPortalPassword(plain: string, stored: string): Promise<boolean> {
  const envelope = parseScryptEnvelope(stored);
  if (!envelope) return false;

  const derived = await scryptAsync(plain, envelope.salt, {
    N: envelope.n,
    r: envelope.r,
    p: envelope.p,
    dkLen: envelope.hash.length,
    maxmem: MAXMEM,
  });

  return timingSafeEqualBytes(derived, envelope.hash);
}

export function isPhotographerPortalPasswordHash(value: string): boolean {
  return parseScryptEnvelope(value) !== null;
}

export function generatePhotographerPortalTemporaryPassword(): string {
  const chars: string[] = [
    pick(UPPER),
    pick(LOWER),
    pick(NUM),
    pick(SYM),
  ];

  while (chars.length < MIN_TEMP_PASSWORD_LEN) chars.push(pick(POOL));

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const a = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = a;
  }

  return chars.join("");
}

export function validatePhotographerPortalPasswordStrength(password: string): string | null {
  if (password.length < MIN_NEW_PASSWORD_LEN) return "Password must be at least 12 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include a symbol.";
  return null;
}

function parseScryptEnvelope(value: string): ScryptEnvelope | null {
  const parts = value.split("$");
  if (parts.length !== 5 || parts[1] !== "scrypt") return null;

  const params = Object.fromEntries(
    parts[2]!
      .split(",")
      .map((part) => part.split("="))
      .filter((pair): pair is [string, string] => pair.length === 2 && !!pair[0] && !!pair[1]),
  );

  const n = Number(params.n);
  const r = Number(params.r);
  const p = Number(params.p);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
  if (n <= 1 || r <= 0 || p <= 0) return null;

  try {
    const salt = base64UrlToBytes(parts[3]!);
    const hash = base64UrlToBytes(parts[4]!);
    if (salt.length === 0 || hash.length === 0) return null;
    return { n, r, p, salt, hash };
  } catch {
    return null;
  }
}

function pick(source: string): string {
  return source[randomInt(source.length)]!;
}

function randomInt(maxExclusive: number): number {
  const bytes = randomBytes(4);
  const view = new DataView(bytes.buffer);
  return view.getUint32(0) % maxExclusive;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
