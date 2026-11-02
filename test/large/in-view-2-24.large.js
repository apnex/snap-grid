// in-view-2-24 - I12: inView lists 2^24 positions in one answer, past the 5,592,404 at which 0.1.1 stopped, its
// deep freeze tracking every object in one Set, which V8 holds to 2^24 entries (docs/DECISIONS.md, D6). One
// answer of 2^24 positions holds three objects each and costs about 3 GB and 8 to 12 seconds, so this file is not
// among the tests npm test runs: the gate runs it in a step of its own, after them (package.json). The tests that
// run everywhere hold the same property at a small size, the global Set held to 1,000 entries (test/support/set-cap.js).
import assert from "node:assert/strict";
import { test } from "node:test";

import { openGrid } from "@apnex/snap-grid";

const N = 2 ** 24;

test("I12: inView lists 2^24 positions in one answer -- one row of 16,777,216 on a grid of pitch 60 and origin 30, -30, at stride 1, the answer, its array and every entry, position and point frozen, in order, each point its position's", () => {
	const { grid } = openGrid({ shape: "square", pitch: 60, origin: { x: 30, y: -30 } });
	const answer = grid.inView({ region: { kind: "rect", x: 30, y: -30, w: (N - 1) * 60, h: 0 }, scale: 1 }, { max: N });
	assert.equal(answer.stride, 1);
	assert.equal(answer.positions.length, N);
	assert.ok(Object.isFrozen(answer) && Object.isFrozen(answer.positions));
	assert.deepEqual(Object.keys(answer), ["stride", "positions"]);
	let wrong = -1;
	for (let i = 0; i < N && wrong < 0; i++) {
		const { position, point } = answer.positions[i];
		const frozen = Object.isFrozen(answer.positions[i]) && Object.isFrozen(position) && Object.isFrozen(point);
		if (!frozen || position.col !== i || position.row !== 0 || point.x !== 30 + 60 * i || point.y !== -30) wrong = i;
	}
	assert.equal(wrong, -1, `entry ${wrong} is not frozen, in order and at its point`);
	assert.deepEqual(answer.positions[N - 1], { position: { col: N - 1, row: 0 }, point: grid.pointOf({ col: N - 1, row: 0 }) });
	assert.deepEqual(Object.keys(answer.positions[N - 1]), ["position", "point"]);
});
