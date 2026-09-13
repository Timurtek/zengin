/**
 * The accounts the auth flows check against, read from the rows `zengin mock` generated in src/mock from
 * mock.json. Signing up with one of their emails says the account exists; signing in with one greets the
 * person by name. The password check is a demo: any password of eight characters or more is right.
 * Regenerate the rows with `npm run mock`.
 */

import { accounts, type Account } from "./mock/accounts";

export type { Account };
export const ACCOUNTS: Account[] = accounts;

/** One account to show in the copy, so the demo can be tried without reading the file. */
export const SAMPLE = ACCOUNTS[0]!;

export function findAccount(email: string): Account | undefined {
  const e = email.trim().toLowerCase();
  return ACCOUNTS.find((a) => a.email.toLowerCase() === e);
}

export function emailError(email: string): string | undefined {
  if (!email.trim()) return "Enter your email.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "That does not look like an email.";
  return undefined;
}

export function passwordError(password: string): string | undefined {
  if (!password) return "Enter a password.";
  if (password.length < 8) return "At least eight characters.";
  return undefined;
}

export function nameError(name: string): string | undefined {
  return name.trim().length < 2 ? "Enter your name." : undefined;
}

/** The six-digit code the reset flow accepts. A demo: the real one comes from the email. */
export const RESET_CODE = "482910";
