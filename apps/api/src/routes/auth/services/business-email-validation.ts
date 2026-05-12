import { and, eq, gt } from "drizzle-orm";
import type { DrizzleClient } from "../../../db";
import {
  authEmailAddressOverrides,
  authEmailDomainChecks,
  authEmailDomainOverrides,
} from "../../../db/schema";

export const EXACT_EMAIL_ALLOWLIST = new Set([
  "abdulraheemsayyed22@gmail.com",
]);

export type BusinessEmailDecision =
  | "ALLOW"
  | "ALLOW_BY_EMAIL_OVERRIDE"
  | "ALLOW_BY_DOMAIN_OVERRIDE"
  | "BLOCK_BY_EMAIL_OVERRIDE"
  | "BLOCK_BY_DOMAIN_OVERRIDE"
  | "BLOCK_INVALID_EMAIL"
  | "BLOCK_FREE_EMAIL"
  | "BLOCK_DISPOSABLE_EMAIL"
  | "BLOCK_NO_MX"
  | "VALIDATION_ERROR";

export interface BusinessEmailValidationResult {
  ok: boolean;
  decision: BusinessEmailDecision;
  message: string;
  normalizedEmail?: string;
  domain?: string;
}

export interface DomainCheckRecord {
  verdict: BusinessEmailDecision;
  isFree: boolean;
  isDisposable: boolean;
  hasMx: boolean | null;
  expiresAt: Date;
}

export interface EmailOverrideRecord { decision: "ALLOW" | "BLOCK" }
export interface DomainOverrideRecord { decision: "ALLOW" | "BLOCK" }
export interface BusinessEmailValidationRepository {
  getEmailOverride(email: string): Promise<EmailOverrideRecord | null>;
  getDomainOverride(domain: string): Promise<DomainOverrideRecord | null>;
  getDomainCheck(domain: string, now: Date): Promise<DomainCheckRecord | null>;
  upsertDomainCheck(domain: string, record: DomainCheckRecord, now: Date): Promise<void>;
}
export interface BusinessEmailValidationOptions { repository: BusinessEmailValidationRepository; fetchMx?: (domain: string) => Promise<boolean>; now?: Date }

const FREE_EMAIL_DOMAINS = new Set(["gmail.com","googlemail.com","yahoo.com","ymail.com","outlook.com","hotmail.com","live.com","msn.com","icloud.com","me.com","mac.com","aol.com","proton.me","protonmail.com","mail.com","gmx.com","gmx.net","zoho.com"]);
const DISPOSABLE_EMAIL_DOMAINS = new Set(["10minutemail.com","guerrillamail.com","mailinator.com","tempmail.com","temp-mail.org","yopmail.com"]);

export async function validateBusinessEmail(emailInput: string, options: BusinessEmailValidationOptions): Promise<BusinessEmailValidationResult> {
  const now = options.now ?? new Date();
  const email = normalizeEmail(emailInput);
  if (!isBasicValidEmail(email)) return decision("BLOCK_INVALID_EMAIL", email);
  const domain = getDomain(email);
  if (!domain) return decision("BLOCK_INVALID_EMAIL", email);
  if (EXACT_EMAIL_ALLOWLIST.has(email)) return decision("ALLOW_BY_EMAIL_OVERRIDE", email, domain);
  try {
    const emailOverride = await options.repository.getEmailOverride(email);
    if (emailOverride?.decision === "ALLOW") return decision("ALLOW_BY_EMAIL_OVERRIDE", email, domain);
    if (emailOverride?.decision === "BLOCK") return decision("BLOCK_BY_EMAIL_OVERRIDE", email, domain);
    const domainOverride = await options.repository.getDomainOverride(domain);
    if (domainOverride?.decision === "ALLOW") return decision("ALLOW_BY_DOMAIN_OVERRIDE", email, domain);
    if (domainOverride?.decision === "BLOCK") return decision("BLOCK_BY_DOMAIN_OVERRIDE", email, domain);
    if (isFreeEmailDomain(domain)) { const result = decision("BLOCK_FREE_EMAIL", email, domain); await cacheDomain(options.repository, domain, result, now, false); return result }
    if (isDisposableEmailDomain(domain)) { const result = decision("BLOCK_DISPOSABLE_EMAIL", email, domain); await cacheDomain(options.repository, domain, result, now, false); return result }
    const cached = await options.repository.getDomainCheck(domain, now);
    if (cached) return decision(cached.verdict, email, domain);
    const hasMx = await (options.fetchMx ?? hasMxRecord)(domain);
    const result = hasMx ? decision("ALLOW", email, domain) : decision("BLOCK_NO_MX", email, domain);
    await cacheDomain(options.repository, domain, result, now, hasMx);
    return result;
  } catch { return decision("VALIDATION_ERROR", email, domain) }
}

export function createBusinessEmailValidationRepository(db: DrizzleClient): BusinessEmailValidationRepository {
  return {
    async getEmailOverride(email) {
      const rows = await db.select({ decision: authEmailAddressOverrides.decision }).from(authEmailAddressOverrides).where(eq(authEmailAddressOverrides.email, email)).limit(1);
      return rows[0] ?? null;
    },
    async getDomainOverride(domain) {
      const rows = await db.select({ decision: authEmailDomainOverrides.decision }).from(authEmailDomainOverrides).where(eq(authEmailDomainOverrides.domain, domain)).limit(1);
      return rows[0] ?? null;
    },
    async getDomainCheck(domain, now) {
      const rows = await db.select({ verdict: authEmailDomainChecks.verdict, isFree: authEmailDomainChecks.isFree, isDisposable: authEmailDomainChecks.isDisposable, hasMx: authEmailDomainChecks.hasMx, expiresAt: authEmailDomainChecks.expiresAt }).from(authEmailDomainChecks).where(and(eq(authEmailDomainChecks.domain, domain), gt(authEmailDomainChecks.expiresAt, now))).limit(1);
      const row = rows[0];
      if (!row || !isDomainCheckDecision(row.verdict)) return null;
      return { verdict: row.verdict, isFree: row.isFree, isDisposable: row.isDisposable, hasMx: row.hasMx, expiresAt: row.expiresAt };
    },
    async upsertDomainCheck(domain, record, now) {
      await db.insert(authEmailDomainChecks).values({ domain, verdict: record.verdict, isFree: record.isFree, isDisposable: record.isDisposable, hasMx: record.hasMx, checkedAt: now, expiresAt: record.expiresAt }).onConflictDoUpdate({ target: authEmailDomainChecks.domain, set: { verdict: record.verdict, isFree: record.isFree, isDisposable: record.isDisposable, hasMx: record.hasMx, checkedAt: now, expiresAt: record.expiresAt } });
    },
  };
}

export function normalizeEmail(email: string) { return email.trim().toLowerCase() }
export function isFreeEmailDomain(domain: string) { return FREE_EMAIL_DOMAINS.has(domain) }
export function isDisposableEmailDomain(domain: string) { return DISPOSABLE_EMAIL_DOMAINS.has(domain) }
export async function hasMxRecord(domain: string) { const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`, { headers: { accept: "application/dns-json" } }); if (!response.ok) return false; const payload = (await response.json()) as DnsOverHttpsResponse; return Array.isArray(payload.Answer) && payload.Answer.some((answer) => answer.type === 15) }
function isBasicValidEmail(email: string) { if (email.length > 254) return false; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false; const domain = getDomain(email); if (!domain) return false; return /^[a-z0-9.-]+$/.test(domain) && !domain.startsWith(".") && !domain.endsWith(".") && !domain.includes("..") }
function getDomain(email: string) { const parts = email.split("@"); if (parts.length !== 2) return null; const domain = parts[1]?.trim().toLowerCase(); return domain || null }
async function cacheDomain(repository: BusinessEmailValidationRepository, domain: string, result: BusinessEmailValidationResult, now: Date, hasMx: boolean | null) { await repository.upsertDomainCheck(domain, { verdict: result.decision, isFree: result.decision === "BLOCK_FREE_EMAIL", isDisposable: result.decision === "BLOCK_DISPOSABLE_EMAIL", hasMx, expiresAt: getCacheExpiry(result.decision, now) }, now) }
function getCacheExpiry(decision: BusinessEmailDecision, now: Date) { const days = decision === "ALLOW" ? 7 : decision === "BLOCK_NO_MX" ? 1 : decision === "BLOCK_FREE_EMAIL" || decision === "BLOCK_DISPOSABLE_EMAIL" ? 30 : 1; return new Date(now.getTime() + days * 24 * 60 * 60 * 1000) }
function decision(decision: BusinessEmailDecision, normalizedEmail?: string, domain?: string): BusinessEmailValidationResult { return { ok: decision === "ALLOW" || decision === "ALLOW_BY_EMAIL_OVERRIDE" || decision === "ALLOW_BY_DOMAIN_OVERRIDE", decision, message: messageForDecision(decision), normalizedEmail, domain } }
function messageForDecision(decision: BusinessEmailDecision) { switch (decision) { case "ALLOW": return "Email is allowed."; case "ALLOW_BY_EMAIL_OVERRIDE": return "Email is allowed by access exception."; case "ALLOW_BY_DOMAIN_OVERRIDE": return "Email domain is allowed by access exception."; case "BLOCK_BY_EMAIL_OVERRIDE": return "This email address is not allowed."; case "BLOCK_BY_DOMAIN_OVERRIDE": return "This email domain is not allowed."; case "BLOCK_INVALID_EMAIL": return "Please enter a valid email address."; case "BLOCK_FREE_EMAIL": return "Please use your company email address. Personal email providers are not accepted."; case "BLOCK_DISPOSABLE_EMAIL": return "Temporary email addresses are not accepted."; case "BLOCK_NO_MX": return "This email domain does not appear to accept email."; case "VALIDATION_ERROR": return "Email validation is temporarily unavailable. Please try again."; } }
function isDomainCheckDecision(value: string): value is BusinessEmailDecision { return value === "ALLOW" || value === "BLOCK_FREE_EMAIL" || value === "BLOCK_DISPOSABLE_EMAIL" || value === "BLOCK_NO_MX" || value === "VALIDATION_ERROR" }
interface DnsOverHttpsResponse { Answer?: Array<{ type: number }> }
