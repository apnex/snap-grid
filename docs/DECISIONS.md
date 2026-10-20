# Decisions

One ruling per entry, append-only.\
A ruling is never edited; a later one supersedes it and says so.

Rulings that shape this component together with its first consumer are held in draw's `dev/DECISIONS.md` (`apnex/drawv2`), and cited here as "draw's `Hn-m`".

---

## D1 - The component stands in its own public repository

**Ruled by:** the director, 2026-10-20 (draw's `H26-1` and `H26-2`).\
**Affects:** this repository, its package and its releases.

**Ruling.**\
snap-grid is a component of its own, in the public repository `apnex/snap-grid`, its package `@apnex/snap-grid`, released from its own CI and taken by draw as a release file pinned by its hash.\
Its versions are `0.x` until mission-kit admits it to the component registry.

**Why.**\
Each component holds its own boundary and its own history from the start, so a consumer composes it through a declared contract rather than a copy, and a second consumer can adopt it without a fork.

---

## D2 - The contract of record is draw's ratified design

**Ruled by:** the director, 2026-10-20 (draw's `H26-4`).\
**Affects:** `CONTRACT.md`, `VISION.md`, `src/`, `test/`, `tools/` and `.github/workflows/`.

**Ruling.**\
The contract of record is section 3 of draw's `dev/design/components/SNAP-GRID.md`, revision 6, ratified with all ten of its decisions as recommended; `CONTRACT.md` carries it, and its section 4 holds the invariants and tests, its section 7 the repository, the gate and the release.\
`VISION.md` is that design's appendix A, ratified as written.

**Choices made at build, each confirmed by the recorder.**\
Where the design left a choice open, the build made these; each that a test can hold is held by one, and each that a consumer can observe is stated in `CONTRACT.md`:
- `openGrid` takes SG1's steps 1 to 3, hands the declaration to the named shape's `open`, which repeats them for its own name, and returns its answer unwrapped.
- `openGrid`'s never-throws and fresh, frozen results hold for `square` and for an added shape that keeps SG11, which the kit checks.
- A shape is a frozen plain object of exactly `name` and `open`, both data properties.
- A point is a non-null value of type `object`, functions refused; its `x` and `y` are read once each, through ordinary property access.
- A declaration is read by descriptor: no getter is called, an accessor is not of its form, an unreadable Proxy is not a plain object, and a symbol-named property is ignored, since no pointer names it.
- Any other argument with an accessor or a symbol-named property is malformed.
- A getter's or Proxy trap's error met while an argument is read is rethrown as the function's own `TypeError`.
- An omitted `options` and one given as `undefined` are the same; `null`, and a property present as `undefined`, are malformed.
- A rect is malformed unless `x`, `y`, `w` and `h` are numbers and `w` and `h` each at least 0: a `NaN` size is malformed, an infinite one is well formed.
- `grid.declaration` writes its properties in the form's order -- `shape`, `pitch`, `origin`, `bounds`; `x`, `y`; `min`, `max`.
- `inView`'s spacing test evaluates `pitch * view.scale * s` left to right in binary64.
- The kit's `open` also requires an answer of SG1's form, frozen -- the answer, its grid, the grid's declaration to its depth -- and fresh across two calls.
- The kit selects a case position for I1 and I5 when `offers` answers exactly `true`; a throw there selects nothing, and I7 records it.
- The kit counts `null` from `enclosing` as a failure of I8, since every case rect lies in some block's `through`.
- The kit compares answers by value, `-0` equal to `0`, except within I7: `Object.is`, the same keys in the same order, the same prototype.
- The kit computes a rect's membership itself and asks `regionContains` for a region of any other kind.
- A case holds all seven of its properties; a view pair holds `view` and, optionally, `options`.
- I4's `args` are always `[view, options]`, and the kit calls `inView(view, options)` in I4 and I7 alike, `options` `undefined` when absent.
- A failure's `args` are copies: a point as `{ x, y }` alone, any other argument as a deep copy of its plain data, then frozen.
- The kit never throws for a throwing accessor or Proxy in a shape's answer, grid or `directions`: it is recorded as the failure of its tuple.
- `ring-test`'s regions name slots by number, `{ kind, from, to }`; its centre is no tie, the rounded distances differing.
- `ring-test`'s `inView` checks its view and options as SG6 does.
- I10's corpus lists apart, with every reason that applies, `rounding` (draw's float arithmetic is not exact) and `domain` (draw's answer lies beyond the 2^50 domain, where snap-grid clamps).
- I10's corpus also lists apart, as `beyond`, the zone wrap's rects wholly beyond one side, where the wrap inverts and SG9 gives the edge position.
- I10's positions for bounded snapping are draw's snapped coordinates as `(x - origin) / pitch`; positionAt is `onLayout` on each axis with `cellOn`'s index.
- I10's `latticePoints` is called through its grid's `points`, with a stub model holding the record.
- The vocabulary check compares each run whole, without its underscores and hyphens, and split at case changes, underscores, hyphens and digits, a trailing `s` or `es` removed.
- The vocabulary check cannot split a listed word inside one run of lower-case letters, such as `zonegrid`, and does not catch it.
- The vocabulary check has no allowance mechanism yet; the first listed word a component needs brings one, allowed by name here.
- The runtime check tokenizes with TypeScript's scanner; a `/` after a value divides and anywhere else begins a regular expression.
- The runtime check does not count a name read as a member, after `.` or `?.`, and does count one written as an object key.
- The package's `files` are `dist` and the documents `README.md`, `VISION.md`, `CONTRACT.md` and `LICENSE`.
- The style checks run over every Markdown file git would keep, tracked, or untracked and not ignored.
- `CONTRACT.md` replaces the design's section references with its own, holds section 4's invariants, and adds the Requires and Trait columns.
- `README.md` names no version: a consumer writes the release it chooses from the repository's Releases page.
- The workflows pin every action by its full commit SHA, the tag named beside it, and every `gh` call names the repository.
