// i10-corpus - I10: square reproduces a reference arithmetic, case for case, -0 told apart from 0,
// except at the points the corpus lists apart, where it gives the exact answer instead.
//
// The corpus was generated once from the reference at a fixed commit (test/corpus/README.md says how)
// and is never written by hand. It names no word of the reference's vocabulary, which the vocabulary
// check confirms here, with the reference's own list.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { openGrid } from "@apnex/snap-grid";
import { findVocabulary, readVocabulary } from "../../tools/check-vocabulary.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const text = fs.readFileSync(path.join(here, "i10-square-corpus.json"), "utf8");
const corpus = JSON.parse(text, (key, value) => (value === "-0" ? -0 : value));
const grids = new Map(Object.entries(corpus.grids).map(([name, declaration]) => {
	const opened = openGrid(declaration);
	assert.ok(opened.ok, `${name} opens`);
	return [name, opened.grid];
}));

/** What square answers for a case's question. */
function ask(c) {
	const grid = grids.get(c.grid);
	switch (c.question) {
		case "nearest": {
			const position = grid.nearest(c.point);
			return { position, point: grid.pointOf(position) };
		}
		case "positionAt":
			return grid.positionAt(c.point);
		case "pointOf":
			return grid.pointOf(c.position);
		case "inView":
			return grid.inView(c.view);
		case "enclosing":
			return grid.enclosing(c.rect);
		case "span":
			return { through: grid.span(c.from, c.to).through };
		default:
			throw new Error(`unknown question ${c.question}`);
	}
}

test("the corpus holds cases of every question, and lists apart the points the reference does not compute exactly", () => {
	const questions = new Set(corpus.cases.map((c) => c.question));
	assert.deepEqual([...questions].sort(), ["enclosing", "inView", "nearest", "pointOf", "positionAt", "span"]);
	assert.ok(corpus.cases.length > 8000, `${corpus.cases.length} cases`);
	assert.ok(corpus.apart.length > 0, "the reference's inexact points are listed");
	for (const c of corpus.apart) assert.ok(["rounding", "domain"].includes(c.reason), `${c.reason} is a reason`);
	assert.ok(text.includes('"-0"'), "-0 appears among the inputs");
});

test("square agrees with the reference at every case, -0 told apart from 0", () => {
	let checked = 0;
	for (const c of corpus.cases) {
		assert.deepStrictEqual(ask(c), c.answer, `${c.question} on ${c.grid}: ${JSON.stringify(c)}`);
		checked++;
	}
	assert.equal(checked, corpus.cases.length);
});

test("square gives the exact answer at every point listed apart, where the reference differs", () => {
	for (const c of corpus.apart) {
		const got = ask(c);
		assert.deepStrictEqual(got, c.answer, `${c.question} on ${c.grid}: ${JSON.stringify(c)}`);
		assert.notDeepStrictEqual(got, c.referenceAnswer, "a listed point is one where the reference differs");
	}
});

test("section 6.3's measured differences are among the points listed apart", () => {
	const listed = (question, grid, match) => corpus.apart.some((c) => c.question === question && c.grid === grid && match(c));
	assert.ok(listed("positionAt", "pitch60-origin30", (c) => c.point.x === -30 + 2 ** -48 && c.referenceAnswer !== null && c.answer === null));
	assert.ok(listed("nearest", "pitch60-origin30", (c) => c.reason === "domain" && (c.point.x === 2 ** 50 || c.point.y === 2 ** 50) && c.referenceAnswer.point[c.point.x === 2 ** 50 ? "x" : "y"] === 1125899906842650));
	assert.ok(listed("nearest", "pitch60-origin30-bounded", (c) => c.point.x === -60 - 2 ** -47 && c.referenceAnswer.point.x === -30 && c.answer.point.x === -90));
	assert.ok(listed("nearest", "pitch60-origin30", (c) => c.point.x === -60 - 2 ** -47 && c.referenceAnswer.point.x === -30 && c.answer.point.x === -90));
	for (const c of corpus.apart) assert.ok(c.grid.startsWith("pitch60-origin30"), "every difference lies on the grid of origin 30");
});

test("test/corpus/README.md records the corpus's counts truly", () => {
	const readme = fs.readFileSync(path.join(here, "README.md"), "utf8");
	const count = (list, question, reason) => list.filter((c) => (!question || c.question === question) && (!reason || c.reason === reason)).length;
	for (const question of ["nearest", "positionAt", "pointOf", "inView", "enclosing", "span"]) {
		const row = `| ${question} | ${count(corpus.cases, question)} | ${count(corpus.apart, question, "rounding")} | ${count(corpus.apart, question, "domain")} |`;
		assert.ok(readme.includes(row), `README.md holds ${row}`);
	}
	assert.ok(readme.includes(`| all | ${corpus.cases.length} | ${count(corpus.apart, null, "rounding")} | ${count(corpus.apart, null, "domain")} |`));
});

test("the corpus names no word of the reference's vocabulary", () => {
	const lists = readVocabulary();
	assert.deepEqual(findVocabulary(text, lists), []);
});
