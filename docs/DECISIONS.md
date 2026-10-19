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

**Builder's choices.**\
Where the design leaves a choice open, the build made these, each held by a test:
- A declaration's properties are read through their descriptors, so a getter is never called: an accessor property holds no value, and is not of its form; a value a Proxy makes unreadable is not a plain object; a symbol-named property is not named by any pointer, so it is left out of SG1's checks.
- `grid.declaration` writes its properties in the order the form names them -- `shape`, `pitch`, `origin`, `bounds`; `x`, `y`; `min`, `max` -- whatever order the declaration gave.
- An argument other than a point holds no other property, string- or symbol-named, and each of its properties is a data property; a point is an object, `typeof` `object`, and its `x` and `y` are read once each, through ordinary property access, so a `DOMPoint`'s getters answer.
- An omitted `options` and one given as `undefined` are the same; `null`, and a property present as `undefined`, are malformed.
- A shape's form is a frozen plain object of exactly `name` and `open`, so `openGrid` and `checkGridShape` refuse an object with any other property.
- A rect's `w` or `h` that is `NaN` is not less than 0, so the rect is well formed, its edge is not finite, and `enclosing` answers `null` for it, as SG9 says of every such edge.
- The kit selects "each case position `offers` accepts" by `offers` answering exactly `true`; a throw there selects nothing, and I7's schedule records it.
- The kit passes a view pair's `options` only when the pair has one, and a failure's `args` are the arguments it passed; it judges a rect's membership itself and asks `regionContains` for a region of another kind; and it counts `null` from `enclosing` as a failure of I8, since every case rect lies in some block's `through`.
- The kit's `args` are copies of the arguments, plain data copied and a point of another prototype written as its `x` and `y`, because a failure list is frozen to its depth and nothing a caller passes is frozen.
- The style checks run over every Markdown file git would keep, tracked or untracked and not ignored, so a new document is checked before its first commit.
