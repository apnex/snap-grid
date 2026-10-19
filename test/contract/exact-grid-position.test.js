// exact-grid-position - SG5: the offered position a point lies exactly on, or none, defined through
// nearest and pointOf; and the remainder test agreeing with it over I10's corpus wherever it should.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { openGrid } from "@apnex/snap-grid";
import { aimedCoordinate, nextDown, nextUp, randomDeclaration, seededRandom } from "../support/doubles.js";

const open = (declaration) => {
	const r = openGrid(declaration);
	assert.ok(r.ok, JSON.stringify(r.problems));
	return r.grid;
};
const lattice0 = { shape: "square", pitch: 60, origin: { x: 0, y: 0 } };
const lattice30 = { shape: "square", pitch: 60, origin: { x: 30, y: 30 } };
const remainderTest = (v, origin, pitch) => Number.isFinite(v) && (v - origin) % pitch === 0;

test("SG5: on and off for each sign", () => {
	const g = open(lattice30);
	assert.deepStrictEqual(g.positionAt({ x: 30, y: -30 }), { col: 0, row: -1 });
	assert.deepStrictEqual(g.positionAt({ x: -90, y: 90 }), { col: -2, row: 1 });
	assert.equal(g.positionAt({ x: 31, y: 30 }), null);
	assert.equal(g.positionAt({ x: -89, y: 30 }), null);
	assert.equal(g.positionAt({ x: 30, y: -29.5 }), null);
	assert.equal(g.positionAt({ x: 0, y: 0 }), null);
});

test("SG5: -0 lies exactly on the position at 0", () => {
	const g = open(lattice0);
	assert.deepStrictEqual(g.positionAt({ x: -0, y: -0 }), { col: 0, row: 0 });
	assert.ok(Object.is(g.positionAt({ x: -0, y: 0 }).col, 0));
});

test("SG5: one rounding from a lattice point is not on it, where the remainder test says it is", () => {
	const g = open(lattice30);
	const x = -30 + 2 ** -48;
	assert.equal(g.positionAt({ x, y: 30 }), null);
	assert.equal(remainderTest(x, 30, 60), true, "the remainder test accepts it, since x - 30 rounds to -60");
	for (const v of [nextUp(30), nextDown(30), nextUp(-30), nextDown(-30), nextUp(0), nextDown(0)]) assert.equal(g.positionAt({ x: v, y: 30 }), null, `${v}`);
	const z = open(lattice0);
	for (const v of [nextUp(60), nextDown(60), Number.MIN_VALUE, -Number.MIN_VALUE]) assert.equal(z.positionAt({ x: v, y: 0 }), null, `${v}`);
});

test("SG5: beyond the bounds there is no position, where the remainder test, knowing no bounds, passes", () => {
	const g = open({ ...lattice0, bounds: { min: { x: -900, y: -480 }, max: { x: 900, y: 480 } } });
	assert.deepStrictEqual(g.positionAt({ x: 900, y: -480 }), { col: 15, row: -8 });
	assert.equal(g.positionAt({ x: 960, y: 0 }), null);
	assert.equal(remainderTest(960, 0, 60), true);
	assert.equal(g.positionAt({ x: Infinity, y: 0 }), null);
	assert.equal(g.positionAt({ x: NaN, y: 0 }), null);
	assert.equal(g.positionAt({ x: 2 ** 51, y: 0 }), null);
});

test("SG5: positionAt is nearest when nearest's point is the point, and null otherwise, over random grids", () => {
	const rnd = seededRandom(51);
	for (let n = 0; n < 1500; n++) {
		const d = randomDeclaration(rnd);
		const g = open(d);
		for (let i = 0; i < 40; i++) {
			const q = { x: aimedCoordinate(rnd, d.pitch, d.origin.x), y: aimedCoordinate(rnd, d.pitch, d.origin.y) };
			const nearest = g.nearest(q);
			const p = nearest && g.pointOf(nearest);
			assert.deepStrictEqual(g.positionAt(q), p && p.x === q.x && p.y === q.y ? nearest : null);
		}
	}
});

test("SG5: the remainder test agrees with positionAt over I10's corpus, at every integer coordinate within the bounds", () => {
	const here = path.dirname(fileURLToPath(import.meta.url));
	const corpus = JSON.parse(fs.readFileSync(path.join(here, "..", "corpus", "i10-square-corpus.json"), "utf8"), (k, v) => (v === "-0" ? -0 : v));
	const grids = new Map(Object.entries(corpus.grids).map(([name, d]) => [name, { d, g: open(d) }]));
	let integers = 0, fractions = 0, disagreements = 0;
	for (const c of [...corpus.cases, ...corpus.apart]) {
		if (!c.point) continue;
		const { d, g } = grids.get(c.grid);
		const q = c.point;
		const within = !d.bounds || (q.x >= d.bounds.min.x && q.x <= d.bounds.max.x && q.y >= d.bounds.min.y && q.y <= d.bounds.max.y);
		if (!within) continue;
		const remainder = remainderTest(q.x, d.origin.x, d.pitch) && remainderTest(q.y, d.origin.y, d.pitch);
		const exact = g.positionAt(q) !== null;
		if (Number.isInteger(q.x) && Number.isInteger(q.y)) {
			assert.equal(remainder, exact, `${c.grid} at ${q.x}, ${q.y}`);
			integers++;
		} else {
			fractions++;
			if (remainder !== exact) disagreements++;
		}
	}
	assert.ok(integers > 500, `${integers} integer points`);
	assert.ok(fractions > 500, `${fractions} points with a fraction`);
	assert.ok(disagreements >= 1, "the corpus holds a fraction one rounding from a lattice point, where the remainder test is wrong");
	const listed = corpus.apart.filter((c) => c.question === "positionAt");
	assert.ok(listed.length >= 1);
	for (const c of listed) assert.deepStrictEqual(grids.get(c.grid).g.positionAt(c.point), c.answer);
});
