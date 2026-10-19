// doubles - neighbouring doubles, a seeded random source, and the points the exact tests aim at.
//
// The random source is seeded, so a failure reproduces; SNAP_GRID_SEED changes the seed.
import { exactIndices } from "./oracle.js";

const view = new DataView(new ArrayBuffer(8));

/** The least double greater than v. */
export function nextUp(v) {
	if (Number.isNaN(v) || v === Infinity) return v;
	if (v === 0) return Number.MIN_VALUE;
	view.setFloat64(0, v);
	const bits = view.getBigUint64(0);
	view.setBigUint64(0, v > 0 ? bits + 1n : bits - 1n);
	return view.getFloat64(0);
}

/** The greatest double less than v. */
export const nextDown = (v) => -nextUp(-v);

/** A seeded random source in [0, 1) (xorshift128+). */
export function seededRandom(seed = Number(process.env.SNAP_GRID_SEED ?? 20261020)) {
	let s0 = BigInt(seed) | 1n, s1 = 0x9e3779b97f4a7c15n;
	const mask = (1n << 64n) - 1n;
	return () => {
		let x = s0;
		const y = s1;
		s0 = y;
		x = (x ^ (x << 23n)) & mask;
		s1 = x ^ y ^ (x >> 17n) ^ (y >> 26n);
		return Number(((s1 + y) & mask) >> 11n) / 2 ** 53;
	};
}

/** Helpers over a random source: integers, log-uniform magnitudes, signs, picks. */
export function randomTools(rnd) {
	const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
	const magnitude = (bits) => Math.floor(rnd() * 2 ** int(0, bits));
	const sign = () => (rnd() < 0.5 ? -1 : 1);
	const pick = (list) => list[Math.floor(rnd() * list.length)];
	return { int, magnitude, sign, pick };
}

const LIMIT = 2 ** 50;

/** A random square declaration: pitch log-uniform from 1 to 2^50, origin log-uniform within 2^50, bounds or none. */
export function randomDeclaration(rnd, { bounds = rnd() < 0.5 } = {}) {
	const { int, magnitude, sign } = randomTools(rnd);
	const pitch = Math.max(1, Math.min(LIMIT, magnitude(50) + int(0, 1)));
	const origin = { x: sign() * magnitude(50) + 0, y: sign() * magnitude(50) + 0 };
	const declaration = { shape: "square", pitch, origin };
	if (!bounds) return declaration;
	for (let attempt = 0; attempt < 20; attempt++) {
		const a = [sign() * magnitude(50), sign() * magnitude(50)].sort((p, q) => p - q);
		const b = [sign() * magnitude(50), sign() * magnitude(50)].sort((p, q) => p - q);
		const lo = { x: a[0], y: b[0] }, hi = { x: a[1], y: b[1] };
		const has = (axis) => exactIndices(lo[axis], origin[axis], pitch).ceil <= exactIndices(hi[axis], origin[axis], pitch).floor;
		if (has("x") && has("y")) {
			return { ...declaration, bounds: { min: { x: lo.x + 0, y: lo.y + 0 }, max: { x: hi.x + 0, y: hi.y + 0 } } };
		}
	}
	return declaration;
}

/**
 * Coordinates aimed at one axis of a grid: random fractions, ties and their neighbours, lattice points
 * and their neighbours, points one rounding from either, tiny magnitudes, and the domain's edges.
 */
export function aimedCoordinate(rnd, pitch, origin) {
	const { int, magnitude, sign, pick } = randomTools(rnd);
	const kMax = Math.floor(LIMIT / pitch);
	const k = sign() * Math.floor(rnd() * (kMax + 1));
	const tie = k * pitch + origin + pitch / 2;
	const lattice = k * pitch + origin;
	const choice = int(0, 9);
	let v;
	if (choice === 0) v = sign() * magnitude(50) + rnd();
	else if (choice === 1) v = tie;
	else if (choice === 2) v = pick([nextUp, nextDown])(tie);
	else if (choice === 3) v = tie + sign() * 2 ** -int(0, 60);
	else if (choice === 4) v = lattice;
	else if (choice === 5) v = pick([nextUp, nextDown])(lattice);
	else if (choice === 6) v = lattice + sign() * 2 ** -int(0, 60);
	else if (choice === 7) v = sign() * 2 ** -int(0, 1074);
	else if (choice === 8) v = pick([LIMIT, -LIMIT, nextDown(LIMIT), nextUp(-LIMIT), LIMIT - 0.5, -LIMIT + 0.5]);
	else v = (rnd() * 2 - 1) * pitch * 3 + origin;
	return Math.abs(v) <= LIMIT ? v : Math.sign(v) * LIMIT;
}
