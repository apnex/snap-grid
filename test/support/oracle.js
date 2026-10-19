// oracle - exact rational answers for the square grid, BigInt over each double's exact value
// (CONTRACT.md SG2: "their tests hold the build to such an oracle").
//
// A finite double is m * 2^e exactly; every answer below is computed from those integers alone, so
// nothing in it rounds.

const view = new DataView(new ArrayBuffer(8));

/** The exact value of a finite double, as { num, den } with den a power of two. */
export function exactOf(v) {
	if (!Number.isFinite(v)) throw new RangeError(`exactOf: ${v} is not finite`);
	view.setFloat64(0, v);
	const bits = view.getBigUint64(0);
	const negative = bits >> 63n === 1n;
	const biased = Number((bits >> 52n) & 0x7ffn);
	let mantissa = bits & ((1n << 52n) - 1n);
	let exponent;
	if (biased === 0) exponent = -1074;
	else {
		mantissa |= 1n << 52n;
		exponent = biased - 1075;
	}
	const signed = negative ? -mantissa : mantissa;
	return exponent >= 0 ? { num: signed << BigInt(exponent), den: 1n } : { num: signed, den: 1n << BigInt(-exponent) };
}

/** floor(a / b) for b > 0. */
export function floorDiv(a, b) {
	const q = a / b;
	return a % b !== 0n && a < 0n ? q - 1n : q;
}

/** ceil(a / b) for b > 0. */
export const ceilDiv = (a, b) => -floorDiv(-a, b);

/** a / b rounded half toward the greater, for b > 0. */
export const roundHalfUpDiv = (a, b) => floorDiv(2n * a + b, 2n * b);

/** (v - origin) / pitch as the exact rational { n, d }, d > 0. */
function quotient(v, origin, pitch) {
	const { num, den } = exactOf(v);
	return { n: num - BigInt(origin) * den, d: BigInt(pitch) * den };
}

/** floor, ceil and round-half-up of (v - origin) / pitch, as BigInt. */
export function exactIndices(v, origin, pitch) {
	const { n, d } = quotient(v, origin, pitch);
	return { floor: floorDiv(n, d), ceil: ceilDiv(n, d), round: roundHalfUpDiv(n, d) };
}

const LIMIT = 2 ** 50;
const inDomain = (v) => Number.isFinite(v) && Math.abs(v) <= LIMIT;
const clampBig = (i, lo, hi) => (i < lo ? lo : i > hi ? hi : i);
const toNumber = (i) => Number(i) + 0;

/** The offered index range of a square declaration's axis ('x' or 'y'), as BigInt. */
export function offeredRange(declaration, axis) {
	const o = declaration.origin[axis];
	const lo = declaration.bounds ? declaration.bounds.min[axis] : -LIMIT;
	const hi = declaration.bounds ? declaration.bounds.max[axis] : LIMIT;
	return [exactIndices(lo, o, declaration.pitch).ceil, exactIndices(hi, o, declaration.pitch).floor];
}

/** The exact nearest offered position of a point, or null outside the domain. */
export function exactNearest(declaration, point) {
	if (!inDomain(point.x) || !inDomain(point.y)) return null;
	const out = {};
	for (const [axis, name] of [["x", "col"], ["y", "row"]]) {
		const [lo, hi] = offeredRange(declaration, axis);
		out[name] = toNumber(clampBig(exactIndices(point[axis], declaration.origin[axis], declaration.pitch).round, lo, hi));
	}
	return out;
}

/** The exact enclosing block of a rect, or null when an edge is not finite or lies outside the domain. */
export function exactEnclosing(declaration, rect) {
	const edges = { x: [rect.x, rect.x + rect.w], y: [rect.y, rect.y + rect.h] };
	if (![...edges.x, ...edges.y].every(inDomain)) return null;
	const from = {}, to = {};
	for (const [axis, name] of [["x", "col"], ["y", "row"]]) {
		const [lo, hi] = offeredRange(declaration, axis);
		const o = declaration.origin[axis];
		from[name] = toNumber(clampBig(exactIndices(edges[axis][0], o, declaration.pitch).floor, lo, hi));
		to[name] = toNumber(clampBig(exactIndices(edges[axis][1], o, declaration.pitch).ceil, lo, hi));
	}
	return { from, to };
}

/**
 * The exact index range of the offered positions whose coordinate lies from lo to hi on an axis, edges
 * included, as [first, last] BigInt, or null when none; no clamping to the domain, which changes no answer.
 */
export function exactViewRange(declaration, axis, lo, hi) {
	const [least, greatest] = offeredRange(declaration, axis);
	const o = declaration.origin[axis];
	const first = exactIndices(lo, o, declaration.pitch).ceil;
	const last = exactIndices(hi, o, declaration.pitch).floor;
	const a = first > least ? first : least;
	const b = last < greatest ? last : greatest;
	return a <= b ? [a, b] : null;
}

/** The exact point of a position, as BigInt coordinates. */
export function exactPointOf(declaration, position) {
	const p = BigInt(declaration.pitch);
	return { x: BigInt(position.col) * p + BigInt(declaration.origin.x), y: BigInt(position.row) * p + BigInt(declaration.origin.y) };
}
