// gate-checks - the vocabulary check and the runtime check (the design's section 7.2; I11) can fail: each
// passes over this repository and fails over a copy holding what it exists to refuse.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { findVocabulary, readVocabulary, splitWords } from "../../tools/check-vocabulary.mjs";
import { findRuntimeUses } from "../../tools/check-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const run = (tool, ...args) => spawnSync(process.execPath, [path.join(root, "tools", tool), ...args], { encoding: "utf8" });
const scratch = (files) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snap-grid-check-"));
	for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
	return dir;
};

test("I11: the vocabulary check splits identifiers at case changes, underscores and hyphens, and matches whole words", () => {
	assert.deepEqual(splitWords("nodeCount NODE_EXT zone-keys HTMLLayout drawv2"), ["node", "count", "node", "ext", "zone", "keys", "html", "layout", "drawv2"]);
	const lists = readVocabulary();
	assert.deepEqual(findVocabulary("// the anchor of a thing", lists).map((f) => f.word), ["anchor"]);
	assert.deepEqual(findVocabulary('const s = "Keyboard";', lists).map((f) => [f.word, f.consumer]), [["keyboard", "gesture-tester"]]);
	assert.deepEqual(findVocabulary("const route = group(key, mouse, bend, draw, nodal, linkage);", lists), [], "ordinary words, and words that merely contain a listed one, pass");
});

test("I11: the vocabulary check passes over src, and fails on a word of draw's in a comment, a string or code", () => {
	assert.equal(run("check-vocabulary.mjs").status, 0);
	for (const text of ["// snaps a waypoint\nexport const a = 1;\n", 'export const a = "zone";\n', "export const layoutName = 1;\n", "/* the DIAGRAM */\n"]) {
		const dir = scratch({ "a.ts": text });
		try {
			const r = run("check-vocabulary.mjs", dir);
			assert.equal(r.status, 1, text);
			assert.match(r.stdout, /FAIL/);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}
});

test("I11: the runtime check passes over dist, and fails on a bare or node: import, a dynamic import, or a runtime's global", () => {
	assert.equal(run("check-runtime.mjs").status, 0);
	const bad = [
		'import fs from "node:fs";\n',
		'import { x } from "some-package";\n',
		'export { y } from "@scope/pkg/sub";\n',
		'import "side-effect";\n',
		'const m = await import("./a.js");\n',
		"export const g = globalThis;\n",
		"export const p = process.env;\n",
		"const r = require;\n",
		"const b = Buffer.from([]);\n",
		"export const w = typeof window;\n",
		"export const d = document;\n",
		"export const s = self;\n",
		"export const t = `${global.x}`;\n",
	];
	for (const text of bad) {
		const dir = scratch({ "a.js": text });
		try {
			assert.equal(run("check-runtime.mjs", dir).status, 1, text);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}
});

test("I11: the runtime check reads names in code only, never in comments or strings, nor as members", () => {
	const clean = '// globalThis, process and require( in a comment\nimport { a } from "./a.js";\nexport * from "../b.js";\nconst s = "window document self";\nconst t = `import("x") ${a.process}`;\nconst o = { x: options.self };\n/* Buffer */\n';
	assert.deepEqual(findRuntimeUses(clean), []);
	assert.deepEqual(findRuntimeUses("const t = `a ${globalThis.x} b`;\n").map((f) => f.finding), ["names globalThis"]);
});
