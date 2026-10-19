// next-grid-position - SG7: the offered neighbour of an offered position in a named direction, or none;
// directions frozen and paired with their opposites.
import assert from "node:assert/strict";
import { test } from "node:test";

import { openGrid } from "@apnex/snap-grid";
import { holdsNegativeZero, isFrozenToDepth } from "../support/answers.js";

const open = (declaration) => {
	const r = openGrid(declaration);
	assert.ok(r.ok, JSON.stringify(r.problems));
	return r.grid;
};
const typeError = (fn) => (e) => e instanceof TypeError && e.message.startsWith(fn);
const STEP = { "-x": [-1, 0], "+x": [1, 0], "-y": [0, -1], "+y": [0, 1] };

test("SG7: a square grid's directions are -x, +x, -y and +y, frozen, opposite in pairs", () => {
	const g = open({ shape: "square", pitch: 60, origin: { x: 0, y: 0 } });
	assert.deepEqual([...g.directions], ["-x", "+x", "-y", "+y"]);
	assert.ok(Object.isFrozen(g.directions));
	assert.deepEqual(g.directions.map((d) => g.opposite(d)), ["+x", "-x", "+y", "-y"]);
	for (const d of g.directions) assert.equal(g.opposite(g.opposite(d)), d);
	for (const bad of ["x", "+z", "", null, 1, "constructor", "+X"]) {
		assert.throws(() => g.opposite(bad), typeError("opposite"), String(bad));
		assert.throws(() => g.next({ col: 0, row: 0 }, bad), typeError("next"), String(bad));
	}
});

test("SG7: every direction at every edge and corner of a bounded grid", () => {
	const g = open({ shape: "square", pitch: 60, origin: { x: 30, y: 30 }, bounds: { min: { x: -930, y: -510 }, max: { x: 930, y: 510 } } });
	const [c0, c1, r0, r1] = [-16, 15, -9, 8];
	for (const col of [c0, c0 + 1, 0, c1 - 1, c1]) {
		for (const row of [r0, r0 + 1, 0, r1 - 1, r1]) {
			for (const d of g.directions) {
				const [dc, dr] = STEP[d];
				const n = { col: col + dc, row: row + dr };
				const inside = n.col >= c0 && n.col <= c1 && n.row >= r0 && n.row <= r1;
				const got = g.next({ col, row }, d);
				assert.deepStrictEqual(got, inside ? n : null, `${col},${row} ${d}`);
				if (got) assert.deepStrictEqual(g.next(got, g.opposite(d)), { col, row });
			}
		}
	}
});

test("SG7: from a position that is not offered, next answers null in every direction", () => {
	const g = open({ shape: "square", pitch: 60, origin: { x: 0, y: 0 }, bounds: { min: { x: -900, y: -480 }, max: { x: 900, y: 480 } } });
	for (const d of g.directions) {
		assert.equal(g.next({ col: 16, row: 0 }, d), null);
		assert.equal(g.next({ col: 0, row: -9 }, d), null);
		assert.equal(g.next({ col: 16, row: 9 }, d), null);
	}
	const u = open({ shape: "square", pitch: 1, origin: { x: 0, y: 0 } });
	assert.equal(u.next({ col: 2 ** 50, row: 0 }, "+x"), null);
	assert.deepStrictEqual(u.next({ col: 2 ** 50, row: 0 }, "-x"), { col: 2 ** 50 - 1, row: 0 });
	assert.equal(u.next({ col: 2 ** 50 + 1, row: 0 }, "-x"), null);
	assert.equal(u.next({ col: 0, row: -(2 ** 50) }, "-y"), null);
});

test("SG7: no neighbour holds -0, each is fresh and frozen, and the position is not frozen", () => {
	const g = open({ shape: "square", pitch: 60, origin: { x: 0, y: 0 } });
	const p = { col: -0, row: -0 };
	for (const d of g.directions) {
		const n = g.next(p, d);
		assert.ok(!holdsNegativeZero(n), d);
		assert.ok(isFrozenToDepth(n));
	}
	assert.deepStrictEqual(g.next({ col: -1, row: 0 }, "+x"), { col: 0, row: 0 });
	assert.ok(Object.is(g.next({ col: -1, row: -0 }, "+x").col, 0));
	assert.ok(Object.is(g.next({ col: -1, row: -0 }, "+x").row, 0));
	assert.ok(!Object.isFrozen(p));
	assert.notEqual(g.next(p, "+x"), g.next(p, "+x"));
});
