#!/usr/bin/env node
// check-repeated-build - the release run's check that a release which changes no built file repeats, byte for
// byte, the built files of the release it names (docs/DECISIONS.md, D3; .github/workflows/release.yml).
//
// It looks the release's version up in tools/repeated-build.json (repeatedBuild, tools/compare-built.mjs); a
// version the map does not name repeats nothing, so it says so and passes, asking nothing of GitHub. For a
// version the map names, it downloads that release's tarball and its SHA-512 with `gh release download` into
// the directory given, checks the tarball against the SHA-512 file -- one line as sha512sum writes it, the
// digest and the tarball's own name -- and compares the built files of the packed tarball with the
// downloaded one's (compareBuilt), failing on a file in either alone or a byte differing.
//
// `gh` is the one on PATH, authenticated in a release run by GH_TOKEN; a test puts a stand-in first on PATH.
//
// Usage:  node tools/check-repeated-build.mjs PACKED.tgz --repo OWNER/NAME --dir DIR [--version VERSION]
//         (VERSION defaults to package.json's)
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compareBuilt, repeatedBuild } from "./compare-built.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fail = (message) => {
	console.log(`check-repeated-build: FAIL -- ${message}`);
	process.exit(1);
};

const args = process.argv.slice(2);
const flag = (name) => {
	const at = args.indexOf(name);
	return at > -1 ? args[at + 1] : undefined;
};
const packed = args[0] !== undefined && !args[0].startsWith("--") ? path.resolve(args[0]) : undefined;
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = flag("--version") ?? pkg.version;

const base = repeatedBuild(version);
if (base === null) {
	console.log(`check-repeated-build: SKIP -- ${version} names no release whose built files it repeats (tools/repeated-build.json)`);
	process.exit(0);
}
const repo = flag("--repo");
const dir = flag("--dir");
if (packed === undefined || repo === undefined || dir === undefined) fail("usage: node tools/check-repeated-build.mjs PACKED.tgz --repo OWNER/NAME --dir DIR [--version VERSION]");
if (!fs.existsSync(packed)) fail(`no packed tarball at ${packed}`);

// the release's file is named as npm packs it: the package's name, its scope's @ dropped and its / a hyphen, then the version
const file = `${pkg.name.replace(/^@/, "").replace("/", "-")}-${base}.tgz`;
fs.mkdirSync(dir, { recursive: true });
try {
	execFileSync("gh", ["release", "download", `v${base}`, "--repo", repo, "--dir", dir, "--pattern", file, "--pattern", `${file}.sha512`], { stdio: ["ignore", "inherit", "inherit"] });
} catch (error) {
	fail(`gh could not download ${file} and its SHA-512 from release v${base} of ${repo}: ${error.message.split("\n")[0]}`);
}
const downloaded = path.join(dir, file);
if (!fs.existsSync(downloaded) || !fs.existsSync(`${downloaded}.sha512`)) fail(`gh left no ${file} or no ${file}.sha512 in ${dir}`);

// the SHA-512 file as sha512sum writes it: the digest, a space, a space or *, and the file's name
const line = fs.readFileSync(`${downloaded}.sha512`, "utf8").trim();
const written = /^([0-9a-f]{128}) [ *](.+)$/.exec(line);
if (written === null || line.includes("\n")) fail(`${file}.sha512 is not one line of sha512sum's form`);
if (written[2] !== file) fail(`${file}.sha512 names ${written[2]}, not ${file}`);
const digest = crypto.createHash("sha512").update(fs.readFileSync(downloaded)).digest("hex");
if (digest !== written[1]) fail(`${file} does not match the SHA-512 attached beside it`);
console.log(`  ${file} matches the SHA-512 attached beside it`);

const { problems, compared } = compareBuilt(packed, downloaded);
for (const p of problems) console.log(`  ${p}`);
if (problems.length) fail(`${problems.length} difference(s) between the built files of ${path.basename(packed)} and of release v${base}`);
console.log(`check-repeated-build: PASS -- ${compared} built file(s) of ${path.basename(packed)} are byte-identical to release v${base}'s, and neither holds another`);
