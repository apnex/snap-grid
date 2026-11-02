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
- The release workflow takes vector-scene's retried lookup of the draft and its backstop of 15 minutes, which the gate workflow's two jobs take too. RD12's check is a step after the pack and before the consumer test and the draft, whose whole body is `tools/check-repeated-build.mjs` called on the packed file: `tools/repeated-build.json` maps a release that changes no built file to the release it repeats -- `0.1.1` to `0.1.0` -- and the script looks package.json's version up there (`repeatedBuild`); for a release the map names it downloads that release's file and its SHA-512 through the authenticated API (`gh release download`), checks the file against the SHA-512 -- the digest, and the file's own name -- and compares the built files of both tarballs byte for byte (`compareBuilt` in `tools/compare-built.mjs`), failing on a file in either alone or a byte differing. A release the map does not name passes the step, asking nothing of GitHub, so the check costs nothing when a release changes code. No action is added, so no pin changes.
- The README's consumer reference states two answers of section 2 where they bite: which of an application's things owns a point is its own data, the item drawn under a point being `vector-scene`'s `itemAt` (G16); and `inView`'s `scale` under a root scaled differently on each axis is the guide's conservative scale (G15).
- The vocabulary lists are renamed as section 3.5 says: `gesture-tester` is `input-tester`, its words `keyboard` and `keycap` kept; the tester has no source yet, so no noun of its own joins them.
- `package.json`'s `files` and `exports`, and `export-map.json`, are `0.1.0`'s: `0.1.1` adds no capability.

**Shown: the built files answer exactly as 0.1.0's.**\
The `0.1.0` release's tarball was taken from npm's cache, whose SHA-512 is the integrity draw's `package-lock.json` records for the `v0.1.0` release file, and equals draw's installed copy file by file.\
Built from this repository, `dist/` equals that tarball's `package/dist/`, all 33 files byte for byte; `npm pack` of `0.1.1` compared with it by `tools/compare-built.mjs` passes, 33 built files byte-identical and neither tarball holding another; `tools/check-repeated-build.mjs` run on that packed file, `gh` stood in by a script serving the cached file and a SHA-512 written from it, passes, and fails on a packed file with one byte added to `dist/square.js`; and every test, the I10 corpus among them, passes over that build.\
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
- S8 -- the built files compared by length, not bytes: 2 failed, the comparison's byte falsifier and the release step's one-byte difference.
- S9 -- a file in the packed tarball alone overlooked: the comparison's falsifier failed.
- S10 -- `0.1.1` mapped to `0.0.9`: 2 failed, the repeated-build test and the release step's pass.
- S11 -- the release step's call of `tools/check-repeated-build.mjs` replaced by an `echo`: the workflow test failed.
- S12 -- the contract naming draw's zone wrap and its file again: the GR4 test failed.
- S13 -- the vocabulary list named `gesture-tester` again: the vocabulary test failed.
- S14 -- the downloaded release no longer checked against its SHA-512: the release step's SHA-512 mismatch failed.
- G4, the run-verifier's -- the step comparing the downloaded tarball with itself, not with the packed one: the release step's one-byte difference failed.
- G8, the run-verifier's -- the step skipping whatever the version: the release step's pass failed, gh never asked.
- G8w -- the workflow's call given a version the map does not name, so the step skips: the workflow test failed; it survived the workflow test's first form, which matched the call as a prefix, and the test now holds the whole line.

**After the run-verifier's seal of `f787520`.**\
The run-verifier sealed `0.1.1` with one should-fix: the gate held where the release step sat and its `sha512sum -c` line, not what the step compared, and its mutants G4 and G8 survived.\
The step's body moved into `tools/check-repeated-build.mjs`, the version looked up by `repeatedBuild` rather than the workflow's inline lookup, and the workflow calls it on the packed file; `test/tools/gate-checks.test.js` runs it end to end with a stand-in `gh` first on `PATH` -- a pass, gh asked for exactly the release's two files; a one-byte difference; a SHA-512 mismatch; a SHA-512 file naming another file; an asset gh cannot find; and a version the map does not name, which skips and asks nothing of gh -- and holds the workflow's call, whole, after the pack and before the consumer test and the draft.\
G4 and G8 now fail, as the list above records with every mutant re-run against the final tests.

---

## D4 - The tests run on test-harness

**Ruled by:** the director, 2026-10-31 (draw's `H26-19` as amended: no test run may leave anything behind, and what the repositories' copies share is one component, `test-harness`, taken by each in its tests alone, pinned to its release file).\
**Affects:** `package.json` and its lockfile, `tools/consumer-test.mjs` and the tests that make scratch folders; nothing in `src/`, and nothing the package ships.

**Ruling.**\
`@apnex/test-harness` `0.1.0` is a development dependency, pinned to its release file by its URL and, in the lockfile, by its hash; `files` is unchanged, so no file of it is packed.\
`npm test` runs the tests under its runner, `test-harness run`, and `npm run consumer` the consumer test under `test-harness exec`, so each run has a folder of its own and fails on anything left in it or still running after it.\
The consumer test serves the page and the installed files with `serveStatic` and loads them in a one-shot Chrome with `dumpDom`, in a folder of its own -- so Chrome's lock folder, crash reporter and keyring use no longer reach the caller's temporary folder or the user's own -- and its scratch folder is a `scratchFolder`, removed however the test ends; the page, the import map and the exercise are its own, as before.\
The tests' scratch folders are `scratchFolder`s too.\
The consumer test's `--keep` is gone: a folder kept would be one the run fails on.\
The runner is not given `--test-force-exit`, which `test-harness`'s README recommends: on Node 22 it cut the results a test file reports when they are many -- `test/contract/declared-grid.test.js` here reported 61 of its 78 tests with it -- and no test here leaves anything running for it to end.

---

## D5 - The tests run on clean-runner and headless-chromium

**Ruled by:** the director, 2026-10-31 (draw's `H26-19`, amended again: the shared component split by its two duties into `clean-runner` and `headless-chromium`, and purged, no legacy retained).\
**Affects:** `package.json` and its lockfile, `README.md`, `tools/consumer-test.mjs` and the tests that import either; nothing in `src/`, and nothing the package ships.

**Ruling.**\
The development dependency `D4` names is replaced by two, each pinned to its release file by its URL and, in the lockfile, by its hash: `@apnex/clean-runner` `0.2.0`, for the runner -- `clean-runner run` and `clean-runner exec`, and `scratchFolder` -- and `@apnex/headless-chromium` `0.1.0`, for `dumpDom` and `serveStatic`; `files` is unchanged, so neither is packed.\
The calls are `D4`'s, each now from the component that holds it, and the runner is still given no `--test-force-exit`.

---

## D6 - 0.1.2: the build keeps its contract, each answer frozen as it is made

**Ruled by:** the director, 2026-11-01 (draw's `H26-23`: its design of record for pan and zoom ratified as it stands); for the problem list and the failure list, the director's instruction for this move, that an answer the same freeze bounds below what the contract promises is fixed the same way.\
**Affects:** `src/square.ts`, `src/declaration-problems.ts`, `src/conformance.ts`, `CONTRACT.md`, `README.md`, `test/`, and `package.json` and its lockfile; a patch release, `0.1.2`.

**Ruling.**\
`0.1.2` is the `snap-grid` paragraph of section 3.2 of draw's `dev/design/components/PAN-ZOOM.md`, revision 10, with its decision PZ13, its section 5.1's move 4 and the row of its appendix A for that move.\
`inView` freezes each value it makes as it makes it, tracking none, so it lists any count SG6's `max` allows, where `0.1.1`'s deep freeze, tracking every object it froze in one `Set`, which V8 holds to 2^24 entries, stopped at 5,592,404 positions, three objects each and two more; a new invariant, I12, lists 2^24 positions in one answer.\
The same freeze bounded two more answers the contract promises at any length -- a refusal's problem list, `openGrid` never throwing (I9), and the kit's failure list, the kit throwing only for a malformed shape or case (SG11) -- and each is frozen as it is made too.\
No rule changes; the build now keeps them.\
The behaviour changes: an `inView` answer of more than 5,592,404 positions, a refusal of more than 16,777,214 problems and a failure list of more than 2^24 objects answer where each threw `RangeError: Set maximum size exceeded`; and, after the verifier's B1, a failure's copy of a case point whose `x` or `y` is not a number holds a copy of that coordinate's plain data, where `0.1.1` held the caller's own value and froze it; and, after the re-review's B3, a failure whose argument or answer holds more than 2^24 arrays and objects answers, that value not copied whole, where `0.1.1` threw for a case point, and for any other argument or answer lost what came before the limit too, up to the whole value as `{}`; and, after B4, a failure's `got` for a thrown error whose `message` is not a string holds that message as a string, where `0.1.1` held the shape's own value and froze it; nothing else.

**Measured.**\
The drafter's `grid-listing.mjs`, run as its usage says (`--expose-gc --max-old-space-size=8192`), against `0.1.1` -- draw's installed `0.1.0`, the same bytes -- and against this build, its import of `snap-grid` alone pointed at the build:

| | Node 22, `0.1.1` | Node 22, `0.1.2` | Node 24, `0.1.1` | Node 24, `0.1.2` |
|---|---|---|---|---|
| one past the ceiling, 5,592,405 | throws after 17.0 s | 0.81 s | throws after 20.6 s | 1.09 s |
| at the ceiling, 5,592,404 | 17.8 s | 0.97 s | 18.9 s | 0.97 s |
| a million | 2.1 s | 0.20 s | 2.6 s | 0.21 s |
| heap held | 155 MB a million, 861 MB at the ceiling | the same | the same | the same |

The kit, over a shape whose every call throws and a case of 1,500,000 positions, 4,500,000 failures: `0.1.1`'s code threw after 23.5 s at a peak of 2.8 GB; this build answers in 12.3 s at 1.7 GB (Node 22).\
A refusal of more than 16,777,214 problems was not built: it needs a declaration of as many own properties over its members, several gigabytes and minutes; the test at a small size holds it.

**Where I12 runs, and why.**\
One answer of 2^24 positions, listed on the default heap, each entry checked frozen and in order, before the gate's step was given a heap of its own (below, after B1):

| | List | Check | Wall | Peak RSS |
|---|---|---|---|---|
| Node 22, alone | 10.0 s | 1.5 s | 11.7 s | 2.96 GB |
| Node 24, alone | 6.1 s | 1.5 s | 7.8 s | 2.92 GB |
| Node 22, the gate's step under `clean-runner` | | | 15.1 s | 3.05 GB |
| Node 24, the gate's step under `clean-runner` | | | 12.8 s | 2.91 GB |

`npm test` runs its 200 tests in 7 to 8 seconds; a test of 3 GB beside them would more than double that and hold more memory than every other test together, and the default heap here, 4.1 GB on Node 22 and 4.3 GB on Node 24, holds it with about 1 GB to spare, less on a machine with less memory.\
The whole gate, the step included, took 24.3 s at a peak of 3.04 GB on Node 22 and 22.3 s at 2.91 GB on Node 24.\
So I12's 2^24 is a file of its own, `test/large/in-view-2-24.large.js`, named so `npm test`'s glob leaves it out, and the gate runs it in a step of its own after the tests, never beside them, on a heap of 4,096 MB (after B1, below); the gate workflow runs the gate on Node 22 and 24, and the release workflow runs it before it packs.\
Every run of `npm test` holds the same property at a small size: with the global `Set` held to 1,000 entries (`test/support/set-cap.js`), as V8 holds it to 2^24, an `inView` answer, a problem list and a failure list each of more than 1,000 objects are given whole and frozen, so each of the three frozen through a `Set` again fails in milliseconds (mutants M1, M7 and M10).

**Choices made at build.**
- `inView` freezes each position, its point and its entry as it makes them, then the array, then the answer; its count, stride and order are unchanged.
- A refusal freezes each problem record as it makes it, then the list, then the answer.
- The kit freezes each copy in a failure once it is filled -- a point's, its coordinates copied as any other argument is (after B1), an array's, an object's, a thrown error's `{ thrown }`, an unreadable value's empty one -- and a copy begun before a read that threw, which a cycle beneath it may hold, as it stands; then each failure, its `args`, and the list.
- `deepFreeze` stays for the answers whose size no argument sets: the grid and its declaration, the open result, `nearest`, `pointOf`, `positionAt`, `next`, `span`, `enclosing`, and `square`.
- `CONTRACT.md` gains I12, held by snap-grid at the small size and by the gate at 2^24, and its "What is returned" paragraph a sentence: how a value is frozen bounds no answer.
- `tools/repeated-build.json` still names `0.1.1` alone, so a release run of `0.1.2`, whose built files differ, skips the repeated-build step; the release and gate workflows are unchanged, and a `v0.1.2` tag builds with them as they are.
- `README.md`'s Test names the gate's new step.

**The `0.1.1` tests changed.**
- `test/tools/gate-checks.test.js`, the repeated-build test: `0.1.1` repeats `0.1.0`, and `package.json`'s version, `0.1.2`, repeats none, where it asserted that `package.json`'s version repeats `0.1.0`; its name gains D6.
- The same file's end-to-end test of `tools/check-repeated-build.mjs`: its five runs that pass or fail on `0.1.1` name `--version 0.1.1`, where they took `package.json`'s; it gains a run with no version, which skips `0.1.2`.
- The same file's gate test: the gate script's exact text gains the step `NODE_OPTIONS=--max-old-space-size=4096 clean-runner run "test/large/*.large.js"`; its name gains I12 and the heap.
- Four tests are added to the contract files, and the I10 corpus and every other test are unchanged.

**Found, and not fixed.**\
Each gives less than the contract promises, but none is the freeze, none can be fixed by freezing as made, and the move names none; each needs a walk that tracks what it has seen without one `Set` or `Map`, a change of the kit's or the reader's design, and so the director's to rule, its revival trigger a consumer asking past it:
1. The kit's walk over a shape's answer, behind its checks for `-0` and for being frozen (I7 and `open`), tracks what it has seen in one `Set`, which cycles in a shape's answer need; judging `square` over a view pair whose answer passes 5,592,404 positions records a false I7 failure, `{ thrown: 'Set maximum size exceeded' }`, where under `0.1.1` that pair failed I4 and I7 because `inView` threw.
2. The kit's copy of a failure's argument or `got` tracks what it has copied in a `Map`, which V8 holds to 2^24 entries, so a value whose plain data holds more than 2^24 arrays and objects is not copied whole, where SG11 gives a deep copy of its plain data: the kit answers every failure, frozen, but an array or object met once the copy's map is full is copied as an empty object.\
   Which parts are so copied follows the walk's order and the limit, so no shape of such a copy is promised: SG11 makes two kits agree on `args`, and a promised shape would tie every kit to both.\
   This finding was worded wrong three times before B3's fix: first that the kit throws; after B1, that only the parts past the limit become empty objects; after B2, that the kit always answers, a value possibly copied as an empty object up to the whole of it -- a full map refused the empty copy's own entry, the error escaping to each copy above, so a value lost what came before the limit too, and a case point whose `x` filled the map made the kit throw at `y` (B3, below).\
   Revived when a consumer judges a shape over a case whose arguments or answers hold more than 2^24 arrays and objects.
3. The declaration reader reads each member's own properties into a `Map`, so a member of more than 2^24 own properties is refused `not-an-object` at its pointer, where SG1 gives one `unknown-property` each.

**Mutants.**\
Each made as exact text in a copy of the working tree -- two replacements where `deepFreeze` is imported again -- built and run against every test `npm test` runs, M1 also against I12's large test; all 22 were killed, M15, M18 and M19 only once the test of the kit's copies was added:

| Rule | Mutant | Tests failing, one of them |
|---|---|---|
| I12, SG6 | `inView` frozen through `deepFreeze`'s `Set` again, as `0.1.1` | 1, the capped `Set`; and I12, "Too many properties to enumerate" after 18 s |
| SG6 | an entry not frozen | 18, the answer frozen to its depth |
| SG6 | an entry's position not frozen | 18, the answer frozen to its depth |
| SG6 | an entry's point not frozen | 18, the answer frozen to its depth |
| SG6 | the array not frozen | 18, the answer frozen to its depth |
| SG6 | the answer not frozen | 18, the answer frozen to its depth |
| I12, SG1 | a refusal frozen through `deepFreeze`'s `Set` again | 1, the capped `Set` |
| SG1 | a problem record not frozen | 3, I9's refusals frozen |
| SG1 | the problem list not frozen | 3, I9's refusals frozen |
| I12, SG11 | the failure list frozen through `deepFreeze`'s `Set` again | 1, the capped `Set` |
| SG11 | a failure not frozen | 3, the failure list fresh and frozen |
| SG11 | a failure's `args` not frozen | 3, the failure list fresh and frozen |
| SG11 | the failure list not frozen | 4, the failure list fresh and frozen |
| SG11 | a copied object not frozen | 3, the failure list fresh and frozen |
| SG11 | a copied array not frozen | 1, the kit's copies |
| SG11 | a copied point not frozen | 1, a throwing accessor or `Proxy` |
| SG11 | a thrown error's copy not frozen | 2, the capped `Set` |
| SG11 | an unreadable value's copy not frozen | 1, the kit's copies |
| SG11 | a copy begun before a read that threw, held by a cycle, not frozen | 1, the kit's copies |
| `0.1.2` | the version left at `0.1.1` | 2, the repeated-build test |
| I12 | the gate without the large step | 1, the gate test |
| D6 | `tools/repeated-build.json` naming `0.1.2` as repeating `0.1.1` | 2, the repeated-build test |

**After the verifier's finding B1.**\
The verifier failed the move on B1: a failure's copy of a case point took its `x` and `y` raw and froze only the record, so the conforming `square`, judged over a case point `{ x: { k: [1] }, y: 0 }` or one whose `x` getter answers a new object, gave a failure list not frozen to its depth that kept the caller's object; `0.1.1`'s `deepFreeze` gave one frozen to its depth by freezing and keeping the caller's object.\
Shown over those two points by a probe outside the repository:

| Build | Frozen to its depth | The caller's object frozen | The caller's object kept |
|---|---|---|---|
| `0.1.1` (draw's installed `0.1.0`, the same bytes) | yes | yes | yes |
| `0.1.2` at `cfa57f8` | no | no | yes |
| `0.1.2` after B1 | yes | no | no |

- `copyPoint` reads `x` and then `y`, once each as before, and copies each as any other argument is copied, through one map, so a number is itself and a real point's copy is unchanged, two kits still agreeing; a coordinate object shared by `x` and `y` copies once.
- The test of the kit's copies gains a second case, failing on `cfa57f8` at "every failure frozen to its depth" before the fix: the verifier's two points, a point whose `x` and `y` are one object, and a position holding an array shared twice and a cyclic array -- each checked frozen to its depth, copied as it was shared or cyclic, and the caller's own values neither frozen nor kept.
- The gate's step runs on a heap of 4,096 MB, given as `NODE_OPTIONS`, which `clean-runner` hands the test process, so it does not depend on the machine's memory; at 2,560 MB the step ran out of heap after 34 s, and at 4,096 MB it passed in 13.9 s at a peak of 3.05 GB; the whole gate then took 25.2 s at a peak of 3.04 GB on Node 22 and 22.7 s at 2.91 GB on Node 24.
- `CONTRACT.md`'s sentence on freezing is qualified: freezing bounds no answer, but the reader's own limit and the kit's copy, findings 3 and 2 above, still bound a problem list and a failure list.

| Rule | Mutant | Tests failing |
|---|---|---|
| SG11, B1 | a case point's coordinates taken raw again, as at `cfa57f8` | 1, the kit's copies |
| SG11 | an array's copy not entered in the copy's map, the verifier's v7, which survived at `cfa57f8` | 1, the kit's copies |
| SG11 | an object's copy not entered in the copy's map | 1, the kit's copies |
| SG11 | `x` and `y` copied through separate maps | 1, the kit's copies |
| SG11 | a function coordinate kept by the copy, the re-review's c4, which survived at `281b846` until the copies test gained the case point `{ x: () => 0, y: 0 }` | 1, the kit's copies |

**After the re-review's finding B3.**\
The re-review found B2's wording still false in one case: a case point's `x` and `y` are copied through one map, so when `x` filled it, `y` was a new key, the catch's own `seen.set` was refused, and nothing above `copyPoint` caught it -- `checkGridShape` threw `RangeError: Map maximum size exceeded`, measured at the real limit with `{ x: <2^24 - 1 objects>, y: { m: 1 } }` on Node 22 and 24, where SG11 lets the kit throw only for a malformed shape or case; `0.1.1` threw too.\
Of the verifier's two options, recording the throw or fixing the code, the director chose the fix, so the promise holds:
- the catch's `seen.set` has its own `try`, and nothing else changed: a value met once the copy's map is full is not remembered and is copied as an empty object wherever it is met, the error no longer reaching the copy above, so the parts met before are kept and every failure is answered;
- `test/support/set-cap.js` gains `withMapCap`, holding the global `Map` to a cap as `withSetCap` holds the `Set`, and three tests use it at 1,000 entries, each failing on `0d2e8a1`: a case point `{ x: 999 objects, y: { m: 1 } }`, its failures answered and frozen, `x` whole and `y` as `{}`; a case point `{ x: 2,000 objects, y: 0 }`, `x` still an array of every element, the first 999 kept; and a case position `{ before: 10 objects, big: 2,000 objects, after }`, `before` kept and `after` as `{}`;
- the re-review's case at the real limit, `{ x: <2^24 - 1 objects>, y: { m: 1 } }`, on this build: every failure answered, frozen, `x` copied whole and `y` as `{}` -- 105.4 s at a peak of 6.97 GB on Node 22 and 82.2 s at 7.07 GB on Node 24, by a probe outside the repository on a heap of 12,288 MB;
- `CONTRACT.md`'s sentence and finding 2 above say what now holds, and no shape of a shortened copy.

| Rule | Mutant | Tests failing |
|---|---|---|
| SG11, B3 | the catch's `seen.set` without its own `try`, as at `0d2e8a1` | 3, the three tests of the copy's map full: the first throwing `Map maximum size exceeded`, the second finding `x` copied as `{}`, the third `before` dropped |

**After the re-review's findings B4 and T1.**\
B4: a failure's `got` for a thrown error held its `message` as it was, so a shape throwing an `Error` whose `message` is an object put that object into the failure list, unfrozen since `53d43f2`, where `0.1.1` held it and froze it.\
The kit now takes a thrown value's message only as a string, in `messageOf`'s existing `try`: an `Error`'s `message` when it is a string and otherwise `String` of it, anything else thrown by `String`, the existing catch answering "an unreadable error" when `String` throws; so `got.thrown` is always a string, as SG11's `{ thrown: <message> }` says, and a throw of anything but such an `Error` gives the message it gave before.\
A test, failing on `6302874` at "thrown is always a string": a shape throwing `Object.assign(new Error("e"), { message: { k: [1] } })` gives a failure list frozen to its depth, every `thrown` a string, and the shape's object neither held nor frozen; `messageOf` as at `6302874` is the mutant it kills.\
T1: the behaviour changes said `0.1.1` threw for a value of more than 2^24 arrays and objects; with both the `Set` and the `Map` capped, `0.1.1` threw for a case point alone, and for a position of 2,000 objects, for `{ before, big, after }` and for an answer of 2,000 objects answered, each copied as `{}` -- the sentence now says so.\
`CONTRACT.md`'s sentence on the copy and finding 2 above are reworded to parse.

**Released** only by this repository's CI on the tag `v0.1.2`, pushed once the move is verified.
