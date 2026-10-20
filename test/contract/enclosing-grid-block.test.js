// enclosing-grid-block - SG9: the smallest block of offered positions whose through holds a rect, clamped
// to the offered positions where none does; held to the exact oracle.
import assert from "node:assert/strict";
import { test } from "node:test";

import { openGrid } from "@apnex/snap-grid";
import { holdsNegativeZero, isFrozenToDepth } from "../support/answers.js";
import { aimedCoordinate, nextDown, nextUp, randomDeclaration, randomTools, seededRandom } from "../support/doubles.js";
import { exactEnclosing } from "../support/oracle.js";

const L = 2 ** 50;
const open = (declaration) => {
	const r = openGrid(declaration);
	assert.ok(r.ok, JSON.stringify(r.problems));
	return r.grid;
};
const rect = (x, y, w, h) => ({ kind: "rect", x, y, w, h });
const block = (c0, r0, c1, r1) => ({ from: { col: c0, row: r0 }, to: { col: c1, row: r1 } });
const bounded = { shape: "square", pitch: 60, origin: { x: 30, y: 30 }, bounds: { min: { x: -930, y: -510 }, max: { x: 930, y: 510 } } };

test("SG9: a rect inside, on the lattice, and straddling cells", () => {
	const g = open(bounded);
	assert.deepStrictEqual(g.enclosing(rect(-30, 30, 120, 60)), block(-1, 0, 1, 1));
	assert.deepStrictEqual(g.enclosing(rect(-29, 31, 118, 58)), block(-1, 0, 1, 1));
	assert.deepStrictEqual(g.enclosing(rect(-31, 29, 122, 62)), block(-2, -1, 2, 2));
	assert.deepStrictEqual(g.enclosing(rect(30, 30, 0, 0)), block(0, 0, 0, 0));
	assert.deepStrictEqual(g.enclosing(rect(31, 31, 0, 0)), block(0, 0, 1, 1));
	const through = g.span({ col: -3, row: 2 }, { col: 4, row: 5 }).through;
	assert.deepStrictEqual(g.enclosing(through), block(-3, 2, 4, 5));
});

test("SG9: rects touching, straddling and beyond every edge", () => {
	const g = open(bounded);
	assert.deepStrictEqual(g.enclosing(rect(930, 510, 0, 0)), block(15, 8, 15, 8));
	assert.deepStrictEqual(g.enclosing(rect(-930, -510, 0, 0)), block(-16, -9, -16, -9));
	assert.deepStrictEqual(g.enclosing(rect(900, 500, 100, 100)), block(14, 7, 15, 8));
	assert.deepStrictEqual(g.enclosing(rect(-1000, -600, 100, 100)), block(-16, -9, -15, -8));
	assert.deepStrictEqual(g.enclosing(rect(-1100, -700, 100, 100)), block(-16, -9, -16, -9));
	assert.deepStrictEqual(g.enclosing(rect(-1000, -600, 2000, 1200)), block(-16, -9, 15, 8));
	assert.deepStrictEqual(g.enclosing(rect(2000, 0, 10, 10)), block(15, -1, 15, 0));
	assert.deepStrictEqual(g.enclosing(rect(-2000, 0, 10, 10)), block(-16, -1, -16, 0));
	assert.deepStrictEqual(g.enclosing(rect(0, 2000, 10, 10)), block(-1, 8, 0, 8));
	assert.deepStrictEqual(g.enclosing(rect(0, -2000, 10, 10)), block(-1, -9, 0, -9));
	assert.deepStrictEqual(g.enclosing(rect(-L, -L, 2 * L, 2 * L)), block(-16, -9, 15, 8));
});

test("SG9: an edge not finite or outside the domain answers null; an infinite w is such an edge, a NaN w or h is malformed", () => {
	const g = open(bounded);
	for (const r of [rect(NaN, 0, 1, 1), rect(0, Infinity, 0, 0), rect(-Infinity, 0, 1, 1), rect(0, 0, Infinity, 1), rect(0, 0, 1, Infinity), rect(nextUp(L), 0, 0, 0), rect(L, 0, 1, 0), rect(0, nextDown(-L), 0, 0), rect(0, 0, 2 ** 51, 0)]) {
		assert.equal(g.enclosing(r), null, JSON.stringify(r));
	}
	assert.notEqual(g.enclosing(rect(-L, -L, 2 * L, 2 * L)), null);
	for (const r of [rect(0, 0, -1, 0), rect(0, 0, NaN, 1), rect(0, 0, 1, NaN), rect(0, 0, -Infinity, 0)]) {
		assert.throws(() => g.enclosing(r), (e) => e instanceof TypeError && e.message.startsWith("enclosing"), JSON.stringify(r));
	}
});

test("SG2, SG9: enclosing equals the exact oracle over random grids, edge-targeted rects, and draw's wrap counterexample", () => {
	const rnd = seededRandom(91);
	const { int, pick } = randomTools(rnd);
	let checked = 0;
	for (let n = 0; n < 2500; n++) {
		const d = randomDeclaration(rnd);
		const g = open(d);
		for (let i = 0; i < 30; i++) {
			const x = aimedCoordinate(rnd, d.pitch, d.origin.x), y = aimedCoordinate(rnd, d.pitch, d.origin.y);
			const w = pick([0, rnd() * d.pitch * 3, d.pitch * int(0, 3), 2 ** -int(1, 50)]), h = pick([0, rnd() * d.pitch * 3, d.pitch * int(0, 3)]);
			const r = rect(x, y, w, h);
			assert.deepStrictEqual(g.enclosing(r), exactEnclosing(d, r), `${JSON.stringify(d)} ${JSON.stringify(r)}`);
			checked++;
		}
	}
	const z = open({ shape: "square", pitch: 60, origin: { x: 30, y: 30 } });
	assert.deepStrictEqual(z.enclosing(rect(-30.000000000000004, 0, 0, 0)), block(-2, -1, -1, 0));
	assert.equal(Math.floor((-30.000000000000004 - 30) / 60), -1, "the naive floor gives the smaller block, which misses the rect");
	assert.deepStrictEqual(z.enclosing(rect(-L, -L, 0, 0)), block(-18764998447377, -18764998447377, -18764998447377, -18764998447377));
	assert.ok(checked === 75000);
});

test("SG9: each answer is fresh, frozen, and holds no -0", () => {
	const g = open({ shape: "square", pitch: 60, origin: { x: 0, y: 0 } });
	const r = rect(-0, -0, 0, 0);
	const a = g.enclosing(r);
	assert.deepStrictEqual(a, block(0, 0, 0, 0));
	assert.ok(!holdsNegativeZero(a));
	assert.ok(!holdsNegativeZero(g.enclosing(rect(-1e-300, -10, 1e-300, 0))));
	assert.ok(isFrozenToDepth(a));
	assert.notEqual(g.enclosing(r), a);
	assert.ok(!Object.isFrozen(r));
});
