---
id: unminted
category: component
title: snap-grid - answer where a grid's positions lie and which lies nearest a point
status: draft
hydrate-when: Two or more parts of your system snap to, draw or validate against the same grid, and each is about to write its own grid arithmetic
sovereignty: internal
supersedes: []
related: [C0, A3]
---

# snap-grid

The contract of record for snap-grid `0.1.1`, each rule stated on its own terms; what was settled at each build is in `docs/DECISIONS.md` (`D2` for `0.1.0`, `D3` for `0.1.1`, whose built files are `0.1.0`'s).\
It also carries the fields of a mission-kit registry entry, and that entry is generated from this file when the component is filed, never written as a second copy.\
The registry id is unminted on purpose; one is minted only when the entry is admitted to the registry.

---

## Duty

Answer, for a grid declared as data, where its positions lie in a plane and which position lies nearest a point.

That is the whole duty.\
It does not also draw a grid, hold which grids an application has, decide what may sit at a position, keep anything between calls, or move anything -- each of those is the consumer's or another component's.

---

## Contract

**Vocabulary.**\
These are the only nouns snap-grid's source uses for what it handles.

| Word | Meaning |
|---|---|
| plane | the two-dimensional space a consumer's coordinates live in; snap-grid assumes nothing of which way its axes point |
| point | any object with number properties `x` and `y`, whatever else it holds -- a plain object, a `DOMPoint`, an entity |
| grid | a set of positions with a rule for where each lies, opened from a declaration |
| declaration | plain JSON data naming a grid's shape and its parameters |
| shape | the kind of rule a grid follows -- `square` is the one shipped |
| position | a grid's own integer coordinates for one of its places -- `{ col, row }` on a square grid |
| domain | the coordinates a shape computes exactly; a square grid's is every number of magnitude at most 2^50 (SG2) |
| representable | a position whose point lies in the shape's domain |
| offered | a representable position whose point lies within the grid's bounds, or any representable position when it has none |
| bounds | an optional box in the plane limiting which positions are offered |
| cell | the closed part of the plane nearer to one position than to any other position of the same shape with no bounds -- bounds never change a cell |
| block | the positions between two corner positions, both included |
| region | a closed part of the plane, tagged by kind; a `rect`, `{ kind: 'rect', x, y, w, h }` with `w` and `h` at least 0, is the kind every view and every `enclosing` takes, and the kind a square grid returns |
| view | `{ region, scale }`: the rect being looked at, and `scale` in screen units per plane unit |
| stride | how many positions apart, on each index, the positions offered for a view are |
| direction | a name for a step from one position to its neighbour, each shape naming its own and pairing each with its opposite |

**Capabilities.**\
What a consumer can depend on, one capability per row.\
A capability is named for what it offers, not for who offers it, so two components that provide the same capability share its name, and the overlap is visible.\
**Provides** means this component implements the capability.\
**Requires** names the capabilities of other components a row depends on, as `component:capability`.\
The trait column names any trait a system takes on by using the capability.

| Capability | Relation | Requires | What a consumer can depend on | Trait |
|---|---|---|---|---|
| `declared-grid` | provides | none | A declaration is opened into a grid, or refused with every problem it has, each naming where it lies (SG1). | none |
| `nearest-grid-position` | provides | none | The offered position nearest a point (SG3). | none |
| `grid-position-point` | provides | none | The point any representable position lies at (SG4). | none |
| `exact-grid-position` | provides | none | The offered position a point lies exactly on, or none (SG5). | none |
| `grid-positions-in-view` | provides | none | The offered positions within a view, thinned to a spacing on screen, in one order (SG6). | none |
| `next-grid-position` | provides | none | The offered neighbour of an offered position in a named direction, or none (SG7). | none |
| `grid-position-span` | provides | none | The region a block runs through and the region its cells cover (SG8). | none |
| `enclosing-grid-block` | provides | none | The smallest block of offered positions whose span runs through a rect, or the shape's answer where none does (SG9). | none |
| `grid-shape-conformance` | provides | none | A kit that judges whether a shape keeps the invariants below over cases it is given (SG11). | none |

None requires another component's capability, and none brings a trait: snap-grid keeps nothing between calls, coordinates no actors and contains no model.

**Errors.**\
Every function validates its arguments before it computes.\
A point may be any object, of any prototype, with number properties `x` and `y`, because consumers pass what they hold -- a `DOMPoint`, or an entity of their own; a position, a region, a view and an options argument are plain objects (SG1) holding the properties their forms name and no other, an options argument any of its properties or none.\
A point is a non-null value of type `object`, so a function is not one; its `x` and `y` are read once each through ordinary property access, so a `DOMPoint`'s getters answer, while every other argument is read through its own data properties, so no getter of it is called.\
An error a getter or a Proxy trap throws while an argument is read is rethrown as the function's own `TypeError`, its message beginning with the function's name.\
A malformed argument -- a point that is not an object with number `x` and `y`, a position not of the shape's form, a region or view not of the vocabulary's form, an option out of range, a direction the grid does not list -- throws a `TypeError` whose message begins with the function's name.\
A well-formed position that is not representable, given to `pointOf` or `span`, throws a `RangeError`.\
A rect is malformed unless `x`, `y`, `w` and `h` are numbers and `w` and `h` are each at least 0, so a `w` or `h` that is `NaN` is malformed and an infinite one is not; its edges are `x`, `y`, `x + w` and `y + h` as binary64 computes them.\
A point with a coordinate that is a number but not finite, or outside the shape's domain, is well formed, and `nearest` and `positionAt` answer `null` for it; so is a rect with such an edge, and `enclosing` answers `null` for it.\
`openGrid` never throws for any declaration; it throws a `TypeError` only for malformed `options`.\
That guarantee, and that what it returns is fresh and frozen, hold for `square` and for an added shape that keeps SG11, which the kit checks (SG11, `open`); `openGrid` hands a declaration to the shape it names and returns its answer as it is, never wrapping an added shape.

**What is returned.**\
Every value snap-grid returns -- a grid, an open result, a problem list, a position, a point, a region, an `inView` answer, a span, a block, a failure list -- is made afresh by the call and frozen to its depth; nothing a caller passes is frozen, kept or changed.

**SG1 -- A declaration, opened or refused.**\
`openGrid(declaration, options?)` returns `{ ok: true, grid }` or `{ ok: false, problems }`.\
A problem is a record of exactly `pointer`, an RFC 6901 pointer into the declaration (`~` written `~0`, `/` written `~1`), and `problem`, one of the codes below.\
Problems are ordered by pointer and then by problem, each compared by UTF-16 code unit as JavaScript's `<` compares strings, and no record appears twice.

A plain object is a value whose prototype is `Object.prototype` or `null`.\
The checks run in this order; a check that fails at a pointer suppresses every check beneath that pointer, and none at a sibling's.\
A member is valid when no problem lies at its pointer or beneath it.

| Step | When | Problem, at pointer |
|---|---|---|
| 1 | the declaration is not a plain object | `not-an-object` at `""`, and nothing else |
| 2 | it has no own `shape` | `missing-property` at `/shape`, and nothing else |
| 3 | `shape` is not a string naming a shape the call knows | `unknown-shape` at `/shape`, and nothing else |
| 4 | an own property other than those the shape names | `unknown-property` at `/<name>`, one each |
| 5 | a required property is absent | `missing-property` at `/<name>` |
| 6 | a property is present and not of its form | the form's problem, below |
| 7 | steps 1 to 6 found no problem anywhere in the declaration, and the bounds offer no position | `no-position-in-bounds` at `/bounds` |

A square declaration names `shape: 'square'`, `pitch`, `origin` and, optionally, `bounds`:

| Property | Form | When not of the form |
|---|---|---|
| `pitch` | an integer from 1 to 2^50 | `invalid-value` at `/pitch` |
| `origin` | a plain object of exactly `x` and `y`, each an integer of magnitude at most 2^50 | `not-an-object` at `/origin`; else, per member, `unknown-property`, `missing-property` or `invalid-value` at `/origin/<name>` |
| `bounds` | a plain object of exactly `min` and `max`, each a point of the same form as `origin`, with `min.x <= max.x` and `min.y <= max.y` | as for `origin`, at `/bounds` and beneath it; when `min` and `max` are both valid and an axis is reversed, `invalid-value` at `/bounds/max/x` or `/bounds/max/y` |

`options.shapes` is an array of shapes (SG11) added to `square`; a shape that is not of SG11's form, or a name given twice or equal to `square`, makes `openGrid` throw a `TypeError`.\
`grid.declaration` is a recursively frozen copy, `-0` written `0`; the grid holds nothing else and never changes.\
Tested by: `test/contract/declared-grid.test.js`.

**SG2 -- The domain, exactness, and what the grid offers.**\
A square grid's domain is every number of magnitude at most 2^50, and every answer it gives is exact: each formula below is stated in real arithmetic, and is computed exactly for every input in the domain, so no answer needs a tolerance.\
Over integers, binary64 is exact already: the offered ranges, `pointOf` and `span` form only integers and half-integers below 2^52 in magnitude, and a quotient of two integers that size rounds onto the correct side of every integer and half-integer.\
Over a coordinate that is not an integer it is not: `Math.round((v - origin) / pitch)` rounds `v - origin` before it divides, and on a grid of pitch 60 and origin 30 sends `v = -60 - 2^-47` to the position at -30 when the one at -90 is nearer.\
So `nearest`, `inView` and `enclosing` compute exactly; splitting `v` into its integer part and its fraction does it in binary64, as that rule checked against an exact rational oracle over 300,000 points showed, and their tests hold the build to such an oracle (`test/support/oracle.js`).\
On each axis, the least and greatest offered index are `ceil((lo - origin) / pitch)` and `floor((hi - origin) / pitch)`, where `lo` and `hi` are the bounds on that axis, or -2^50 and 2^50 with no bounds; so every offered index is below 2^52 in magnitude.\
`nearest`, `positionAt`, `inView`, `next` and `enclosing` answer only with offered positions; `pointOf` and `span` compute for any representable position, because they compute rather than choose.\
`grid.offers(position)` says whether a well-formed position is offered.\
Tested by: `test/contract/grid-position-point.test.js` and, against the oracle, the tests of SG3, SG6 and SG9.

**SG3 -- Nearest.**\
`grid.nearest(point)` returns the offered position whose point is nearest, or `null` for a coordinate that is not finite or lies outside the domain.\
On a square grid, on each axis: `(v - origin) / pitch` rounded to an integer, half toward the greater as `Math.round` rounds, computed exactly (SG2), clamped to the least and greatest offered index, then `+ 0`.\
So a coordinate exactly halfway between two positions goes to the greater, and no index is `-0`.\
Per-axis rounding and clamping is exactly nearest, because each cell is a square and the offered positions form a rectangle.\
Tested by: `test/contract/nearest-grid-position.test.js`.

**SG4 -- Where a position lies.**\
`grid.pointOf(position)` returns its point; a square position is a plain object of exactly `col` and `row`, each a safe integer.\
On a square grid: `{ x: col * pitch + origin.x + 0, y: row * pitch + origin.y + 0 }`; a position whose point would lie outside the domain throws a `RangeError`, and one whose indices are not safe integers is malformed.\
Tested by: `test/contract/grid-position-point.test.js`.

**SG5 -- Exactly on.**\
`grid.positionAt(point)` returns `n = grid.nearest(point)` when `grid.pointOf(n)` has exactly the point's `x` and `y` (`===`), and `null` otherwise.\
Defined through `nearest` and `pointOf`, it means the same for every shape, and needs no tolerance.\
The test an application may write instead, `(v - origin) % pitch === 0` on each axis, agrees with it for every integer coordinate in the domain on a grid with no bounds, and within the bounds on one with them; beyond the bounds `positionAt` answers `null` where that test, which knows no bounds, can pass.\
It disagrees where `v - origin` rounds: on a grid of pitch 60 and origin 30 it accepts `x = -30 + 2^-48`, one rounding from a lattice point, which `positionAt` refuses.\
Tested by: `test/contract/exact-grid-position.test.js`.

**SG6 -- In view.**\
`grid.inView(view, options?)` returns a frozen `{ stride, positions }`, each entry a frozen `{ position, point }`.\
`view.region` is a rect with finite `x`, `y`, `w`, `h`, `w` and `h` at least 0, and `x + w`, `y + h` finite; `view.scale` is finite and above 0.\
`options.minSpacing`, default 0, is a finite number at least 0: the least distance on screen between neighbouring positions offered.\
`options.max`, default 10000, is an integer from 1 to 2^32 - 1, the longest array JavaScript allows: the most positions returned.\
On a square grid:
- an index range on each axis is the offered indices whose coordinate lies in the region, from `x` to `x + w` (or `y` to `y + h`) as binary64 computes them, edges included, computed exactly (SG2) -- possibly empty; the region's interval on each axis may first be intersected with the domain's, an empty intersection giving an empty range, which changes no answer, since no offered position lies beyond the domain;
- the stride is the least power of two `s`, from 1 to 2^52, at which `pitch * view.scale * s >= options.minSpacing` in binary64, or 2^52 when none is;
- a position is returned when both its indices are in range and divisible by the stride, tested as `i % s === 0`;
- the number returned is counted before anything is made, as the product of the two axes' counts, an axis counting 0 when its range is empty and otherwise `floor(hi / s) - ceil(lo / s) + 1`;
- while that number exceeds `options.max`, the stride doubles; at 2^52 only index 0 is divisible, every index being below 2^52 in magnitude, so this ends;
- an empty view returns no positions and the stride chosen for the spacing;
- the positions are ordered by row and then by column, both ascending.

For one region and one grid, the positions returned at stride `2s` are a subset of those at stride `s`: zooming out drops positions and never moves one.\
Tested by: `test/contract/grid-positions-in-view.test.js`.

**SG7 -- Next.**\
`grid.directions` is a frozen array of the shape's direction names, and `grid.opposite(direction)` names each one's opposite.\
A square grid's directions are `-x`, `+x`, `-y` and `+y`, each a step of one index on that axis, opposite in pairs.\
`grid.next(position, direction)` returns the neighbour in that direction when both the position and the neighbour are offered, and `null` otherwise.\
Tested by: `test/contract/next-grid-position.test.js`.

**SG8 -- Span.**\
`grid.span(from, to)` returns a frozen `{ through, covering }` for the block between `from` and `to`, in either order:
- `through` -- the smallest region holding every position's point;
- `covering` -- the smallest region holding every position's cell.

On a square grid, with the least corner's point `(x0, y0)`: `through` is `{ kind: 'rect', x: x0, y: y0, w: |to.col - from.col| * pitch, h: |to.row - from.row| * pitch }`, and `covering` is `through` grown by `pitch / 2` on every side.\
No count is formed on the way, so every value is an integer or a half-integer below 2^52 in magnitude, and exact.\
So `span(p, p).through` is the rect of `p`'s point with `w` and `h` 0, and `span(p, p).covering` is `p`'s cell.\
`grid.regionContains(region, point)` says whether a point lies in a region of the shape's kinds, edges included, a rect's edges being `x`, `y`, `x + w` and `y + h` as binary64 computes them.\
Tested by: `test/contract/grid-position-span.test.js`.

**SG9 -- Enclosing.**\
`grid.enclosing(rect)` returns a block `{ from, to }` of offered positions, or `null`.\
Where some block's `through` contains the rect, it is the smallest such block; where none does, the shape's rule says what it answers; and it is `null` for a rect with an edge that is not finite or lies outside the domain (Errors, above).\
On a square grid, on each axis: `from` is `floor((min - origin) / pitch)` and `to` is `ceil((max - origin) / pitch)`, computed exactly (SG2), each clamped to the least and greatest offered index, then `+ 0`, where `min` and `max` are the rect's edges; so a rect reaching past the offered positions gives the block clamped to them, and a rect wholly beyond one side gives a block of the one edge position there, never a block whose `from` passes its `to`.\
Tested by: `test/contract/enclosing-grid-block.test.js`.

**SG10 -- Exports.**\
`@apnex/snap-grid` exports `openGrid` and `square`; `@apnex/snap-grid/conformance` exports `checkGridShape`.\
The package imports no other package and no module particular to one runtime, names no global but the JavaScript built-ins it uses, and reads no clock and no randomness and holds no timer, so the same files run in Node and in a browser and answer the same there.\
Tested by: `test/contract/public-surface.test.js`, the runtime check (`tools/check-runtime.mjs`), the clock and chance check (`tools/check-clock-and-chance.mjs`) and the consumer test (`tools/consumer-test.mjs`).

**SG11 -- Shapes are adapters, proved by a kit.**\
A shape is a frozen object `{ name, open }`, `name` a non-empty string and `open(declaration)` returning what `openGrid` returns for it, its grid offering everything SG2 to SG9 name: `declaration`, `directions`, `opposite`, `offers`, `nearest`, `pointOf`, `positionAt`, `inView`, `next`, `span`, `regionContains` and `enclosing`.\
Each shape defines its own domain and its own representable positions: a square grid's domain is every coordinate within 2^50, fraction or not, and its representable positions are those whose points lie in it, their indices reaching 2^51; a shape on a circle has points that are not integers; and `positionAt` means the same for both, because it is defined through `nearest` and `pointOf` (SG5).

`checkGridShape(shape, cases)` judges, over each case, the checks the invariants below mark *kit* -- those that need nothing but the port and a rect, whose membership the kit computes itself -- and returns a frozen array of failures, empty when none.\
A case is `{ name, declaration, points, positions, views, blocks, rects }`: a declaration the shape admits, and the arguments to judge over -- points; representable positions; `{ view, options }` pairs; `[from, to]` pairs of representable positions; and rects that the `through` of some block of offered positions contains.\
A failure is `{ invariant, case, args, got }`: the invariant's number, as `'I1'`, the case's name, the arguments, and what the kit saw.\
The kit judges the cases in the array's order, and within a case the invariants in the order `open`, I1 to I8, each over the arguments the table below names, in the order the case gives them.\
It records one failure for each argument tuple that fails any of its invariant's checks, a call that throws failing its tuple and ending that tuple's checks.\
So, for a shape whose every answer depends only on its declaration and its arguments, two conforming kits list the same failures in the same order, with the same `invariant`, `case` and `args`; `got` is a diagnostic -- the answer that failed, or `{ thrown: <message> }` -- and its form is not part of the contract.\
A shape whose answers depend on how often or in what order it is asked is broken whatever a kit lists; a kit samples, and cannot always see it -- I7 catches what a repeated call shows -- so two kits, making their other calls in different orders, may list different failures for it, or one none.\
A declaration the shape refuses is the case's one failure, `{ invariant: 'open', case, args: [declaration], got: problems }`.\
So is an answer from `open` that is not of SG1's form, `{ ok: true, grid }` or `{ ok: false, problems }`, or not frozen -- the answer and its grid frozen, the grid's `declaration` frozen to its depth -- or not fresh, two calls giving the same answer or the same grid.

The kit's rules where the table leaves a choice:
- a case position is selected for I1 and I5 when `offers` answers exactly `true`; one whose `offers` throws is not selected there, and I7's schedule, which calls `offers` for every case position, records the throw;
- I2 asks `offers` of each case position inside each point's tuple, so an `offers` that throws there fails that tuple;
- I4's `args` are always `[view, options]`, and the kit calls `inView(view, options)` in I4 and in I7 alike, `options` being `undefined` when the case's pair has none;
- answers are compared by value, `-0` equal to `0`, except within I7, whose two answers are compared with `Object.is`, the same keys in the same order and the same prototype;
- a rect's membership is computed by the kit, its edges as binary64 computes them, and a region of any other kind is asked of the grid's `regionContains`;
- `null` from `enclosing` fails I8, since every case rect lies in the `through` of some block of offered positions;
- a failure's `args` are copies, made one way so two kits agree: a point as `{ x, y }` alone, whatever its prototype or other fields, and every other argument as a deep copy of its plain data -- own enumerable data properties of an object, the elements of an array -- then frozen;
- a throwing accessor or Proxy in a shape's answer, its grid or its `directions` is recorded as the failure of the tuple it belongs to -- `open`, I5's first tuple, or the tuple whose call met it -- and the kit itself never throws for it, throwing a `TypeError` only for a malformed shape or case.

| Invariant | Judged over, in order | `args` |
|---|---|---|
| `open` | the case's declaration | `[declaration]` |
| I1 | each case position `offers` accepts | `[position]` |
| I2, I3 | each case point | `[point]` |
| I4 | each view pair; then each two view pairs, the earlier first, whose regions are equal and whose strides differ, `got` the first position of the greater stride's answer missing from the other's | `[view, options]`; `[pair, pair]` |
| I5 | the grid's directions, once; then each case position `offers` accepts, with each direction in the order of `directions` | `[]`; `[position, direction]` |
| I6 | each block; then each case position | `[from, to]`; `[position]` |
| I7 | a fixed schedule of calls, each made twice and the two answers compared field by field, each answer checked for `-0` and for being frozen: for each case point, `nearest` then `positionAt`; for each case position, `offers`, `pointOf`, then `next` in each direction in the order of `directions`; for each view pair, `inView`; for each block, `span`; for each rect, `enclosing` | `[name, ...arguments]` |
| I8 | each case rect | `[rect]` |

What the kit cannot check through the port -- that a nearest position is nearest among every position, that `inView` misses none and orders them as its shape says, that neighbours' cells share an edge, that a span is the smallest, that an enclosing block cannot shrink -- each shape proves in its own tests, against its formulas.

`square` is proved by the kit and by its own tests in snap-grid; so is `ring-test`, a shape in the tests alone, which exists to show that the port and the kit are not square by accident -- one index, two directions that wrap, points that are not integers, and regions that are not rects.

A consumer may write a shape against this port and prove it with the kit; a shape more than one consumer needs is adjusted into snap-grid (C0, "Adjustment over replacement"), never copied between them.\
Tested by: `test/contract/grid-shape-conformance.test.js` and `test/ring-test.test.js`.

**Invariants.**\
Each invariant holds for every grid of every shape.\
*Kit* marks what `checkGridShape` judges through the port over a case's arguments (SG11); *shape* marks what each shape proves in its own tests, against its own formulas, because the port cannot show it; *snap-grid* and *gate* mark what only snap-grid's tests or its gate hold.

| # | Invariant | Held by |
|---|---|---|
| I1 | For every case position `p` that `offers` accepts: `nearest(pointOf(p))` is `p`, and `positionAt(pointOf(p))` is `p`. | kit |
| I2 | `nearest(q)` is `null` or offered, and no offered position among the case's positions and the neighbours of `nearest(q)` is strictly nearer to `q`, nearness measured as `(q.x - p.x) ** 2 + (q.y - p.y) ** 2` in binary64 (kit). It is `null` exactly when a coordinate of `q` is not finite or lies outside the domain, and no offered position at all is nearer (shape). | kit, shape |
| I3 | `positionAt(q)` is `nearest(q)` when `pointOf(nearest(q))` has exactly `q`'s `x` and `y`, and `null` otherwise. | kit |
| I4 | Every entry `inView` returns has an offered position, its point is `pointOf` of that position, and the point lies in the view's rect; the stride is a power of two from 1 to 2^52; no more than `max` entries are returned; of two answers for one region, the one with the greater stride holds a subset of the other's positions (kit). No offered position in the rect at the stride is missed, the stride is the least the shape's rule allows, and the order is the shape's (shape). | kit, shape |
| I5 | `directions` is frozen, and each direction's `opposite` is among them; `opposite(opposite(d))` is `d`; `next(p, d)` is `null` or offered, and where it is `n`, `next(n, opposite(d))` is `p` (kit). A neighbour's cell shares an edge with the position's (shape). | kit, shape |
| I6 | `span(a, b)` equals `span(b, a)`; `through` holds the points of `a` and `b`; every case point in `through` is in `covering`; `span(p, p).covering` holds `p`'s point (kit). `through` and `covering` are the smallest regions of the shape's kinds holding the block's points and its cells (shape). | kit, shape |
| I7 | The same declaration and arguments always give the same answer, field for field and in the same order; no answer holds `-0`; every answer is frozen to its depth. | kit |
| I8 | `enclosing(rect)` is `null` or a block of offered positions; for a case rect, the block's `through` holds the rect's four corners and every case point in the rect (kit). No corner can move inward and keep that true, and the shape's rule decides a rect no block contains (shape). | kit, shape |
| I9 | `openGrid` never throws for any JSON value, and answers every declaration with exactly the problems SG1 gives, from a table of cases, escaped pointers and code-unit order among them. | snap-grid |
| I10 | `square` reproduces the grid arithmetic its corpus was made from: the corpus's points, positions and answers, over coordinates in the domain and stated as square-grid cases, pass with `-0` told apart from `0` -- except at the points the corpus lists apart, each with the reference answer, the exact one, and every reason that applies: `rounding`, where the reference's binary64 arithmetic is not exact; `domain`, where the reference answer lies outside the 2^50 domain, so snap-grid clamps; and `beyond`, a rect wholly beyond one side of a bounded grid, where a reference that clamps the low edge only from below and the high edge only from above gives a block whose `from` passes its `to`, and SG9 gives the edge position there; a point with two causes carries both. The corpus's provenance -- what it was made from, and how -- is in `docs/DECISIONS.md` (D3) and `test/corpus/README.md`. | snap-grid |
| I11 | The source names no consumer's vocabulary; the built files import no package and no runtime-specific module, name no global but the JavaScript built-ins the build uses and no route to `Function`, and read no clock, timer, source of chance or network. | gate |

The kit measures nearness in binary64 because it has no exact measure for an arbitrary shape.\
A square grid's exact answer never loses that comparison: its distance on each axis is no greater than any other position's, and rounding never reverses an order, so its computed distance is never the greater.

---

## Reference

This repository, `apnex/snap-grid`, and its package `@apnex/snap-grid`, released only by its own CI as a tarball attached to a GitHub release, drafted, verified and then published (`.github/workflows/release.yml`).\
The package exports `openGrid` and `square`, and `@apnex/snap-grid/conformance` exports `checkGridShape`, as `export-map.json` records.\
The code is TypeScript in `src/`, built to `dist/`, which only a release holds.\
The tests are in `test/`: one file per capability in `test/contract/`, the I10 corpus and its test in `test/corpus/`, and `ring-test` in `test/fixtures/`.\
The gate, `npm run gate`, builds, runs the tests, the vocabulary, runtime, clock and chance, and export-map checks in `tools/`, and mission-kit's style checks.\
The design of record and the rulings are kept in draw's records, `apnex/drawv2`.

---

## Fit criteria

**Does my project want this at all?**
- More than one part of your system snaps to, draws or validates against the same grid, and they must agree to the last unit.
- You are about to write `Math.round((v - offset) / pitch) * pitch + offset` -- especially if you have written it before.

**It is the wrong tool when:**

| You need | Reach elsewhere, because snap-grid is |
|---|---|
| grid lines or dots drawn | not a renderer -- it says where; the consumer draws |
| which grids an application has, stored or edited | not a store |
| whether something may sit at a position | not an authority over occupancy |
| freehand placement, or snapping to other things' edges | not a general snapping engine -- it knows only its grid |
| a grid of fractional pitch | not yet: pitches and origins are integers until a consumer needs otherwise |

---

## Adjustment policy

Internal and sovereign: a measured gap is recorded where both sides can see it, then resolved by adjusting snap-grid or by fracturing it if the gap reveals a second duty; never forked.

---

## Edges

**Contains:** the `square` shape and the conformance kit.\
**Consumes:** nothing.\
**Consumed-by:** draw, then `input-tester`, which places every key and mouse button by `span` (SG8) on one square grid.
