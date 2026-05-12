import { index, pgTable, text, timestamp, boolean, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const RESERVED_USERNAMES = [
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
] as const;

export const USERNAME_PATTERN = "^[a-z0-9_.]{3,30}$";

export const betterAuthUserTableName = "user";

export const betterAuthUsers = pgTable(
  betterAuthUserTableName,
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("emailVerified").notNull(),
    image: text("image"),
    username: text("username").notNull(),
    displayUsername: text("displayUsername"),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_username_unique_idx").on(table.username),
    check("user_username_format_check", sql`${table.username} ~ ${USERNAME_PATTERN}`),
    check("user_username_lowercase_check", sql`${table.username} = lower(${table.username})`),
    check(
      "user_username_reserved_check",
      sql`${table.username} not in ('admin', 'root', 'support', 'help', 'api', 'auth', 'login', 'sign-in', 'register', 'fotocorp', 'system', 'null', 'undefined')`,
    ),
  ],
);

export const betterAuthSessions = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => betterAuthUsers.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const betterAuthAccounts = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => betterAuthUsers.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const betterAuthVerifications = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);
