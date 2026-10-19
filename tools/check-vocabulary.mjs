#!/usr/bin/env node
// check-vocabulary - the vocabulary check (the design's section 7.2; CONTRACT.md I11): fails when a
// file holds a word of a consumer's vocabulary, in code, a string or a comment.
//
// Every run of letters, digits, underscores and hyphens is split at case changes, underscores and
// hyphens -- so nodeCount is node and count, NODE_EXT is node and ext -- and each part is compared,
// lower-cased, as a whole word with every list in tools/consumer-vocabulary.json. An import check
// cannot see a word in a comment; this can.
//
// The lists are test data, kept here and never in src/ or a release. A listed word a component
// genuinely needs is allowed by name in its decision record, never by loosening the match.
//
// Usage:  node tools/check-vocabulary.mjs [DIR_OR_FILE ...]    (default: src)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

/** The consumer lists: { consumer: [word, ...] }. */
export function readVocabulary(file = path.join(here, "consumer-vocabulary.json")) {
	return JSON.parse(fs.readFileSync(file, "utf8")).lists;
}

/** Splits text into lower-cased words at case changes, underscores, hyphens and every other non-word character. */
export function splitWords(text) {
	const words = [];
	for (const run of text.match(/[A-Za-z0-9_-]+/g) ?? []) {
		for (const piece of run.split(/[_-]+/)) {
			if (!piece) continue;
			// a lower-case letter or digit then a capital, or a capital then a capital and a lower-case letter
			for (const word of piece.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)) if (word) words.push(word.toLowerCase());
		}
	}
	return words;
}

/** Every listed word a text holds: [{ line, word, consumer }], in order. */
export function findVocabulary(text, lists) {
	const owner = new Map();
	for (const [consumer, words] of Object.entries(lists)) for (const w of words) owner.set(w.toLowerCase(), consumer);
	const found = [];
	text.split("\n").forEach((line, i) => {
		for (const word of splitWords(line)) if (owner.has(word)) found.push({ line: i + 1, word, consumer: owner.get(word) });
	});
	return found;
}

function filesUnder(target) {
	const stat = fs.statSync(target);
	if (stat.isFile()) return [target];
	return fs.readdirSync(target, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1)).flatMap((e) => filesUnder(path.join(target, e.name)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const targets = process.argv.slice(2);
	const lists = readVocabulary();
	const files = (targets.length ? targets : [path.join(root, "src")]).flatMap((t) => filesUnder(path.resolve(t)));
	if (files.length === 0) {
		console.log("check-vocabulary: FAIL -- no files found, so nothing was checked");
		process.exit(1);
	}
	let findings = 0;
	for (const file of files) {
		for (const f of findVocabulary(fs.readFileSync(file, "utf8"), lists)) {
			console.log(`  ${path.relative(process.cwd(), file)}:${f.line}  "${f.word}" (${f.consumer})`);
			findings++;
		}
	}
	if (findings) {
		console.log(`check-vocabulary: FAIL -- ${findings} word(s) of a consumer's vocabulary in ${files.length} file(s)`);
		process.exit(1);
	}
	console.log(`check-vocabulary: PASS -- ${files.length} file(s), no word of ${Object.keys(lists).join(" or ")}'s vocabulary`);
}
