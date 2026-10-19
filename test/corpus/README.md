# The I10 corpus

`i10-square-corpus.json` holds draw's grid arithmetic at commit `0c59572`, stated as square-grid cases (CONTRACT.md, I10).\
It was generated once by `tools/generate-i10-corpus.mjs` and is never written by hand; `i10-corpus.test.js` holds snap-grid to it.

---

## How it was made

Make a worktree of draw at the commit, then run the generator against it:
```bash
git -C ../drawv2 worktree add --detach /tmp/opencode/draw-0c59572 0c59572
node tools/generate-i10-corpus.mjs /tmp/opencode/draw-0c59572
git -C ../drawv2 worktree remove --force /tmp/opencode/draw-0c59572
```

The generator refuses a checkout at any other commit.\
Its random choices are seeded, so a second run writes the same file.

It calls draw's own functions where they are exported:
- nearest, bounded -- `snapNode` and `snapIn` (`app/src/snap.js:29-34,146-151`), on draw's two grids, pitch 60 and origin 0 within 900 by 480, and pitch 60 and origin 30 within 930 by 510;
- nearest, unbounded -- `nearestAnchor` (`kernel/geometry.mjs:59-63`), on the same two grids with no bounds;
- positionAt -- `onLayout` on each axis and `cellOn` for the index (`kernel/geometry.mjs:40,46`), on both grids, and within the bounds on the bounded ones;
- pointOf -- `anchorAt`, which is `pxOn` on each axis (`kernel/geometry.mjs:49,65-67`), on all four grids;
- inView over an extent -- `latticePoints` (`layouts/layout-canvas.mjs:26-35`), through each grid's `points`, from records of the layout table's form: draw's two, and five more of other pitches, origins and extents;
- span -- `through`'s corner from `anchorAt` and its size from `spanExtent` (`kernel/geometry.mjs:108-111`).

The zone wrap's floor and ceiling sit inside a closure, so the generator quotes them and their clamps (`zones/zone-keys.mjs:28-33`), and compares the quote with the file before it generates anything:
- enclosing, unbounded -- `floorZ` and `ceilZ` alone, on the grid of pitch 60 and origin 30;
- enclosing, bounded -- with the clamps, within 930 by 510, for rects not wholly beyond a side, since the wrap clamps its low edge only from below and its high edge only from above, and never meets such a rect.

The coordinates are integers and fractions of both signs, `-0`, ties and their neighbouring doubles, lattice points and theirs, points one rounding from either, points on, inside and beyond every edge, tiny magnitudes, and magnitudes up to 2^50.

---

## What it holds

Every answer draw gave was compared, as the corpus was made, with the exact answer of the BigInt oracle in `test/support/oracle.js`.\
Where they agree, the case is in `cases`; where they differ, it is in `apart`, with draw's answer as `referenceAnswer`, the exact one as `answer`, and a reason.

| Question | Cases | Apart, rounding | Apart, domain |
|---|---|---|---|
| nearest | 5533 | 49 | 18 |
| positionAt | 633 | 1 | 0 |
| pointOf | 712 | 0 | 0 |
| inView | 7 | 0 | 0 |
| enclosing | 1261 | 3 | 5 |
| span | 640 | 0 | 0 |
| all | 8786 | 53 | 23 |

**Rounding** is a point where draw's binary64 arithmetic is not exact: on the grid of origin 30, `v - 30` rounds before it divides, so within one rounding of a cell's edge draw gives the farther position, and `onLayout` accepts `x = -30 + 2^-48` (the design's section 6.3).\
Every one lies on that grid; on the grid of origin 0, `v - 0` is exact and the division never rounds onto a tie, so no point there differs.

**Domain** is a point within 2^50 whose exact nearest lattice point, which draw gives, lies beyond 2^50, where snap-grid clamps to the domain: on the grid of origin 30, `x = 2^50` gives `1125899906842650` from draw and `1125899906842590` from snap-grid (the design's section 6.3).

-0 is written as the string `"-0"`, since JSON has no negative zero, and the test reads it back as `-0`.\
The file names no word of draw's vocabulary, which its test confirms with the vocabulary check's list.
