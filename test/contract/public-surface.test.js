// public-surface - the package exposes exactly what export-map.json names (zorg's EM14; SG10).
//
// Every path in package.json's exports is named in the map; a module path is imported by its public name
// and its runtime exports compared with the map; and every capability row of CONTRACT.md is served by
// some export or deferred with a ruling. tools/check-export-map.mjs makes the same judgement for the gate,
// and fails on a map that is wrong.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { contractRows, exportMapProblems } from "../../tools/check-export-map.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const map = JSON.parse(fs.readFileSync(path.join(root, "export-map.json"), "utf8"));
const publicName = (p) => (p === "." ? pkg.name : `${pkg.name}/${p.slice(2)}`);

test("the export map names the package and exactly its exported paths", () => {
	assert.equal(map.package, pkg.name);
	assert.deepEqual(Object.keys(map.paths).sort(), Object.keys(pkg.exports).sort());
});

for (const [p, entry] of Object.entries(map.paths)) {
	test(`${publicName(p)} exposes what the map names`, async () => {
		assert.ok(entry.exports, `${p} is a module path`);
		const mod = await import(publicName(p));
		assert.deepEqual(Object.keys(mod).sort(), Object.keys(entry.exports).sort());
	});
}

test("SG10: the package exports openGrid and square, and its conformance path checkGridShape", async () => {
	assert.deepEqual(Object.keys(await import("@apnex/snap-grid")).sort(), ["openGrid", "square"]);
	assert.deepEqual(Object.keys(await import("@apnex/snap-grid/conformance")), ["checkGridShape"]);
	assert.deepEqual(pkg.exports, {
		".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
		"./conformance": { types: "./dist/conformance.d.ts", default: "./dist/conformance.js" },
	});
});

test("every contract row is served by an export or deferred with a ruling", () => {
	const rows = contractRows(fs.readFileSync(path.join(root, "CONTRACT.md"), "utf8"));
	assert.equal(rows.length, 9);
	const served = new Set(Object.values(map.paths).flatMap((e) => Object.values(e.exports ?? {})).flatMap((x) => x.serves));
	for (const row of rows) assert.ok(served.has(row) || map.deferred[row], `${row} is neither served nor deferred`);
	for (const [row, ruling] of Object.entries(map.deferred)) assert.match(ruling, /^D\d+$/, `${row} is deferred without a ruling`);
});

test("the package declares no dependency, and pins TypeScript", () => {
	assert.equal(pkg.dependencies, undefined);
	assert.equal(pkg.devDependencies.typescript, "5.9.3");
	assert.equal(pkg.type, "module");
	assert.equal(pkg.engines.node, ">=22");
	assert.deepEqual(pkg.files.sort(), ["CONTRACT.md", "LICENSE", "README.md", "VISION.md", "dist"]);
});

test("the export-map check passes here, and fails on a map that names an export the package lacks or misses a row", async () => {
	assert.deepEqual(await exportMapProblems(root), []);
	const copy = fs.mkdtempSync(path.join(os.tmpdir(), "snap-grid-map-"));
	try {
		for (const f of ["package.json", "CONTRACT.md", "export-map.json"]) fs.copyFileSync(path.join(root, f), path.join(copy, f));
		fs.mkdirSync(path.join(copy, "docs"));
		fs.copyFileSync(path.join(root, "docs", "DECISIONS.md"), path.join(copy, "docs", "DECISIONS.md"));
		fs.cpSync(path.join(root, "dist"), path.join(copy, "dist"), { recursive: true });
		const broken = structuredClone(map);
		broken.paths["."].exports.extraThing = { part: "snap-grid", serves: ["declared-grid"] };
		broken.paths["./conformance"].exports.checkGridShape.serves = ["no-such-row"];
		fs.writeFileSync(path.join(copy, "export-map.json"), JSON.stringify(broken));
		const problems = await exportMapProblems(copy);
		assert.ok(problems.some((p) => p.startsWith(". exports") && p.includes("extraThing")), problems.join("\n"));
		assert.ok(problems.some((p) => p.includes("no-such-row")), problems.join("\n"));
		assert.ok(problems.some((p) => p === "grid-shape-conformance is neither served nor deferred"), problems.join("\n"));
	} finally {
		fs.rmSync(copy, { recursive: true, force: true });
	}
});
