export const RESERVED_USERNAMES = new Set([
  "admin",
  "root",
  "support",
  "help",
  "api",
  "auth",
  "login",
  "sign-in",
  "register",
  "fotocorp",
  "system",
  "null",
  "undefined",
]);

const USERNAME_REGEX = /^[a-z0-9_.]{3,30}$/;

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string) {
  const normalized = normalizeUsername(username);
  return USERNAME_REGEX.test(normalized) && !RESERVED_USERNAMES.has(normalized);
}
