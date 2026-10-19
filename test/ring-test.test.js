// ring-test - the test shape's own tests (the design's appendix C): what the kit cannot check through the
// port, proved against ring-test's own definitions -- nearest among every position, completeness and order
// in view, the smallest spans -- and its declaration refused as SG1 refuses.
import assert from "node:assert/strict";
import { test } from "node:test";

import { openGrid } from "@apnex/snap-grid";
import { isFrozenToDepth } from "./support/answers.js";
import { seededRandom } from "./support/doubles.js";
import { ringTest } from "./fixtures/ring-test.js";

const DECLARATION = { shape: "ring-test", centre: { x: 5, y: -7 }, radius: 100, slots: 12 };
const open = (declaration = DECLARATION) => {
	const r = openGrid(declaration, { shapes: [ringTest] });
	assert.ok(r.ok, JSON.stringify(r.problems));
	return r.grid;
};
const rect = (x, y, w, h) => ({ kind: "rect", x, y, w, h });
const distance = (q, p) => (q.x - p.x) ** 2 + (q.y - p.y) ** 2;

test("ring-test: refused as SG1 refuses, step 7 never applying", () => {
	const problems = (d) => {
		const r = openGrid(d, { shapes: [ringTest] });
		return r.ok ? [] : r.problems.map((p) => [p.pointer, p.problem]);
	};
	assert.deepEqual(problems({ shape: "ring-test" }), [["/centre", "missing-property"], ["/radius", "missing-property"], ["/slots", "missing-property"]]);
	assert.deepEqual(problems({ ...DECLARATION, slots: 2, radius: 2 ** 30 + 1, centre: { x: 0.5, z: 1 }, more: 1 }), [["/centre/y", "missing-property"], ["/centre/x", "invalid-value"], ["/centre/z", "unknown-property"], ["/more", "unknown-property"], ["/radius", "invalid-value"], ["/slots", "invalid-value"]].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1)));
	assert.deepEqual(problems({ ...DECLARATION, slots: 65 }), [["/slots", "invalid-value"]]);
	assert.deepEqual(problems({ ...DECLARATION, slots: 64, radius: 1 }), []);
	assert.deepEqual(problems(null), [["", "not-an-object"]]);
});

test("ring-test: points that are not integers, positions of one index, directions that wrap", () => {
	const g = open();
	assert.deepStrictEqual(g.pointOf({ slot: 0 }), { x: 105, y: -7 });
	assert.ok(!Number.isInteger(g.pointOf({ slot: 1 }).x));
	assert.deepEqual([...g.directions], ["-slot", "+slot"]);
	assert.deepStrictEqual(g.next({ slot: 11 }, "+slot"), { slot: 0 });
	assert.deepStrictEqual(g.next({ slot: 0 }, "-slot"), { slot: 11 });
	assert.equal(g.next({ slot: 12 }, "+slot"), null);
	assert.throws(() => g.pointOf({ slot: 12 }), RangeError);
	assert.equal(g.offers({ slot: -1 }), false);
});

test("ring-test: nearest is nearest among every position, ties to the lower slot, null outside the domain", () => {
	const g = open();
	const points = Array.from({ length: 12 }, (_, slot) => g.pointOf({ slot }));
	const rnd = seededRandom(71);
	for (let i = 0; i < 5000; i++) {
		const q = { x: (rnd() * 2 - 1) * 400, y: (rnd() * 2 - 1) * 400 };
		const least = Math.min(...points.map((p) => distance(q, p)));
		const slot = points.findIndex((p) => distance(q, p) === least);
		assert.deepStrictEqual(g.nearest(q), { slot });
	}
	const centre = { x: 5, y: -7 };
	const least = Math.min(...points.map((p) => distance(centre, p)));
	assert.deepStrictEqual(g.nearest(centre), { slot: points.findIndex((p) => distance(centre, p) === least) }, "the centre is no tie: the rounded distances differ (appendix C)");
	assert.equal(g.nearest({ x: 2 ** 40 + 1, y: 0 }), null);
	assert.equal(g.nearest({ x: NaN, y: 0 }), null);
	assert.notEqual(g.nearest({ x: 2 ** 40, y: 0 }), null);
});

test("ring-test: inView misses no position in the rect, keeps the least stride its rule allows, and orders by slot", () => {
	const g = open();
	const points = Array.from({ length: 12 }, (_, slot) => g.pointOf({ slot }));
	const rnd = seededRandom(72);
	for (let i = 0; i < 2000; i++) {
		const r = rect((rnd() * 2 - 1) * 200, (rnd() * 2 - 1) * 200, rnd() * 300, rnd() * 300);
		const scale = rnd() * 2 + 0.1, minSpacing = rnd() < 0.3 ? 0 : rnd() * 150, max = 1 + Math.floor(rnd() * 12);
		const answer = g.inView({ region: r, scale }, { minSpacing, max });
		const inside = points.map((p, slot) => ({ p, slot })).filter(({ p }) => r.x <= p.x && p.x <= r.x + r.w && r.y <= p.y && p.y <= r.y + r.h);
		const apart = (s) => {
			const kept = inside.filter(({ slot }) => slot % s === 0);
			return kept.every((a, j) => kept.slice(j + 1).every((b) => Math.sqrt(distance(a.p, b.p)) * scale >= minSpacing));
		};
		let s = 1;
		while (!apart(s)) s *= 2;
		while (inside.filter(({ slot }) => slot % s === 0).length > max) s *= 2;
		assert.equal(answer.stride, s);
		assert.deepStrictEqual(answer.positions.map((e) => e.position.slot), inside.filter(({ slot }) => slot % s === 0).map(({ slot }) => slot));
		assert.ok(isFrozenToDepth(answer));
	}
});

test("ring-test: a span's through and covering are the smallest regions of its kinds, by their definitions", () => {
	const g = open();
	const points = Array.from({ length: 12 }, (_, slot) => g.pointOf({ slot }));
	const s = g.span({ slot: 7 }, { slot: 3 });
	assert.deepStrictEqual(s, { through: { kind: "ring-points", from: 3, to: 7 }, covering: { kind: "ring-cells", from: 3, to: 7 } });
	points.forEach((p, slot) => assert.equal(g.regionContains(s.through, p), slot >= 3 && slot <= 7, `slot ${slot}`));
	points.forEach((p, slot) => assert.equal(g.regionContains(s.covering, p), slot >= 3 && slot <= 7, `slot ${slot}`));
	const rnd = seededRandom(73);
	for (let i = 0; i < 2000; i++) {
		const q = { x: (rnd() * 2 - 1) * 300, y: (rnd() * 2 - 1) * 300 };
		const least = Math.min(...points.map((p) => distance(q, p)));
		const cellOf = points.map((p, slot) => slot).filter((slot) => distance(q, points[slot]) === least);
		assert.equal(g.regionContains(s.covering, q), cellOf.some((slot) => slot >= 3 && slot <= 7));
		assert.equal(g.regionContains(s.through, q), false, "a point off every slot is in no through");
	}
});

test("ring-test: enclosing gives a zero-size rect at a slot's point that slot, and every other rect null", () => {
	const g = open();
	const p = g.pointOf({ slot: 4 });
	assert.deepStrictEqual(g.enclosing(rect(p.x, p.y, 0, 0)), { from: { slot: 4 }, to: { slot: 4 } });
	assert.deepStrictEqual(g.enclosing(rect(p.x, p.y, 2 ** -60, 0)), { from: { slot: 4 }, to: { slot: 4 } }, "a size that vanishes in the edge's arithmetic");
	assert.equal(g.enclosing(rect(p.x, p.y, 1, 0)), null);
	assert.equal(g.enclosing(rect(p.x + 1, p.y, 0, 0)), null);
	assert.equal(g.enclosing(rect(-200, -200, 400, 400)), null);
});
