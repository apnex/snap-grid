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
