# snap-grid

Answer, for a grid declared as data, where its positions lie in a plane and which position lies nearest a point.

**Status: experimental until mission-kit admits it; runs in the Node versions `package.json`'s `engines` names, and in browsers that support ES2022 and import maps.**

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

A browser loads it as ES2022 modules through an import map, so it needs a browser that supports both.\
The page maps each export to its file with one import-map entry per export, never a trailing-slash prefix, which would map `@apnex/snap-grid/conformance` to an address with no `.js`.

---

## Use

Open a grid from a declaration, then ask it; every answer is exact over coordinates within 2^50, and frozen.

Open the grid and ask it the nearest position to a point, and where that position lies:
```js
import { openGrid } from "@apnex/snap-grid";

const opened = openGrid({ shape: "square", pitch: 60, origin: { x: 30, y: 30 }, bounds: { min: { x: -930, y: -510 }, max: { x: 930, y: 510 } } });
if (!opened.ok) throw new Error(JSON.stringify(opened.problems));
const { grid } = opened;
const position = grid.nearest({ x: 47, y: -12 });
const point = grid.pointOf(position);
```

The other questions are `positionAt`, `inView`, `next`, `span`, `regionContains` and `enclosing`; `CONTRACT.md` gives each one's rule, SG1 to SG9.\
A shape of your own is proved with the kit, `checkGridShape` from `@apnex/snap-grid/conformance` (SG11).

---

## Test

The gate builds, runs every test, the vocabulary, runtime and export-map checks, and mission-kit's style checks over the Markdown.

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

Then remove the import-map entries of each page that loads it, and any shape you proved with its kit.

---

## Documents

- `VISION.md` - why it exists, and what it will never be.
- `CONTRACT.md` - what a consumer can depend on, one capability per row, and every rule.
- `docs/DECISIONS.md` - the rulings about this component.
- `test/corpus/README.md` - how the corpus that holds it to its first consumer's arithmetic was made.
