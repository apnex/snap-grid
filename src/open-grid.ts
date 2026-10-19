/**
 * openGrid (CONTRACT.md, SG1): a declaration opened into a grid by the shape it names, or refused with
 * every problem it has.
 *
 * openGrid takes steps 1 to 3 itself -- a plain object, an own shape, a shape the call knows -- and
 * hands every later step to the shape, whose open returns what openGrid returns.
 * It never throws for any declaration; it throws a TypeError only for malformed options.
 */
import { malformed } from "./argument-check.js";
import { exactRecord } from "./plain-data.js";
import { isGridShape } from "./shape-form.js";
import { checkShapeName } from "./declaration-problems.js";
import { square } from "./square.js";
import type { GridShape, OpenGridOptions, OpenGridResult } from "./types.js";

function shapesOf(options: unknown): ReadonlyMap<string, GridShape> {
	const shapes = new Map<string, GridShape>([[square.name, square]]);
	if (options === undefined) return shapes;
	const o = exactRecord(options, [], ["shapes"]);
	if (o === null) throw malformed("openGrid", "options must be a plain object of shapes, or nothing else");
	if (!o.has("shapes")) return shapes;
	const list = o.get("shapes");
	if (!Array.isArray(list)) throw malformed("openGrid", "options.shapes must be an array of shapes");
	for (let i = 0; i < list.length; i++) {
		const shape: unknown = list[i];
		if (!isGridShape(shape)) throw malformed("openGrid", `options.shapes[${i}] must be a frozen plain object of exactly name, a non-empty string, and open, a function`);
		if (shapes.has(shape.name)) throw malformed("openGrid", `options.shapes[${i}] is named ${JSON.stringify(shape.name)}, a name ${shape.name === square.name ? "snap-grid ships" : "given twice"}`);
		shapes.set(shape.name, shape);
	}
	return shapes;
}

/** Opens a declaration into a grid, or refuses it with every problem it has. */
export function openGrid(declaration: unknown, options?: OpenGridOptions): OpenGridResult {
	const shapes = shapesOf(options);
	const named = checkShapeName(declaration, (name) => shapes.has(name));
	if ("problems" in named) return named.problems.refusal();
	return (shapes.get(named.name) as GridShape).open(declaration);
}
