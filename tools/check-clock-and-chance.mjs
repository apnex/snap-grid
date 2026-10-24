#!/usr/bin/env node
// check-clock-and-chance - the clock and chance check (CONTRACT.md SG10 and I11), vector-scene's as written,
// snap-grid's first (docs/DECISIONS.md, D3): fails when a built file reads a clock or randomness, holds a
// timer, or reaches a network -- what the runtime check (tools/check-runtime.mjs) does not look for, since
// those names are every runtime's globals; a grid keeps nothing between calls, so its answers depend on
// nothing but its declaration and its arguments.
//
// Each file is parsed by TypeScript into a syntax tree (check-runtime.mjs's parseModule), and the walk
// finds, in source order:
// - every identifier naming a clock, a timer, a source of chance or a network global -- Date,
//   performance, setTimeout, crypto, fetch and the rest below, Intl (whose DateTimeFormat reads the
//   clock) and Temporal among them, and WeakRef and FinalizationRegistry, whose answers follow the
//   collector's timing -- except the name of a property access (`a.Date`), which is a member and not the
//   global;
// - `Math.random`, and a member named `random` or `now` reached by brackets with a string literal on
//   Math, Date or performance (`Math["random"]`);
// - every use of `Math` as a value other than a direct member access by identifier, so `Math.max(1, 2)`
//   passes and `const m = Math`, `Math["max"]` or `f(Math)` do not;
// - every destructuring whose source is Math, Date or performance (`const { random } = Math`).
// A file TypeScript cannot parse without a diagnostic fails the check rather than being guessed at.
//
// Usage:  node tools/check-clock-and-chance.mjs [DIR_OR_FILE ...]    (default: dist, its .js files)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import { parseModule } from "./check-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CLOCK_AND_CHANCE_NAMES = ["Date", "performance", "setTimeout", "setInterval", "setImmediate", "clearTimeout", "clearInterval", "clearImmediate", "queueMicrotask", "requestAnimationFrame", "requestIdleCallback", "crypto", "fetch", "XMLHttpRequest", "WebSocket", "navigator", "location", "Intl", "Temporal", "WeakRef", "FinalizationRegistry"];
const HOLDERS = ["Math", "Date", "performance"];
const BANNED_MEMBERS = ["random", "now"];

/** The text of a string literal or a template with no substitution, or undefined. */
const literalText = (node) => (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : undefined);

/** True when a node is a bare identifier naming one of the holders of a clock or chance. */
const isHolder = (node) => ts.isIdentifier(node) && HOLDERS.includes(node.text);

/** Every clock, timer, source of chance or network a built file reaches: [{ line, finding }], in source order. */
export function findClockAndChance(source, fileName) {
	const file = parseModule(source, fileName);
	const found = [];
	const lineOf = (node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
	const visit = (node) => {
		if (ts.isIdentifier(node)) {
			const parent = node.parent;
			const memberName = ts.isPropertyAccessExpression(parent) && parent.name === node;
			if (CLOCK_AND_CHANCE_NAMES.includes(node.text) && !memberName) found.push({ line: lineOf(node), finding: `names ${node.text}` });
			if (node.text === "Math" && !memberName) {
				const directMember = ts.isPropertyAccessExpression(parent) && parent.expression === node && ts.isIdentifier(parent.name);
				if (directMember && parent.name.text === "random") found.push({ line: lineOf(node), finding: "reads Math.random" });
				else if (!directMember) found.push({ line: lineOf(node), finding: "uses Math as a value, not as a direct member access by identifier" });
			}
		}
		if (ts.isElementAccessExpression(node) && isHolder(node.expression) && BANNED_MEMBERS.includes(literalText(node.argumentExpression))) {
			found.push({ line: lineOf(node), finding: `reads ${node.expression.text}.${literalText(node.argumentExpression)} by brackets` });
		}
		if (ts.isVariableDeclaration(node) && node.initializer && isHolder(node.initializer) && (ts.isObjectBindingPattern(node.name) || ts.isArrayBindingPattern(node.name))) {
			found.push({ line: lineOf(node), finding: `destructures from ${node.initializer.text}` });
		}
		if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && isHolder(node.right) && (ts.isObjectLiteralExpression(node.left) || ts.isArrayLiteralExpression(node.left))) {
			found.push({ line: lineOf(node), finding: `destructures from ${node.right.text}` });
		}
		if (ts.isParameter(node) && node.initializer && isHolder(node.initializer) && (ts.isObjectBindingPattern(node.name) || ts.isArrayBindingPattern(node.name))) {
			found.push({ line: lineOf(node), finding: `destructures from ${node.initializer.text}` });
		}
		ts.forEachChild(node, visit);
	};
	visit(file);
	return found;
}

function jsFilesUnder(target) {
	const stat = fs.statSync(target);
	if (stat.isFile()) return target.endsWith(".js") ? [target] : [];
	return fs.readdirSync(target, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1)).flatMap((e) => jsFilesUnder(path.join(target, e.name)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const targets = process.argv.slice(2);
	const files = (targets.length ? targets : [path.join(root, "dist")]).flatMap((t) => jsFilesUnder(path.resolve(t)));
	if (files.length === 0) {
		console.log("check-clock-and-chance: FAIL -- no built .js files found; run npm run build first");
		process.exit(1);
	}
	let findings = 0;
	for (const file of files) {
		let uses;
		try {
			uses = findClockAndChance(fs.readFileSync(file, "utf8"), path.basename(file));
		} catch (e) {
			uses = [{ line: 1, finding: e.message }];
		}
		for (const f of uses) {
			console.log(`  ${path.relative(process.cwd(), file)}:${f.line}  ${f.finding}`);
			findings++;
		}
	}
	if (findings) {
		console.log(`check-clock-and-chance: FAIL -- ${findings} clock, timer, chance or network use(s) in ${files.length} built file(s)`);
		process.exit(1);
	}
	console.log(`check-clock-and-chance: PASS -- ${files.length} built file(s) read no clock or randomness, hold no timer and reach no network`);
}
