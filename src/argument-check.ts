/**
 * Argument checks shared by every function (CONTRACT.md, "Errors"): a malformed argument throws a
 * TypeError whose message begins with the function's name.
 *
 * A point may be any object, of any prototype, with number properties x and y, read once each through
 * ordinary property access, because consumers pass what they hold. Every other argument is a plain
 * object holding exactly the properties its form names, read through their descriptors.
 */
import { exactRecord } from "./plain-data.js";
import type { InViewOptions } from "./types.js";

/** A TypeError whose message begins with the function's name. */
export function malformed(fn: string, what: string): TypeError {
	return new TypeError(`${fn}: ${what}`);
}

/** The x and y of a point, read once each, or a TypeError. */
export function readPoint(fn: string, point: unknown, label = "point"): { readonly x: number; readonly y: number } {
	if (typeof point !== "object" || point === null) throw malformed(fn, `${label} must be an object with number properties x and y`);
	const { x, y } = point as { x: unknown; y: unknown };
	if (typeof x !== "number" || typeof y !== "number") throw malformed(fn, `${label} must be an object with number properties x and y`);
	return { x, y };
}

/** A rect as section 3.3 forms it: exactly kind 'rect', x, y, w and h, numbers, w and h not less than 0. */
export function readRect(fn: string, rect: unknown, label = "rect"): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
	const r = exactRecord(rect, ["kind", "x", "y", "w", "h"]);
	const form = `${label} must be a plain object of exactly kind 'rect', x, y, w and h, each of x, y, w and h a number, w and h not less than 0`;
	if (r === null || r.get("kind") !== "rect") throw malformed(fn, form);
	const x = r.get("x"), y = r.get("y"), w = r.get("w"), h = r.get("h");
	if (typeof x !== "number" || typeof y !== "number" || typeof w !== "number" || typeof h !== "number" || w < 0 || h < 0) throw malformed(fn, form);
	return { x, y, w, h };
}

/** A view: exactly region and scale, the region a rect with finite x, y, w, h, x + w and y + h, the scale finite and above 0. */
export function readView(fn: string, view: unknown): { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly scale: number } {
	const v = exactRecord(view, ["region", "scale"]);
	if (v === null) throw malformed(fn, "view must be a plain object of exactly region and scale");
	const region = readRect(fn, v.get("region"), "view.region");
	const { x, y, w, h } = region;
	if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h) || !Number.isFinite(x + w) || !Number.isFinite(y + h)) {
		throw malformed(fn, "view.region must have finite x, y, w, h, x + w and y + h");
	}
	const scale = v.get("scale");
	if (typeof scale !== "number" || !Number.isFinite(scale) || !(scale > 0)) throw malformed(fn, "view.scale must be a finite number above 0");
	return { x, y, w, h, scale };
}

/** inView's options, with their defaults: minSpacing 0, max 10000. */
export function readInViewOptions(fn: string, options: unknown): Required<InViewOptions> {
	if (options === undefined) return { minSpacing: 0, max: 10000 };
	const o = exactRecord(options, [], ["minSpacing", "max"]);
	if (o === null) throw malformed(fn, "options must be a plain object of minSpacing, max, both or neither");
	let minSpacing = 0, max = 10000;
	if (o.has("minSpacing")) {
		const v = o.get("minSpacing");
		if (typeof v !== "number" || !Number.isFinite(v) || !(v >= 0)) throw malformed(fn, "options.minSpacing must be a finite number at least 0");
		minSpacing = v;
	}
	if (o.has("max")) {
		const v = o.get("max");
		if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 2 ** 32 - 1) throw malformed(fn, "options.max must be an integer from 1 to 2^32 - 1");
		max = v;
	}
	return { minSpacing, max };
}
