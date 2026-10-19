// nearest-grid-position - SG3, with SG2's exactness: the offered position nearest a point, held to an
// exact rational oracle over random and edge-targeted points.
import assert from "node:assert/strict";
import { test } from "node:test";

import { openGrid } from "@apnex/snap-grid";
import { holdsNegativeZero, isFrozenToDepth } from "../support/answers.js";
import { aimedCoordinate, nextDown, nextUp, randomDeclaration, randomTools, seededRandom } from "../support/doubles.js";
import { exactNearest } from "../support/oracle.js";

const L = 2 ** 50;
const open = (declaration) => {
	const r = openGrid(declaration);
	assert.ok(r.ok, JSON.stringify(r.problems));
	return r.grid;
};
const bounds = (x, y) => ({ min: { x: -x, y: -y }, max: { x, y } });
const lattice0 = { shape: "square", pitch: 60, origin: { x: 0, y: 0 } };
const lattice30 = { shape: "square", pitch: 60, origin: { x: 30, y: 30 } };
const nearestX = (grid, x) => grid.nearest({ x, y: 0 }).col;

test("SG3: ties go toward the greater, on both signs, and no index is -0", () => {
	const g0 = open(lattice0);
	assert.equal(nearestX(g0, 30), 1);
	assert.equal(nearestX(g0, 90), 2);
	assert.ok(Object.is(nearestX(g0, -30), 0));
	assert.equal(nearestX(g0, -90), -1);
	assert.equal(nearestX(g0, nextDown(30)), 0);
	assert.ok(Object.is(nearestX(g0, nextUp(-30)), 0));
	assert.equal(nearestX(g0, nextDown(-30)), -1);
	const g30 = open(lattice30);
	assert.equal(nearestX(g30, 0), 0);
	assert.equal(nearestX(g30, 60), 1);
	assert.equal(nearestX(g30, -60), -1);
	assert.equal(nearestX(g30, -0), 0);
	assert.ok(Object.is(nearestX(g30, -0), 0));
	assert.equal(nearestX(g30, -Number.MIN_VALUE), -1);
	const unit = open({ shape: "square", pitch: 1, origin: { x: 0, y: 0 } });
	for (const [v, i] of [[0.5, 1], [-0.5, 0], [1.5, 2], [-1.5, -1], [2.5, 3], [-2.5, -2]]) assert.ok(Object.is(nearestX(unit, v), i), `${v} -> ${i}`);
	for (const v of [-0, -1e-300, -0.4, -Number.MIN_VALUE]) {
		assert.ok(!holdsNegativeZero(g0.nearest({ x: v, y: v })), `${v}`);
		assert.ok(!holdsNegativeZero(unit.nearest({ x: v, y: v })), `${v}`);
	}
});

test("SG3: clamping on every side and at every corner", () => {
	const g = open({ ...lattice30, bounds: bounds(930, 510) });
	const cases = [
		[{ x: 5000, y: 0 }, { col: 15, row: 0 }],
		[{ x: -5000, y: 0 }, { col: -16, row: 0 }],
		[{ x: 0, y: 5000 }, { col: 0, row: 8 }],
		[{ x: 0, y: -5000 }, { col: 0, row: -9 }],
		[{ x: L, y: L }, { col: 15, row: 8 }],
		[{ x: -L, y: L }, { col: -16, row: 8 }],
		[{ x: L, y: -L }, { col: 15, row: -9 }],
		[{ x: -L, y: -L }, { col: -16, row: -9 }],
		[{ x: 931, y: -511 }, { col: 15, row: -9 }],
		[{ x: 930, y: 510 }, { col: 15, row: 8 }],
	];
	for (const [point, position] of cases) assert.deepStrictEqual(g.nearest(point), position, JSON.stringify(point));
	assert.deepStrictEqual(g.pointOf(g.nearest({ x: 5000, y: -5000 })), { x: 930, y: -510 });
	const off = open({ shape: "square", pitch: 60, origin: { x: 0, y: 0 }, bounds: { min: { x: -100, y: -100 }, max: { x: 100, y: 100 } } });
	assert.deepStrictEqual(off.nearest({ x: 99, y: -99 }), { col: 1, row: -1 });
	assert.deepStrictEqual(off.nearest({ x: 1000, y: -1000 }), { col: 1, row: -1 });
});

test("SG3: a coordinate not finite, or outside the domain, answers null", () => {
	const g = open(lattice0);
	for (const v of [NaN, Infinity, -Infinity, nextUp(L), nextDown(-L), 2 ** 51, 2 ** 53, -1e300, Number.MAX_VALUE]) {
		assert.equal(g.nearest({ x: v, y: 0 }), null, `x ${v}`);
		assert.equal(g.nearest({ x: 0, y: v }), null, `y ${v}`);
	}
	assert.notEqual(g.nearest({ x: L, y: -L }), null);
	const bounded = open({ ...lattice0, bounds: bounds(900, 480) });
	assert.equal(bounded.nearest({ x: Infinity, y: 0 }), null);
	assert.equal(bounded.nearest({ x: L + 1, y: 0 }), null);
});

test("SG2, SG3: the counterexamples of the design's section 10.2 answer exactly", () => {
	const g = open(lattice30);
	assert.deepStrictEqual(g.nearest({ x: -60 - 2 ** -47, y: 0 }), { col: -2, row: 0 });
	assert.deepStrictEqual(g.pointOf(g.nearest({ x: -60 - 2 ** -47, y: 0 })), { x: -90, y: 30 });
	assert.equal(Math.round((-60 - 2 ** -47 - 30) / 60), -1, "the naive formula gives the farther position");
	assert.deepStrictEqual(g.nearest({ x: 2 ** 50, y: 0 }), { col: 18764998447376, row: 0 });
	assert.deepStrictEqual(g.pointOf({ col: 18764998447376, row: 0 }), { x: 1125899906842590, y: 30 });
	const far = open({ shape: "square", pitch: 2 ** 50, origin: { x: -(2 ** 50), y: 2 ** 50 } });
	assert.deepStrictEqual(far.nearest({ x: 2 ** 50, y: -(2 ** 50) }), { col: 2, row: -2 });
	const unit = open({ shape: "square", pitch: 1, origin: { x: 2 ** 50, y: -(2 ** 50) } });
	assert.deepStrictEqual(unit.nearest({ x: -(2 ** 50), y: 2 ** 50 }), { col: -(2 ** 51), row: 2 ** 51 });
});

test("SG2, SG3: nearest equals the exact oracle over random grids and edge-targeted points", () => {
	const rnd = seededRandom(31);
	let checked = 0;
	for (let g = 0; g < 2500; g++) {
		const declaration = randomDeclaration(rnd);
		const grid = open(declaration);
		for (let i = 0; i < 60; i++) {
			const point = { x: aimedCoordinate(rnd, declaration.pitch, declaration.origin.x), y: aimedCoordinate(rnd, declaration.pitch, declaration.origin.y) };
			const got = grid.nearest(point);
			assert.deepStrictEqual(got, exactNearest(declaration, point), `${JSON.stringify(declaration)} at ${point.x}, ${point.y}`);
			checked++;
		}
	}
	assert.equal(checked, 150000);
});

test("SG2, SG3: nearest equals the exact oracle on draw's grids, at translated origins near 2^50, and at tiny pitches", () => {
	const rnd = seededRandom(32);
	const { int, sign } = randomTools(rnd);
	const grids = [
		lattice0,
		lattice30,
		{ ...lattice0, bounds: bounds(900, 480) },
		{ ...lattice30, bounds: bounds(930, 510) },
		{ shape: "square", pitch: 7, origin: { x: L - 3, y: -(L - 5) } },
		{ shape: "square", pitch: 1, origin: { x: L, y: -L } },
		{ shape: "square", pitch: 3, origin: { x: -L + 1, y: L - 1 } },
		{ shape: "square", pitch: L, origin: { x: L, y: -L } },
		{ shape: "square", pitch: L - 1, origin: { x: 1, y: -1 } },
		{ shape: "square", pitch: 60, origin: { x: L - 30, y: -(L - 30) }, bounds: { min: { x: L - 1000, y: -L }, max: { x: L, y: -(L - 1000) } } },
	];
	for (const declaration of grids) {
		const grid = open(declaration);
		for (let i = 0; i < 6000; i++) {
			const near = sign() * (L - int(0, 4 * declaration.pitch)) + (rnd() < 0.5 ? 0 : sign() * 2 ** -int(1, 3));
			const x = i % 3 === 0 ? Math.max(-L, Math.min(L, near)) : aimedCoordinate(rnd, declaration.pitch, declaration.origin.x);
			const y = aimedCoordinate(rnd, declaration.pitch, declaration.origin.y);
			assert.deepStrictEqual(grid.nearest({ x, y }), exactNearest(declaration, { x, y }), `${JSON.stringify(declaration)} at ${x}, ${y}`);
		}
	}
});

test("SG3: every answer is fresh and frozen, and the point is neither frozen nor kept", () => {
	const g = open(lattice0);
	const point = { x: 61, y: -29 };
	const a = g.nearest(point), b = g.nearest(point);
	assert.notEqual(a, b);
	assert.ok(isFrozenToDepth(a));
	assert.ok(!Object.isFrozen(point));
	assert.deepEqual(Object.keys(a), ["col", "row"]);
});
