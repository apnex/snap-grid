/**
 * Public surface of snap-grid (CONTRACT.md, SG10): openGrid and square, and nothing else.
 * The conformance kit, checkGridShape, is the package's second entry point, "@apnex/snap-grid/conformance".
 */
export { openGrid } from "./open-grid.js";
export { square } from "./square.js";
export type {
	DeclarationProblem,
	DeclarationProblemCode,
	Grid,
	GridBlock,
	GridShape,
	GridSpan,
	InViewAnswer,
	InViewEntry,
	InViewOptions,
	OpenGridOptions,
	OpenGridResult,
	Point,
	Rect,
	Region,
	SquareGrid,
	SquarePosition,
	View,
} from "./types.js";
