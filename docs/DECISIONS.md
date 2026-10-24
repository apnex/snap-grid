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
- The runtime check walks TypeScript's syntax tree of each built file (`ts.createSourceFile`, `ScriptKind.JS`, as a module), so a regular expression is never read as division.
- The runtime check counts every identifier but a property access's name, so an object key such as `{ self: 1 }` counts; a file that does not parse fails.
- The package's `files` are `dist` and the documents `README.md`, `VISION.md`, `CONTRACT.md` and `LICENSE`.
- A source map's `sources` (`../src/*.ts`) are labels for its inlined `sourcesContent`, not files the release must hold.
- The style checks run over every Markdown file git would keep, tracked, or untracked and not ignored.
- `CONTRACT.md` replaces the design's section references with its own, holds section 4's invariants, and adds the Requires and Trait columns.
- `README.md` names no version: a consumer writes the release it chooses from the repository's Releases page.
- The workflows pin every action by its full commit SHA, the tag named beside it, and every `gh` call names the repository.
- A release refuses a version outside `0.x`, by D9, and packs once: the consumer test installs the very file the draft attaches.
- GitHub keeps one pending release run per repository: a third tag pushed while one waits cancels the waiting run, which is re-run by hand.

---

## D3 - 0.1.1 carries the documents and the gate of draw's ratified RELEASES-0.2.md, revision 4, its built files 0.1.0's

**Ruled by:** the director, 2026-10-24 (draw's `H26-14`, every decision RD1 to RD19 at its recommendation; RD12, a patch release carrying the documents, its built files byte-identical to `0.1.0`'s).\
**Affects:** `CONTRACT.md`, `README.md`, `tools/`, `test/tools/`, `test/contract/contract-coverage.test.js`, `.github/workflows/` and `package.json`; nothing in `src/`.

**Ruling.**\
`0.1.1` is section 3.4 of draw's `dev/design/components/RELEASES-0.2.md`, revision 4, with what its section 3.5 gives every component: the contract freed of draw's files and design (RD15), the consumer reference (RD16), the gate's checks of B424 stated for snap-grid (RD13), and the vocabulary list renamed, under its guardrails GR2 to GR5.\
No behaviour changes: `src/`, `tsconfig.json` and TypeScript's version are `0.1.0`'s, so the build is `0.1.0`'s byte for byte, and a release run of `0.1.1` refuses a packed file whose built files are not.\
D2 stands for everything else.

**Choices made at build.**
- `CONTRACT.md` states each rule on its own terms, with one provenance line under Reference: SG2's example of a rounding `Math.round` is a grid of pitch 60 and origin 30, its oracle named as `test/support/oracle.js`; SG5 compares the test an application may write, `(v - origin) % pitch === 0`; SG9 states that a rect wholly beyond one side gives the edge position, never a block whose `from` passes its `to`, with no word of the wrap that inverts there; the Errors paragraph's points are "a `DOMPoint`, or an entity of their own"; I10 states what the corpus holds, and its provenance is here; SG10, I11 and Reference name the checks the gate now runs; Edges names `input-tester` and its use of `span`. `test/contract/contract-coverage.test.js` holds that the provenance line is the only one naming draw's records, files or design (GR4).
- I10's provenance, moved here from the contract: `test/corpus/i10-square-corpus.json` was generated once, by `tools/generate-i10-corpus.mjs`, from draw's `kernel/geometry.mjs`, `app/src/snap.js`, `layouts/layout-canvas.mjs` and `zones/zone-keys.mjs` at draw's `0c59572`, on draw's two grids -- pitch 60 and origin 0 within 900 by 480, and pitch 60 and origin 30 within 930 by 510 -- and five more of the layout table's form; its reference answers are draw's, its `beyond` entries the rects wholly beyond one side that draw's zone wrap (`zones/zone-keys.mjs:28-33`) is never given and where it inverts; `test/corpus/README.md` says how it was made, and the corpus itself holds no word of draw's.
- The runtime check is vector-scene's (its D2, N5): the free globals of each built file, resolved by TypeScript's checker over the file alone, held to an allow-list that a test holds to exactly the globals the build names; `eval`, `Function` and a call or `new` through a property named `constructor` refused. Its allow-list is the thirteen built-ins snap-grid's build names, `RangeError` among them and `WeakMap` not (erratum 1). It has no platform-member pass: no platform object reaches snap-grid, and its build names `open`, `points`, `r` and `scale`, which are platform members' names; a test holds those names passing. The control is a built file naming `RangeError`; the falsifiers are `WeakMap`, which vector-scene's list allows, and every platform global vector-scene's tests plant, with `BigInt`, `DataView`, `ArrayBuffer` and `DOMPoint` beside them.
- The clock and chance check is vector-scene's as written -- `Date`, `performance`, the timers, `crypto`, the network, `Intl`, `Temporal`, `WeakRef`, `FinalizationRegistry`, and `Math.random` however it is reached -- its header stated for snap-grid; it is snap-grid's first such check (B414), the gate runs it after the runtime check, and a test holds the gate's script.
- The release workflow takes vector-scene's retried lookup of the draft and its backstop of 15 minutes, which the gate workflow's two jobs take too. RD12's check is a step after the pack and before the consumer test and the draft: `tools/repeated-build.json` maps a release that changes no built file to the release it repeats -- `0.1.1` to `0.1.0` -- and for such a release the step downloads that release's file and its SHA-512 through the authenticated API (`gh release download`), checks one against the other (`sha512sum -c`), and compares the built files of both tarballs byte for byte with `tools/compare-built.mjs`, which fails on a file in either alone or a byte differing. A release the map does not name passes the step, so the check costs nothing when a release changes code. No action is added, so no pin changes.
- The README's consumer reference states two answers of section 2 where they bite: which of an application's things owns a point is its own data, the item drawn under a point being `vector-scene`'s `itemAt` (G16); and `inView`'s `scale` under a root scaled differently on each axis is the guide's conservative scale (G15).
- The vocabulary lists are renamed as section 3.5 says: `gesture-tester` is `input-tester`, its words `keyboard` and `keycap` kept; the tester has no source yet, so no noun of its own joins them.
- `package.json`'s `files` and `exports`, and `export-map.json`, are `0.1.0`'s: `0.1.1` adds no capability.

**Shown: the built files answer exactly as 0.1.0's.**\
The `0.1.0` release's tarball was taken from npm's cache, whose SHA-512 is the integrity draw's `package-lock.json` records for the `v0.1.0` release file, and equals draw's installed copy file by file.\
Built from this repository, `dist/` equals that tarball's `package/dist/`, all 33 files byte for byte; `npm pack` of `0.1.1` compared with it by `tools/compare-built.mjs` passes, 33 built files byte-identical and neither tarball holding another; the release step run locally, `gh` stood in by a script serving the cached file and a SHA-512 written from it, passes, and fails on a packed file with one byte added to `dist/square.js`; and every test, the I10 corpus among them, passes over that build.\
Identical files answer identically, so `0.1.1` answers every call as `0.1.0` does.

**Errata against draw's design** (`RELEASES-0.2.md` revision 4, section 3.5):
1. The table of the gates gives snap-grid's runtime check "the thirteen and `RangeError`", vector-scene's thirteen built-ins and one more. Run over `0.1.0`'s build, TypeScript's checker finds that snap-grid names twelve of the thirteen -- `Array`, `Error`, `JSON`, `Map`, `Math`, `Number`, `Object`, `Reflect`, `Set`, `String`, `TypeError` and `undefined` -- and `RangeError`, but not `WeakMap`; and vector-scene's check, which section 3.5 says each component takes, holds its list to exactly the globals the build names, so that a built-in the build stops using leaves the list with it (vector-scene's D2, N5). Fourteen names would fail that test, or need it loosened; so the list is the thirteen snap-grid names, and a falsifier holds `WeakMap` refused. The table should read "the thirteen but `WeakMap`, and `RangeError`".

**Mutants planted (GR2).**\
Each mutant was planted in a copy of this repository by an exact replacement of one span, built, and run against the tests of what it breaks; each failed them:
- S1 -- `WeakMap` added to the allow-list: the exact-list test failed.
- S2 -- `RangeError` taken from it: 2 failed, the check over the build and the control.
- S3 -- the free globals no longer held to the list: the falsifiers failed.
- S4 -- a call through `constructor` no longer refused: 2 failed.
- S5 -- `eval` and `Function` taken from the runtime names: 1 failed.
- S6 -- `WeakRef` taken from the clock and chance names: its falsifier failed.
- S7 -- the clock and chance check taken from the gate's script: the gate's script test failed.
- S8 -- the built files compared by length, not bytes: the comparison's byte falsifier failed.
- S9 -- a file in the packed tarball alone overlooked: the comparison's falsifier failed.
- S10 -- `0.1.1` mapped to `0.0.9`: the repeated-build test failed.
- S11 -- the comparison taken out of the release step: the workflow test failed.
- S12 -- the contract naming draw's zone wrap and its file again: the GR4 test failed.
- S13 -- the vocabulary list named `gesture-tester` again: the vocabulary test failed.
