// grid-position-point - SG4, with SG2's offered ranges: the point any representable position lies at,
// the offered range's endpoints, and the domain's edge.
import assert from "node:assert/strict";
import { test } from "node:test";

import { openGrid } from "@apnex/snap-grid";
import { holdsNegativeZero, isFrozenToDepth } from "../support/answers.js";
import { randomDeclaration, randomTools, seededRandom } from "../support/doubles.js";
import { exactIndices, exactPointOf, offeredRange } from "../support/oracle.js";

const L = 2 ** 50;
const open = (declaration) => {
	const r = openGrid(declaration);
	assert.ok(r.ok, JSON.stringify(r.problems));
	return r.grid;
};
const rangeError = (fn) => (e) => e instanceof RangeError && e.message.startsWith(fn);
const typeError = (fn) => (e) => e instanceof TypeError && e.message.startsWith(fn);

test("SG4: pointOf is col * pitch + origin.x, row * pitch + origin.y, on both signs, never -0", () => {
	const g = open({ shape: "square", pitch: 60, origin: { x: 30, y: -30 } });
	assert.deepStrictEqual(g.pointOf({ col: 0, row: 0 }), { x: 30, y: -30 });
	assert.deepStrictEqual(g.pointOf({ col: -1, row: 1 }), { x: -30, y: 30 });
	assert.deepStrictEqual(g.pointOf({ col: -0, row: -0 }), { x: 30, y: -30 });
	const z = open({ shape: "square", pitch: 60, origin: { x: 0, y: 0 } });
	assert.ok(!holdsNegativeZero(z.pointOf({ col: -0, row: -0 })));
	assert.deepStrictEqual(z.pointOf({ col: -0, row: -0 }), { x: 0, y: 0 });
});

test("SG2, SG4: a representable position beyond the bounds has a point, and is not offered", () => {
	const g = open({ shape: "square", pitch: 60, origin: { x: 0, y: 0 }, bounds: { min: { x: -900, y: -480 }, max: { x: 900, y: 480 } } });
	assert.deepStrictEqual(g.pointOf({ col: 16, row: -9 }), { x: 960, y: -540 });
	assert.equal(g.offers({ col: 16, row: 0 }), false);
	assert.equal(g.offers({ col: 0, row: -9 }), false);
	assert.equal(g.offers({ col: 15, row: -8 }), true);
	assert.deepStrictEqual(g.pointOf({ col: 10 ** 12, row: 0 }), { x: 6e13, y: 0 });
});

test("SG2: the offered range's endpoints on both signs, with bounds off the lattice", () => {
	const cases = [
		[{ x: 0, y: 0 }, { min: { x: -100, y: -100 }, max: { x: 100, y: 100 } }, [-1, 1], [-1, 1]],
		[{ x: 30, y: 30 }, { min: { x: -100, y: -31 }, max: { x: 100, y: 29 } }, [-2, 1], [-1, -1]],
		[{ x: -7, y: 11 }, { min: { x: -67, y: 11 }, max: { x: 52, y: 11 } }, [-1, 0], [0, 0]],
		[{ x: 0, y: 0 }, { min: { x: 1, y: -119 }, max: { x: 60, y: -60 } }, [1, 1], [-1, -1]],
	];
	for (const [origin, b, cols, rows] of cases) {
		const g = open({ shape: "square", pitch: 60, origin, bounds: b });
		for (const [axis, [lo, hi]] of [["col", cols], ["row", rows]]) {
			const at = (i) => (axis === "col" ? { col: i, row: rows[0] } : { col: cols[0], row: i });
			assert.equal(g.offers(at(lo)), true, `${JSON.stringify(b)} ${axis} ${lo}`);
			assert.equal(g.offers(at(hi)), true, `${JSON.stringify(b)} ${axis} ${hi}`);
			assert.equal(g.offers(at(lo - 1)), false, `${JSON.stringify(b)} ${axis} ${lo - 1}`);
			assert.equal(g.offers(at(hi + 1)), false, `${JSON.stringify(b)} ${axis} ${hi + 1}`);
		}
	}
});

test("SG2: with no bounds the offered range is the domain's, its endpoints exact, near 2^50 and at 2^51", () => {
	const rnd = seededRandom(41);
	const { int } = randomTools(rnd);
	const declarations = [
		{ shape: "square", pitch: 1, origin: { x: 0, y: 0 } },
		{ shape: "square", pitch: 1, origin: { x: L, y: -L } },
		{ shape: "square", pitch: 60, origin: { x: 30, y: 30 } },
		{ shape: "square", pitch: L, origin: { x: -L, y: L } },
		{ shape: "square", pitch: 3, origin: { x: L - 1, y: -(L - 2) } },
	];
	for (let i = 0; i < 300; i++) declarations.push(randomDeclaration(rnd, { bounds: int(0, 1) === 1 }));
	for (const d of declarations) {
		const g = open(d);
		for (const axis of ["x", "y"]) {
			const [lo, hi] = offeredRange(d, axis).map(Number);
			const at = (i) => (axis === "x" ? { col: i, row: Number(offeredRange(d, "y")[0]) } : { col: Number(offeredRange(d, "x")[0]), row: i });
			assert.equal(g.offers(at(lo)), true);
			assert.equal(g.offers(at(hi)), true);
			assert.equal(g.offers(at(lo - 1)), false);
			assert.equal(g.offers(at(hi + 1)), false);
			assert.ok(Math.abs(lo) < 2 ** 52 && Math.abs(hi) < 2 ** 52);
		}
	}
	const unit = open({ shape: "square", pitch: 1, origin: { x: L, y: -L } });
	assert.equal(unit.offers({ col: -(2 ** 51), row: 2 ** 51 }), true);
	assert.deepStrictEqual(unit.pointOf({ col: -(2 ** 51), row: 2 ** 51 }), { x: -L, y: L });
});

test("SG4: the domain's edge, and one unit past it, a RangeError", () => {
	const g = open({ shape: "square", pitch: 1, origin: { x: 0, y: 0 } });
	assert.deepStrictEqual(g.pointOf({ col: L, row: -L }), { x: L, y: -L });
	assert.throws(() => g.pointOf({ col: L + 1, row: 0 }), rangeError("pointOf"));
	assert.throws(() => g.pointOf({ col: 0, row: -L - 1 }), rangeError("pointOf"));
	const z = open({ shape: "square", pitch: 60, origin: { x: 30, y: 30 } });
	const top = Number(exactIndices(L, 30, 60).floor), bottom = Number(exactIndices(-L, 30, 60).ceil);
	assert.deepStrictEqual(z.pointOf({ col: top, row: bottom }), { x: top * 60 + 30, y: bottom * 60 + 30 });
	assert.throws(() => z.pointOf({ col: top + 1, row: 0 }), rangeError("pointOf"));
	assert.throws(() => z.pointOf({ col: 0, row: bottom - 1 }), rangeError("pointOf"));
	assert.throws(() => z.pointOf({ col: Number.MAX_SAFE_INTEGER, row: 0 }), rangeError("pointOf"));
	assert.throws(() => z.pointOf({ col: 2 ** 53, row: 0 }), typeError("pointOf"));
	assert.throws(() => z.pointOf({ col: 0.5, row: 0 }), typeError("pointOf"));
	assert.equal(z.offers({ col: top + 1, row: 0 }), false);
});

test("SG4: pointOf equals the exact point over random representable positions", () => {
	const rnd = seededRandom(42);
	const { int, sign } = randomTools(rnd);
	for (let n = 0; n < 2000; n++) {
		const d = randomDeclaration(rnd);
		const g = open(d);
		const [cl, ch] = [exactIndices(-L, d.origin.x, d.pitch).ceil, exactIndices(L, d.origin.x, d.pitch).floor].map(Number);
		const [rl, rh] = [exactIndices(-L, d.origin.y, d.pitch).ceil, exactIndices(L, d.origin.y, d.pitch).floor].map(Number);
		for (let i = 0; i < 20; i++) {
			const pick = (lo, hi) => (int(0, 3) === 0 ? (sign() > 0 ? hi : lo) : lo + Math.floor(rnd() * (hi - lo + 1)));
			const position = { col: pick(cl, ch), row: pick(rl, rh) };
			const exact = exactPointOf(d, position);
			const got = g.pointOf(position);
			assert.equal(BigInt(got.x), exact.x);
			assert.equal(BigInt(got.y), exact.y);
			assert.ok(isFrozenToDepth(got));
		}
	}
});

test("SG2: offers answers only for a well-formed position", () => {
	const g = open({ shape: "square", pitch: 60, origin: { x: 0, y: 0 } });
	for (const bad of [null, {}, { col: 0 }, { col: 0, row: 0, z: 0 }, { col: "0", row: 0 }, { col: 2 ** 53, row: 0 }, [0, 0], Object.create({ col: 0, row: 0 })]) {
		assert.throws(() => g.offers(bad), typeError("offers"), JSON.stringify(bad));
	}
	assert.equal(g.offers({ col: Number.MAX_SAFE_INTEGER, row: 0 }), false);
});
