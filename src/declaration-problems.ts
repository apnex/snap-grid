/**
 * The problem records of a refused declaration (CONTRACT.md, SG1): RFC 6901 pointers, and one order.
 */
import { deepFreeze, ownStringProperties, type OwnProperty } from "./plain-data.js";
import type { DeclarationProblem, DeclarationProblemCode, OpenGridResult } from "./types.js";

/** A pointer to a member of the value a pointer names: "~" written "~0" and "/" written "~1". */
export function childPointer(parent: string, name: string): string {
	return `${parent}/${name.replaceAll("~", "~0").replaceAll("/", "~1")}`;
}

/** Collects problems, then orders them by pointer and then by problem, by UTF-16 code unit, with no record twice. */
export class ProblemList {
	readonly #items: DeclarationProblem[] = [];

	add(pointer: string, problem: DeclarationProblemCode): void {
		this.#items.push({ pointer, problem });
	}

	get size(): number {
		return this.#items.length;
	}

	/** True when a problem lies at the pointer or beneath it. */
	hasAtOrBeneath(pointer: string): boolean {
		return this.#items.some((p) => p.pointer === pointer || p.pointer.startsWith(`${pointer}/`));
	}

	/** The refusal: a fresh, frozen, ordered list of fresh records. */
	refusal(): OpenGridResult<never> {
		const ordered = [...this.#items].sort((a, b) => (a.pointer < b.pointer ? -1 : a.pointer > b.pointer ? 1 : a.problem < b.problem ? -1 : a.problem > b.problem ? 1 : 0));
		const problems: DeclarationProblem[] = [];
		for (const p of ordered) {
			const last = problems[problems.length - 1];
			if (last !== undefined && last.pointer === p.pointer && last.problem === p.problem) continue;
			problems.push({ pointer: p.pointer, problem: p.problem });
		}
		return deepFreeze({ ok: false, problems });
	}
}

/** The value of an own property when it is a data property; undefined for an accessor or an absent one. */
export const dataValue = (p: OwnProperty | undefined): unknown => (p !== undefined && p.data ? p.value : undefined);

/** Steps 1 to 3: the shape a declaration names, when it is a plain object naming one the call knows. */
export function checkShapeName(declaration: unknown, knows: (name: string) => boolean): { readonly name: string; readonly root: Map<string, OwnProperty> } | { readonly problems: ProblemList } {
	const problems = new ProblemList();
	const root = ownStringProperties(declaration);
	if (root === null) {
		problems.add("", "not-an-object");
		return { problems };
	}
	const shape = root.get("shape");
	if (shape === undefined) {
		problems.add("/shape", "missing-property");
		return { problems };
	}
	const name = dataValue(shape);
	if (typeof name !== "string" || !knows(name)) {
		problems.add("/shape", "unknown-shape");
		return { problems };
	}
	return { name, root };
}

