// grid-shape-conformance - SG11: the kit, checkGridShape, proved in both directions: square and ring-test
// pass it over good cases, and deliberately broken shapes fail it with exactly the failures SG11 names.
import assert from "node:assert/strict";
import { test } from "node:test";

import { openGrid, square } from "@apnex/snap-grid";
import { checkGridShape } from "@apnex/snap-grid/conformance";
import { isFrozenToDepth } from "../support/answers.js";
import { ringTest } from "../fixtures/ring-test.js";

const rect = (x, y, w, h) => ({ kind: "rect", x, y, w, h });

/** A point of another prototype, its x and y read through getters, as a DOMPoint's are. */
class PointLike {
	#x;
	#y;
	constructor(x, y) {
		this.#x = x;
		this.#y = y;
	}
	get x() {
		return this.#x;
	}
	get y() {
		return this.#y;
	}
}

// offered columns -3 to 2 (points -150 to 150), rows -2 to 1 (points -90 to 90)
const DECLARATION = { shape: "square", pitch: 60, origin: { x: 30, y: 30 }, bounds: { min: { x: -150, y: -90 }, max: { x: 150, y: 90 } } };
const P1 = { x: -60 - 2 ** -47, y: 0 };
const POINTS = [P1, { x: 0, y: 0 }, { x: 31, y: -29 }, { x: -0, y: -1e-300 }, { x: 1000, y: -1000 }, { x: NaN, y: 0 }, { x: 2 ** 51, y: 0 }, new PointLike(45, 45)];
const POS = [{ col: 0, row: 0 }, { col: -3, row: -2 }, { col: 2, row: 1 }, { col: 5, row: 0 }, { col: -1, row: 1 }];
const WHOLE = rect(-150, -90, 300, 180);
const VIEWS = [{ view: { region: WHOLE, scale: 1 } }, { view: { region: WHOLE, scale: 1 }, options: { minSpacing: 100 } }, { view: { region: WHOLE, scale: 1 }, options: { max: 2 } }, { view: { region: rect(-30, -30, 0, 0), scale: 2 }, options: { minSpacing: 0 } }];
const BLOCKS = [[{ col: -3, row: -2 }, { col: 2, row: 1 }], [{ col: 0, row: 0 }, { col: 0, row: 0 }], [{ col: 5, row: 0 }, { col: -1, row: 1 }]];
const R4 = rect(-60 - 2 ** -47, 0, 1, 1);
const RECTS = [WHOLE, rect(-10, -10, 20, 20), rect(30, 30, 0, 0), R4];
const squareCase = (name = "bounded") => ({ name, declaration: DECLARATION, points: POINTS, positions: POS, views: VIEWS, blocks: BLOCKS, rects: RECTS });

/** The parts of each failure SG11 makes part of the contract. */
const listed = (failures) => failures.map((f) => ({ invariant: f.invariant, case: f.case, args: f.args }));
/** An argument as the kit writes it in a failure: a point of another prototype as its x and y. */
const asArg = (v) => (v instanceof PointLike ? { x: v.x, y: v.y } : v);

/** A broken shape: square, with some of its grid's members replaced. */
function mutant(name, change) {
	return Object.freeze({
		name,
		open(declaration) {
			const r = square.open(declaration);
			if (!r.ok) return r;
			return Object.freeze({ ok: true, grid: Object.freeze({ ...r.grid, ...change(r.grid) }) });
		},
	});
}

test("SG11: square keeps every kit invariant over good cases, bounded and not, draw's grids among them", () => {
	const unbounded = { name: "unbounded", declaration: { shape: "square", pitch: 7, origin: { x: -3, y: 2 } }, points: [...POINTS, { x: 2 ** 50, y: -(2 ** 50) }, { x: 3.5, y: -1.5 }], positions: [{ col: 2 ** 47, row: -(2 ** 47) }, ...POS], views: VIEWS, blocks: BLOCKS, rects: [...RECTS, rect(-(2 ** 50) + 4, -(2 ** 50) + 6, 2 ** 51 - 8, 2 ** 51 - 12)] };
	const grids = [
		{ shape: "square", pitch: 60, origin: { x: 0, y: 0 }, bounds: { min: { x: -900, y: -480 }, max: { x: 900, y: 480 } } },
		{ shape: "square", pitch: 60, origin: { x: 30, y: 30 }, bounds: { min: { x: -930, y: -510 }, max: { x: 930, y: 510 } } },
		{ shape: "square", pitch: 60, origin: { x: 0, y: 0 } },
		{ shape: "square", pitch: 60, origin: { x: 30, y: 30 } },
	].map((declaration, i) => ({ name: `grid ${i}`, declaration, points: POINTS, positions: POS, views: VIEWS, blocks: BLOCKS, rects: RECTS }));
	const failures = checkGridShape(square, [squareCase(), unbounded, ...grids]);
	assert.deepEqual(failures, []);
	assert.ok(Object.isFrozen(failures));
});

test("SG11: ring-test keeps every kit invariant, through the same port and kit", () => {
	const opened = openGrid({ shape: "ring-test", centre: { x: 3, y: -2 }, radius: 10, slots: 6 }, { shapes: [ringTest] });
	assert.ok(opened.ok);
	const g = opened.grid;
	const slotPoints = [0, 1, 2, 3, 4, 5].map((slot) => g.pointOf({ slot }));
	const cases = [
		{
			name: "six slots",
			declaration: { shape: "ring-test", centre: { x: 3, y: -2 }, radius: 10, slots: 6 },
			points: [...slotPoints, { x: 3, y: -2 }, { x: 20, y: 0 }, { x: -7.25, y: 1.5 }, { x: NaN, y: 0 }, { x: 2 ** 41, y: 0 }, new PointLike(8, 6.6)],
			positions: [0, 1, 2, 3, 4, 5].map((slot) => ({ slot })),
			views: [{ view: { region: rect(-10, -15, 30, 30), scale: 1 } }, { view: { region: rect(-10, -15, 30, 30), scale: 1 }, options: { minSpacing: 15 } }, { view: { region: rect(-10, -15, 30, 30), scale: 1 }, options: { max: 1 } }, { view: { region: rect(0, -20, 20, 40), scale: 0.5 } }],
			blocks: [[{ slot: 0 }, { slot: 3 }], [{ slot: 4 }, { slot: 1 }], [{ slot: 5 }, { slot: 5 }]],
			rects: slotPoints.map((p) => rect(p.x, p.y, 0, 0)),
		},
		{ name: "three slots", declaration: { shape: "ring-test", centre: { x: 0, y: 0 }, radius: 1, slots: 3 }, points: [{ x: 0.1, y: 0 }], positions: [{ slot: 2 }], views: [], blocks: [[{ slot: 0 }, { slot: 2 }]], rects: [rect(1, 0, 0, 0)] },
	];
	assert.deepEqual(checkGridShape(ringTest, cases), []);
});

test("SG11: a declaration the shape refuses is the case's one failure, and the next case is still judged", () => {
	const refused = { ...squareCase("refused"), declaration: { shape: "square", pitch: 0, origin: { x: 0, y: 0 } } };
	const failures = checkGridShape(square, [refused, squareCase()]);
	assert.deepEqual(failures, [{ invariant: "open", case: "refused", args: [{ shape: "square", pitch: 0, origin: { x: 0, y: 0 } }], got: [{ pointer: "/pitch", problem: "invalid-value" }] }]);
	const throwing = Object.freeze({ name: "throws", open: () => { throw new Error("no"); } });
	assert.deepEqual(checkGridShape(throwing, [squareCase()]), [{ invariant: "open", case: "bounded", args: [DECLARATION], got: { thrown: "no" } }]);
});

test("SG11: a nearest that rounds before it divides fails I2 at the point where a neighbour is strictly nearer", () => {
	const naive = mutant("naive", (g) => ({
		nearest(q) {
			const d = g.declaration;
			const round = (v, o, lo, hi) => Math.min(Math.max(Math.round((v - o) / d.pitch), lo), hi) + 0;
			return Number.isFinite(q.x) && Number.isFinite(q.y) && Math.abs(q.x) <= 2 ** 50 && Math.abs(q.y) <= 2 ** 50 ? Object.freeze({ col: round(q.x, 30, -3, 2), row: round(q.y, 30, -2, 1) }) : null;
		},
	}));
	const failures = checkGridShape(naive, [squareCase()]);
	assert.deepEqual(listed(failures), [{ invariant: "I2", case: "bounded", args: [P1] }]);
	assert.deepEqual(failures[0].got, { nearest: { col: -1, row: 0 }, nearer: { col: -2, row: 0 } });
});

test("SG11: an unfrozen answer fails I7 for each call of the schedule that returns it", () => {
	const unfrozen = mutant("unfrozen", (g) => ({ pointOf: (p) => ({ ...g.pointOf(p) }) }));
	assert.deepEqual(listed(checkGridShape(unfrozen, [squareCase()])), POS.map((p) => ({ invariant: "I7", case: "bounded", args: ["pointOf", p] })));
});

test("SG11: a wrong opposite fails I5 for the directions, and for each offered position whose step it cannot undo", () => {
	const wrong = mutant("wrong-opposite", (g) => ({ opposite: (d) => (d === "+x" ? "+y" : g.opposite(d)) }));
	assert.deepEqual(listed(checkGridShape(wrong, [squareCase()])), [
		{ invariant: "I5", case: "bounded", args: [] },
		{ invariant: "I5", case: "bounded", args: [{ col: 0, row: 0 }, "+x"] },
		{ invariant: "I5", case: "bounded", args: [{ col: -3, row: -2 }, "+x"] },
		{ invariant: "I5", case: "bounded", args: [{ col: -1, row: 1 }, "+x"] },
	]);
});

test("SG11: a next that steps two fails I5 wherever a step cannot be undone", () => {
	const far = mutant("far-step", (g) => ({ next: (p, d) => (d === "-x" ? g.next(g.next(p, d) ?? p, d) : g.next(p, d)) }));
	assert.deepEqual(listed(checkGridShape(far, [squareCase()])), [
		{ invariant: "I5", case: "bounded", args: [{ col: 0, row: 0 }, "-x"] },
		{ invariant: "I5", case: "bounded", args: [{ col: 0, row: 0 }, "+x"] },
		{ invariant: "I5", case: "bounded", args: [{ col: -3, row: -2 }, "+x"] },
		{ invariant: "I5", case: "bounded", args: [{ col: 2, row: 1 }, "-x"] },
		{ invariant: "I5", case: "bounded", args: [{ col: -1, row: 1 }, "-x"] },
		{ invariant: "I5", case: "bounded", args: [{ col: -1, row: 1 }, "+x"] },
	]);
});

test("SG11: an impure nearest, its fields in another order on every other call, fails I7 and nothing else", () => {
	const impure = mutant("impure", (g) => {
		let calls = 0;
		return {
			nearest(q) {
				const n = g.nearest(q);
				return n === null || calls++ % 2 === 0 ? n : Object.freeze({ row: n.row, col: n.col });
			},
		};
	});
	const expected = POINTS.filter((q) => Number.isFinite(q.x) && Math.abs(q.x) <= 2 ** 50).map((q) => ({ invariant: "I7", case: "bounded", args: ["nearest", asArg(q)] }));
	assert.deepEqual(listed(checkGridShape(impure, [squareCase()])), expected);
});

test("SG11: an answer holding -0 fails I7", () => {
	const negative = mutant("negative-zero", (g) => ({
		next(p, d) {
			const n = g.next(p, d);
			return n && n.col === 0 ? Object.freeze({ col: -0, row: n.row }) : n;
		},
	}));
	assert.deepEqual(listed(checkGridShape(negative, [squareCase()])), [
		{ invariant: "I7", case: "bounded", args: ["next", { col: 0, row: 0 }, "-y"] },
		{ invariant: "I7", case: "bounded", args: ["next", { col: 0, row: 0 }, "+y"] },
		{ invariant: "I7", case: "bounded", args: ["next", { col: -1, row: 1 }, "+x"] },
	]);
});

test("SG11: an enclosing block one column short fails I8 for each rect it no longer holds", () => {
	const short = mutant("short", (g) => ({
		enclosing(r) {
			const b = g.enclosing(r);
			return b && b.to.col > b.from.col ? Object.freeze({ from: b.from, to: Object.freeze({ col: b.to.col - 1, row: b.to.row }) }) : b;
		},
	}));
	assert.deepEqual(listed(checkGridShape(short, [squareCase()])), [WHOLE, rect(-10, -10, 20, 20), R4].map((r) => ({ invariant: "I8", case: "bounded", args: [r] })));
});

test("SG11: an inView whose coarser answer moves a position fails I4 for the pair, got the moved position", () => {
	const moved = mutant("moved", (g) => ({
		inView(v, options) {
			const a = g.inView(v, options);
			if (a.stride < 4) return a;
			const positions = a.positions.map((e) => ({ col: e.position.col + 1, row: e.position.row })).filter((p) => g.offers(p)).map((position) => Object.freeze({ position: Object.freeze(position), point: g.pointOf(position) }));
			return Object.freeze({ stride: a.stride, positions: Object.freeze(positions) });
		},
	}));
	const failures = checkGridShape(moved, [squareCase()]);
	assert.deepEqual(listed(failures), [{ invariant: "I4", case: "bounded", args: [VIEWS[1], VIEWS[2]] }]);
	assert.deepEqual(failures[0].got, { col: 1, row: 0 });
});

test("SG11: a span anchored at its first argument fails I6 for each block it is not symmetric over", () => {
	const anchored = mutant("anchored", (g) => ({
		span(from, to) {
			const s = g.span(from, to);
			const p = g.pointOf(from);
			return Object.freeze({ through: Object.freeze({ ...s.through, x: p.x, y: p.y }), covering: s.covering });
		},
	}));
	assert.deepEqual(listed(checkGridShape(anchored, [squareCase()])), [BLOCKS[0], BLOCKS[2]].map((b) => ({ invariant: "I6", case: "bounded", args: b })));
});

test("SG11: a stride that is no power of two, and an answer past max, fail I4", () => {
	const three = mutant("three", (g) => ({ inView: (v, o) => Object.freeze({ ...g.inView(v, o), stride: 3 }) }));
	assert.deepEqual(listed(checkGridShape(three, [squareCase()])), VIEWS.map((v) => ({ invariant: "I4", case: "bounded", args: v.options ? [v.view, v.options] : [v.view] })));
	const greedy = mutant("greedy", (g) => ({ inView: (v) => g.inView(v) }));
	assert.deepEqual(listed(checkGridShape(greedy, [squareCase()])), [{ invariant: "I4", case: "bounded", args: [VIEWS[2].view, VIEWS[2].options] }]);
});

test("SG11: a throwing call fails its tuple and ends that tuple's checks, in the order the cases give", () => {
	const fragile = mutant("fragile", (g) => ({
		positionAt(q) {
			if (q.x === 0) throw new Error("not at zero");
			return g.positionAt(q);
		},
	}));
	const failures = checkGridShape(fragile, [squareCase("first"), squareCase("second")]);
	assert.deepEqual(listed(failures), ["first", "second"].flatMap((name) => [
		{ invariant: "I3", case: name, args: [{ x: 0, y: 0 }] },
		{ invariant: "I3", case: name, args: [{ x: -0, y: -1e-300 }] },
		{ invariant: "I7", case: name, args: ["positionAt", { x: 0, y: 0 }] },
		{ invariant: "I7", case: name, args: ["positionAt", { x: -0, y: -1e-300 }] },
	]));
	assert.deepEqual(failures[0].got, { thrown: "not at zero" });
});

test("SG11: the failure list is fresh and frozen, its args copies; nothing the caller passed is frozen", () => {
	const unfrozen = mutant("unfrozen", (g) => ({ pointOf: (p) => ({ ...g.pointOf(p) }) }));
	const c = squareCase();
	const failures = checkGridShape(unfrozen, [c]);
	assert.ok(failures.length > 0);
	assert.ok(isFrozenToDepth(failures));
	assert.notEqual(failures[0].args[1], POS[0]);
	assert.ok(!Object.isFrozen(c) && !Object.isFrozen(POS[0]) && !Object.isFrozen(POINTS) && !Object.isFrozen(DECLARATION));
	assert.notEqual(checkGridShape(square, [c]), checkGridShape(square, [c]));
});

test("SG11: checkGridShape refuses a malformed shape or case with a TypeError naming it", () => {
	const good = squareCase();
	const bad = [
		[null, [good]],
		[{ name: "x", open: square.open }, [good]],
		[Object.freeze({ name: "", open: square.open }), [good]],
		[square, good],
		[square, [{ ...good, extra: 1 }]],
		[square, [{ ...good, name: 5 }]],
		[square, [{ ...good, points: "none" }]],
		[square, [(({ rects, ...rest }) => rest)(good)]],
		[square, [{ ...good, views: [{ region: WHOLE, scale: 1 }] }]],
		[square, [{ ...good, blocks: [[{ col: 0, row: 0 }]] }]],
		[square, [null]],
	];
	for (const [shape, cases] of bad) {
		assert.throws(() => checkGridShape(shape, cases), (e) => e instanceof TypeError && e.message.startsWith("checkGridShape"));
	}
	assert.deepEqual(checkGridShape(square, []), []);
});
