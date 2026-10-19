// grid-position-span - SG8: the region a block runs through and the region its cells cover, and whether a
// region holds a point.
import assert from "node:assert/strict";
import { test } from "node:test";

import { openGrid } from "@apnex/snap-grid";
import { holdsNegativeZero, isFrozenToDepth } from "../support/answers.js";
import { nextDown, nextUp, randomDeclaration, randomTools, seededRandom } from "../support/doubles.js";
import { exactIndices } from "../support/oracle.js";

const L = 2 ** 50;
const open = (declaration) => {
	const r = openGrid(declaration);
	assert.ok(r.ok, JSON.stringify(r.problems));
	return r.grid;
};
const rect = (x, y, w, h) => ({ kind: "rect", x, y, w, h });

test("SG8: through and covering, in both orders", () => {
	const g = open({ shape: "square", pitch: 60, origin: { x: 30, y: 30 } });
	const expected = { through: rect(-90, -30, 180, 120), covering: rect(-120, -60, 240, 180) };
	assert.deepStrictEqual(g.span({ col: -2, row: 1 }, { col: 1, row: -1 }), expected);
	assert.deepStrictEqual(g.span({ col: 1, row: -1 }, { col: -2, row: 1 }), expected);
	assert.deepStrictEqual(g.span({ col: -2, row: -1 }, { col: 1, row: 1 }), expected);
});

test("SG8: span(p, p) is p's point with no size, and p's cell", () => {
	const g = open({ shape: "square", pitch: 7, origin: { x: -3, y: 2 } });
	assert.deepStrictEqual(g.span({ col: 2, row: -1 }, { col: 2, row: -1 }), { through: rect(11, -5, 0, 0), covering: rect(7.5, -8.5, 7, 7) });
	const z = open({ shape: "square", pitch: 60, origin: { x: 0, y: 0 } });
	const s = z.span({ col: -0, row: -0 }, { col: 0, row: 0 });
	assert.deepStrictEqual(s, { through: rect(0, 0, 0, 0), covering: rect(-30, -30, 60, 60) });
	assert.ok(!holdsNegativeZero(s));
	assert.ok(!holdsNegativeZero(z.span({ col: -0, row: 0 }, { col: 0, row: -0 })));
	assert.ok(isFrozenToDepth(s));
});

test("SG8: spans at the domain's corners are exact; one past the domain is a RangeError", () => {
	const u = open({ shape: "square", pitch: 1, origin: { x: 0, y: 0 } });
	assert.deepStrictEqual(u.span({ col: -L, row: -L }, { col: L, row: L }), { through: rect(-L, -L, 2 * L, 2 * L), covering: rect(-L - 0.5, -L - 0.5, 2 * L + 1, 2 * L + 1) });
	const z = open({ shape: "square", pitch: 60, origin: { x: 30, y: 30 } });
	const top = Number(exactIndices(L, 30, 60).floor), bottom = Number(exactIndices(-L, 30, 60).ceil);
	assert.deepStrictEqual(z.span({ col: top, row: top }, { col: bottom, row: bottom }).through, rect(bottom * 60 + 30, bottom * 60 + 30, (top - bottom) * 60, (top - bottom) * 60));
	const shifted = open({ shape: "square", pitch: 1, origin: { x: L, y: -L } });
	assert.deepStrictEqual(shifted.span({ col: 0, row: 0 }, { col: -(2 ** 51), row: 2 ** 51 }), { through: rect(-L, -L, 2 ** 51, 2 ** 51), covering: rect(-L - 0.5, -L - 0.5, 2 ** 51 + 1, 2 ** 51 + 1) });
	assert.throws(() => z.span({ col: top + 1, row: 0 }, { col: 0, row: 0 }), (e) => e instanceof RangeError && e.message.startsWith("span"));
	assert.throws(() => z.span({ col: 0, row: 0 }, { col: 0, row: bottom - 1 }), (e) => e instanceof RangeError && e.message.startsWith("span"));
	const odd = open({ shape: "square", pitch: 2 ** 50 - 1, origin: { x: 1, y: 0 } });
	assert.deepStrictEqual(odd.span({ col: 1, row: -1 }, { col: 1, row: -1 }).covering, rect(2 ** 50 - (2 ** 50 - 1) / 2, -(2 ** 50 - 1) - (2 ** 50 - 1) / 2, 2 ** 50 - 1, 2 ** 50 - 1));
});

test("SG8: span is exact over random representable blocks", () => {
	const rnd = seededRandom(81);
	const { int } = randomTools(rnd);
	for (let n = 0; n < 1500; n++) {
		const d = randomDeclaration(rnd);
		const g = open(d);
		const [cl, ch] = [exactIndices(-L, d.origin.x, d.pitch).ceil, exactIndices(L, d.origin.x, d.pitch).floor].map(Number);
		const [rl, rh] = [exactIndices(-L, d.origin.y, d.pitch).ceil, exactIndices(L, d.origin.y, d.pitch).floor].map(Number);
		const pick = (lo, hi) => (int(0, 4) === 0 ? (int(0, 1) ? hi : lo) : lo + Math.floor(rnd() * (hi - lo + 1)));
		for (let i = 0; i < 10; i++) {
			const a = { col: pick(cl, ch), row: pick(rl, rh) }, b = { col: pick(cl, ch), row: pick(rl, rh) };
			const s = g.span(a, b);
			const p = BigInt(d.pitch);
			const x0 = BigInt(Math.min(a.col, b.col)) * p + BigInt(d.origin.x), y0 = BigInt(Math.min(a.row, b.row)) * p + BigInt(d.origin.y);
			const w = BigInt(Math.abs(a.col - b.col)) * p, h = BigInt(Math.abs(a.row - b.row)) * p;
			assert.deepEqual([s.through.x, s.through.y, s.through.w, s.through.h].map(BigInt), [x0, y0, w, h]);
			assert.deepEqual([s.covering.x * 2, s.covering.y * 2, s.covering.w, s.covering.h].map(BigInt), [2n * x0 - p, 2n * y0 - p, w + p, h + p]);
			assert.deepStrictEqual(g.span(b, a), s);
		}
	}
});

test("SG8: regionContains on each edge and just beyond it, the edges as binary64 computes them", () => {
	const g = open({ shape: "square", pitch: 60, origin: { x: 0, y: 0 } });
	const r = rect(-30.5, 10, 61, 0.1);
	const right = -30.5 + 61, bottom = 10 + 0.1;
	for (const [x, y, inside] of [
		[-30.5, 10, true],
		[right, bottom, true],
		[0, 10.05, true],
		[nextDown(-30.5), 10, false],
		[nextUp(right), 10, false],
		[0, nextDown(10), false],
		[0, nextUp(bottom), false],
		[NaN, 10, false],
		[Infinity, 10, false],
	]) {
		assert.equal(g.regionContains(r, { x, y }), inside, `${x}, ${y}`);
	}
	const tiny = rect(1, 0, 2 ** -60, 0);
	assert.equal(1 + 2 ** -60, 1, "the edge as binary64 computes it is x itself");
	assert.equal(g.regionContains(tiny, { x: 1, y: 0 }), true);
	assert.equal(g.regionContains(tiny, { x: nextUp(1), y: 0 }), false);
	assert.equal(g.regionContains(rect(0, 0, NaN, 0), { x: 0, y: 0 }), false);
	assert.equal(g.regionContains(rect(-Infinity, 0, Infinity, 0), { x: 0, y: 0 }), false);
	assert.equal(g.regionContains(rect(-Infinity, 0, 0, 0), { x: -Infinity, y: 0 }), true);
	const s = g.span({ col: -1, row: 0 }, { col: 1, row: 1 });
	assert.equal(g.regionContains(s.through, { x: 60, y: 60 }), true);
	assert.equal(g.regionContains(s.covering, { x: 90, y: -30 }), true);
	assert.equal(g.regionContains(s.covering, { x: 90.0000001, y: -30 }), false);
	for (const bad of [{ kind: "ring-points", from: 0, to: 1 }, { kind: "rect", x: 0, y: 0, w: -1, h: 0 }, { x: 0, y: 0, w: 1, h: 1 }]) {
		assert.throws(() => g.regionContains(bad, { x: 0, y: 0 }), (e) => e instanceof TypeError && e.message.startsWith("regionContains"));
	}
});
