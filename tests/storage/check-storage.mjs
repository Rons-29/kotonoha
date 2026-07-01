import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "../..");
const output = join(tmpdir(), `kotonoha-storage-${Date.now()}.mjs`);

await build({
  entryPoints: [join(root, "src/main.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: output,
  alias: {
    obsidian: join(root, "tests/storage/obsidian-stub.mjs"),
  },
  logLevel: "silent",
});

const {
  findCurrentMemo,
  isLikelyDailyNotePath,
  normalizeFolder,
  normalizeOptionalFolder,
  parseMemoItems,
  serializeMemoBlock,
  upsertUnderHeading,
} = await import(`${pathToFileURL(output).href}?v=${Date.now()}`);

const note = [
  "# 2026-06-21",
  "",
  "- 08:00 見出し外の予定",
  "",
  "## つぶやき",
  "- 09:00 対象メモ %% kotonoha:id=memo-1 %%",
  "- [ ] 09:05 未完了 %% kotonoha:id=memo-2 %%",
  "",
  "## その他",
  "- 10:00 別セクション",
].join("\n");

const items = parseMemoItems(note, "Daily/2026-06-21.md", "つぶやき");
assert.equal(items.length, 2);
assert.equal(items[0].storageId, "memo-1");
assert.equal(items[1].taskStatus, "open");

const shifted = `追加行\n${note}`;
const current = findCurrentMemo(shifted, items[0], "つぶやき");
assert.equal(current?.storageId, "memo-1");
assert.equal(current?.startLine, items[0].startLine + 1);

const serialized = serializeMemoBlock("memo-1", "09:00", "更新後", "archived", true, "done");
assert.match(serialized, /^- \[x\] 09:00 更新後/);
assert.match(serialized, /id=memo-1/);
assert.match(serialized, /status=archived/);
assert.match(serialized, /pinned=true/);
assert.match(serialized, /\n  %% kotonoha:id=memo-1;status=archived;pinned=true %%$/);

const activeSerialized = serializeMemoBlock("memo-active", "09:10", "通常表示", "active", false, "none");
assert.equal(activeSerialized, "- 09:10 通常表示");

const childMetaNote = [
  "# Daily",
  "## つぶやき",
  "- 12:00 子行メタ",
  "  %% kotonoha:id=memo-child;pinned=true %%",
].join("\n");
const childMeta = parseMemoItems(childMetaNote, "2026-06-21.md", "つぶやき")[0];
assert.equal(childMeta.storageId, "memo-child");
assert.equal(childMeta.pinned, true);
assert.equal(childMeta.content, "子行メタ");

const legacyNote = [
  "# Daily",
  "## つぶやき",
  "- 11:00 旧形式",
].join("\n");
const legacy = parseMemoItems(legacyNote, "2026-06-21.md", "つぶやき")[0];
assert.equal(legacy.storageId, null);
assert.equal(findCurrentMemo(legacyNote, legacy, "つぶやき")?.content, "旧形式");

const duplicatedLegacy = `${legacyNote}\n- 11:00 旧形式`;
assert.equal(findCurrentMemo(duplicatedLegacy, legacy, "つぶやき"), null);

const inserted = upsertUnderHeading("# Daily\n\n## つぶやき\n- 08:00 既存\n\n## 次", "つぶやき", "- 09:00 新規", false);
assert.match(inserted, /- 08:00 既存\n\n- 09:00 新規\n## 次/);

assert.equal(isLikelyDailyNotePath("2026-06-21.md", "YYYY-MM-DD"), true);
assert.equal(isLikelyDailyNotePath("01_diary/2026/2026-06-21_日.md", "YYYY-MM-DD_ddd"), true);
assert.equal(isLikelyDailyNotePath("Projects/meeting-notes.md", "YYYY-MM-DD"), false);
assert.equal(isLikelyDailyNotePath("2026-06 monthly.md", "YYYY-MM-DD"), false);

assert.equal(normalizeFolder("../Kotonoha/../attachments"), "Kotonoha/attachments");
assert.equal(normalizeFolder("/Kotonoha//attachments/"), "Kotonoha/attachments");
assert.equal(normalizeOptionalFolder("../01_diary/./2026"), "01_diary/2026");
assert.equal(normalizeOptionalFolder(""), "");

console.log("Storage checks passed.");
