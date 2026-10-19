/**
 * checkGridShape (CONTRACT.md, SG11): the conformance kit, which judges whether a shape keeps the
 * invariants section 4 of the design marks *kit* over the cases it is given.
 *
 * It judges the cases in the array's order, and within a case `open`, then I1 to I8, each over the
 * arguments SG11's table names, in the order the case gives them. It records one failure for each
 * argument tuple that fails any of its invariant's checks; a call that throws fails its tuple and ends
 * that tuple's checks. `got` is a diagnostic: the answer that failed, or { thrown: <message> }.
 *
 * Where SG11 leaves a choice open, this kit:
 * - selects "each case position offers accepts" by offers answering exactly true; a position whose
 *   offers throws is not selected there, and I7's schedule, which calls offers for every case
 *   position, records the throw;
 * - passes a view pair's options only when the pair has them, and its args are the arguments it passed;
 * - judges membership of a rect itself, edges x, y, x + w and y + h as binary64 computes them, and asks
 *   the grid's regionContains for a region of any other kind;
 * - counts null from enclosing as a failure of I8, since every case rect lies in some block's through;
 * - compares answers within I1 to I8 by value, -0 equal to 0, and I7's two answers field by field in
 *   the same order, -0 told apart from 0.
 */
import { malformed } from "./argument-check.js";
import { deepFreeze, exactRecord, isPlainObject } from "./plain-data.js";
import { isGridShape } from "./shape-form.js";
import type { GridShape, GridShapeCase, GridShapeFailure, GridShapeInvariant } from "./types.js";

export type { GridShapeCase, GridShapeFailure, GridShapeInvariant } from "./types.js";

const FN = "checkGridShape";
const STRIDE_LIMIT = 2 ** 52;
const DEPTH_LIMIT = 256;

/** A grid as the kit sees it through the port: every member may be anything until it is asked. */
type PortGrid = Record<string, unknown>;

interface ViewPair {
	readonly pair: unknown;
	readonly view: unknown;
	readonly options: unknown;
	readonly hasOptions: boolean;
}

interface CheckedCase {
	readonly name: string;
	readonly declaration: unknown;
	readonly points: readonly unknown[];
	readonly positions: readonly unknown[];
	readonly views: readonly ViewPair[];
	readonly blocks: readonly (readonly [unknown, unknown])[];
	readonly rects: readonly unknown[];
}

/** A check's verdict: null when it holds, or what the kit saw. */
type Verdict = null | { readonly got: unknown };
const failed = (got: unknown): Verdict => ({ got });

class Thrown {
	constructor(readonly message: string) {}
}

function readCases(cases: unknown): CheckedCase[] {
	if (!Array.isArray(cases)) throw malformed(FN, "cases must be an array of cases");
	const out: CheckedCase[] = [];
	const lists = ["points", "positions", "views", "blocks", "rects"];
	for (let i = 0; i < cases.length; i++) {
		const form = `cases[${i}] must be a plain object of exactly name, a string, declaration, and the arrays points, positions, views, blocks and rects`;
		const c = exactRecord(cases[i], ["name", "declaration", ...lists]);
		if (c === null || typeof c.get("name") !== "string" || lists.some((l) => !Array.isArray(c.get(l)))) throw malformed(FN, form);
		const views = (c.get("views") as unknown[]).map((pair, j) => {
			const v = exactRecord(pair, ["view"], ["options"]);
			if (v === null) throw malformed(FN, `cases[${i}].views[${j}] must be a plain object of view and, optionally, options`);
			return { pair, view: v.get("view"), options: v.get("options"), hasOptions: v.has("options") };
		});
		const blocks = (c.get("blocks") as unknown[]).map((block, j) => {
			if (!Array.isArray(block) || block.length !== 2) throw malformed(FN, `cases[${i}].blocks[${j}] must be an array of two positions`);
			return [block[0], block[1]] as const;
		});
		out.push({
			name: c.get("name") as string,
			declaration: c.get("declaration"),
			points: [...(c.get("points") as unknown[])],
			positions: [...(c.get("positions") as unknown[])],
			views,
			blocks,
			rects: [...(c.get("rects") as unknown[])],
		});
	}
	return out;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Two answers equal by value: numbers by ===, NaN equal to NaN; objects by the same own enumerable keys, in any order. */
function equalValue(a: unknown, b: unknown, depth = 0): boolean {
	if (typeof a === "number" && typeof b === "number") return a === b || (Number.isNaN(a) && Number.isNaN(b));
	if (!isObject(a) || !isObject(b)) return a === b;
	if (depth > DEPTH_LIMIT || Array.isArray(a) !== Array.isArray(b)) return false;
	const ka = Object.keys(a), kb = Object.keys(b);
	if (ka.length !== kb.length) return false;
	return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && equalValue(a[k], b[k], depth + 1));
}

/** Two answers the same field by field: Object.is on every value, the same keys in the same order, the same prototypes. */
function sameAnswer(a: unknown, b: unknown, depth = 0): boolean {
	if (!isObject(a) || !isObject(b)) return Object.is(a, b);
	if (depth > DEPTH_LIMIT || Object.getPrototypeOf(a) !== Object.getPrototypeOf(b) || Array.isArray(a) !== Array.isArray(b)) return false;
	const ka = Object.keys(a), kb = Object.keys(b);
	if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
	return ka.every((k) => sameAnswer(a[k], b[k], depth + 1));
}

/** Walks every value reachable through own data properties. */
function* reachable(value: unknown): Generator<unknown> {
	const pending: unknown[] = [value];
	const seen = new Set<unknown>();
	while (pending.length > 0) {
		const item = pending.pop();
		yield item;
		if ((typeof item !== "object" || item === null) && typeof item !== "function") continue;
		if (seen.has(item)) continue;
		seen.add(item);
		for (const key of Reflect.ownKeys(item)) {
			const d = Object.getOwnPropertyDescriptor(item, key);
			if (d !== undefined && "value" in d) pending.push(d.value);
		}
	}
}

const holdsNegativeZero = (value: unknown): boolean => {
	for (const v of reachable(value)) if (Object.is(v, -0)) return true;
	return false;
};

const frozenToDepth = (value: unknown): boolean => {
	for (const v of reachable(value)) if (((typeof v === "object" && v !== null) || typeof v === "function") && !Object.isFrozen(v)) return false;
	return true;
};

const isStride = (s: unknown): boolean => {
	if (typeof s !== "number" || !Number.isInteger(s) || s < 1 || s > STRIDE_LIMIT) return false;
	let t = s;
	while (t > 1 && t % 2 === 0) t /= 2;
	return t === 1;
};

/** A fresh copy of an argument or an answer, for a failure: plain data copied, a point-like object as its x and y. */
function copyOut(value: unknown, seen = new Map<object, unknown>()): unknown {
	if (value instanceof Thrown) return { thrown: value.message };
	if (typeof value === "function") return `[function ${value.name}]`;
	if (typeof value !== "object" || value === null) return value;
	if (seen.has(value)) return seen.get(value);
	try {
		if (Array.isArray(value)) {
			const out: unknown[] = [];
			seen.set(value, out);
			for (let i = 0; i < value.length; i++) out.push(copyOut(value[i], seen));
			return out;
		}
		const out: Record<string, unknown> = {};
		seen.set(value, out);
		for (const key of Object.keys(value)) {
			const d = Object.getOwnPropertyDescriptor(value, key);
			if (d !== undefined && "value" in d) out[key] = copyOut(d.value, seen);
		}
		if (!isPlainObject(value)) {
			const { x, y } = value as { x: unknown; y: unknown };
			if (typeof x === "number" && !("x" in out)) out["x"] = x;
			if (typeof y === "number" && !("y" in out)) out["y"] = y;
		}
		return out;
	} catch (e) {
		return { unreadable: messageOf(e) };
	}
}

/** Judges one shape over one case, pushing failures in SG11's order. */
function judgeCase(shape: GridShape, c: CheckedCase, failures: GridShapeFailure[]): void {
	const fail = (invariant: GridShapeInvariant, args: readonly unknown[], got: unknown): void => {
		failures.push({ invariant, case: c.name, args: copyOut(args) as unknown[], got: copyOut(got) });
	};
	/** Runs one argument tuple's checks: the first failing check's got, or a throw, fails the tuple. */
	const judge = (invariant: GridShapeInvariant, args: readonly unknown[], checks: () => Verdict): void => {
		let verdict: Verdict;
		try {
			verdict = checks();
		} catch (e) {
			verdict = failed(new Thrown(messageOf(e)));
		}
		if (verdict !== null) fail(invariant, args, verdict.got);
	};

	let opened: unknown;
	try {
		opened = shape.open(c.declaration);
	} catch (e) {
		fail("open", [c.declaration], new Thrown(messageOf(e)));
		return;
	}
	if (!isObject(opened) || opened["ok"] !== true || !isObject(opened["grid"])) {
		fail("open", [c.declaration], isObject(opened) && opened["ok"] === false ? opened["problems"] : opened);
		return;
	}
	const grid = opened["grid"] as PortGrid;
	const ask = (name: string, ...args: unknown[]): unknown => {
		const member = grid[name];
		if (typeof member !== "function") throw new TypeError(`the grid has no function ${name}`);
		return member.apply(grid, args);
	};
	const offered = (position: unknown): boolean => ask("offers", position) === true;
	const accepted = (position: unknown): boolean => {
		try {
			return offered(position);
		} catch {
			return false;
		}
	};
	const directionsOf = (): readonly unknown[] => {
		const d = grid["directions"];
		return Array.isArray(d) ? d : [];
	};
	const coordinates = (point: unknown): { x: unknown; y: unknown } => {
		const { x, y } = point as { x: unknown; y: unknown };
		return { x, y };
	};
	const squaredDistance = (q: { x: unknown; y: unknown }, p: unknown): number => {
		const { x, y } = coordinates(p);
		return ((q.x as number) - (x as number)) ** 2 + ((q.y as number) - (y as number)) ** 2;
	};
	const inRect = (rect: unknown, point: unknown): boolean => {
		const { x, y, w, h } = rect as Record<string, number>;
		const p = coordinates(point) as { x: number; y: number };
		return (x as number) <= p.x && p.x <= (x as number) + (w as number) && (y as number) <= p.y && p.y <= (y as number) + (h as number);
	};
	const contains = (region: unknown, point: unknown): boolean => {
		if (isObject(region) && region["kind"] === "rect") return inRect(region, point);
		return ask("regionContains", region, point) === true;
	};

	// I1: an offered position is its point's nearest position, and the position at its point
	for (const p of c.positions) {
		if (!accepted(p)) continue;
		judge("I1", [p], () => {
			const point = ask("pointOf", p);
			const n = ask("nearest", point);
			if (!equalValue(n, p)) return failed(n);
			const at = ask("positionAt", point);
			return equalValue(at, p) ? null : failed(at);
		});
	}

	// I2: nearest is null or offered, and no offered case position or neighbour of it is strictly nearer
	for (const q of c.points) {
		judge("I2", [q], () => {
			const n = ask("nearest", q);
			if (n === null) return null;
			if (!offered(n)) return failed(n);
			const at = coordinates(q);
			const own = squaredDistance(at, ask("pointOf", n));
			for (const p of c.positions) {
				if (offered(p) && squaredDistance(at, ask("pointOf", p)) < own) return failed({ nearest: n, nearer: p });
			}
			for (const d of directionsOf()) {
				const m = ask("next", n, d);
				if (m !== null && offered(m) && squaredDistance(at, ask("pointOf", m)) < own) return failed({ nearest: n, nearer: m });
			}
			return null;
		});
	}

	// I3: positionAt is nearest exactly when nearest's point is the point
	for (const q of c.points) {
		judge("I3", [q], () => {
			const n = ask("nearest", q);
			const at = ask("positionAt", q);
			if (n === null) return at === null ? null : failed(at);
			const p = coordinates(ask("pointOf", n));
			const { x, y } = coordinates(q);
			const expected = p.x === x && p.y === y ? n : null;
			return equalValue(at, expected) ? null : failed(at);
		});
	}

	// I4: each entry offered, at its point, in the rect; the stride a power of two; no more than max; strides nest
	const answers: (Record<string, unknown> | null)[] = [];
	for (const v of c.views) {
		let answer: Record<string, unknown> | null = null;
		const args = v.hasOptions ? [v.view, v.options] : [v.view];
		judge("I4", args, () => {
			const r = ask("inView", ...args);
			if (!isObject(r) || !Array.isArray(r["positions"])) return failed(r);
			answer = r;
			if (!isStride(r["stride"])) return failed(r);
			const max = isObject(v.options) && v.options["max"] !== undefined ? v.options["max"] : 10000;
			if (!(r["positions"].length <= (max as number))) return failed(r);
			const region = (v.view as Record<string, unknown>)["region"];
			for (const entry of r["positions"] as unknown[]) {
				if (!isObject(entry)) return failed(entry);
				if (!offered(entry["position"])) return failed(entry);
				if (!equalValue(entry["point"], ask("pointOf", entry["position"]))) return failed(entry);
				if (!inRect(region, entry["point"])) return failed(entry);
			}
			return null;
		});
		answers.push(answer);
	}
	for (let i = 0; i < c.views.length; i++) {
		for (let j = i + 1; j < c.views.length; j++) {
			const a = answers[i], b = answers[j];
			const vi = c.views[i] as ViewPair, vj = c.views[j] as ViewPair;
			if (a === null || a === undefined || b === null || b === undefined || a["stride"] === b["stride"]) continue;
			if (!equalValue((vi.view as Record<string, unknown>)["region"], (vj.view as Record<string, unknown>)["region"])) continue;
			judge("I4", [vi.pair, vj.pair], () => {
				const [coarse, fine] = (a["stride"] as number) > (b["stride"] as number) ? [a, b] : [b, a];
				const kept = (fine["positions"] as unknown[]).map((e) => (e as Record<string, unknown>)["position"]);
				for (const e of coarse["positions"] as unknown[]) {
					const position = (e as Record<string, unknown>)["position"];
					if (!kept.some((k) => equalValue(k, position))) return failed(position);
				}
				return null;
			});
		}
	}

	// I5: directions frozen and paired; next is null or offered, and steps back by the opposite
	judge("I5", [], () => {
		const d = grid["directions"];
		if (!Array.isArray(d) || !Object.isFrozen(d)) return failed(d);
		for (const direction of d) {
			const o = ask("opposite", direction);
			if (!d.includes(o)) return failed({ direction, opposite: o });
			const back = ask("opposite", o);
			if (back !== direction) return failed({ direction, opposite: o, oppositeOfOpposite: back });
		}
		return null;
	});
	for (const p of c.positions) {
		if (!accepted(p)) continue;
		for (const d of directionsOf()) {
			judge("I5", [p, d], () => {
				const n = ask("next", p, d);
				if (n === null) return null;
				if (!offered(n)) return failed(n);
				const back = ask("next", n, ask("opposite", d));
				return equalValue(back, p) ? null : failed({ next: n, back });
			});
		}
	}

	// I6: span is symmetric, through holds its corners' points, covering holds what through holds
	for (const [from, to] of c.blocks) {
		judge("I6", [from, to], () => {
			const s = ask("span", from, to);
			const t = ask("span", to, from);
			if (!equalValue(s, t)) return failed({ span: s, reversed: t });
			if (!isObject(s)) return failed(s);
			if (!contains(s["through"], ask("pointOf", from)) || !contains(s["through"], ask("pointOf", to))) return failed(s);
			for (const q of c.points) if (contains(s["through"], q) && !contains(s["covering"], q)) return failed({ span: s, point: q });
			return null;
		});
	}
	for (const p of c.positions) {
		judge("I6", [p], () => {
			const s = ask("span", p, p);
			return isObject(s) && contains(s["covering"], ask("pointOf", p)) ? null : failed(s);
		});
	}

	// I7: a fixed schedule of calls, each made twice; the same answer, no -0, frozen to its depth
	const schedule: unknown[][] = [];
	for (const q of c.points) schedule.push(["nearest", q], ["positionAt", q]);
	for (const p of c.positions) {
		schedule.push(["offers", p], ["pointOf", p]);
		for (const d of directionsOf()) schedule.push(["next", p, d]);
	}
	for (const v of c.views) schedule.push(v.hasOptions ? ["inView", v.view, v.options] : ["inView", v.view]);
	for (const [from, to] of c.blocks) schedule.push(["span", from, to]);
	for (const r of c.rects) schedule.push(["enclosing", r]);
	for (const call of schedule) {
		judge("I7", call, () => {
			const [name, ...args] = call as [string, ...unknown[]];
			const first = ask(name, ...args);
			const second = ask(name, ...args);
			if (!sameAnswer(first, second)) return failed({ first, second });
			if (holdsNegativeZero(first) || holdsNegativeZero(second)) return failed(first);
			if (!frozenToDepth(first) || !frozenToDepth(second)) return failed(first);
			return null;
		});
	}

	// I8: enclosing gives a block of offered positions whose through holds the rect's corners and its case points
	for (const rect of c.rects) {
		judge("I8", [rect], () => {
			const b = ask("enclosing", rect);
			if (!isObject(b)) return failed(b);
			if (!offered(b["from"]) || !offered(b["to"])) return failed(b);
			const s = ask("span", b["from"], b["to"]);
			if (!isObject(s)) return failed({ block: b, span: s });
			const { x, y, w, h } = rect as Record<string, number>;
			const corners = [
				{ x, y },
				{ x: (x as number) + (w as number), y },
				{ x, y: (y as number) + (h as number) },
				{ x: (x as number) + (w as number), y: (y as number) + (h as number) },
			];
			for (const corner of corners) if (!contains(s["through"], corner)) return failed({ block: b, through: s["through"], corner });
			for (const q of c.points) if (inRect(rect, q) && !contains(s["through"], q)) return failed({ block: b, through: s["through"], point: q });
			return null;
		});
	}
}

/** Judges a shape over cases, returning a frozen array of failures, empty when none. */
export function checkGridShape(shape: GridShape, cases: readonly GridShapeCase[]): readonly GridShapeFailure[] {
	if (!isGridShape(shape)) throw malformed(FN, "shape must be a frozen plain object of exactly name, a non-empty string, and open, a function");
	const checked = readCases(cases);
	const failures: GridShapeFailure[] = [];
	for (const c of checked) judgeCase(shape, c, failures);
	return deepFreeze(failures);
}
