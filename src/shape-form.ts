/**
 * The form of a shape (CONTRACT.md, SG11): a frozen plain object of exactly name and open, the name a
 * non-empty string and open a function.
 */
import { exactRecord } from "./plain-data.js";
import type { GridShape } from "./types.js";

/** True when the value is of a shape's form. */
export function isGridShape(value: unknown): value is GridShape {
	const r = exactRecord(value, ["name", "open"]);
	if (r === null || !Object.isFrozen(value)) return false;
	const name = r.get("name");
	return typeof name === "string" && name.length > 0 && typeof r.get("open") === "function";
}
