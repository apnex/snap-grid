// gate-checks - the gate's own checks (I11) can fail: the vocabulary check, the runtime check -- vector-scene's,
// its allow-list holding exactly the built-ins snap-grid's build names and no platform-member pass -- the clock
// and chance check, vector-scene's as written, and the release run's check that a release's built files are
// those of the release it repeats (docs/DECISIONS.md, D3), run end to end with a stand-in gh, each pass over
// this repository and fail over a copy holding what it exists to refuse.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { candidateWords, findVocabulary, readVocabulary, splitWords } from "../../tools/check-vocabulary.mjs";
import { findClockAndChance } from "../../tools/check-clock-and-chance.mjs";
import { ALLOWED_GLOBALS, findRuntimeUses, freeGlobalReferences, parseModule } from "../../tools/check-runtime.mjs";
import { compareBuilt, repeatedBuild } from "../../tools/compare-built.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const run = (tool, ...args) => spawnSync(process.execPath, [path.join(root, "tools", tool), ...args], { encoding: "utf8" });
const scratch = (files) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snap-grid-check-"));
	for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
	return dir;
};

test("I11: the vocabulary check splits identifiers at case changes, underscores, hyphens and digits, and also compares each whole", () => {
	assert.deepEqual(splitWords("nodeCount NODE_EXT zone-keys HTMLLayout zone2 drawV2"), ["node", "count", "node", "ext", "zone", "keys", "html", "layout", "zone", "2", "draw", "v", "2"]);
	assert.deepEqual(candidateWords("draw_V2"), ["draw_v2", "drawv2", "draw", "v", "2"]);
	const lists = readVocabulary();
	assert.deepEqual(findVocabulary("// the anchor of a thing", lists).map((f) => f.word), ["anchor"]);
	assert.deepEqual(findVocabulary('const s = "Keyboard";', lists).map((f) => [f.word, f.consumer]), [["keyboard", "input-tester"]]);
	assert.deepEqual(findVocabulary("const route = group(key, mouse, bend, draw, nodal, linkage, keys, groups);", lists), [], "ordinary words, and words that merely contain a listed one, pass");
});

test("I11: plurals, digits and a case change inside a word are caught; a run of lower-case letters is not", () => {
	const lists = readVocabulary();
	const caught = (text) => findVocabulary(text, lists).map((f) => f.listed);
	assert.deepEqual(caught("const zones = [];"), ["zone"]);
	assert.deepEqual(caught("// nodes and glyphes"), ["node", "glyph"]);
	assert.deepEqual(caught("export const drawV2 = 1;"), ["drawv2"]);
	assert.deepEqual(caught("const draw_v2 = 1;"), ["drawv2"]);
	assert.deepEqual(caught("let zone2 = 0;"), ["zone"]);
	assert.deepEqual(caught("class ZoneGrid {}"), ["zone"]);
	assert.deepEqual(caught("const zonegrid = 0;"), [], "a listed word inside one run of lower-case letters is not caught: no dictionary splits it");
	for (const control of ["group", "route", "key", "nodal", "keys", "drawing", "linked"]) assert.deepEqual(caught(`const ${control} = 1;`), [], control);
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

test("I11: the runtime check passes over dist, and fails on a bare or node: import, a dynamic import, a runtime's global, eval, Function or a call through constructor", () => {
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
		"const r = /'/; const p = process.env;\n",
		"if (Math.PI) /'/.test(''); globalThis.x = 1; //'\n",
		"{} /'/.test(''); process.exit(); //'\n",
		"export const o = { self: 1 };\n",
		'export const e = eval("this");\n',
		"const F = Function; export const g = F(\"return this\")();\n",
		'export const n = new Function("return this")();\n',
		'export const c = (() => 0).constructor("return this")();\n',
		'export const b = (() => 0)["constructor"]("return this")();\n',
		'export const k = new (function () {}).constructor("return this")();\n',
	];
	// every plant a file of its own in one copy, run through the tool once: each must be reported
	const dir = scratch(Object.fromEntries(bad.map((text, i) => [`plant-${String(i).padStart(2, "0")}.js`, text])));
	try {
		const r = run("check-runtime.mjs", dir);
		assert.equal(r.status, 1);
		bad.forEach((text, i) => assert.match(r.stdout, new RegExp(`plant-${String(i).padStart(2, "0")}\\.js:`), text));
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("I11: the runtime check reads names in code only, never in comments or strings, nor as members", () => {
	const clean = '// globalThis, process and require( in a comment\nimport { a } from "./a.js";\nconst options = {}, b = 1, c = 2;\nexport * from "../b.js";\nconst s = "window document self";\nconst q = \'process\';\nconst t = `import("x") ${a.process}`;\nconst o = { x: options.self };\nconst d = a / b / c;\nconst r = [/"/g, /\\//];\n/* Buffer */\n';
	assert.deepEqual(findRuntimeUses(clean), []);
	assert.deepEqual(findRuntimeUses("const t = `a ${globalThis.x} b`;\n").map((f) => f.finding), ["names globalThis"]);
	assert.deepEqual(findRuntimeUses("const r = /'/; const p = process.env;\n").map((f) => f.finding), ["names process"], "a quote inside a regular expression begins no string");
	assert.deepEqual(findRuntimeUses("const s = 'process';\n"), [], "a name inside a string is not a finding");
	assert.deepEqual(findRuntimeUses("const g = global; const r = require;\n").map((f) => f.finding), ["names global", "names require"], "contextual keywords are names too");
	assert.deepEqual(findRuntimeUses("if (Math.PI) /'/.test(''); globalThis.x = 1; //'\n").map((f) => f.finding), ["names globalThis"], "a regular expression after ) is no division");
	assert.deepEqual(findRuntimeUses("{} /'/.test(''); process.exit(); //'\n").map((f) => f.finding), ["names process"], "a regular expression after a block's } is no division");
	assert.deepEqual(findRuntimeUses("const o = { self: 1 };\n").map((f) => f.finding), ["names self"], "an object-literal key is counted");
	assert.deepEqual(findRuntimeUses("const a = {}; const m = import.meta.url; const n = a?.process;\n"), [], "import.meta is no dynamic import, and an optional member is a member");
	assert.deepEqual(findRuntimeUses('const x = {}, y = {}, o = {}; const a = x.eval; const b = y.Function; const s = "eval(Function)"; const c = o.constructor; const d = o.constructor === Object; // eval\n'), [], "eval and Function as members, in strings and comments, and a constructor read but not called, pass");
	assert.deepEqual(findRuntimeUses('const g = eval("this");\n').map((f) => f.finding), ["names eval"]);
	assert.deepEqual(findRuntimeUses('const g = new Function("return this")();\n').map((f) => f.finding), ["names Function"]);
	assert.deepEqual(findRuntimeUses('const f = () => 0; const g = f.constructor("return this")();\n').map((f) => f.finding), ["calls through a property named constructor, which reaches Function"]);
	assert.throws(() => findRuntimeUses('const s = "open;\n'), /could not parse/);
});

test("I11, B424: the runtime check allows exactly the built-ins snap-grid's build names -- RangeError among them, WeakMap not -- so any other global fails however it is named", () => {
	const named = new Set();
	for (const file of fs.readdirSync(path.join(root, "dist")).filter((f) => f.endsWith(".js"))) {
		for (const { name } of freeGlobalReferences(parseModule(fs.readFileSync(path.join(root, "dist", file), "utf8"), file))) named.add(name);
	}
	assert.deepEqual([...named].sort(), [...ALLOWED_GLOBALS].sort(), "the allow-list is exactly the globals the built files name");
	assert.deepEqual([...ALLOWED_GLOBALS].sort(), ["Array", "Error", "JSON", "Map", "Math", "Number", "Object", "RangeError", "Reflect", "Set", "String", "TypeError", "undefined"]);
	const finding = (name) => `names the global ${name}, which is none of the built-ins the build uses`;
	// the control: a built file naming RangeError, which snap-grid throws for a position it cannot represent, passes
	assert.deepEqual(findRuntimeUses('export const f = () => { throw new RangeError("pointOf: beyond the domain"); };\n'), []);
	// the falsifiers: WeakMap, which vector-scene's build names and snap-grid's does not, and every platform global
	const globals = ["WeakMap", "MessageChannel", "EventSource", "Worker", "SharedWorker", "BroadcastChannel", "RTCPeerConnection", "Atomics", "SharedArrayBuffer", "WebSocket", "XMLHttpRequest", "fetch", "navigator", "location", "localStorage", "indexedDB", "postMessage", "structuredClone", "queueMicrotask", "Promise", "Proxy", "Symbol", "Date", "Intl", "WeakRef", "BigInt", "DataView", "ArrayBuffer", "DOMPoint", "arguments"];
	for (const name of globals) {
		assert.deepEqual(findRuntimeUses(`export const planted = () => ${name};\n`).map((f) => f.finding), [finding(name)], name);
	}
	assert.deepEqual(findRuntimeUses("export const a = new MessageChannel();\n").map((f) => f.finding), [finding("MessageChannel")], "constructed");
	assert.deepEqual(findRuntimeUses("export const a = typeof Worker;\n").map((f) => f.finding), [finding("Worker")], "under typeof");
	assert.deepEqual(findRuntimeUses("export const a = { Atomics };\n").map((f) => f.finding), [finding("Atomics")], "a shorthand property is a reference");
	assert.deepEqual(findRuntimeUses("export function f() { return Worker; }\nfunction g() { const Worker = 1; return Worker; }\nexport { g };\n").map((f) => [f.line, f.finding]), [[1, finding("Worker")]], "a name declared in another scope does not cover this one");
	const clean = [
		`export const a = () => [${ALLOWED_GLOBALS.join(", ")}];\n`,
		"const Worker = 1; export const a = Worker;\n",
		"export const a = (MessageChannel) => MessageChannel;\n",
		"export function f({ EventSource }) { return EventSource; }\n",
		"export const a = (x) => x.Worker + x?.Atomics + ({ BroadcastChannel: 1 }).BroadcastChannel;\n",
		"// MessageChannel, Worker and Atomics in a comment\nexport const s = \"new Worker(MessageChannel)\";\n",
		"label: for (;;) { break label; }\nexport {};\n",
		"try { void 0; } catch (error) { void error; }\nexport {};\n",
		"import { Worker } from \"./worker.js\";\nexport const w = Worker;\n",
	];
	for (const text of clean) assert.deepEqual(findRuntimeUses(text), [], text);
	const dir = scratch(Object.fromEntries(globals.slice(0, 7).map((name, i) => [`global-${i}.js`, `export const planted = () => ${name};\n`])));
	try {
		const r = run("check-runtime.mjs", dir);
		assert.equal(r.status, 1);
		globals.slice(0, 7).forEach((name, i) => assert.match(r.stdout, new RegExp(`global-${i}\\.js:1  names the global ${name},`)));
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("I11, B424: the runtime check has no platform-member pass -- the build's own names open, points, r and scale, which are platform members' names, pass by dot, by brackets and by destructuring", () => {
	const ownNames = [
		"export const a = (shape, declaration) => shape.open(declaration);\n",
		"export const b = (grid) => grid.points + grid[\"scale\"];\n",
		"export const c = ({ r, scale }) => r * scale;\n",
		"export const d = (view) => \"scale\" in view && Reflect.get(view, \"scale\");\n",
	];
	for (const text of ownNames) assert.deepEqual(findRuntimeUses(text), [], text);
	for (const [file, form] of [["conformance.js", /\.points\b/], ["open-grid.js", /open: square\.open/], ["exact-index.js", /\{ q, r, f \}/], ["square.js", /\.scale\b/]]) {
		assert.match(fs.readFileSync(path.join(root, "dist", file), "utf8"), form, `${file} names one of them, and the check passes over it`);
	}
});

test("I11: the clock and chance check passes over dist, and fails on a clock, a timer, chance or a network planted in a built file -- by bracket or by destructuring too", () => {
	assert.equal(run("check-clock-and-chance.mjs").status, 0);
	const bad = [
		"export const a = Date.now();\n",
		"export const b = Math.random();\n",
		'export const c = Math["random"]();\n',
		"const { random } = Math; export const d = random();\n",
		"const { random: chance } = Math; export const e = chance();\n",
		"let r; ({ random: r } = Math); export const f = r();\n",
		"const m = Math; export const g = m.random();\n",
		'export const h = Math["max"](1, 2);\n',
		"export const i = [Math][0].random();\n",
		"const { now } = Date; export const j = now();\n",
		"const { now } = performance; export const k = now();\n",
		"export const l = performance.now();\n",
		"setTimeout(() => 0, 1);\n",
		"queueMicrotask(() => 0);\n",
		"export const n = crypto.getRandomValues(new Uint8Array(1));\n",
		"export const o = new Date();\n",
		"export const p = `${Math[`random`]()}`;\n",
		"function q({ random } = Math) { return random(); }\nexport { q };\n",
		"export const r = new Intl.DateTimeFormat().format();\n",
		"const { DateTimeFormat } = Intl; export const s = DateTimeFormat;\n",
		"export const u = Temporal.Now.instant();\n",
		"export const v = new WeakRef({});\n",
		"export const w = new FinalizationRegistry(() => 0);\n",
	];
	for (const text of bad) assert.ok(findClockAndChance(text).length > 0, text);
	const dir = scratch(Object.fromEntries(bad.map((text, i) => [`plant-${String(i).padStart(2, "0")}.js`, text])));
	try {
		const r = run("check-clock-and-chance.mjs", dir);
		assert.equal(r.status, 1);
		assert.match(r.stdout, /FAIL/);
		bad.forEach((text, i) => assert.match(r.stdout, new RegExp(`plant-${String(i).padStart(2, "0")}\\.js:`), text));
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("I11: the clock and chance check reads code only, and passes a direct member access by identifier", () => {
	const clean = [
		"export const a = Math.max(1, 2);\n",
		"export const b = Math.min(...[3, 4]) + Math.floor(1.5) + Math.abs(-1);\n",
		"// Date.now(), Math.random() and setTimeout in a comment\nexport const c = 'Math.random() and Date.now()';\n",
		"export const d = options.Date + record.performance + x.random;\n",
		"const { random } = other; export const e = random;\n",
		"export const f = options.Intl + record.Temporal + held.WeakRef + held.FinalizationRegistry;\n",
	];
	for (const text of clean) assert.deepEqual(findClockAndChance(text), [], text);
	assert.deepEqual(findClockAndChance('export const c = Math["random"]();\n').map((f) => f.finding), ["reads Math.random by brackets", "uses Math as a value, not as a direct member access by identifier"]);
	assert.throws(() => findClockAndChance('const s = "open;\n'), /could not parse/);
});

/** A package tarball of `files` under package/, made by tar as npm makes one. */
function tarball(dir, name, files) {
	const top = path.join(dir, `${name}-tree`);
	for (const [file, text] of Object.entries(files)) {
		fs.mkdirSync(path.dirname(path.join(top, "package", file)), { recursive: true });
		fs.writeFileSync(path.join(top, "package", file), text);
	}
	const out = path.join(dir, `${name}.tgz`);
	execFileSync("tar", ["-czf", out, "-C", top, "package"]);
	return out;
}

test("D3: the built files of two tarballs compare byte for byte -- the same files pass whatever the documents and package.json say; a byte changed, a file added and a file missing each fail", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snap-grid-built-"));
	try {
		const built = { "dist/index.js": "export * from \"./a.js\";\n", "dist/a.js": "export const a = 1;\n", "dist/a.js.map": "{}" };
		const base = tarball(dir, "base", { ...built, "package.json": "{\"version\":\"0.1.0\"}", "README.md": "old" });
		const same = tarball(dir, "same", { ...built, "package.json": "{\"version\":\"0.1.1\"}", "README.md": "new", "CONTRACT.md": "new" });
		assert.deepEqual(compareBuilt(same, base), { problems: [], compared: 3 }, "documents and the version differ; the built files do not");
		const byte = tarball(dir, "byte", { ...built, "dist/a.js": "export const a = 2;\n" });
		assert.deepEqual(compareBuilt(byte, base).problems, ["dist/a.js differs"]);
		const added = tarball(dir, "added", { ...built, "dist/b.js": "" });
		assert.deepEqual(compareBuilt(added, base).problems, ["dist/b.js is in added.tgz alone"]);
		const { "dist/a.js.map": _, ...fewer } = built;
		const missing = tarball(dir, "missing", fewer);
		assert.deepEqual(compareBuilt(missing, base).problems, ["dist/a.js.map is in base.tgz alone"]);
		const none = tarball(dir, "none", { "package.json": "{}" });
		assert.ok(compareBuilt(none, tarball(dir, "none2", { "package.json": "{}" })).problems.includes("none.tgz holds no built file"));
		assert.equal(spawnSync(process.execPath, [path.join(root, "tools", "compare-built.mjs"), same, base], { encoding: "utf8" }).status, 0);
		const r = spawnSync(process.execPath, [path.join(root, "tools", "compare-built.mjs"), byte, base], { encoding: "utf8" });
		assert.equal(r.status, 1);
		assert.match(r.stdout, /dist\/a\.js differs/);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("D3, RD12: this release repeats 0.1.0's built files, as tools/repeated-build.json records, and the release workflow runs tools/check-repeated-build.mjs on the packed file after the pack and before the consumer test and the draft", () => {
	const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
	assert.equal(repeatedBuild(pkg.version), "0.1.0");
	assert.equal(repeatedBuild("0.2.0"), null, "a release not named repeats nothing");
	const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "release.yml"), "utf8");
	const call = 'run: node tools/check-repeated-build.mjs "$RUNNER_TEMP/packed/$FILE" --repo "$GITHUB_REPOSITORY" --dir "$RUNNER_TEMP/repeated"';
	const lines = workflow.split("\n").filter((line) => !line.trim().startsWith("#") && line.includes("check-repeated-build.mjs"));
	assert.deepEqual(lines.map((line) => line.trim()), [call], "the step calls the script once, on the packed file, its version package.json's, and nothing more");
	const at = workflow.indexOf(call);
	assert.ok(at > workflow.indexOf("npm pack"), "after the pack");
	assert.ok(at < workflow.indexOf("npm run consumer"), "before the consumer test");
	assert.ok(at < workflow.indexOf("gh release create"), "before the draft");
	assert.ok(!workflow.includes("releases[") && !workflow.includes("compare-built.mjs") && !workflow.includes("gh release download"), "no lookup, download or comparison of the workflow's own: the script does each");
});

/**
 * A stand-in for gh, first on PATH: it writes each call's arguments as a line of JSON into its log, and for
 * `release download` copies each --pattern from its assets into --dir, failing as gh does when one is missing.
 */
function standInGh(dir) {
	const bin = path.join(dir, "bin");
	const assets = path.join(dir, "assets");
	const log = path.join(dir, "gh-calls.log");
	fs.mkdirSync(bin);
	fs.mkdirSync(assets);
	fs.writeFileSync(path.join(bin, "gh.mjs"), `import fs from "node:fs";
import path from "node:path";
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + "\\n");
if (args[0] !== "release" || args[1] !== "download") process.exit(2);
const into = args[args.indexOf("--dir") + 1];
for (let i = 0; i < args.length; i++) {
	if (args[i] !== "--pattern") continue;
	const from = path.join(${JSON.stringify(assets)}, args[i + 1]);
	if (!fs.existsSync(from)) { console.error("no asset matches " + args[i + 1]); process.exit(1); }
	fs.copyFileSync(from, path.join(into, args[i + 1]));
}
`);
	fs.writeFileSync(path.join(bin, "gh"), `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(path.join(bin, "gh.mjs"))} "$@"\n`, { mode: 0o755 });
	const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
	const run = (packed, ...extra) => {
		fs.rmSync(log, { force: true });
		const into = fs.mkdtempSync(path.join(dir, "repeated-"));
		const r = spawnSync(process.execPath, [path.join(root, "tools", "check-repeated-build.mjs"), packed, "--repo", "apnex/snap-grid", "--dir", into, ...extra], { encoding: "utf8", env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` } });
		return { status: r.status, out: `${r.stdout}${r.stderr}`, calls: calls(), into };
	};
	return { assets, run };
}

/** The SHA-512 line sha512sum writes for a file. */
const sha512Line = (file, name = path.basename(file)) => `${crypto.createHash("sha512").update(fs.readFileSync(file)).digest("hex")}  ${name}\n`;

test("D3, RD12: tools/check-repeated-build.mjs, end to end with a stand-in gh -- a pass, a one-byte difference, a SHA-512 mismatch, a SHA-512 file naming another file, a missing asset, and a version the map does not name, which skips and asks nothing of gh", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snap-grid-repeated-"));
	try {
		const gh = standInGh(dir);
		const built = { "dist/index.js": "export * from \"./a.js\";\n", "dist/a.js": "export const a = 1;\n", "dist/a.js.map": "{}" };
		const base = tarball(dir, "apnex-snap-grid-0.1.0", { ...built, "package.json": "{\"version\":\"0.1.0\"}" });
		fs.copyFileSync(base, path.join(gh.assets, "apnex-snap-grid-0.1.0.tgz"));
		fs.writeFileSync(path.join(gh.assets, "apnex-snap-grid-0.1.0.tgz.sha512"), sha512Line(base));
		const same = tarball(dir, "same", { ...built, "package.json": "{\"version\":\"0.1.1\"}", "README.md": "new" });
		const byte = tarball(dir, "byte", { ...built, "dist/a.js": "export const a = 2;\n", "package.json": "{\"version\":\"0.1.1\"}" });

		// a pass: the version is package.json's, 0.1.1, which repeats 0.1.0; gh is asked for that release's two files
		const pass = gh.run(same);
		assert.equal(pass.status, 0, pass.out);
		assert.match(pass.out, /check-repeated-build: PASS -- 3 built file\(s\) of same\.tgz are byte-identical to release v0\.1\.0's/);
		assert.match(pass.out, /apnex-snap-grid-0\.1\.0\.tgz matches the SHA-512 attached beside it/);
		assert.deepEqual(pass.calls, [["release", "download", "v0.1.0", "--repo", "apnex/snap-grid", "--dir", pass.into, "--pattern", "apnex-snap-grid-0.1.0.tgz", "--pattern", "apnex-snap-grid-0.1.0.tgz.sha512"]]);

		// a one-byte difference in a built file fails, naming it
		const differ = gh.run(byte);
		assert.equal(differ.status, 1, differ.out);
		assert.match(differ.out, /dist\/a\.js differs/);
		assert.match(differ.out, /check-repeated-build: FAIL -- 1 difference\(s\) between the built files of byte\.tgz and of release v0\.1\.0/);

		// a downloaded tarball that does not match its SHA-512 fails before anything is compared
		fs.writeFileSync(path.join(gh.assets, "apnex-snap-grid-0.1.0.tgz.sha512"), sha512Line(same, "apnex-snap-grid-0.1.0.tgz"));
		const mismatch = gh.run(same);
		assert.equal(mismatch.status, 1, mismatch.out);
		assert.match(mismatch.out, /check-repeated-build: FAIL -- apnex-snap-grid-0\.1\.0\.tgz does not match the SHA-512 attached beside it/);
		assert.doesNotMatch(mismatch.out, /PASS|differs/);

		// a SHA-512 file whose digest is right but names another file fails too
		fs.writeFileSync(path.join(gh.assets, "apnex-snap-grid-0.1.0.tgz.sha512"), sha512Line(base, "other.tgz"));
		const named = gh.run(same);
		assert.equal(named.status, 1, named.out);
		assert.match(named.out, /names other\.tgz, not apnex-snap-grid-0\.1\.0\.tgz/);

		// an asset gh cannot find fails
		fs.rmSync(path.join(gh.assets, "apnex-snap-grid-0.1.0.tgz.sha512"));
		const missing = gh.run(same);
		assert.equal(missing.status, 1, missing.out);
		assert.match(missing.out, /gh could not download apnex-snap-grid-0\.1\.0\.tgz and its SHA-512 from release v0\.1\.0 of apnex\/snap-grid/);

		// a version the map does not name skips, gh never asked, whatever the packed file holds
		const skip = gh.run(byte, "--version", "0.2.0");
		assert.equal(skip.status, 0, skip.out);
		assert.match(skip.out, /check-repeated-build: SKIP -- 0\.2\.0 names no release whose built files it repeats/);
		assert.deepEqual(skip.calls, []);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("I11: the gate runs every check, the clock and chance check among them, after the tests and before the style checks", () => {
	const gate = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).scripts.gate;
	assert.equal(gate, "npm test && node tools/check-vocabulary.mjs && node tools/check-runtime.mjs && node tools/check-clock-and-chance.mjs && node tools/check-export-map.mjs && node tools/check-style.mjs");
});
