// set-cap - V8's Set holds at most 2^24 entries, so a deep freeze that tracks what it freezes in one Set stops
// any answer of more than 2^24 objects (PAN-ZOOM's measurement: inView at 5,592,404 positions). Listing past
// that costs gigabytes; this stands in for it at a small size: for one call, the global Set holds at most `cap`
// entries, refusing another as V8 refuses the 2^24-and-first, so an answer frozen through a Set stops past it
// and an answer frozen as it is made does not.

/** Runs `call` with the global Set refusing more than `cap` entries per instance; the real Set is back after. */
export function withSetCap(cap, call) {
	const RealSet = globalThis.Set;
	class CappedSet extends RealSet {
		add(value) {
			if (this.size >= cap && !this.has(value)) throw new RangeError("Set maximum size exceeded");
			return super.add(value);
		}
	}
	globalThis.Set = CappedSet;
	try {
		return call();
	} finally {
		globalThis.Set = RealSet;
	}
}

/**
 * Runs `call` with the global Map refusing more than `cap` entries per instance, as V8 refuses the 2^24-and-first
 * ("Map maximum size exceeded"); the real Map is back after. The kit's copy of a failure's values tracks them in a
 * Map, so this stands in for a value of more than 2^24 arrays and objects at a small size.
 */
export function withMapCap(cap, call) {
	const RealMap = globalThis.Map;
	class CappedMap extends RealMap {
		set(key, value) {
			if (this.size >= cap && !this.has(key)) throw new RangeError("Map maximum size exceeded");
			return super.set(key, value);
		}
	}
	globalThis.Map = CappedMap;
	try {
		return call();
	} finally {
		globalThis.Map = RealMap;
	}
}
