import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PINNED_EXTENSION_ID } from "./pinnedExtensionId";

const here = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(here, "..");
const repoRoot = path.resolve(extensionRoot, "../..");

const PRIVATE_KEY_RE = /-----BEGIN (?:RSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/;

function extensionIdFromPublicKeyBase64(key: string): string {
  const der = Buffer.from(key, "base64");
  if (der.length === 0 || der.length > 512) {
    throw new Error("manifest key is not an RSA public key");
  }
  const digest = createHash("sha256").update(der).digest();
  const alphabet = "abcdefghijklmnop";
  let id = "";
  for (let i = 0; i < 16; i++) {
    const byte = digest[i];
    if (byte === undefined) {
      throw new Error("SHA-256 digest was shorter than 16 bytes");
    }
    const hi = alphabet[byte >> 4];
    const lo = alphabet[byte & 0x0f];
    if (hi === undefined || lo === undefined) {
      throw new Error("extension id alphabet lookup failed");
    }
    id += hi + lo;
  }
  return id;
}

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...filesUnder(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

describe("pinned extension id", () => {
  it("is the Chrome id of the manifest public key and is recorded in the design note", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(extensionRoot, "public/manifest.json"), "utf8"),
    ) as { key?: string };
    expect(typeof manifest.key).toBe("string");
    const key = manifest.key ?? "";
    expect(key).not.toMatch(PRIVATE_KEY_RE);
    expect(extensionIdFromPublicKeyBase64(key)).toBe(PINNED_EXTENSION_ID);
    expect(PINNED_EXTENSION_ID).toMatch(/^[a-p]{32}$/);

    const design = readFileSync(path.join(repoRoot, "docs/extension-design.md"), "utf8");
    expect(design).toContain(PINNED_EXTENSION_ID);
    expect(design).not.toMatch(PRIVATE_KEY_RE);
  });

  it("does not keep a private key file in the extension package", () => {
    const offenders = filesUnder(extensionRoot).filter((file) => {
      if (/\.(pem|der|key)$/i.test(file)) return true;
      return PRIVATE_KEY_RE.test(readFileSync(file, "utf8"));
    });
    expect(offenders).toEqual([]);
  });
});
