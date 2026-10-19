// ring-test - the shape in the tests alone (the design's appendix C, CONTRACT.md SG11), opened through
// options.shapes and never exported, to show that the port and the kit are not square by accident.
//
// One index, two directions that wrap, points that are not integers, and regions that are not rects.
// Its points are computed in binary64 by one expression, and every other answer -- its regions among
// them -- is defined through its own nearest and positionAt, so no two of its answers can disagree by
// a rounding; it proves the port, not geometry or precision.

const NAME = "ring-test";
const DOMAIN = 2 ** 40;
const STRIDE_LIMIT = 2 ** 52;
const DIRECTIONS = ["-slot", "+slot"];
const OPPOSITE = new Map([["-slot", "+slot"], ["+slot", "-slot"]]);

const isPlain = (v) => typeof v === "object" && v !== null && [Object.prototype, null].includes(Object.getPrototypeOf(v));
const ownData = (v) => new Map(Object.getOwnPropertyNames(v).map((k) => [k, Object.getOwnPropertyDescriptor(v, k)]).map(([k, d]) => [k, "value" in d ? d.value : undefined]));
const childPointer = (parent, name) => `${parent}/${name.replaceAll("~", "~0").replaceAll("/", "~1")}`;
const isInt = (v, lo, hi) => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;

function deepFreeze(value) {
	if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const k of Object.keys(value)) deepFreeze(value[k]);
	}
	return value;
}

function refuse(problems) {
	const sorted = [...problems].sort((a, b) => (a.pointer < b.pointer ? -1 : a.pointer > b.pointer ? 1 : a.problem < b.problem ? -1 : a.problem > b.problem ? 1 : 0));
	return deepFreeze({ ok: false, problems: sorted.filter((p, i) => i === 0 || p.pointer !== sorted[i - 1].pointer || p.problem !== sorted[i - 1].problem) });
}

// SG1's steps for { shape: 'ring-test', centre, radius, slots }; step 7 never applies
function check(declaration) {
	if (!isPlain(declaration)) return { problems: [{ pointer: "", problem: "not-an-object" }] };
	const root = ownData(declaration);
	if (!root.has("shape")) return { problems: [{ pointer: "/shape", problem: "missing-property" }] };
	if (root.get("shape") !== NAME) return { problems: [{ pointer: "/shape", problem: "unknown-shape" }] };
	const problems = [];
	for (const k of root.keys()) if (!["shape", "centre", "radius", "slots"].includes(k)) problems.push({ pointer: childPointer("", k), problem: "unknown-property" });
	for (const k of ["centre", "radius", "slots"]) if (!root.has(k)) problems.push({ pointer: `/${k}`, problem: "missing-property" });
	if (root.has("radius") && !isInt(root.get("radius"), 1, 2 ** 30)) problems.push({ pointer: "/radius", problem: "invalid-value" });
	if (root.has("slots") && !isInt(root.get("slots"), 3, 64)) problems.push({ pointer: "/slots", problem: "invalid-value" });
	if (root.has("centre")) {
		const centre = root.get("centre");
		if (!isPlain(centre)) problems.push({ pointer: "/centre", problem: "not-an-object" });
		else {
			const members = ownData(centre);
			for (const k of members.keys()) if (!["x", "y"].includes(k)) problems.push({ pointer: childPointer("/centre", k), problem: "unknown-property" });
			for (const k of ["x", "y"]) {
				if (!members.has(k)) problems.push({ pointer: `/centre/${k}`, problem: "missing-property" });
				else if (!isInt(members.get(k), -(2 ** 30), 2 ** 30)) problems.push({ pointer: `/centre/${k}`, problem: "invalid-value" });
			}
		}
	}
	if (problems.length > 0) return { problems };
	const c = root.get("centre");
	return { declaration: { shape: NAME, centre: { x: c.x + 0, y: c.y + 0 }, radius: root.get("radius"), slots: root.get("slots") } };
}

const typeError = (fn, what) => new TypeError(`${fn}: ${what}`);

function readPoint(fn, p) {
	if (typeof p !== "object" || p === null) throw typeError(fn, "point must be an object with number properties x and y");
	const { x, y } = p;
	if (typeof x !== "number" || typeof y !== "number") throw typeError(fn, "point must be an object with number properties x and y");
	return { x, y };
}

function readPosition(fn, p) {
	if (!isPlain(p) || Reflect.ownKeys(p).length !== 1 || !Object.prototype.hasOwnProperty.call(p, "slot") || !Number.isSafeInteger(p.slot)) {
		throw typeError(fn, "position must be a plain object of exactly slot, a safe integer");
	}
	return p.slot;
}

function readRect(fn, r) {
	const keys = isPlain(r) ? Reflect.ownKeys(r) : [];
	if (keys.length !== 5 || !["kind", "x", "y", "w", "h"].every((k) => keys.includes(k)) || r.kind !== "rect" || ["x", "y", "w", "h"].some((k) => typeof r[k] !== "number") || r.w < 0 || r.h < 0) {
		throw typeError(fn, "rect must be a plain object of exactly kind 'rect', x, y, w and h");
	}
	return r;
}

function readDirection(fn, d) {
	if (!OPPOSITE.has(d)) throw typeError(fn, `direction must be one of ${DIRECTIONS.join(", ")}`);
	return d;
}

function makeGrid(declaration) {
	const { centre, radius, slots } = declaration;
	const offered = (slot) => slot >= 0 && slot < slots;
	const pointAt = (slot) => {
		const a = (2 * Math.PI * slot) / slots;
		return { x: centre.x + radius * Math.cos(a) + 0, y: centre.y + radius * Math.sin(a) + 0 };
	};
	const points = Array.from({ length: slots }, (_, s) => pointAt(s));
	const distance = (q, p) => (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
	const inDomain = (v) => Number.isFinite(v) && Math.abs(v) <= DOMAIN;
	const nearestSlot = (q) => {
		if (!inDomain(q.x) || !inDomain(q.y)) return null;
		let best = 0;
		for (let s = 1; s < slots; s++) if (distance(q, points[s]) < distance(q, points[best])) best = s;
		return best;
	};
	const slotAt = (q) => {
		const s = nearestSlot(q);
		return s !== null && points[s].x === q.x && points[s].y === q.y ? s : null;
	};
	const inRect = (r, q) => r.x <= q.x && q.x <= r.x + r.w && r.y <= q.y && q.y <= r.y + r.h;
	const contains = (region, q) => {
		if (region.kind === "rect") return inRect(region, q);
		if (region.kind === "ring-points") {
			const s = slotAt(q);
			return s !== null && s >= region.from && s <= region.to;
		}
		if (!inDomain(q.x) || !inDomain(q.y)) return false;
		const least = Math.min(...points.map((p) => distance(q, p)));
		for (let s = region.from; s <= region.to; s++) if (distance(q, points[s]) === least) return true;
		return false;
	};
	const readRegion = (fn, region) => {
		if (isPlain(region) && (region.kind === "ring-points" || region.kind === "ring-cells")) {
			const keys = Reflect.ownKeys(region);
			if (keys.length === 3 && keys.includes("from") && keys.includes("to") && offered(region.from) && offered(region.to) && Number.isInteger(region.from) && Number.isInteger(region.to) && region.from <= region.to) return region;
			throw typeError(fn, "region must be a rect, or a ring-points or ring-cells region of offered slots from and to");
		}
		return readRect(fn, region);
	};
	const position = (slot) => deepFreeze({ slot });

	return deepFreeze({
		declaration: deepFreeze(declaration),
		directions: Object.freeze([...DIRECTIONS]),
		opposite: (d) => OPPOSITE.get(readDirection("opposite", d)),
		offers: (p) => offered(readPosition("offers", p)),
		nearest(q) {
			const s = nearestSlot(readPoint("nearest", q));
			return s === null ? null : position(s);
		},
		pointOf(p) {
			const slot = readPosition("pointOf", p);
			if (!offered(slot)) throw new RangeError("pointOf: the position is not representable");
			return deepFreeze(pointAt(slot));
		},
		positionAt(q) {
			const s = slotAt(readPoint("positionAt", q));
			return s === null ? null : position(s);
		},
		inView(view, options) {
			if (!isPlain(view) || !("region" in view) || !("scale" in view)) throw typeError("inView", "view must be a plain object of exactly region and scale");
			const r = readRect("inView", view.region);
			const minSpacing = options?.minSpacing ?? 0;
			const max = options?.max ?? 10000;
			const within = [];
			for (let s = 0; s < slots; s++) if (inRect(r, points[s])) within.push(s);
			const kept = (stride) => within.filter((s) => s % stride === 0);
			const apart = (list) => {
				for (let i = 0; i < list.length; i++) {
					for (let j = i + 1; j < list.length; j++) {
						const a = points[list[i]], b = points[list[j]];
						if (!(Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2) * view.scale >= minSpacing)) return false;
					}
				}
				return true;
			};
			let stride = 1;
			while (stride < STRIDE_LIMIT && !apart(kept(stride))) stride *= 2;
			while (stride < STRIDE_LIMIT && kept(stride).length > max) stride *= 2;
			return deepFreeze({ stride, positions: kept(stride).map((s) => ({ position: { slot: s }, point: pointAt(s) })) });
		},
		next(p, d) {
			const slot = readPosition("next", p);
			readDirection("next", d);
			if (!offered(slot)) return null;
			return position((slot + (d === "+slot" ? 1 : slots - 1)) % slots);
		},
		span(from, to) {
			const a = readPosition("span", from), b = readPosition("span", to);
			if (!offered(a) || !offered(b)) throw new RangeError("span: a position is not representable");
			const lo = Math.min(a, b), hi = Math.max(a, b);
			return deepFreeze({ through: { kind: "ring-points", from: lo, to: hi }, covering: { kind: "ring-cells", from: lo, to: hi } });
		},
		regionContains(region, q) {
			const r = readRegion("regionContains", region);
			return contains(r, readPoint("regionContains", q));
		},
		enclosing(rect) {
			const r = readRect("enclosing", rect);
			const corner = { x: r.x, y: r.y };
			if (r.x + r.w !== r.x || r.y + r.h !== r.y) return null;
			const s = slotAt(corner);
			return s === null ? null : deepFreeze({ from: { slot: s }, to: { slot: s } });
		},
	});
}

export const ringTest = deepFreeze({
	name: NAME,
	open(declaration) {
		const checked = check(declaration);
		if (checked.problems) return refuse(checked.problems);
		return deepFreeze({ ok: true, grid: makeGrid(checked.declaration) });
	},
});
