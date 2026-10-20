/**
 * openGrid (CONTRACT.md, SG1): a declaration opened into a grid by the shape it names, or refused with
 * every problem it has.
 *
 * openGrid takes steps 1 to 3 itself -- a plain object, an own shape, a shape the call knows -- and
 * hands every later step to the shape, whose open returns what openGrid returns, unwrapped. It never
 * throws for any declaration it opens with square, nor with an added shape that keeps SG11, which the
 * conformance kit checks; it throws a TypeError for malformed options.
 */
import { malformed, readArray } from "./argument-check.js";
import { checkShapeName } from "./declaration-problems.js";
import { exactRecord } from "./plain-data.js";
import { readGridShape } from "./shape-form.js";
import { square } from "./square.js";
import type { OpenGridOptions, OpenGridResult } from "./types.js";

interface KnownShape {
	readonly shape: unknown;
	readonly open: (declaration: unknown) => unknown;
}

function shapesOf(options: unknown): ReadonlyMap<string, KnownShape> {
	const shapes = new Map<string, KnownShape>([[square.name, { shape: square, open: square.open }]]);
	if (options === undefined) return shapes;
	const o = exactRecord(options, [], ["shapes"]);
	if (o === null) throw malformed("openGrid", "options must be a plain object of shapes, or nothing else");
	if (!o.has("shapes")) return shapes;
	const list = readArray("openGrid", o.get("shapes"), "options.shapes");
	list.forEach((shape, i) => {
		const parts = readGridShape(shape);
		if (parts === null) throw malformed("openGrid", `options.shapes[${i}] must be a frozen plain object of exactly name, a non-empty string, and open, a function`);
		if (shapes.has(parts.name)) throw malformed("openGrid", `options.shapes[${i}] is named ${JSON.stringify(parts.name)}, a name ${parts.name === square.name ? "snap-grid ships" : "given twice"}`);
		shapes.set(parts.name, { shape, open: parts.open });
	});
	return shapes;
}

/** Opens a declaration into a grid, or refuses it with every problem it has. */
export function openGrid(declaration: unknown, options?: OpenGridOptions): OpenGridResult {
	const shapes = shapesOf(options);
	const named = checkShapeName(declaration, (name) => shapes.has(name));
	if ("problems" in named) return named.problems.refusal();
	const known = shapes.get(named.name) as KnownShape;
	return Reflect.apply(known.open, known.shape, [declaration]) as OpenGridResult;
}
