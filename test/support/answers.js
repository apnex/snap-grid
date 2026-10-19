// answers - what every answer is held to (CONTRACT.md, "What is returned"): frozen to its depth, no -0.

/** True when the value and everything reachable from it through own properties is frozen. */
export function isFrozenToDepth(value, seen = new Set()) {
	if ((typeof value !== "object" || value === null) && typeof value !== "function") return true;
	if (seen.has(value)) return true;
	seen.add(value);
	if (!Object.isFrozen(value)) return false;
	for (const key of Reflect.ownKeys(value)) {
		const d = Object.getOwnPropertyDescriptor(value, key);
		if ("value" in d && !isFrozenToDepth(d.value, seen)) return false;
	}
	return true;
}

/** True when the value holds -0 anywhere. */
export function holdsNegativeZero(value, seen = new Set()) {
	if (Object.is(value, -0)) return true;
	if (typeof value !== "object" || value === null || seen.has(value)) return false;
	seen.add(value);
	return Object.values(value).some((v) => holdsNegativeZero(v, seen));
}

/** The node:test diagnostic for a mismatch, shortened for a long list. */
export const describe = (value) => JSON.stringify(value, (k, v) => (Object.is(v, -0) ? "-0" : typeof v === "bigint" ? `${v}n` : v));
