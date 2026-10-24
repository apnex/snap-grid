#!/usr/bin/env node
// compare-built - the built files of two package tarballs, byte for byte (docs/DECISIONS.md, D3): fails
// unless both hold exactly the same files under `package/dist/`, each with the same bytes. A release that
// changes no built file -- a patch carrying documents alone -- names in tools/repeated-build.json the
// release whose built files it repeats, and the release run's tools/check-repeated-build.mjs compares the
// tarball it packed with that release's, downloaded through the authenticated API and checked against its
// own SHA-512, before it makes a draft (.github/workflows/release.yml).
//
// Each tarball is listed and unpacked by `tar` into a scratch directory, which is removed afterwards.
//
// Usage:  node tools/compare-built.mjs PACKED.tgz BASE.tgz
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** The release whose built files the release of `version` repeats, from tools/repeated-build.json, or null. */
export function repeatedBuild(version, file = path.join(here, "repeated-build.json")) {
	const releases = JSON.parse(fs.readFileSync(file, "utf8")).releases;
	return Object.hasOwn(releases, version) ? releases[version] : null;
}

/** The built files a package tarball holds, as paths under `package/dist/`, sorted. */
function builtFiles(tarball) {
	return execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" })
		.split("\n")
		.filter((entry) => entry.startsWith("package/dist/") && !entry.endsWith("/"))
		.map((entry) => entry.slice("package/dist/".length))
		.sort();
}

/** Every difference between two package tarballs' built files, one line each, and the files compared. */
export function compareBuilt(packed, base) {
	const problems = [];
	const ours = builtFiles(packed);
	const theirs = builtFiles(base);
	for (const file of ours) if (!theirs.includes(file)) problems.push(`dist/${file} is in ${path.basename(packed)} alone`);
	for (const file of theirs) if (!ours.includes(file)) problems.push(`dist/${file} is in ${path.basename(base)} alone`);
	if (ours.length === 0) problems.push(`${path.basename(packed)} holds no built file`);
	const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "snap-grid-compare-"));
	try {
		const unpack = (tarball, into) => {
			fs.mkdirSync(into);
			execFileSync("tar", ["-xzf", tarball, "-C", into]);
			return path.join(into, "package", "dist");
		};
		const a = unpack(packed, path.join(scratch, "packed"));
		const b = unpack(base, path.join(scratch, "base"));
		const both = ours.filter((file) => theirs.includes(file));
		for (const file of both) if (!fs.readFileSync(path.join(a, file)).equals(fs.readFileSync(path.join(b, file)))) problems.push(`dist/${file} differs`);
		return { problems, compared: both.length };
	} finally {
		fs.rmSync(scratch, { recursive: true, force: true });
	}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const [packed, base] = process.argv.slice(2);
	if (!packed || !base) {
		console.log("compare-built: FAIL -- usage: node tools/compare-built.mjs PACKED.tgz BASE.tgz");
		process.exit(1);
	}
	const { problems, compared } = compareBuilt(path.resolve(packed), path.resolve(base));
	for (const p of problems) console.log(`  ${p}`);
	if (problems.length) {
		console.log(`compare-built: FAIL -- ${problems.length} difference(s) between ${path.basename(packed)} and ${path.basename(base)}`);
		process.exit(1);
	}
	console.log(`compare-built: PASS -- ${compared} built file(s) of ${path.basename(packed)} are byte-identical to ${path.basename(base)}'s, and neither holds another`);
}
