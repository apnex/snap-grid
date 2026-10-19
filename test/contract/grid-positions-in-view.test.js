// grid-positions-in-view - SG6: the offered positions within a view, thinned to a spacing on screen by a
// power-of-two stride counted from position 0, in one order; its index ranges held to the exact oracle.
import assert from "node:assert/strict";
import { test } from "node:test";

import { openGrid } from "@apnex/snap-grid";
import { holdsNegativeZero, isFrozenToDepth } from "../support/answers.js";
import { aimedCoordinate, randomDeclaration, randomTools, seededRandom } from "../support/doubles.js";
import { exactViewRange } from "../support/oracle.js";

const L = 2 ** 50;
const TOP = 2 ** 52;
const open = (declaration) => {
	const r = openGrid(declaration);
	assert.ok(r.ok, JSON.stringify(r.problems));
	return r.grid;
};
const rect = (x, y, w, h) => ({ kind: "rect", x, y, w, h });
const view = (x, y, w, h, scale = 1) => ({ region: rect(x, y, w, h), scale });

/** SG6's stride for the spacing alone, by its literal rule. */
function spacingStride(pitch, scale, minSpacing) {
	let s = 1;
	while (s < TOP && !(pitch * scale * s >= minSpacing)) s *= 2;
	return s;
}

/** Every offered position in a small view, found by trying every index near it. */
function search(declaration, v, options = {}) {
	const { pitch, origin } = declaration;
	const b = declaration.bounds;
	const right = v.region.x + v.region.w, bottom = v.region.y + v.region.h;
	const cols = [], rows = [];
	for (let i = Math.floor((v.region.x - origin.x) / pitch) - 2; i <= Math.ceil((right - origin.x) / pitch) + 2; i++) {
		const x = i * pitch + origin.x;
		if (x >= v.region.x && x <= right && (!b || (x >= b.min.x && x <= b.max.x)) && Math.abs(x) <= L) cols.push(i);
	}
	for (let i = Math.floor((v.region.y - origin.y) / pitch) - 2; i <= Math.ceil((bottom - origin.y) / pitch) + 2; i++) {
		const y = i * pitch + origin.y;
		if (y >= v.region.y && y <= bottom && (!b || (y >= b.min.y && y <= b.max.y)) && Math.abs(y) <= L) rows.push(i);
	}
	let s = spacingStride(pitch, v.scale, options.minSpacing ?? 0);
	const kept = (list) => list.filter((i) => i % s === 0);
	while (s < TOP && kept(cols).length * kept(rows).length > (options.max ?? 10000)) s *= 2;
	const positions = [];
	for (const row of kept(rows)) for (const col of kept(cols)) positions.push({ position: { col: col + 0, row: row + 0 }, point: { x: col * pitch + origin.x + 0, y: row * pitch + origin.y + 0 } });
	return { stride: s, positions };
}

test("SG6: complete against a search of every index in small views, with the least stride and max", () => {
	const rnd = seededRandom(61);
	const { int, sign, pick } = randomTools(rnd);
	for (let n = 0; n < 4000; n++) {
		const pitch = int(1, 20);
		const origin = { x: int(-50, 50), y: int(-50, 50) };
		const declaration = { shape: "square", pitch, origin };
		if (rnd() < 0.5) {
			const lo = { x: int(-150, 50), y: int(-150, 50) };
			declaration.bounds = { min: lo, max: { x: lo.x + int(pitch, 200), y: lo.y + int(pitch, 200) } };
		}
		const r = openGrid(declaration);
		if (!r.ok) continue;
		const v = view(sign() * rnd() * 150, sign() * rnd() * 150, pick([0, rnd() * 120, int(0, 120)]), pick([0, rnd() * 120, int(0, 120)]), pick([1, 0.5, 2, rnd() * 4 + 0.01]));
		const options = {};
		if (rnd() < 0.6) options.minSpacing = pick([0, rnd() * 100, int(0, 300)]);
		if (rnd() < 0.6) options.max = int(1, 60);
		assert.deepStrictEqual(r.grid.inView(v, options), search(declaration, v, options), `${JSON.stringify(declaration)} ${JSON.stringify(v)} ${JSON.stringify(options)}`);
	}
});

test("SG6: the least stride for a spread of scales and spacings, and 2^52 when none is", () => {
	const g = open({ shape: "square", pitch: 60, origin: { x: 0, y: 0 } });
	for (const scale of [1e-12, 0.001, 0.1, 0.25, 0.5, 1, 1.5, 2, 1000]) {
		for (const minSpacing of [0, 1, 7, 30, 59.99, 60, 61, 120, 1000, 1e6]) {
			const answer = g.inView(view(-10, -10, 20, 20, scale), { minSpacing });
			assert.equal(answer.stride, spacingStride(60, scale, minSpacing), `scale ${scale} spacing ${minSpacing}`);
		}
	}
	assert.equal(g.inView(view(0, 0, 1, 1, 1), { minSpacing: 1e300 }).stride, TOP);
	assert.deepStrictEqual(g.inView(view(0, 0, 1, 1, 1), { minSpacing: 1e300 }).positions, [{ position: { col: 0, row: 0 }, point: { x: 0, y: 0 } }]);
	assert.equal(g.inView(view(0, 0, 1, 1, 1e-300), { minSpacing: 1 }).stride, TOP);
	assert.equal(g.inView(view(0, 0, 1, 1, 1), { minSpacing: 60 }).stride, 1);
	assert.equal(g.inView(view(0, 0, 1, 1, 1), { minSpacing: Number.MIN_VALUE }).stride, 1);
});

test("SG6: max doubles the stride until the count fits, counted before anything is made", () => {
	const g = open({ shape: "square", pitch: 1, origin: { x: 0, y: 0 } });
	const v = view(-100, -100, 200, 200);
	assert.equal(g.inView(v).stride, 4, "201 by 201 exceeds 10000, and so does 101 by 101");
	assert.equal(g.inView(v).positions.length, 51 * 51);
	assert.equal(g.inView(v, { max: 40401 }).stride, 1);
	assert.equal(g.inView(v, { max: 40400 }).stride, 2);
	assert.equal(g.inView(v, { max: 1 }).stride, 128);
	assert.deepStrictEqual(g.inView(v, { max: 1 }).positions, [{ position: { col: 0, row: 0 }, point: { x: 0, y: 0 } }]);
	const whole = g.inView(view(-L, -L, 2 * L, 2 * L), { max: 1 });
	assert.equal(whole.stride, 2 ** 51);
	assert.deepStrictEqual(whole.positions, [{ position: { col: 0, row: 0 }, point: { x: 0, y: 0 } }]);
	const many = g.inView(view(-L, -L, 2 * L, 2 * L), { max: 300 });
	assert.equal(many.stride, 2 ** 47);
	assert.equal(many.positions.length, 17 * 17);
	assert.deepStrictEqual(many.positions[0].position, { col: -L, row: -L });
});

test("SG6: empty and disjoint regions return no positions and the stride chosen for the spacing", () => {
	const g = open({ shape: "square", pitch: 60, origin: { x: 30, y: 30 }, bounds: { min: { x: -930, y: -510 }, max: { x: 930, y: 510 } } });
	assert.deepStrictEqual(g.inView(view(31, 31, 58, 58)), { stride: 1, positions: [] });
	assert.deepStrictEqual(g.inView(view(31, 31, 58, 58), { minSpacing: 200 }), { stride: 4, positions: [] });
	assert.deepStrictEqual(g.inView(view(2000, 0, 100, 100), { minSpacing: 100 }), { stride: 2, positions: [] });
	assert.deepStrictEqual(g.inView(view(-1e300, -1e300, 1e299, 1e299), { minSpacing: 59 }), { stride: 1, positions: [] });
	assert.deepStrictEqual(g.inView(view(-990, -570, 59, 59)), { stride: 1, positions: [] });
	assert.deepStrictEqual(g.inView(view(31, -1000, 58, 2000), { max: 1 }), { stride: 1, positions: [] });
});

test("SG6: zero-size regions: on a lattice point, that position; off it, none", () => {
	const g = open({ shape: "square", pitch: 60, origin: { x: 30, y: 30 } });
	assert.deepStrictEqual(g.inView(view(-30, 90, 0, 0)), { stride: 1, positions: [{ position: { col: -1, row: 1 }, point: { x: -30, y: 90 } }] });
	assert.deepStrictEqual(g.inView(view(-30, 91, 0, 0)), { stride: 1, positions: [] });
	assert.deepStrictEqual(g.inView(view(-30, 90, 0, 0), { minSpacing: 120 }), { stride: 2, positions: [] });
	assert.deepStrictEqual(g.inView(view(30, 30, 0, 0), { minSpacing: 1e9 }), { stride: 2 ** 24, positions: [{ position: { col: 0, row: 0 }, point: { x: 30, y: 30 } }] });
	assert.deepStrictEqual(g.inView(view(-30 + 2 ** -48, 30, 0, 0)), { stride: 1, positions: [] });
});

test("SG6: negative indices at strides up to 2^52", () => {
	const g = open({ shape: "square", pitch: 1, origin: { x: 0, y: 0 } });
	const answer = g.inView(view(-L, -L, 2 ** 49, 2 ** 49), { max: 1 });
	assert.equal(answer.stride, 2 ** 50);
	assert.deepStrictEqual(answer.positions, [{ position: { col: -L, row: -L }, point: { x: -L, y: -L } }]);
	const four = g.inView(view(-L, -L, L, L), { max: 4 });
	assert.equal(four.stride, 2 ** 50);
	assert.deepStrictEqual(four.positions.map((e) => [e.position.col, e.position.row]), [[-L, -L], [0, -L], [-L, 0], [0, 0]]);
	const nine = g.inView(view(-L, -L, L, L), { max: 9 });
	assert.equal(nine.stride, 2 ** 49);
	assert.deepStrictEqual(nine.positions.map((e) => [e.position.col, e.position.row]), [[-L, -L], [-(2 ** 49), -L], [0, -L], [-L, -(2 ** 49)], [-(2 ** 49), -(2 ** 49)], [0, -(2 ** 49)], [-L, 0], [-(2 ** 49), 0], [0, 0]]);
	const shifted = open({ shape: "square", pitch: 1, origin: { x: L, y: L } });
	const top = shifted.inView(view(-L, -L, 2 * L, 2 * L), { max: 1 });
	assert.equal(top.stride, TOP);
	assert.deepStrictEqual(top.positions, [{ position: { col: 0, row: 0 }, point: { x: L, y: L } }]);
	const corner = shifted.inView(view(-L, -L, 0, 0), { max: 1 });
	assert.deepStrictEqual(corner, { stride: 1, positions: [{ position: { col: -(2 ** 51), row: -(2 ** 51) }, point: { x: -L, y: -L } }] });
	const thinned = shifted.inView(view(-L, -L, 0, 0), { minSpacing: 2 ** 51 });
	assert.deepStrictEqual(thinned, { stride: 2 ** 51, positions: [{ position: { col: -(2 ** 51), row: -(2 ** 51) }, point: { x: -L, y: -L } }] });
	const beyond = shifted.inView(view(-L, -L, 0, 0), { minSpacing: 2 ** 52 });
	assert.deepStrictEqual(beyond, { stride: TOP, positions: [] });
	for (const e of [...answer.positions, ...four.positions, ...corner.positions]) assert.ok(!holdsNegativeZero(e));
});

test("SG2, SG6: the index ranges equal the exact oracle's, fractions and translated origins near 2^50 among them", () => {
	const rnd = seededRandom(62);
	const { int, pick, sign } = randomTools(rnd);
	let checked = 0;
	for (let n = 0; n < 3000; n++) {
		const d = n % 10 === 0 ? { shape: "square", pitch: int(1, 90), origin: { x: sign() * (L - int(0, 200)), y: sign() * (L - int(0, 200)) } } : randomDeclaration(rnd);
		const g = open(d);
		for (let i = 0; i < 20; i++) {
			const x = aimedCoordinate(rnd, d.pitch, d.origin.x), y = aimedCoordinate(rnd, d.pitch, d.origin.y);
			const w = pick([0, d.pitch * rnd() * 3, d.pitch * int(0, 3), rnd()]), h = pick([0, d.pitch * rnd() * 3, d.pitch * int(0, 3), rnd()]);
			if (!Number.isFinite(x + w) || !Number.isFinite(y + h)) continue;
			const answer = g.inView(view(x, y, w, h), { max: 2 ** 32 - 1 });
			const cols = exactViewRange(d, "x", x, x + w), rows = exactViewRange(d, "y", y, y + h);
			const expected = [];
			if (cols && rows) for (let r = rows[0]; r <= rows[1]; r++) for (let c = cols[0]; c <= cols[1]; c++) expected.push({ col: Number(c) + 0, row: Number(r) + 0 });
			assert.equal(answer.stride, 1);
			assert.deepStrictEqual(answer.positions.map((e) => e.position), expected, `${JSON.stringify(d)} ${x} ${y} ${w} ${h}`);
			checked++;
		}
	}
	const z = open({ shape: "square", pitch: 60, origin: { x: 30, y: 30 } });
	assert.deepStrictEqual(z.inView(view(-60 - 2 ** -47, 0, 2 ** -47, 60)).positions.map((e) => e.position), []);
	assert.deepStrictEqual(z.inView(view(-90 - 2 ** -46, 30, 2 ** -46, 0)).positions.map((e) => e.position), [{ col: -2, row: 0 }]);
	assert.ok(checked > 50000, `${checked}`);
});

test("SG6: zooming out drops positions and never moves one; the order is by row, then column", () => {
	const rnd = seededRandom(63);
	const g = open({ shape: "square", pitch: 7, origin: { x: 3, y: -2 } });
	for (let n = 0; n < 200; n++) {
		const v = view(-500 + rnd() * 400, -500 + rnd() * 400, rnd() * 600, rnd() * 600);
		let previous = null;
		for (const minSpacing of [0, 8, 15, 29, 57, 113, 300, 1000]) {
			const answer = g.inView(v, { minSpacing });
			const keys = answer.positions.map((e) => `${e.position.col},${e.position.row}`);
			for (let i = 1; i < answer.positions.length; i++) {
				const a = answer.positions[i - 1].position, b = answer.positions[i].position;
				assert.ok(a.row < b.row || (a.row === b.row && a.col < b.col));
			}
			if (previous && previous.stride < answer.stride) for (const k of keys) assert.ok(previous.keys.has(k), `${k} kept`);
			previous = { stride: answer.stride, keys: new Set(keys) };
		}
	}
});

test("SG6: the answer is frozen to its depth, fresh each call, and the view is neither frozen nor kept", () => {
	const g = open({ shape: "square", pitch: 60, origin: { x: 0, y: 0 } });
	const v = view(-100, -100, 200, 200);
	const options = { minSpacing: 10 };
	const a = g.inView(v, options), b = g.inView(v, options);
	assert.ok(isFrozenToDepth(a));
	assert.notEqual(a, b);
	assert.notEqual(a.positions[0], b.positions[0]);
	assert.ok(!Object.isFrozen(v) && !Object.isFrozen(v.region) && !Object.isFrozen(options));
	assert.deepEqual(Object.keys(a), ["stride", "positions"]);
	assert.deepEqual(Object.keys(a.positions[0]), ["position", "point"]);
});
