/**
 * The public types of snap-grid, one per noun of CONTRACT.md's vocabulary.
 * Every type is read-only: everything snap-grid returns is frozen to its depth.
 */

/** Any object with number properties x and y, whatever else it holds. */
export interface Point {
	readonly x: number;
	readonly y: number;
}

/** A square grid's position: its own integer coordinates. */
export interface SquarePosition {
	readonly col: number;
	readonly row: number;
}

/** The rect region, the kind every view and every enclosing takes, and the kind a square grid returns. */
export interface Rect {
	readonly kind: "rect";
	readonly x: number;
	readonly y: number;
	readonly w: number;
	readonly h: number;
}

/** A closed part of the plane, tagged by kind; each shape names the kinds it knows. */
export type Region = Rect | { readonly kind: string };

/** The rect being looked at, and its scale in screen units per plane unit. */
export interface View {
	readonly region: Rect;
	readonly scale: number;
}

/** inView's options: the least spacing on screen, and the most positions returned. */
export interface InViewOptions {
	readonly minSpacing?: number;
	readonly max?: number;
}

/** One position inView returns, with its point. */
export interface InViewEntry<P> {
	readonly position: P;
	readonly point: Point;
}

/** What inView returns: the stride chosen, and the positions in view, in the shape's order. */
export interface InViewAnswer<P> {
	readonly stride: number;
	readonly positions: readonly InViewEntry<P>[];
}

/** The region a block runs through, and the region its cells cover. */
export interface GridSpan<R = Region> {
	readonly through: R;
	readonly covering: R;
}

/** The positions between two corner positions, both included. */
export interface GridBlock<P> {
	readonly from: P;
	readonly to: P;
}

/** A grid opened from a declaration: every question CONTRACT.md's SG2 to SG9 name. */
export interface Grid<P = unknown, R extends Region = Region> {
	readonly declaration: unknown;
	readonly directions: readonly string[];
	opposite(direction: string): string;
	offers(position: P): boolean;
	nearest(point: Point): P | null;
	pointOf(position: P): Point;
	positionAt(point: Point): P | null;
	inView(view: View, options?: InViewOptions): InViewAnswer<P>;
	next(position: P, direction: string): P | null;
	span(from: P, to: P): GridSpan<R>;
	regionContains(region: R | Region, point: Point): boolean;
	enclosing(rect: Rect): GridBlock<P> | null;
}

/** A square grid. */
export type SquareGrid = Grid<SquarePosition, Rect>;

/** The problem codes of CONTRACT.md's SG1. */
export type DeclarationProblemCode =
	| "not-an-object"
	| "missing-property"
	| "unknown-shape"
	| "unknown-property"
	| "invalid-value"
	| "no-position-in-bounds";

/** One problem of a refused declaration: where it lies, as an RFC 6901 pointer, and its code. */
export interface DeclarationProblem {
	readonly pointer: string;
	readonly problem: DeclarationProblemCode;
}

/** What openGrid, and every shape's open, returns. */
export type OpenGridResult<G = Grid> =
	| { readonly ok: true; readonly grid: G }
	| { readonly ok: false; readonly problems: readonly DeclarationProblem[] };

/** A shape: a frozen object naming a kind of rule, and opening declarations of it. */
export interface GridShape {
	readonly name: string;
	open(declaration: unknown): OpenGridResult;
}

/** openGrid's options: shapes added to square. */
export interface OpenGridOptions {
	readonly shapes?: readonly GridShape[];
}

/** One case the conformance kit judges a shape over. */
export interface GridShapeCase {
	readonly name: string;
	readonly declaration: unknown;
	readonly points: readonly Point[];
	readonly positions: readonly unknown[];
	readonly views: readonly { readonly view: View; readonly options?: InViewOptions }[];
	readonly blocks: readonly (readonly [unknown, unknown])[];
	readonly rects: readonly Rect[];
}

/** The invariants the kit names in a failure. */
export type GridShapeInvariant = "open" | "I1" | "I2" | "I3" | "I4" | "I5" | "I6" | "I7" | "I8";

/** One failure the kit records: the invariant, the case's name, the arguments, and what the kit saw. */
export interface GridShapeFailure {
	readonly invariant: GridShapeInvariant;
	readonly case: string;
	readonly args: readonly unknown[];
	readonly got: unknown;
}
