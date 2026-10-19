/**
 * Exact per-axis indices (CONTRACT.md, SG2): floor, ceiling and round-half-up of (v - origin) / pitch,
 * computed exactly in binary64 for every double v of magnitude at most 2^50, every integer origin of
 * magnitude at most 2^50, and every integer pitch from 1 to 2^50.
 *
 * Math.round((v - origin) / pitch) rounds v - origin before it divides, so near a cell's edge it can
 * give the farther index. Splitting v into its integer part and its fraction keeps every step exact:
 * - n = trunc(v) and f = v - n are exact, f in (-1, 1);
 * - d = n - origin is an exact integer of magnitude at most 2^51;
 * - q = floor(d / pitch) is exact, since the quotient's rounding error, at most a quarter of 1 / pitch,
 *   is smaller than its distance to any integer it does not equal;
 * - r = d - q * pitch is exact, 0 <= r < pitch;
 * so (v - origin) / pitch = q + (r + f) / pitch, and (r + f) / pitch lies in (-1, 1), whose floor,
 * ceiling and rounding are decided by comparisons that are exact.
 * Every result is normalised from -0 to 0.
 */

interface IndexSplit {
	readonly q: number;
	readonly r: number;
	readonly f: number;
}

function splitIndex(v: number, origin: number, pitch: number): IndexSplit {
	const n = Math.trunc(v);
	const f = v - n;
	const d = n - origin;
	const q = Math.floor(d / pitch);
	const r = d - q * pitch;
	return { q, r, f };
}

/** floor((v - origin) / pitch), exactly. */
export function floorIndex(v: number, origin: number, pitch: number): number {
	const { q, r, f } = splitIndex(v, origin, pitch);
	return (r === 0 && f < 0 ? q - 1 : q) + 0;
}

/** ceil((v - origin) / pitch), exactly. */
export function ceilIndex(v: number, origin: number, pitch: number): number {
	const { q, r, f } = splitIndex(v, origin, pitch);
	return (r > 0 || f > 0 ? q + 1 : q) + 0;
}

/** (v - origin) / pitch rounded to an integer, half toward the greater as Math.round rounds, exactly. */
export function roundIndex(v: number, origin: number, pitch: number): number {
	const { q, r, f } = splitIndex(v, origin, pitch);
	// with t = r + f in (-1, pitch): one up when 2t >= pitch, one down when 2t < -pitch
	const m = 2 * r - pitch;
	const up = m >= 2 || (m > -2 && 2 * f >= -m);
	const down = 2 * r + pitch === 1 && 2 * f < -1;
	return (up ? q + 1 : down ? q - 1 : q) + 0;
}
