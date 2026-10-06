import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function encryptionKey(): Buffer {
  const configured = process.env.DATA_ENCRYPTION_KEY;
  if (!configured) throw new Error("DATA_ENCRYPTION_KEY is not configured");

  const key =
    /^[0-9a-fA-F]{64}$/.test(configured)
      ? Buffer.from(configured, "hex")
      : Buffer.from(configured, "base64");

  if (key.byteLength !== 32) {
    throw new Error("DATA_ENCRYPTION_KEY must encode exactly 32 bytes");
  }
  return key;
}

export function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decrypt(value: string): string {
  const [iv, authTag, ciphertext] = value.split(".");
  if (!iv || !authTag || !ciphertext) throw new Error("Encrypted value has an invalid format");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
