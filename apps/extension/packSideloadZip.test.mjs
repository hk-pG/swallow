import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  extensionIdFromPublicKeyBase64,
  listZipEntries,
  normalizeZipPath,
  packSideloadDist,
  readPinnedExtensionId,
  SideloadPackError,
} from "./packSideloadZip.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const dirs = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "swallow-sideload-"));
  dirs.push(dir);
  return dir;
}

function pinnedId() {
  return readPinnedExtensionId(readFileSync(path.join(here, "src/pinnedExtensionId.ts"), "utf8"));
}

function publicManifest() {
  return JSON.parse(readFileSync(path.join(here, "public/manifest.json"), "utf8"));
}

function writeFixture(dir, manifest) {
  const dist = path.join(dir, "dist");
  mkdirSync(path.join(dist, "chunks"), { recursive: true });
  writeFileSync(path.join(dist, "manifest.json"), JSON.stringify(manifest));
  writeFileSync(path.join(dist, "popup.html"), readFileSync(path.join(here, "public/popup.html")));
  writeFileSync(path.join(dist, "popup.css"), "body{}\n");
  writeFileSync(path.join(dist, "icon.png"), readFileSync(path.join(here, "public/icon.png")));
  writeFileSync(path.join(dist, "popup.js"), "export {}\n");
  writeFileSync(
    path.join(dist, "background.js"),
    'import { title } from "./chunks/userMessage.js";\nexport { title };\n',
  );
  writeFileSync(path.join(dist, "chunks/userMessage.js"), "export const title = 'ok';\n");
  writeFileSync(path.join(dist, "background.js.map"), "map\n");
  return dist;
}

describe("sideload zip", () => {
  it("packs dist at the archive root and keeps the development id", () => {
    const root = tempDir();
    const manifest = publicManifest();
    const dist = writeFixture(root, manifest);
    const outFile = path.join(root, "out.zip");
    const packed = packSideloadDist({
      extensionRoot: root,
      distDir: dist,
      outFile,
      pinnedId: pinnedId(),
    });

    expect(packed.extensionId).toBe(pinnedId());
    expect(packed.extensionId).toBe("fpcegcbemljdnihmoaejmmbpijdffgfn");
    expect(packed.names).toContain("chunks/userMessage.js");
    expect(packed.names).not.toContain("background.js.map");
    const entries = listZipEntries(readFileSync(outFile));
    expect(entries.map((entry) => entry.name)).toEqual(packed.names);
    expect(entries.some((entry) => entry.name.startsWith("dist/"))).toBe(false);
    const zipped = JSON.parse(
      entries.find((entry) => entry.name === "manifest.json")?.data.toString("utf8") ?? "{}",
    );
    expect(zipped.key).toBe(manifest.key);
    expect(zipped.manifest_version).toBe(3);
    expect(extensionIdFromPublicKeyBase64(zipped.key)).toBe(pinnedId());
    expect(entries.some((entry) => /PRIVATE KEY/.test(entry.data.toString("latin1")))).toBe(false);
  });

  it("refuses a dist that dropped an imported chunk", () => {
    const root = tempDir();
    const dist = writeFixture(root, publicManifest());
    rmSync(path.join(dist, "chunks/userMessage.js"));
    expect(() =>
      packSideloadDist({
        extensionRoot: root,
        distDir: dist,
        outFile: path.join(root, "out.zip"),
        pinnedId: pinnedId(),
      }),
    ).toThrow(/chunks\/userMessage\.js/);
  });

  it("refuses a private key, a different id, and a non-Chrome manifest", () => {
    const root = tempDir();
    const dist = writeFixture(root, publicManifest());
    const pem = path.join(dist, "signing.pem");
    writeFileSync(pem, `-----BEGIN RSA ${"PRIVATE KEY"}-----\nnot-a-key\n`);
    expect(() =>
      packSideloadDist({
        extensionRoot: root,
        distDir: dist,
        outFile: path.join(root, "out.zip"),
        pinnedId: pinnedId(),
      }),
    ).toThrow(/秘密鍵/);
    rmSync(pem);

    const other = publicManifest();
    other.key = `${other.key.slice(0, -1)}A`;
    writeFixture(root, other);
    expect(() =>
      packSideloadDist({
        extensionRoot: root,
        distDir: dist,
        outFile: path.join(root, "other.zip"),
        pinnedId: pinnedId(),
      }),
    ).toThrow(/開発用 ID/);
    expect(() => readFileSync(path.join(root, "other.zip"))).toThrow();

    const firefox = publicManifest();
    firefox.browser_specific_settings = { gecko: { id: "swallow@example" } };
    writeFixture(root, firefox);
    expect(() =>
      packSideloadDist({
        extensionRoot: root,
        distDir: dist,
        outFile: path.join(root, "ff.zip"),
        pinnedId: pinnedId(),
      }),
    ).toThrow(/Firefox/);

    const updating = publicManifest();
    updating.update_url = "https://example.invalid/updates.xml";
    writeFixture(root, updating);
    expect(() =>
      packSideloadDist({
        extensionRoot: root,
        distDir: dist,
        outFile: path.join(root, "upd.zip"),
        pinnedId: pinnedId(),
      }),
    ).toThrow(/update_url/);
  });

  it("refuses a missing build, a symlink, and a path outside dist", () => {
    const root = tempDir();
    expect(() =>
      packSideloadDist({
        extensionRoot: root,
        distDir: path.join(root, "dist"),
        outFile: path.join(root, "out.zip"),
        pinnedId: pinnedId(),
      }),
    ).toThrow(/build/);

    const dist = writeFixture(root, publicManifest());
    symlinkSync(path.join(dist, "icon.png"), path.join(dist, "linked.png"));
    expect(() =>
      packSideloadDist({
        extensionRoot: root,
        distDir: dist,
        outFile: path.join(root, "out.zip"),
        pinnedId: pinnedId(),
      }),
    ).toThrow(/シンボリックリンク/);
    rmSync(path.join(dist, "linked.png"));

    expect(() => normalizeZipPath("../secret.json")).toThrow(SideloadPackError);
    expect(() =>
      packSideloadDist({
        extensionRoot: root,
        distDir: dist,
        outFile: path.join(dist, "inside.zip"),
        pinnedId: pinnedId(),
      }),
    ).toThrow(/dist の外/);
  });

  it("documents sideload, the unset store id, and that the store is not used", () => {
    const id = pinnedId();
    const version = publicManifest().version;
    const distribution = readFileSync(
      path.join(repoRoot, "docs/extension-distribution.md"),
      "utf8",
    );
    const design = readFileSync(path.join(repoRoot, "docs/extension-design.md"), "utf8");
    expect(distribution).toContain(id);
    expect(distribution).toContain("STORE_EXTENSION_ID");
    expect(distribution).toContain("None");
    expect(distribution).toContain("chrome://extensions");
    expect(distribution).toContain("パッケージ化されていない拡張機能を読み込む");
    expect(distribution).toContain("pack:sideload");
    expect(distribution).toContain(`swallow-extension-${version}-sideload.zip`);
    expect(distribution).toContain("再読み込み");
    expect(distribution).toContain("アップロードしない");
    expect(distribution).not.toMatch(/-----BEGIN (?:RSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/);
    expect(design).toContain("extension-distribution.md");
    expect(design).toContain("のどちらかと完全一致");
    expect(design).toContain(id);
  });
});
