#!/usr/bin/env node
// generate-i10-corpus - write I10's corpus (the design's section 4, guardrail G2): draw's grid
// arithmetic at commit 0c59572, run over coordinates in the domain and stated as square-grid cases.
//
// It is run once, against a checkout of draw at that commit, and its output is committed; the corpus
// test then holds snap-grid to it. The output holds no word of draw's: draw's grids are square grids,
// its points and indices are points and positions, and each question is snap-grid's.
//
// Draw's functions are called where they are exported -- kernel/geometry.mjs (`nearestAnchor`,
// `onLayout`, `cellOn`, `anchorAt`, `spanExtent`), app/src/snap.js (`snapNode`, `snapIn`) and
// layouts/layout-canvas.mjs (`latticePoints`, through its grid's `points`). The zone wrap's floor and
// ceiling sit inside a closure in zones/zone-keys.mjs, so they are quoted below with their lines, and
// the quote is compared with the file before anything is generated.
//
// Every answer draw gives is compared, at generation, with the exact answer of the BigInt oracle in
// test/support/oracle.js. Where they agree the case joins `cases`; where they differ it joins `apart`,
// with draw's answer as `referenceAnswer`, the exact one as `answer`, and every reason that applies:
// - `rounding`: draw's binary64 arithmetic is not exact -- its answer differs from its own rule
//   computed exactly;
// - `domain`: draw's rule, computed exactly, gives a position whose point lies beyond the domain of
//   coordinates within 2^50, where snap-grid clamps;
// - `beyond`: a rect wholly beyond one side of the bounded grid, which the zone wrap is never given
//   (it wraps a selection's bounds, within the extent): the wrap clamps its low edge only from below and
//   its high edge only from above, so its block inverts, where snap-grid gives the edge position.
// The reasons are judged answer field by answer field, so a point with two causes carries both.
//
// Usage:  node tools/generate-i10-corpus.mjs <draw checkout at 0c59572> [output]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { exactIndices, exactNearest, exactEnclosing, exactViewRange, offeredRange } from "../test/support/oracle.js";
import { nextDown, nextUp, randomTools, seededRandom } from "../test/support/doubles.js";

const COMMIT = "0c59572";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [drawRoot, output = path.join(root, "test", "corpus", "i10-square-corpus.json")] = process.argv.slice(2);
if (!drawRoot) {
	console.error("usage: node tools/generate-i10-corpus.mjs <draw checkout at 0c59572> [output]");
	process.exit(2);
}
const head = execFileSync("git", ["-C", drawRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!head.startsWith(COMMIT)) {
	console.error(`generate-i10-corpus: ${drawRoot} is at ${head}, not ${COMMIT}`);
	process.exit(1);
}

// The zone wrap's floor and ceiling, quoted (zones/zone-keys.mjs:28-29), and its clamps (:30-33).
const QUOTED = {
	28: "const floorZ = (v) => Math.floor((v - HALF) / GAP) * GAP + HALF;",
	29: "const ceilZ = (v) => Math.ceil((v - HALF) / GAP) * GAP + HALF;",
	30: "const x = Math.max(floorZ(b.x - HALF), -ZONE_EXT.x);",
	31: "const y = Math.max(floorZ(b.y - HALF), -ZONE_EXT.y);",
	32: "const x2 = Math.min(ceilZ(b.x2 + HALF), ZONE_EXT.x);",
	33: "const y2 = Math.min(ceilZ(b.y2 + HALF), ZONE_EXT.y);",
};
const keysLines = fs.readFileSync(path.join(drawRoot, "zones", "zone-keys.mjs"), "utf8").split("\n");
for (const [line, text] of Object.entries(QUOTED)) {
	if (keysLines[Number(line) - 1].trim() !== text) {
		console.error(`generate-i10-corpus: zones/zone-keys.mjs:${line} is not the quoted expression:\n  ${keysLines[Number(line) - 1].trim()}`);
		process.exit(1);
	}
}

const load = (file) => import(pathToFileURL(path.join(drawRoot, file)).href);
const geometry = await load("kernel/geometry.mjs");
const snap = await load("app/src/snap.js");
const canvas = await load("layouts/layout-canvas.mjs");
const table = await load("layouts/layout-table.mjs");
const { STD } = await load("kernel/spec.mjs");
const { LAYOUTS, nearestAnchor, onLayout, cellOn, anchorAt, spanExtent } = geometry;
const GAP = STD.pitch;
const HALF = GAP / 2;
const ZONE_EXT = table.ZONE_EXT;
const NODE_EXT = snap.NODE_EXT;
const floorZ = (v) => Math.floor((v - HALF) / GAP) * GAP + HALF; // zones/zone-keys.mjs:28
const ceilZ = (v) => Math.ceil((v - HALF) / GAP) * GAP + HALF; // zones/zone-keys.mjs:29

// Draw's two grids, each bounded by its extent and unbounded, as square declarations.
const L = { n: LAYOUTS.node, z: LAYOUTS.zone };
const EXT = { n: NODE_EXT, z: ZONE_EXT };
const declare = (pitch, offset, ext) => ({
	shape: "square",
	pitch,
	origin: { x: offset, y: offset },
	...(ext ? { bounds: { min: { x: -ext.x, y: -ext.y }, max: { x: ext.x, y: ext.y } } } : {}),
});
const grids = {
	"pitch60-origin0-bounded": declare(GAP, L.n.offset, EXT.n),
	"pitch60-origin0": declare(GAP, L.n.offset),
	"pitch60-origin30-bounded": declare(GAP, L.z.offset, EXT.z),
	"pitch60-origin30": declare(GAP, L.z.offset),
};
const gridOf = { nb: "pitch60-origin0-bounded", nu: "pitch60-origin0", zb: "pitch60-origin30-bounded", zu: "pitch60-origin30" };

const cases = [];
const apart = [];
const same = (a, b) => {
	if (typeof a === "number" || typeof b === "number") return Object.is(a, b);
	if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return a === b;
	const ka = Object.keys(a), kb = Object.keys(b);
	return ka.length === kb.length && ka.every((k) => same(a[k], b[k]));
};
const REASONS = ["rounding", "domain", "beyond"];
/** An answer's numeric fields, by path. */
const leaves = (v, at = "") => (v !== null && typeof v === "object" ? Object.keys(v).flatMap((k) => leaves(v[k], `${at}/${k}`)) : [[at, v]]);
/**
 * Files a case: into `cases` when draw's answer is the exact one, else into `apart` with both and every
 * reason. `rule` is draw's rule computed exactly, and `ruleReason` names how that rule differs from
 * snap-grid's (`domain` or `beyond`) where it does; a field where draw differs from its own rule rounds.
 */
function file(entry, reference, exact, rule = exact, ruleReason = null) {
	if (same(reference, exact)) {
		cases.push({ ...entry, answer: exact });
		return;
	}
	const reasons = new Set();
	const [r, e, x] = [reference, exact, rule].map((v) => new Map(leaves(v)));
	const shaped = [...r.keys()].join() === [...e.keys()].join() && [...e.keys()].join() === [...x.keys()].join();
	if (shaped) {
		for (const [at, value] of r) {
			if (Object.is(value, e.get(at))) continue;
			if (!Object.is(value, x.get(at))) reasons.add("rounding");
			if (!Object.is(x.get(at), e.get(at))) reasons.add(ruleReason);
		}
	} else {
		if (!same(reference, rule)) reasons.add("rounding");
		if (!same(rule, exact)) reasons.add(ruleReason);
	}
	if (reasons.size === 0 || reasons.has(null)) throw new Error(`generate-i10-corpus: no reason for ${JSON.stringify(entry)}`);
	apart.push({ ...entry, reasons: REASONS.filter((reason) => reasons.has(reason)), referenceAnswer: reference, answer: exact });
}

const LIMIT = 2 ** 50;
const toPosition = (col, row) => ({ col: Number(col) + 0, row: Number(row) + 0 });
// a grid with no bounds and no domain: the exact nearest lattice point, unclamped
const lattice = (declaration) => ({ ...declaration, bounds: { min: { x: -(2 ** 200), y: -(2 ** 200) }, max: { x: 2 ** 200, y: 2 ** 200 } } });
const exactPoint = (d, p) => ({ x: Number(BigInt(p.col) * BigInt(d.pitch) + BigInt(d.origin.x)) + 0, y: Number(BigInt(p.row) * BigInt(d.pitch) + BigInt(d.origin.y)) + 0 });
const latticeNearest = (d, q) => {
	const out = {};
	for (const [axis, name] of [["x", "col"], ["y", "row"]]) {
		let i = exactIndices(q[axis], d.origin[axis], d.pitch).round;
		if (d.bounds) {
			const [lo, hi] = offeredRange(d, axis);
			i = i < lo ? lo : i > hi ? hi : i;
		}
		out[name] = Number(i) + 0;
	}
	return out;
};

// ---- the coordinates asked about ----
const rnd = seededRandom(20261020);
const { int, sign, pick } = randomTools(rnd);
const coordinatesFor = (offset, extent) => {
	const tie = (k) => k * GAP + offset + HALF;
	const on = (k) => k * GAP + offset;
	const list = [0, -0, 1e-300, -1e-300, Number.MIN_VALUE, -Number.MIN_VALUE, 0.5, -0.5, 1, -1, 29, 30, 31, -29, -30, -31, 59, 60, 61, -59, -60, -61, 89.5, -89.5];
	for (const e of [extent, extent + 1, extent - 1, extent + HALF, extent - HALF, extent + GAP, extent + 0.5, 1000, 5000, 4980, 1e6]) list.push(e, -e);
	for (let k = -20; k <= 20; k++) list.push(tie(k), on(k), nextUp(tie(k)), nextDown(tie(k)), nextUp(on(k)), nextDown(on(k)));
	for (let j = 1; j <= 52; j += pick([1, 2, 3])) {
		const k = int(-20, 20);
		list.push(tie(k) + sign() * 2 ** -j, on(k) + sign() * 2 ** -j);
	}
	for (let i = 0; i < 40; i++) {
		const k = sign() * Math.floor(rnd() * 2 ** int(5, 43));
		list.push(pick([nextUp, nextDown])(tie(k)), pick([nextUp, nextDown])(on(k)));
	}
	list.push(-60 - 2 ** -47, -30 + 2 ** -48, 30 - 2 ** -48, 60 + 2 ** -46, -90 + 2 ** -46);
	for (const big of [LIMIT, LIMIT - 1, LIMIT - 0.25, LIMIT - 30, LIMIT - 26, LIMIT - 34, 2 ** 49, 2 ** 49 + 30, 2 ** 49 + 0.5, 2 ** 40 + 0.5, 2 ** 40 + 30, 2 ** 33 + 0.125]) list.push(big, -big);
	for (let i = 0; i < 160; i++) list.push(sign() * int(0, 1200));
	for (let i = 0; i < 120; i++) list.push(sign() * rnd() * 1200);
	for (let i = 0; i < 60; i++) list.push(sign() * Math.floor(rnd() * 2 ** int(11, 50)));
	for (let i = 0; i < 60; i++) list.push(sign() * (Math.floor(rnd() * 2 ** int(11, 49)) + pick([0.5, 0.25, 0.75, 0.125])));
	return list.filter((v) => Math.abs(v) <= LIMIT);
};
const coordinates = { n: { x: coordinatesFor(0, NODE_EXT.x), y: coordinatesFor(0, NODE_EXT.y) }, z: { x: coordinatesFor(HALF, ZONE_EXT.x), y: coordinatesFor(HALF, ZONE_EXT.y) } };
const pointsFor = (g, count) => {
	const xs = coordinates[g].x, ys = coordinates[g].y;
	const out = [];
	for (let i = 0; i < Math.max(xs.length, ys.length); i++) out.push({ x: xs[i % xs.length], y: ys[(i * 7) % ys.length] });
	while (out.length < count) out.push({ x: pick(xs), y: pick(ys) });
	return out;
};

// ---- nearest: snapNode and snapIn, bounded; nearestAnchor, unbounded ----
for (const g of ["n", "z"]) {
	const bounded = grids[gridOf[`${g}b`]];
	const unbounded = grids[gridOf[`${g}u`]];
	for (const point of pointsFor(g, 1400)) {
		const s = g === "n" ? snap.snapNode(point) : snap.snapIn({ layout: "zone", ext: ZONE_EXT }, point);
		const reference = { position: { col: (s.x - L[g].offset) / GAP, row: (s.y - L[g].offset) / GAP }, point: { x: s.x, y: s.y } };
		const exact = exactNearest(bounded, point);
		const lat = latticeNearest(bounded, point);
		file({ question: "nearest", grid: gridOf[`${g}b`], point }, reference, { position: exact, point: exactPoint(bounded, exact) }, { position: lat, point: exactPoint(bounded, lat) }, "domain");
	}
	for (const point of pointsFor(g, 1400)) {
		const a = nearestAnchor(L[g], point.x, point.y);
		const reference = { position: { col: a.cx, row: a.cy }, point: { x: a.x, y: a.y } };
		const exact = exactNearest(unbounded, point);
		const lat = latticeNearest(unbounded, point);
		file({ question: "nearest", grid: gridOf[`${g}u`], point }, reference, { position: exact, point: exactPoint(unbounded, exact) }, { position: lat, point: exactPoint(unbounded, lat) }, "domain");
	}
}

// ---- positionAt: onLayout on each axis, the index cellOn's; within the bounds on a bounded grid ----
for (const g of ["n", "z"]) {
	const offset = L[g].offset;
	const near = [];
	for (let i = 0; i < 260; i++) {
		const k = sign() * int(0, 25);
		const on = k * GAP + offset;
		near.push(pick([on, on, on, nextUp(on), nextDown(on), on + sign(), on + sign() * 2 ** -int(1, 52), on + sign() * 0.5, sign() * int(0, 1600) * pick([1, 0.5])]));
	}
	for (const big of [LIMIT - 4, LIMIT - 34, 2 ** 49 + 30, 2 ** 40 + 30, 2 ** 40 + 0.5]) near.push(big, -big);
	near.push(0, -0, -30 + 2 ** -48, 30 + 2 ** -48, -60 - 2 ** -47);
	const points = near.map((x, i) => ({ x, y: near[(i * 11 + 3) % near.length] }));
	for (const [tag, declaration] of [[`${g}u`, grids[gridOf[`${g}u`]]], [`${g}b`, grids[gridOf[`${g}b`]]]]) {
		for (const point of points) {
			if (declaration.bounds && !(Math.abs(point.x) <= EXT[g].x && Math.abs(point.y) <= EXT[g].y)) continue;
			const reference = onLayout(L[g], point.x) && onLayout(L[g], point.y) ? { col: cellOn(L[g], point.x), row: cellOn(L[g], point.y) } : null;
			const n = exactNearest(declaration, point);
			const p = exactPoint(declaration, n);
			const exact = p.x === point.x && p.y === point.y ? n : null;
			file({ question: "positionAt", grid: gridOf[tag], point }, reference, exact, exact);
		}
	}
}

// ---- pointOf: anchorAt (pxOn on each axis), bounds or none ----
for (const g of ["n", "z"]) {
	const greatest = Math.floor((LIMIT - L[g].offset) / GAP);
	const least = Math.ceil((-LIMIT - L[g].offset) / GAP);
	const indices = [0, -0, 1, -1, 15, -15, 16, -16, 17, -17, 31, -31, greatest, least, greatest - 1, least + 1, 2 ** 40, -(2 ** 40)];
	for (let i = 0; i < 80; i++) indices.push(sign() * int(0, 40), sign() * Math.floor(rnd() * 2 ** int(6, 44)));
	for (const tag of [`${g}u`, `${g}b`]) {
		const declaration = grids[gridOf[tag]];
		for (let i = 0; i < indices.length; i++) {
			const position = { col: indices[i], row: indices[(i * 5 + 1) % indices.length] };
			const a = anchorAt(L[g], position.col, position.row);
			file({ question: "pointOf", grid: gridOf[tag], position }, { x: a.x, y: a.y }, exactPoint(declaration, position), exactPoint(declaration, position));
		}
	}
}

// ---- inView over the extent: latticePoints, through each grid's points, from records of the table's form ----
const records = [
	{ name: "node", ...table.LAYOUT_TABLE[0] },
	{ name: "zone", ...table.LAYOUT_TABLE[1] },
	{ name: "node", pitch: 60, offset: 0, ext: { x: 100, y: 50 } },
	{ name: "zone", pitch: 60, offset: 30, ext: { x: 95, y: 31 } },
	{ name: "node", pitch: 7, offset: 3, ext: { x: 20, y: 9 } },
	{ name: "zone", pitch: 1, offset: 0, ext: { x: 3, y: 2 } },
	{ name: "node", pitch: 60, offset: 0, ext: { x: 0, y: 0 } },
];
for (const record of records) {
	const model = { get: (kind, id) => (kind === "layout" ? { id, name: record.name, pitch: record.pitch, offset: record.offset, ext: record.ext } : undefined) };
	const shown = canvas.LAYOUTS_CANVAS.grids.find((x) => x.layout === record.name);
	const points = shown.points(model);
	const declaration = declare(record.pitch, record.offset, record.ext);
	const reference = { stride: 1, positions: points.map((p) => ({ position: { col: (p.x - record.offset) / record.pitch, row: (p.y - record.offset) / record.pitch }, point: { x: p.x, y: p.y } })) };
	const region = { kind: "rect", x: -record.ext.x, y: -record.ext.y, w: 2 * record.ext.x, h: 2 * record.ext.y };
	const exactPositions = [];
	const cols = exactViewRange(declaration, "x", region.x, region.x + region.w);
	const rows = exactViewRange(declaration, "y", region.y, region.y + region.h);
	if (cols && rows) for (let r = rows[0]; r <= rows[1]; r++) for (let c = cols[0]; c <= cols[1]; c++) exactPositions.push({ position: toPosition(c, r), point: exactPoint(declaration, toPosition(c, r)) });
	const exact = { stride: 1, positions: exactPositions };
	const known = Object.keys(grids).find((k) => JSON.stringify(grids[k]) === JSON.stringify(declaration));
	const id = known ?? `pitch${record.pitch}-origin${record.offset}-bounds${record.ext.x}x${record.ext.y}`;
	grids[id] = declaration;
	file({ question: "inView", grid: id, view: { region, scale: 1 } }, reference, exact, exact);
}

// ---- enclosing: the wrap's floor and ceiling, with its clamps on the bounded grid ----
{
	const declaration = grids[gridOf.zb];
	const free = grids[gridOf.zu];
	const edges = [...coordinates.z.x.filter((v) => Math.abs(v) <= 1200), ...coordinates.z.x.filter(() => rnd() < 0.15)];
	const rects = [];
	for (let i = 0; i < 900; i++) {
		const w = pick([0, 0, int(0, 300), rnd() * 300, 60, 30, 2 ** -int(1, 40), int(0, 2400)]);
		const h = pick([0, int(0, 300), rnd() * 300, 60, 30, 2 ** -int(1, 40), int(0, 1200)]);
		rects.push({ kind: "rect", x: pick(edges), y: pick(edges), w, h });
	}
	// rects wholly beyond one side, which the wrap is never given
	for (let i = 0; i < 120; i++) {
		const side = i % 4;
		const far = pick([int(1, 100), int(1, 2000), rnd() * 500, 2 ** int(11, 49), 0.5]);
		const w = pick([0, int(0, 300), rnd() * 120]), h = pick([0, int(0, 300), rnd() * 120]);
		const along = (ext) => sign() * rnd() * (ext + 60);
		const x = side === 0 ? ZONE_EXT.x + far : side === 1 ? -ZONE_EXT.x - far - w : along(ZONE_EXT.x);
		const y = side === 2 ? ZONE_EXT.y + far : side === 3 ? -ZONE_EXT.y - far - h : along(ZONE_EXT.y);
		rects.push({ kind: "rect", x, y, w, h });
	}
	const floorOf = (v) => Number(exactIndices(v, HALF, GAP).floor) + 0;
	const ceilOf = (v) => Number(exactIndices(v, HALF, GAP).ceil) + 0;
	const [cl, ch] = offeredRange(declaration, "x").map(Number), [rl, rh] = offeredRange(declaration, "y").map(Number);
	for (const rect of rects) {
		const { x, y } = rect;
		const right = x + rect.w, bottom = y + rect.h;
		if (![x, y, right, bottom].every((v) => Math.abs(v) <= LIMIT)) continue;
		// unbounded: the floor and ceiling alone (:28-29)
		const ru = { from: { col: (floorZ(x) - HALF) / GAP, row: (floorZ(y) - HALF) / GAP }, to: { col: (ceilZ(right) - HALF) / GAP, row: (ceilZ(bottom) - HALF) / GAP } };
		const lu = { from: { col: floorOf(x), row: floorOf(y) }, to: { col: ceilOf(right), row: ceilOf(bottom) } };
		file({ question: "enclosing", grid: gridOf.zu, rect }, ru, exactEnclosing(free, rect), lu, "domain");
		// bounded: with the clamps (:30-33), the low edge clamped only from below and the high edge only from above
		const rb = {
			from: { col: (Math.max(floorZ(x), -ZONE_EXT.x) - HALF) / GAP, row: (Math.max(floorZ(y), -ZONE_EXT.y) - HALF) / GAP },
			to: { col: (Math.min(ceilZ(right), ZONE_EXT.x) - HALF) / GAP, row: (Math.min(ceilZ(bottom), ZONE_EXT.y) - HALF) / GAP },
		};
		const lb = { from: { col: Math.max(floorOf(x), cl), row: Math.max(floorOf(y), rl) }, to: { col: Math.min(ceilOf(right), ch), row: Math.min(ceilOf(bottom), rh) } };
		file({ question: "enclosing", grid: gridOf.zb, rect }, rb, exactEnclosing(declaration, rect), lb, "beyond");
	}
}

// ---- span: through, from anchorAt of the least corner and spanExtent of the counts ----
for (const g of ["n", "z"]) {
	for (const tag of [`${g}u`, `${g}b`]) {
		const declaration = grids[gridOf[tag]];
		for (let i = 0; i < 160; i++) {
			const reach = pick([20, 40, 2 ** 20, 2 ** 43]);
			const from = { col: sign() * int(0, reach) + 0, row: sign() * int(0, reach) + 0 };
			const to = i % 4 === 0 ? { ...from } : { col: sign() * int(0, reach) + 0, row: sign() * int(0, reach) + 0 };
			const corner = anchorAt(L[g], Math.min(from.col, to.col), Math.min(from.row, to.row));
			const ext = spanExtent({ cols: Math.abs(to.col - from.col) + 1, rows: Math.abs(to.row - from.row) + 1 });
			const reference = { through: { kind: "rect", x: corner.x, y: corner.y, w: ext.sw, h: ext.sh } };
			const p = exactPoint(declaration, { col: Math.min(from.col, to.col), row: Math.min(from.row, to.row) });
			const exact = { through: { kind: "rect", x: p.x, y: p.y, w: Math.abs(to.col - from.col) * GAP, h: Math.abs(to.row - from.row) * GAP } };
			file({ question: "span", grid: gridOf[tag], from, to }, reference, exact, exact);
		}
	}
}

// ---- write, -0 as the string "-0", one case to a line ----
const encode = (v) => JSON.stringify(v, (k, x) => (Object.is(x, -0) ? "-0" : x));
const counts = {};
for (const c of cases) counts[c.question] = (counts[c.question] ?? 0) + 1;
const apartCounts = {};
for (const c of apart) apartCounts[`${c.question} ${c.reasons.join("+")}`] = (apartCounts[`${c.question} ${c.reasons.join("+")}`] ?? 0) + 1;
const lines = [
	"{",
	`  "about": ${encode("Square-grid cases: each asks a grid a question and gives the answer. Numbers are JSON numbers, except -0, written as the string \"-0\". Cases in apart give a reference answer that differs from the exact one, and every reason: rounding, domain or beyond.")},`,
	`  "grids": {`,
	Object.entries(grids).map(([k, v]) => `    ${encode(k)}: ${encode(v)}`).join(",\n"),
	"  },",
	`  "cases": [`,
	cases.map((c) => `    ${encode(c)}`).join(",\n"),
	"  ],",
	`  "apart": [`,
	apart.map((c) => `    ${encode(c)}`).join(",\n"),
	"  ]",
	"}",
	"",
];
fs.writeFileSync(output, lines.join("\n"));
console.log(`generate-i10-corpus: ${cases.length} cases, ${apart.length} apart, from ${head}, to ${path.relative(root, output)}`);
console.log(`  cases: ${JSON.stringify(counts)}`);
console.log(`  apart: ${JSON.stringify(apartCounts)}`);
