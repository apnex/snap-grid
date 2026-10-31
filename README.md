# snap-grid

Answer, for a grid declared as data, where its positions lie in a plane and which position lies nearest a point.

---

## Install

snap-grid is released only as a tarball attached to a GitHub release, made by its own CI, so a consumer names the release file and its lockfile pins the file's hash.

Choose a release from the repository's Releases page, `https://github.com/apnex/snap-grid/releases`, and name its file in your `package.json`, writing that release's version for `<version>`:
```json
"dependencies": {
  "@apnex/snap-grid": "https://github.com/apnex/snap-grid/releases/download/v<version>/apnex-snap-grid-<version>.tgz"
}
```

Then install, which records the file's `integrity` in `package-lock.json`, so every `npm ci` refuses a file whose hash differs:
```bash
npm install
```

The package has two export paths, as `package.json`'s `exports` gives: `@apnex/snap-grid` maps to `index.js` in the package's `dist` folder, and `@apnex/snap-grid/conformance` to `conformance.js` beside it; each imports the other files of `dist` by relative path.\
A browser loads them as ES2022 modules, so a page either maps each bare name to its file with one import-map entry per export, never a trailing-slash prefix, which would map `@apnex/snap-grid/conformance` to an address with no `.js`, or imports `dist/index.js` by its own relative path where the page serves a copy of the release's files.

Map both names in the page's import map, writing where the page serves the package for `/vendor/snap-grid`:
```html
<script type="importmap">{ "imports": { "@apnex/snap-grid": "/vendor/snap-grid/dist/index.js", "@apnex/snap-grid/conformance": "/vendor/snap-grid/dist/conformance.js" } }</script>
```

---

## Use

Open a grid from a declaration, then ask it; every answer is exact over coordinates within 2^50, and frozen.\
This section is the whole surface a consumer handles: two functions, the grid one opens, and the shapes they take and answer; `CONTRACT.md` gives every rule, SG1 to SG11.

### Opening a grid

Open the grid and ask it the nearest position to a point, and where that position lies:
```js
import { openGrid } from "@apnex/snap-grid";

const opened = openGrid({ shape: "square", pitch: 60, origin: { x: 30, y: 30 }, bounds: { min: { x: -930, y: -510 }, max: { x: 930, y: 510 } } });
if (!opened.ok) throw new Error(JSON.stringify(opened.problems));
const { grid } = opened;
const position = grid.nearest({ x: 47, y: -12 });
const point = grid.pointOf(position);
```

`openGrid(declaration, options?)` answers `{ ok: true, grid }` or `{ ok: false, problems }`, and never throws for any declaration, so check `ok`; it throws a `TypeError` only for malformed `options`.

| Shape | Holds |
|---|---|
| square declaration | `shape: "square"`; `pitch`, an integer from 1 to 2^50; `origin`, `{ x, y }` of integers of magnitude at most 2^50; optionally `bounds`, `{ min, max }`, each of `origin`'s form, `min` at most `max` on each axis; nothing else |
| problem | `pointer`, a JSON Pointer into the declaration, `""` the declaration itself; `problem`, one of `not-an-object`, `missing-property`, `unknown-shape`, `unknown-property`, `invalid-value`, `no-position-in-bounds` |
| `options` | optionally `shapes`, an array of shapes of your own added to `square` (SG11) |
| shape | `square`, exported beside `openGrid`, or one of your own: a frozen `{ name, open }`, `open(declaration)` answering as `openGrid` does |

`grid.declaration` is a frozen copy of the declaration, `-0` written `0`; a grid holds nothing else and never changes.\
In TypeScript, `openGrid` answers a grid of positions it cannot know; a square grid's type is `SquareGrid`, `opened.grid as SquareGrid`.

### Asking a grid

| Function | Takes | Answers |
|---|---|---|
| `grid.nearest(point)` | a point | the offered position nearest it, a coordinate exactly halfway going to the greater; `null` for a coordinate not finite or beyond 2^50 |
| `grid.pointOf(position)` | a position | the point it lies at, `{ x: col * pitch + origin.x, y: row * pitch + origin.y }` on a square grid |
| `grid.positionAt(point)` | a point | the offered position the point lies exactly on, by `===`, or `null` |
| `grid.offers(position)` | a position | whether it is offered: representable, and within the bounds when there are any |
| `grid.inView(view, options?)` | a view, and optionally `{ minSpacing, max }` | `{ stride, positions }`, the offered positions in the view's rect at every `stride`-th index, each `{ position, point }`, by row then by column |
| `grid.next(position, direction)` | a position, a direction | the neighbour that way when both it and the position are offered, or `null` |
| `grid.directions`, `grid.opposite(direction)` | a direction | the directions, `-x`, `+x`, `-y` and `+y` on a square grid; each one's opposite |
| `grid.span(from, to)` | two positions, in either order | `{ through, covering }`: the rect through every point of the block, and the rect covering every cell |
| `grid.regionContains(region, point)` | a region, a point | whether the point lies in it, edges included |
| `grid.enclosing(rect)` | a rect | the smallest block `{ from, to }` of offered positions whose `through` contains the rect, clamped to the offered positions; `null` for an edge not finite or beyond 2^50 |

| Shape | Holds |
|---|---|
| point | any object with number properties `x` and `y`, whatever else it holds -- a plain object, a `DOMPoint`, an entity of yours |
| position | on a square grid, `{ col, row }`, each a safe integer |
| rect | `{ kind: "rect", x, y, w, h }`, `w` and `h` at least 0; its edges are `x`, `y`, `x + w` and `y + h` |
| view | `{ region, scale }`: the rect being looked at, and `scale` in screen units per plane unit, finite and above 0 |
| `inView` options | `minSpacing`, the least distance on screen between neighbouring positions, default 0; `max`, the most positions answered, default 10000 |

The traps that bite here:
- A point outside the bounds still has a nearest position: `nearest` clamps to the edge of what is offered, and `enclosing` clamps likewise, a rect wholly beyond one side giving a block of the one edge position there.
- `positionAt` asks for exact equality, so a coordinate one rounding off a position answers `null`; the test `(v - origin) % pitch === 0` disagrees with it where `v - origin` rounds, and beyond the bounds.
- A position whose point would lie beyond 2^50 is well formed but not representable: `pointOf` and `span` throw a `RangeError` for it, where every other question answers `null` or `false`.
- A point is read through ordinary property access, so a `DOMPoint`'s getters answer; every other argument -- a position, a rect, a view, options -- is read through its own data properties, must be a plain object holding the properties its form names and no other, and a getter on it is refused.
- `inView` thins as you zoom out: the stride doubles until `pitch * scale * stride` reaches `minSpacing` and until no more than `max` positions are answered, and a greater stride's positions are a subset of a lesser's, so no position moves.
- `scale` is one number: under a root scaled differently on each axis, or sheared, the guide below gives the conservative scale to pass, the smallest stretch of the root's transform.
- Which of your things owns a point is your data, not snap-grid's question; the item drawn under a point on the screen is `vector-scene`'s `itemAt`.
- No answer holds `-0`.

### Proving a shape of your own

`checkGridShape(shape, cases)`, from `@apnex/snap-grid/conformance`, judges a shape through the port and answers a frozen array of failures, empty when there is none:
```js
import { checkGridShape } from "@apnex/snap-grid/conformance";
import { square } from "@apnex/snap-grid";

const failures = checkGridShape(square, [{ name: "unbounded", declaration: { shape: "square", pitch: 10, origin: { x: 0, y: 0 } }, points: [{ x: 3, y: -7 }], positions: [{ col: 1, row: 2 }], views: [{ view: { region: { kind: "rect", x: 0, y: 0, w: 100, h: 50 }, scale: 1 } }], blocks: [[{ col: 0, row: 0 }, { col: 2, row: 1 }]], rects: [{ kind: "rect", x: 1, y: 1, w: 5, h: 5 }] }]);
```

| Shape | Holds |
|---|---|
| case | `name`; a `declaration` the shape admits; the arguments to judge over -- `points`, representable `positions`, `views` as `{ view, options? }`, `blocks` as `[from, to]` pairs of representable positions, and `rects` that the `through` of some block of offered positions contains |
| failure | `invariant`, `"open"` or `"I1"` to `"I8"`; `case`, the case's name; `args`, the arguments; `got`, what the kit saw, a diagnostic whose form is not part of the contract |

The kit judges what the port can show; what it cannot -- that a nearest position is nearest among every position, that `inView` misses none -- your shape proves in its own tests.

### Errors

A malformed argument throws a `TypeError` whose message begins with the function's name, and an error a getter or a `Proxy` trap throws while an argument is read is rethrown as that `TypeError`.\
A well-formed position that is not representable, given to `pointOf` or `span`, throws a `RangeError`.\
A coordinate that is a number but not finite, or beyond 2^50, is well formed: `nearest` and `positionAt` answer `null` for it, and `enclosing` for a rect with such an edge.

---

## Test

The gate builds, runs every test, the vocabulary, runtime, clock and chance, and export-map checks, and mission-kit's style checks over the Markdown.\
The tests, and the consumer test, run under `test-harness`'s runner, a development dependency pinned to its release file, which fails a run that leaves a file, a folder or a process behind.

Run the gate with a mission-kit checkout beside this repository, or with `MISSION_KIT` naming one:
```bash
npm ci
npm run gate
```

The consumer test packs the package, installs the file into an empty project, imports every export in Node, and loads every export in headless Chrome through an import map:
```bash
npm run consumer
```

---

## Remove

Remove the dependency, and with it the lockfile's entry:
```bash
npm uninstall @apnex/snap-grid
```

Then remove the import-map entries of each page that loads it, or the copy of its files the page serves, and any shape you proved with its kit.

---

## Status

Experimental until mission-kit admits it; it runs in the Node versions `package.json`'s `engines` names, and in browsers that support ES2022 modules.

---

## Documents

- `VISION.md` - why it exists, and what it will never be.
- `CONTRACT.md` - what a consumer can depend on, one capability per row, and every rule.
- `docs/DECISIONS.md` - the rulings about this component, and the choices made at each build.
- `test/corpus/README.md` - how the corpus that holds it to its first consumer's arithmetic was made.
- The guide to using `input-capture`, `input-binding`, `vector-scene` and `snap-grid` together, with the tester as its worked example: `docs/GUIDE.md` in `https://github.com/apnex/input-tester`, written with the tester's first release.
