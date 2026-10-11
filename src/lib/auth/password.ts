import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Argon2id (the library default algorithm) with OWASP-recommended parameters.
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// A real hash used to equalize timing when the email does not exist.
let dummyHash: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("timing-equalizer-not-a-real-password");
  return dummyHash;
}
