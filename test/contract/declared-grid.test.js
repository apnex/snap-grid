// declared-grid - SG1 and I9: a declaration is opened into a grid, or refused with every problem it has,
// each naming where it lies, in one order; openGrid never throws for any JSON value.
import assert from "node:assert/strict";
import { test } from "node:test";

import { openGrid, square } from "@apnex/snap-grid";
import { isFrozenToDepth, holdsNegativeZero } from "../support/answers.js";
import { seededRandom, randomTools } from "../support/doubles.js";
import { ringTest } from "../fixtures/ring-test.js";

const L = 2 ** 50;
const base = () => ({ shape: "square", pitch: 60, origin: { x: 0, y: 0 } });
const problems = (declaration, options) => {
	const r = openGrid(declaration, options);
	return r.ok ? [] : r.problems.map((p) => [p.pointer, p.problem]);
};
const opens = (declaration, options) => {
	const r = openGrid(declaration, options);
	assert.ok(r.ok, `refused: ${JSON.stringify(r.problems)}`);
	return r.grid;
};

// I9's table: each declaration, and exactly the problems SG1 gives it
const TABLE = [
	// step 1
	["null", null, [["", "not-an-object"]]],
	["a number", 60, [["", "not-an-object"]]],
	["a string", "square", [["", "not-an-object"]]],
	["true", true, [["", "not-an-object"]]],
	["an array", [{ shape: "square" }], [["", "not-an-object"]]],
	["an object of another prototype", Object.assign(Object.create({ shape: "square" }), { pitch: 60 }), [["", "not-an-object"]]],
	["a Date", new Date(0), [["", "not-an-object"]]],
	// step 2, and nothing else
	["no shape", {}, [["/shape", "missing-property"]]],
	["no shape, other problems ignored", { pitch: "x", origin: 5, extra: 1 }, [["/shape", "missing-property"]]],
	["an inherited shape is not own", Object.assign(Object.create(null), { pitch: 60 }), [["/shape", "missing-property"]]],
	// step 3, and nothing else
	["an unknown shape", { shape: "circle", pitch: "x" }, [["/shape", "unknown-shape"]]],
	["a shape that is not a string", { shape: 5 }, [["/shape", "unknown-shape"]]],
	["a shape named by an inherited property", { shape: "constructor" }, [["/shape", "unknown-shape"]]],
	["a shape named toString", { shape: "toString" }, [["/shape", "unknown-shape"]]],
	["a shape of another case", { shape: "Square", pitch: 60, origin: { x: 0, y: 0 } }, [["/shape", "unknown-shape"]]],
	// step 4
	["an unknown property", { ...base(), colour: "red" }, [["/colour", "unknown-property"]]],
	["unknown properties, escaped", { ...base(), "a/b": 1, "c~d": 2, "": 3 }, [["/", "unknown-property"], ["/a~1b", "unknown-property"], ["/c~0d", "unknown-property"]]],
	["an own __proto__", JSON.parse('{"shape":"square","pitch":60,"origin":{"x":0,"y":0},"__proto__":1}'), [["/__proto__", "unknown-property"]]],
	// step 5
	["no pitch", { shape: "square", origin: { x: 0, y: 0 } }, [["/pitch", "missing-property"]]],
	["no origin", { shape: "square", pitch: 60 }, [["/origin", "missing-property"]]],
	["nothing but the shape", { shape: "square" }, [["/origin", "missing-property"], ["/pitch", "missing-property"]]],
	// step 6: pitch
	...[0, -1, 1.5, L + 1, 2 ** 51, "60", null, true, NaN, Infinity, -0, [60], { n: 60 }].map((pitch) => [`pitch ${String(pitch)}`, { ...base(), pitch }, [["/pitch", "invalid-value"]]]),
	// step 6: origin
	...[null, 5, "o", [0, 0], true].map((origin) => [`origin ${JSON.stringify(origin)}`, { ...base(), origin }, [["/origin", "not-an-object"]]]),
	["origin of another prototype", { ...base(), origin: Object.create({ x: 0, y: 0 }) }, [["/origin", "not-an-object"]]],
	["origin with an unknown member", { ...base(), origin: { x: 0, y: 0, z: 0 } }, [["/origin/z", "unknown-property"]]],
	["origin missing y", { ...base(), origin: { x: 0 } }, [["/origin/y", "missing-property"]]],
	["origin empty", { ...base(), origin: {} }, [["/origin/x", "missing-property"], ["/origin/y", "missing-property"]]],
	...[1.5, L + 1, -(L + 1), "0", null, NaN, -Infinity].map((x) => [`origin x ${String(x)}`, { ...base(), origin: { x, y: 0 } }, [["/origin/x", "invalid-value"]]]),
	["origin with every member's problem", { ...base(), origin: { x: 0.5, q: 1 } }, [["/origin/q", "unknown-property"], ["/origin/x", "invalid-value"], ["/origin/y", "missing-property"]]],
	// step 6: bounds
	...[null, 5, [], "b"].map((bounds) => [`bounds ${JSON.stringify(bounds)}`, { ...base(), bounds }, [["/bounds", "not-an-object"]]]),
	["bounds empty", { ...base(), bounds: {} }, [["/bounds/max", "missing-property"], ["/bounds/min", "missing-property"]]],
	["bounds with an unknown member", { ...base(), bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 }, mid: 1 } }, [["/bounds/mid", "unknown-property"]]],
	["bounds min not an object", { ...base(), bounds: { min: 1, max: { x: 0, y: 0 } } }, [["/bounds/min", "not-an-object"]]],
	["bounds members' members", { ...base(), bounds: { min: { x: 0.5, y: 0, w: 1 }, max: { y: L + 1 } } }, [["/bounds/max/x", "missing-property"], ["/bounds/max/y", "invalid-value"], ["/bounds/min/w", "unknown-property"], ["/bounds/min/x", "invalid-value"]]],
	["bounds reversed on x", { ...base(), bounds: { min: { x: 60, y: 0 }, max: { x: -60, y: 0 } } }, [["/bounds/max/x", "invalid-value"]]],
	["bounds reversed on y", { ...base(), bounds: { min: { x: 0, y: 1 }, max: { x: 0, y: 0 } } }, [["/bounds/max/y", "invalid-value"]]],
	["bounds reversed on both", { ...base(), bounds: { min: { x: 1, y: 1 }, max: { x: 0, y: 0 } } }, [["/bounds/max/x", "invalid-value"], ["/bounds/max/y", "invalid-value"]]],
	["bounds reversed, but min invalid: no order check", { ...base(), bounds: { min: { x: 1.5, y: 9 }, max: { x: 0, y: 0 } } }, [["/bounds/min/x", "invalid-value"]]],
	// a problem beneath one member never suppresses its sibling's
	["siblings each keep their problems", { shape: "square", pitch: 0, origin: { x: "0", y: 0 }, bounds: 5, more: 1 }, [["/bounds", "not-an-object"], ["/more", "unknown-property"], ["/origin/x", "invalid-value"], ["/pitch", "invalid-value"]]],
	// step 7
	["bounds that offer no position on x", { ...base(), bounds: { min: { x: 1, y: 0 }, max: { x: 59, y: 0 } } }, [["/bounds", "no-position-in-bounds"]]],
	["bounds that offer no position on y", { ...base(), origin: { x: 0, y: 30 }, bounds: { min: { x: 0, y: 31 }, max: { x: 0, y: 89 } } }, [["/bounds", "no-position-in-bounds"]]],
	["step 7 skipped after any other problem", { ...base(), extra: 1, bounds: { min: { x: 1, y: 0 }, max: { x: 59, y: 0 } } }, [["/extra", "unknown-property"]]],
	["step 7 skipped after a problem in the origin", { ...base(), origin: { x: 0, y: 0.5 }, bounds: { min: { x: 1, y: 0 }, max: { x: 59, y: 0 } } }, [["/origin/y", "invalid-value"]]],
];

for (const [name, declaration, expected] of TABLE) {
	test(`SG1, I9: ${name}`, () => {
		assert.deepEqual(problems(declaration), expected);
	});
}

test("SG1: problems are ordered by UTF-16 code unit, as < compares strings, not by code point", () => {
	const astral = "\uD83D\uDE00";
	const high = "\uFF5E";
	const got = problems({ ...base(), [high]: 1, [astral]: 2, B: 3, a: 4, "~": 5 });
	assert.deepEqual(got.map(([p]) => p), ["/B", "/a", "/~0", `/${astral}`, `/${high}`]);
});

test("SG1: an accepted declaration opens, with its offered and refused edges", () => {
	opens({ ...base(), pitch: 1 });
	opens({ ...base(), pitch: L, origin: { x: L, y: -L } });
	opens({ ...base(), bounds: { min: { x: -L, y: -L }, max: { x: L, y: L } } });
	opens({ ...base(), bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } } });
	opens(Object.assign(Object.create(null), base()));
	assert.deepEqual(problems({ ...base(), bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }, origin: { x: 1, y: 0 } }), [["/bounds", "no-position-in-bounds"]]);
});

test("SG1: grid.declaration is a frozen copy, -0 written 0, in the form's order; the declaration passed is neither kept nor frozen", () => {
	const declaration = { bounds: { max: { y: 5, x: 5 }, min: { y: -0, x: -5 } }, origin: { y: 0, x: -0 }, pitch: 1, shape: "square" };
	const grid = opens(declaration);
	assert.ok(isFrozenToDepth(grid.declaration));
	assert.ok(!holdsNegativeZero(grid.declaration));
	assert.deepStrictEqual(grid.declaration, { shape: "square", pitch: 1, origin: { x: 0, y: 0 }, bounds: { min: { x: -5, y: 0 }, max: { x: 5, y: 5 } } });
	assert.deepEqual(Object.keys(grid.declaration), ["shape", "pitch", "origin", "bounds"]);
	assert.notEqual(grid.declaration, declaration);
	assert.notEqual(grid.declaration.origin, declaration.origin);
	assert.ok(!Object.isFrozen(declaration) && !Object.isFrozen(declaration.origin) && !Object.isFrozen(declaration.bounds.min));
	declaration.pitch = 99;
	assert.equal(grid.declaration.pitch, 1);
	assert.ok(isFrozenToDepth(grid));
});

test("SG1: a getter in a declaration is never called, and is not of its form", () => {
	let called = 0;
	const declaration = { shape: "square", origin: { x: 0, y: 0 } };
	Object.defineProperty(declaration, "pitch", { enumerable: true, get: () => { called++; return 60; } });
	assert.deepEqual(problems(declaration), [["/pitch", "invalid-value"]]);
	const origin = {};
	Object.defineProperty(origin, "x", { enumerable: true, get: () => { called++; return 0; } });
	origin.y = 0;
	assert.deepEqual(problems({ ...base(), origin }), [["/origin/x", "invalid-value"]]);
	const shaped = {};
	Object.defineProperty(shaped, "shape", { get: () => { called++; return "square"; } });
	assert.deepEqual(problems(shaped), [["/shape", "unknown-shape"]]);
	assert.equal(called, 0);
});

test("SG1: a non-enumerable own property is an own property", () => {
	const declaration = base();
	Object.defineProperty(declaration, "hidden", { value: 1, enumerable: false });
	assert.deepEqual(problems(declaration), [["/hidden", "unknown-property"]]);
});

test("SG1, I9: openGrid never throws for a Proxy that throws, nor for a revoked one", () => {
	const hostile = new Proxy({}, { getPrototypeOf() { throw new Error("trap"); }, ownKeys() { throw new Error("trap"); } });
	assert.deepEqual(problems(hostile), [["", "not-an-object"]]);
	const { proxy, revoke } = Proxy.revocable(base(), {});
	revoke();
	assert.deepEqual(problems(proxy), [["", "not-an-object"]]);
	const keys = new Proxy(base(), { ownKeys() { throw new Error("trap"); } });
	assert.deepEqual(problems(keys), [["", "not-an-object"]]);
	assert.deepEqual(problems({ ...base(), origin: hostile }), [["/origin", "not-an-object"]]);
});

test("I9: openGrid never throws for any JSON value, and every refusal is frozen, ordered and without a repeat", () => {
	const rnd = seededRandom(9);
	const { int, pick } = randomTools(rnd);
	const names = ["shape", "pitch", "origin", "bounds", "min", "max", "x", "y", "z", "a/b", "~", ""];
	const scalars = [null, true, false, 0, -0, 1, 60, -60, 1.5, 2 ** 50, 2 ** 51, "square", "", "x"];
	const value = (depth) => {
		const kind = int(0, depth > 3 ? 0 : 3);
		if (kind === 0) return pick(scalars);
		if (kind === 1) return Array.from({ length: int(0, 3) }, () => value(depth + 1));
		const o = {};
		if (kind === 3 || rnd() < 0.7) o.shape = pick(["square", "square", "ring", 5]);
		for (let i = int(0, 4); i > 0; i--) o[pick(names)] = value(depth + 1);
		return o;
	};
	for (let i = 0; i < 4000; i++) {
		const v = value(0);
		const r = openGrid(v);
		assert.ok(isFrozenToDepth(r));
		if (r.ok) continue;
		assert.ok(r.problems.length > 0);
		for (let j = 1; j < r.problems.length; j++) {
			const a = r.problems[j - 1], b = r.problems[j];
			assert.ok(a.pointer < b.pointer || (a.pointer === b.pointer && a.problem < b.problem), `ordered: ${JSON.stringify(r.problems)}`);
		}
		for (const p of r.problems) assert.deepEqual(Object.keys(p), ["pointer", "problem"]);
	}
});

test("SG1: options.shapes adds shapes; a declaration of an unknown shape is refused without them", () => {
	const ring = { shape: "ring-test", centre: { x: 0, y: 0 }, radius: 10, slots: 6 };
	assert.deepEqual(problems(ring), [["/shape", "unknown-shape"]]);
	assert.ok(openGrid(ring, { shapes: [ringTest] }).ok);
	assert.ok(openGrid(base(), { shapes: [ringTest] }).ok);
	assert.ok(openGrid(base(), {}).ok);
	assert.ok(openGrid(base(), { shapes: [] }).ok);
	assert.ok(openGrid(base(), undefined).ok);
	assert.deepEqual(problems({ ...ring, radius: 0 }, { shapes: [ringTest] }), [["/radius", "invalid-value"]]);
});

test("SG1: options.shapes refused for each malformed form, with a TypeError naming openGrid", () => {
	const unfrozen = { name: "other", open: ringTest.open };
	const extra = Object.freeze({ name: "other", open: ringTest.open, more: 1 });
	const sparse = [];
	sparse.length = 1;
	const malformed = [
		null,
		5,
		[],
		{ shapes: [ringTest], extra: 1 },
		{ shapes: undefined },
		{ shapes: ringTest },
		{ shapes: "ring-test" },
		{ shapes: [unfrozen] },
		{ shapes: [extra] },
		{ shapes: [Object.freeze({ name: "", open: ringTest.open })] },
		{ shapes: [Object.freeze({ name: 5, open: ringTest.open })] },
		{ shapes: [Object.freeze({ name: "other", open: "open" })] },
		{ shapes: [Object.freeze({ name: "other" })] },
		{ shapes: [square] },
		{ shapes: [Object.freeze({ name: "square", open: ringTest.open })] },
		{ shapes: [ringTest, ringTest] },
		{ shapes: sparse },
		{ shapes: [null] },
		Object.create({ shapes: [] }),
	];
	for (const options of malformed) {
		assert.throws(() => openGrid(base(), options), (e) => e instanceof TypeError && e.message.startsWith("openGrid"), `refuses ${String(JSON.stringify(options))}`);
	}
	assert.ok(!Object.isFrozen(unfrozen));
});

test("SG1: square opens its own declarations directly, and refuses another shape's as unknown", () => {
	assert.ok(square.open(base()).ok);
	assert.deepEqual(square.open({ shape: "ring-test" }).problems, [{ pointer: "/shape", problem: "unknown-shape" }]);
	assert.ok(Object.isFrozen(square));
	assert.deepEqual(Object.keys(square).sort(), ["name", "open"]);
	assert.equal(square.name, "square");
});
