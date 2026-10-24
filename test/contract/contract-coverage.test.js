// contract-coverage - one test file per row of CONTRACT.md's capability table, so the contract reads as a
// list of tests (the design's section 4: "one file per capability").
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { contractRows } from "../../tools/check-export-map.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const rows = contractRows(fs.readFileSync(path.join(here, "..", "..", "CONTRACT.md"), "utf8"));

test("CONTRACT.md has its nine capabilities", () => {
	assert.deepEqual(rows, [
		"declared-grid",
		"nearest-grid-position",
		"grid-position-point",
		"exact-grid-position",
		"grid-positions-in-view",
		"next-grid-position",
		"grid-position-span",
		"enclosing-grid-block",
		"grid-shape-conformance",
	]);
});

for (const row of rows) {
	test(`${row} has its contract test file`, () => {
		assert.ok(fs.existsSync(path.join(here, `${row}.test.js`)), `test/contract/${row}.test.js is missing`);
	});
}

test("CONTRACT.md carries the six headings of a component entry, in order", () => {
	const text = fs.readFileSync(path.join(here, "..", "..", "CONTRACT.md"), "utf8");
	const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
	assert.deepEqual(headings, ["Duty", "Contract", "Reference", "Fit criteria", "Adjustment policy", "Edges"]);
	for (const field of ["id: unminted", "category: component", "status: draft", "sovereignty: internal", "supersedes: []", "related: [C0, A3]"]) {
		assert.ok(text.includes(`\n${field}\n`), `the frontmatter holds ${field}`);
	}
});

test("CONTRACT.md names no file or design of draw's but its one provenance line (GR4)", () => {
	const text = fs.readFileSync(path.join(here, "..", "..", "CONTRACT.md"), "utf8");
	const naming = text.split("\n").filter((line) => /drawv2|draw's|SNAP-GRID\.md|VECTOR-SCENE\.md|INPUT-BINDING\.md|INPUT-CAPTURE\.md|RELEASES-0\.2\.md|the design's|H26|zone|\.mjs:\d|kernel\/|layouts\/|app\/src/.test(line));
	assert.equal(naming.length, 1, naming.join("\n"));
	assert.match(naming[0], /^The design of record and the rulings are kept in draw's records, `apnex\/drawv2`\.$/);
});
