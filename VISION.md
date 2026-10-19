# snap-grid - Vision

**Status: ratified by the director as written, 2026-10-20 (draw's ruling `H26-4`, in draw's `dev/DECISIONS.md`); enduring.**\
This document states why snap-grid exists and what it will never be.\
It carries no current state, no roadmap, and no schedule.

Holding this document authorises nothing.\
A change of direction is recorded as a decision first and absorbed here afterwards.

---

**North star.**\
Let every part of every application agree, to the last unit, on where a grid's positions lie and which one a point belongs to.

**Why it exists.**\
Applications that place things on a grid restate the arithmetic -- snap here, validate there, draw somewhere else -- and the restatements drift: a point the canvas accepts is one the server refuses, or a dot is drawn a unit off the place it marks.\
`snap-grid` holds the arithmetic once, for any shape of grid, so the parts that snap, validate and draw ask the same thing and get the same answer.

**What it is.**\
An embeddable library that opens a grid declared as data and answers seven questions of it: the nearest position, where a position lies, whether a point is exactly on one, the positions in view, a position's neighbour, the span of a block, and the block enclosing a region.\
Grids are supplied by whoever asks; `snap-grid` keeps none.

**What it is not.**
- Not a renderer: it says where; the consumer draws.
- Not a store: which grids an application has, and how they change, are the application's.
- Not an authority: it never decides what may sit at a position.
- Not a general snapping engine: it knows its grid, never other things' edges.
- Not a network service: it never listens and never sends.

**What success means.**
- **Agreement:** no two consumers of one declaration ever disagree on a position or a point.
- **Leanness:** small enough that no consumer would rather write its own.
- **Reach:** a grid of a new shape arrives as a shape proved by the kit, never as a change to a consumer.
- **Reuse:** a second, unrelated application adopts it without a variant, a fork or a change.

**Authority.**\
Held by the director; drafted by anyone, ratified only by the director; amended, never quietly rewritten.
