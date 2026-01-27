import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import type { Pool } from "pg";

export interface EncryptedSecret {
  ciphertext: string;
  nonce: string;
  version: number;
}

export interface TenantSecrets {
  ghlApiKey?: string;
  pdpApiKey?: string;
}

function resolveMasterKey(): Buffer | null {
  const raw = process.env.TENANT_SECRET_KEY;
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  try {
    const buf = Buffer.from(trimmed, "base64");
    if (buf.length === 32) {
      return buf;
    }
  } catch {
    return null;
  }

  return null;
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const masterKey = resolveMasterKey();
  if (!masterKey) {
    return {
      ciphertext: plaintext,
      nonce: "",
      version: 0
    };
  }

  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([encrypted, tag]).toString("base64"),
    nonce: nonce.toString("base64"),
    version: 1
  };
}

export function decryptSecret(ciphertext: string, nonce: string | null, version: number): string {
  if (!ciphertext) {
    return "";
  }
  if (version === 0) {
    return ciphertext;
  }

  const masterKey = resolveMasterKey();
  if (!masterKey) {
    throw new Error("TENANT_SECRET_KEY is not set; cannot decrypt secrets");
  }

  if (!nonce) {
    throw new Error("Missing nonce for encrypted secret");
  }

  const data = Buffer.from(ciphertext, "base64");
  const tag = data.subarray(data.length - 16);
  const encrypted = data.subarray(0, data.length - 16);

  const decipher = createDecipheriv("aes-256-gcm", masterKey, Buffer.from(nonce, "base64"));
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export async function getTenantSecrets(pool: Pool, tenantId: string): Promise<TenantSecrets> {
  const result = await pool.query(
    "SELECT ghl_api_key_enc, pdp_api_key_enc, enc_version, enc_nonce FROM tenant_secrets WHERE tenant_id = $1",
    [tenantId]
  );
  if (result.rowCount === 0) {
    return {};
  }
  const row = result.rows[0] as {
    ghl_api_key_enc: string | null;
    pdp_api_key_enc: string | null;
    enc_version: number;
    enc_nonce: string | null;
  };

  const version = row.enc_version ?? 0;
  const nonce = row.enc_nonce;

  return {
    ghlApiKey: row.ghl_api_key_enc
      ? decryptSecret(row.ghl_api_key_enc, nonce, version)
      : undefined,
    pdpApiKey: row.pdp_api_key_enc
      ? decryptSecret(row.pdp_api_key_enc, nonce, version)
      : undefined
  };
}
