// returned-values-and-errors - CONTRACT.md's "Errors" and "What is returned": each function refusing each
// malformed argument with a TypeError whose message begins with its name, a RangeError for a position that
// is not representable, any object with number x and y accepted as a point, every answer made afresh and
// frozen to its depth, and no argument frozen.
import assert from "node:assert/strict";
import { test } from "node:test";

import { openGrid, square } from "@apnex/snap-grid";
import { checkGridShape } from "@apnex/snap-grid/conformance";
import { isFrozenToDepth } from "../support/answers.js";

const opened = openGrid({ shape: "square", pitch: 60, origin: { x: 30, y: 30 }, bounds: { min: { x: -930, y: -510 }, max: { x: 930, y: 510 } } });
const grid = opened.grid;
const rect = (x, y, w, h) => ({ kind: "rect", x, y, w, h });
const refuses = (fn, call, label) => assert.throws(call, (e) => e instanceof TypeError && e.message.startsWith(`${fn}:`), `${fn} refuses ${label}`);

/** A point as a browser's DOMPoint holds it: x and y are getters on its prototype. */
class DomPointLike {
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

const accessor = (name, value, base) => {
	const o = { ...base };
	delete o[name];
	Object.defineProperty(o, name, { enumerable: true, get: () => value });
	return o;
};
const withSymbol = (o) => Object.assign({ ...o }, { [Symbol("extra")]: 1 });

const BAD_POINTS = [undefined, null, 5, "p", true, { x: 1 }, { y: 1 }, { x: "1", y: 1 }, { x: 1, y: 1n }, { x: null, y: 0 }, () => 0];
const BAD_POSITIONS = [undefined, null, 5, {}, { col: 0 }, { row: 0 }, { col: 0, row: 0, z: 0 }, { col: "0", row: 0 }, { col: 0.5, row: 0 }, { col: 2 ** 53, row: 0 }, { col: NaN, row: 0 }, { col: Infinity, row: 0 }, [0, 0], Object.create({ col: 0, row: 0 }), accessor("col", 0, { col: 0, row: 0 }), withSymbol({ col: 0, row: 0 })];
const BAD_RECTS = [undefined, null, 5, {}, rect(0, 0, -1, 0), rect(0, 0, 0, -0.5), rect(0, 0, NaN, 0), rect(0, 0, 0, NaN), rect("0", 0, 0, 0), rect(0, 0, 0, null), { ...rect(0, 0, 0, 0), kind: "square" }, { x: 0, y: 0, w: 0, h: 0 }, { ...rect(0, 0, 0, 0), extra: 1 }, accessor("w", 1, rect(0, 0, 0, 0)), Object.create(rect(0, 0, 0, 0)), withSymbol(rect(0, 0, 0, 0)), rect(0, 0, -Infinity, 0)];
const BAD_DIRECTIONS = [undefined, null, "", "x", "+X", "+z", "constructor", 1];

test("Errors: nearest and positionAt refuse every malformed point", () => {
	for (const p of BAD_POINTS) {
		refuses("nearest", () => grid.nearest(p), String(p));
		refuses("positionAt", () => grid.positionAt(p), String(p));
		refuses("regionContains", () => grid.regionContains(rect(0, 0, 1, 1), p), String(p));
	}
});

test("Errors: pointOf, offers, next and span refuse every malformed position", () => {
	for (const p of BAD_POSITIONS) {
		refuses("pointOf", () => grid.pointOf(p), JSON.stringify(p));
		refuses("offers", () => grid.offers(p), JSON.stringify(p));
		refuses("next", () => grid.next(p, "+x"), JSON.stringify(p));
		refuses("span", () => grid.span(p, { col: 0, row: 0 }), JSON.stringify(p));
		refuses("span", () => grid.span({ col: 0, row: 0 }, p), JSON.stringify(p));
	}
});

test("Errors: next and opposite refuse a direction the grid does not list", () => {
	for (const d of BAD_DIRECTIONS) {
		refuses("next", () => grid.next({ col: 0, row: 0 }, d), String(d));
		refuses("next", () => grid.next({ col: 99, row: 0 }, d), `${String(d)}, from a position not offered`);
		refuses("opposite", () => grid.opposite(d), String(d));
	}
});

test("Errors: enclosing and regionContains refuse every malformed rect", () => {
	for (const r of BAD_RECTS) {
		refuses("enclosing", () => grid.enclosing(r), JSON.stringify(r));
		refuses("regionContains", () => grid.regionContains(r, { x: 0, y: 0 }), JSON.stringify(r));
	}
	assert.equal(grid.enclosing(rect(0, 0, Infinity, 0)), null, "an infinite w is well formed, and its edge is not finite");
	assert.equal(grid.enclosing(rect(Infinity, 0, 0, 0)), null);
});

test("Errors: inView refuses every malformed view and option", () => {
	const good = { region: rect(0, 0, 100, 100), scale: 1 };
	const views = [undefined, null, {}, { region: rect(0, 0, 1, 1) }, { scale: 1 }, { ...good, extra: 1 }, { region: rect(0, 0, 1, 1), scale: 0 }, { region: rect(0, 0, 1, 1), scale: -1 }, { region: rect(0, 0, 1, 1), scale: Infinity }, { region: rect(0, 0, 1, 1), scale: NaN }, { region: rect(0, 0, 1, 1), scale: "1" }, { region: rect(NaN, 0, 1, 1), scale: 1 }, { region: rect(0, Infinity, 1, 1), scale: 1 }, { region: rect(0, 0, NaN, 1), scale: 1 }, { region: rect(1e308, 0, 1e308, 1), scale: 1 }, { region: rect(0, -1e308, 1, -1e308), scale: 1 }, { region: { x: 0, y: 0, w: 1, h: 1 }, scale: 1 }, Object.create(good)];
	for (const v of views) refuses("inView", () => grid.inView(v), JSON.stringify(v));
	const options = [null, 5, "o", [], { extra: 1 }, { minSpacing: -1 }, { minSpacing: NaN }, { minSpacing: Infinity }, { minSpacing: "1" }, { minSpacing: undefined }, { max: 0 }, { max: 1.5 }, { max: 2 ** 32 }, { max: -1 }, { max: undefined }, { max: "10" }, Object.create({ max: 1 })];
	for (const o of options) refuses("inView", () => grid.inView(good, o), JSON.stringify(o));
	assert.ok(grid.inView(good, {}));
	assert.ok(grid.inView(good, undefined));
	assert.ok(grid.inView(good, { max: 2 ** 32 - 1, minSpacing: 0 }));
	assert.ok(grid.inView({ region: rect(-1e308, 0, 1e308, 0), scale: Number.MIN_VALUE }));
});

test("Errors: a well-formed position that is not representable is a RangeError from pointOf and span", () => {
	const top = { col: 18764998447377, row: 0 };
	assert.throws(() => grid.pointOf(top), (e) => e instanceof RangeError && e.message.startsWith("pointOf"));
	assert.throws(() => grid.span(top, { col: 0, row: 0 }), (e) => e instanceof RangeError && e.message.startsWith("span"));
	assert.equal(grid.offers(top), false);
	assert.equal(grid.next(top, "-x"), null);
});

test("Errors: openGrid never throws for a declaration, only for malformed options", () => {
	for (const d of [undefined, null, () => 0, Symbol("s"), 1n, new Map(), { shape: "square", pitch: () => 60, origin: { x: 0, y: 0 } }]) assert.doesNotThrow(() => openGrid(d));
	assert.throws(() => openGrid({}, { shapes: "x" }), (e) => e instanceof TypeError && e.message.startsWith("openGrid:"));
});

test("Errors: a getter's or a Proxy trap's own error, met while an argument is read, is rethrown as the function's TypeError", () => {
	const getterThrows = { get x() { throw new Error("boom"); }, y: 0 };
	const trapThrows = new Proxy({ x: 0, y: 0 }, { get() { throw new Error("trap"); } });
	const { proxy: revoked, revoke } = Proxy.revocable({}, {});
	revoke();
	for (const p of [getterThrows, trapThrows, revoked]) {
		refuses("nearest", () => grid.nearest(p), "a point that throws");
		refuses("positionAt", () => grid.positionAt(p), "a point that throws");
		refuses("regionContains", () => grid.regionContains(rect(0, 0, 1, 1), p), "a point that throws");
	}
	refuses("pointOf", () => grid.pointOf(revoked), "a revoked position");
	refuses("offers", () => grid.offers(new Proxy({ col: 0, row: 0 }, { ownKeys() { throw new Error("trap"); } })), "a position whose keys throw");
	refuses("enclosing", () => grid.enclosing(revoked), "a revoked rect");
	refuses("inView", () => grid.inView({ region: revoked, scale: 1 }), "a revoked region");
	refuses("inView", () => grid.inView({ region: rect(0, 0, 1, 1), scale: 1 }, revoked), "revoked options");
	refuses("openGrid", () => openGrid({ shape: "square" }, revoked), "revoked options");
	refuses("openGrid", () => openGrid({ shape: "square" }, { shapes: revoked }), "a revoked shapes array");
	refuses("openGrid", () => openGrid({ shape: "square" }, { shapes: new Proxy([], { get() { throw new Error("trap"); } }) }), "a shapes array that throws");
	refuses("checkGridShape", () => checkGridShape(square, revoked), "revoked cases");
	refuses("checkGridShape", () => checkGridShape(revoked, []), "a revoked shape");
	refuses("checkGridShape", () => checkGridShape(square, [{ name: "c", declaration: {}, points: revoked, positions: [], views: [], blocks: [], rects: [] }]), "revoked points");
});

test("A point may be any object with number x and y: a DOMPoint-like, an entity, a null-prototype object", () => {
	const entity = { id: "e-1", kind: "thing", name: "box", x: 91, y: -29, w: 40, h: 40 };
	const points = [new DomPointLike(91, -29), entity, Object.assign(Object.create(null), { x: 91, y: -29 }), Object.freeze({ x: 91, y: -29 }), Object.assign([], { x: 91, y: -29 })];
	for (const p of points) {
		assert.deepStrictEqual(grid.nearest(p), { col: 1, row: -1 });
		assert.equal(grid.positionAt(p), null);
		assert.equal(grid.regionContains(rect(90, -30, 1, 1), p), true);
	}
	assert.deepStrictEqual(grid.positionAt(new DomPointLike(90, -30)), { col: 1, row: -1 });
	assert.ok(!Object.isFrozen(entity));
});

test("What is returned: every answer is made afresh and frozen to its depth; no argument is frozen, kept or changed", () => {
	const point = { x: 47, y: -12 };
	const position = { col: 1, row: -1 };
	const other = { col: -2, row: 3 };
	const r = rect(-100, -100, 200, 200);
	const view = { region: rect(-100, -100, 200, 200), scale: 1 };
	const options = { minSpacing: 0, max: 100 };
	const before = JSON.stringify([point, position, other, r, view, options]);
	const calls = [
		() => openGrid({ shape: "square", pitch: 60, origin: { x: 0, y: 0 } }),
		() => openGrid({ shape: "square" }),
		() => grid.nearest(point),
		() => grid.pointOf(position),
		() => grid.positionAt({ x: 90, y: -30 }),
		() => grid.inView(view, options),
		() => grid.next(position, "+x"),
		() => grid.span(position, other),
		() => grid.enclosing(r),
	];
	for (const call of calls) {
		const a = call(), b = call();
		assert.ok(isFrozenToDepth(a), call.toString());
		assert.notEqual(a, b, `${call.toString()} is made afresh`);
	}
	assert.ok(isFrozenToDepth(grid));
	assert.ok(isFrozenToDepth(opened));
	for (const arg of [point, position, other, r, view, view.region, options]) assert.ok(!Object.isFrozen(arg));
	assert.equal(JSON.stringify([point, position, other, r, view, options]), before);
});
