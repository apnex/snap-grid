/**
 * Reading plain objects without running a caller's code, and freezing what snap-grid returns
 * (CONTRACT.md, "Errors" and "What is returned").
 *
 * A plain object is a value whose prototype is Object.prototype or null (SG1).
 * Its properties are read through their descriptors, so a getter is never called; a property that is
 * an accessor holds no value. An object a Proxy makes unreadable -- a trap that throws -- is not a
 * plain object.
 */

/** One own property of a plain object: its value when it is a data property, or none for an accessor. */
export type OwnProperty = { readonly data: true; readonly value: unknown } | { readonly data: false };

/** True when the value is an object whose prototype is Object.prototype or null. */
export function isPlainObject(value: unknown): value is object {
	if (typeof value !== "object" || value === null) return false;
	try {
		const proto: unknown = Object.getPrototypeOf(value);
		return proto === Object.prototype || proto === null;
	} catch {
		return false;
	}
}

/**
 * The own string-named properties of a plain object, in their own order, each read through its
 * descriptor; null when the value is not a plain object or cannot be read.
 * Symbol-named properties are left out: no pointer can name one.
 */
export function ownStringProperties(value: unknown): Map<string, OwnProperty> | null {
	if (!isPlainObject(value)) return null;
	try {
		const out = new Map<string, OwnProperty>();
		for (const name of Object.getOwnPropertyNames(value)) {
			const descriptor = Object.getOwnPropertyDescriptor(value, name);
			if (descriptor === undefined) continue;
			out.set(name, "value" in descriptor ? { data: true, value: descriptor.value } : { data: false });
		}
		return out;
	} catch {
		return null;
	}
}

/**
 * The values of a plain object holding exactly the named properties, every one a data property, and no
 * other own property, string- or symbol-named; `optional` names those that may be absent.
 * Returns null when the value is not of that form.
 */
export function exactRecord(value: unknown, required: readonly string[], optional: readonly string[] = []): Map<string, unknown> | null {
	if (!isPlainObject(value)) return null;
	try {
		const keys = Reflect.ownKeys(value);
		const out = new Map<string, unknown>();
		for (const key of keys) {
			if (typeof key !== "string" || (!required.includes(key) && !optional.includes(key))) return null;
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (descriptor === undefined || !("value" in descriptor)) return null;
			out.set(key, descriptor.value);
		}
		for (const name of required) if (!out.has(name)) return null;
		return out;
	} catch {
		return null;
	}
}

/** Freezes a value snap-grid made, and every object and function reachable from it. */
export function deepFreeze<T>(value: T): T {
	const pending: unknown[] = [value];
	const seen = new Set<unknown>();
	while (pending.length > 0) {
		const item = pending.pop();
		if ((typeof item !== "object" || item === null) && typeof item !== "function") continue;
		if (seen.has(item)) continue;
		seen.add(item);
		Object.freeze(item);
		for (const key of Reflect.ownKeys(item)) {
			const descriptor = Object.getOwnPropertyDescriptor(item, key);
			if (descriptor !== undefined && "value" in descriptor) pending.push(descriptor.value);
		}
	}
	return value;
}
