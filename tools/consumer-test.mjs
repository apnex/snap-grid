#!/usr/bin/env node
// consumer-test - the consumer test (the design's section 7.3): the package as a consumer receives it.
//
// It packs the package -- or takes a tarball already packed, such as the one a release attaches --
// installs the file into an empty project with --omit=dev, imports every export by name in Node, then
// serves the installed files and loads every export in headless Chrome through an import map made as
// draw makes its own: one entry per export, never a trailing-slash prefix, each export's address carrying
// the package's version. The page calls openGrid once and writes what it saw into the page, which
// Chrome's --dump-dom returns.
//
// The server and the one-shot Chrome are headless-chromium's, the scratch folder clean-runner's (development
// dependencies, pinned to their release files, which nothing the package ships holds): serveStatic, dumpDom -- $CHROME, or
// a Chrome on PATH, in a folder of its own, gone with everything it made -- and scratchFolder, removed
// however this test ends. `npm run consumer` runs it under clean-runner's runner, which fails on anything
// it leaves behind.
//
// Usage:  node tools/consumer-test.mjs [--tarball FILE]    (or SNAP_GRID_TARBALL=FILE)
import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { scratchFolder } from "@apnex/clean-runner";
import { dumpDom, findChrome, serveStatic } from "@apnex/headless-chromium";

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tarballAt = process.argv.indexOf("--tarball");
const given = tarballAt > -1 ? process.argv[tarballAt + 1] : process.env.SNAP_GRID_TARBALL || null;
const scratch = scratchFolder("snap-grid-consumer-");
const fail = (message) => {
	console.log(`consumer-test: FAIL -- ${message}`);
	process.exitCode = 1;
	throw new Error(message);
};
const step = (message) => console.log(`  ${message}`);

async function main() {
	// 1. the tarball given, or build and pack one, as a release does
	let tarball, shipped;
	if (given) {
		tarball = path.resolve(given);
		if (!fs.existsSync(tarball) || !fs.statSync(tarball).isFile()) fail(`no tarball at ${tarball}`);
		const entries = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" }).split("\n").filter((e) => e && !e.endsWith("/"));
		if (entries.some((e) => !e.startsWith("package/"))) fail(`${tarball} is not an npm package tarball`);
		shipped = entries.map((e) => e.slice("package/".length)).sort();
		step(`took the tarball given, ${path.basename(tarball)}: ${shipped.length} files`);
	} else {
		execFileSync("npm", ["run", "build"], { cwd: root, stdio: ["ignore", "ignore", "inherit"] });
		const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", scratch], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }));
		tarball = path.join(scratch, packed[0].filename);
		shipped = packed[0].files.map((f) => f.path).sort();
		step(`packed ${packed[0].filename}: ${shipped.length} files`);
	}
	const stray = shipped.filter((f) => !f.startsWith("dist/") && !["CONTRACT.md", "LICENSE", "README.md", "VISION.md", "package.json"].includes(f));
	if (stray.length) fail(`the tarball holds files outside dist and the documents: ${stray.join(", ")}`);
	if (shipped.some((f) => f.endsWith(".d.ts.map"))) fail("the tarball holds a declaration map");

	// 2. install the file into an empty project, without development dependencies
	const project = path.join(scratch, "project");
	fs.mkdirSync(project);
	fs.writeFileSync(path.join(project, "package.json"), JSON.stringify({ name: "snap-grid-consumer", version: "0.0.0", private: true, type: "module" }, null, 2));
	execFileSync("npm", ["install", tarball, "--omit=dev", "--no-audit", "--no-fund"], { cwd: project, stdio: ["ignore", "ignore", "inherit"] });
	const installed = path.join(project, "node_modules", "@apnex", "snap-grid");
	const pkg = JSON.parse(fs.readFileSync(path.join(installed, "package.json"), "utf8"));
	const others = fs.readdirSync(path.join(project, "node_modules")).filter((d) => d !== "@apnex" && !d.startsWith("."));
	if (others.length) fail(`installing brought other packages: ${others.join(", ")}`);
	step(`installed ${pkg.name}@${pkg.version} into an empty project, with nothing else`);

	// 3. import every export by name in Node
	const map = JSON.parse(fs.readFileSync(path.join(root, "export-map.json"), "utf8"));
	const specifiers = Object.keys(pkg.exports).map((p) => (p === "." ? pkg.name : `${pkg.name}/${p.slice(2)}`));
	const imports = Object.entries(map.paths).map(([p, e], i) => `import { ${Object.keys(e.exports).join(", ")} } from "${p === "." ? pkg.name : `${pkg.name}/${p.slice(2)}`}"; const m${i} = { ${Object.keys(e.exports).join(", ")} };`);
	const nodeCheck = [
		...imports,
		"const all = Object.assign({}, " + Object.keys(map.paths).map((_, i) => `m${i}`).join(", ") + ");",
		'for (const [name, value] of Object.entries(all)) if (value === undefined) throw new Error(name + " is undefined");',
		'const r = all.openGrid({ shape: "square", pitch: 60, origin: { x: 30, y: 30 } });',
		'if (!r.ok || r.grid.nearest({ x: -60 - 2 ** -47, y: 0 }).col !== -2) throw new Error("openGrid answered wrongly");',
		'if (all.checkGridShape(all.square, []).length !== 0) throw new Error("checkGridShape answered wrongly");',
		'console.log("node-ok " + Object.keys(all).sort().join(","));',
	].join("\n");
	fs.writeFileSync(path.join(project, "node-check.mjs"), nodeCheck);
	const { stdout: nodeOut } = await run(process.execPath, ["node-check.mjs"], { cwd: project });
	if (!nodeOut.startsWith("node-ok ")) fail(`Node: ${nodeOut}`);
	step(`Node ${process.version} imported ${nodeOut.trim().slice(8)} by name`);

	// 4. an import map, one entry per export, each into the vendored files at the installed version
	const base = `/vendor/${pkg.name}@${pkg.version}/`;
	const entries = {};
	for (const [p, target] of Object.entries(pkg.exports)) {
		const file = typeof target === "string" ? target : target.default;
		const conditions = typeof target === "string" ? [] : Object.keys(target);
		if (conditions.some((c) => c !== "types" && c !== "default") || p.includes("*") || typeof file !== "string" || !file.startsWith("./dist/")) fail(`an exports form the map does not support: ${p}`);
		entries[p === "." ? pkg.name : `${pkg.name}/${p.slice(2)}`] = base + file.slice("./dist/".length);
	}
	if (Object.keys(entries).some((k) => k.endsWith("/"))) fail("a trailing-slash entry in the import map");
	const bindings = Object.entries(map.paths).flatMap(([p, e]) => Object.keys(e.exports).map((name) => ({ name, from: p === "." ? pkg.name : `${pkg.name}/${p.slice(2)}` })));
	const page = `<!doctype html>
<html><head><meta charset="utf-8"><title>snap-grid consumer</title>
<script type="importmap">${JSON.stringify({ imports: entries })}</script>
<script type="module">
${[...new Set(bindings.map((b) => b.from))].map((from) => `import { ${bindings.filter((b) => b.from === from).map((b) => b.name).join(", ")} } from "${from}";`).join("\n")}
const names = { ${bindings.map((b) => b.name).join(", ")} };
const out = document.getElementById("result");
try {
	const missing = Object.entries(names).filter(([, v]) => v === undefined).map(([k]) => k);
	const opened = openGrid({ shape: "square", pitch: 60, origin: { x: 30, y: 30 } });
	const n = opened.grid.nearest({ x: -60 - 2 ** -47, y: 0 });
	const p = opened.grid.pointOf(n);
	out.textContent = missing.length === 0 && opened.ok && n.col === -2 && p.x === -90 ? "snap-grid-ok " + Object.keys(names).sort().join(",") + " " + JSON.stringify(p) : "snap-grid-wrong " + missing.join(",");
} catch (e) {
	out.textContent = "snap-grid-error " + e.message;
}
</script></head><body><pre id="result">snap-grid-pending</pre></body></html>
`;

	// 5. a static server: the page, and the installed package's files under its versioned address
	const server = await serveStatic({ pages: { "/": page, "/index.html": page }, folders: { [base]: path.join(installed, "dist") } });
	const requests = server.requests;
	const address = `${server.origin}/`;
	step(`serving the page and ${base} at ${address}`);

	// 6. headless Chrome, one-shot, in a folder of its own
	try {
		const chrome = findChrome();
		if (chrome === null) fail("no Chrome: set CHROME, or put google-chrome on PATH");
		const dom = await dumpDom(address, { virtualTimeBudgetMs: 10000, timeoutMs: 90000 });
		const result = dom.match(/<pre id="result">([^<]*)<\/pre>/)?.[1] ?? "";
		const missed = requests.filter((r) => r.status !== 200 && r.path !== "/favicon.ico");
		if (missed.length) fail(`requests not answered 200: ${missed.map((r) => `${r.path} ${r.status}`).join(", ")}`);
		for (const address of Object.values(entries)) if (!requests.some((r) => r.path === address)) fail(`Chrome never asked for ${address}`);
		if (!result.startsWith("snap-grid-ok ")) fail(`Chrome's page says: ${result || dom.slice(0, 400)}`);
		const { stdout: version } = await run(chrome, ["--version"]);
		step(`${version.trim()} loaded ${specifiers.join(" and ")} through the import map: ${requests.length} requests, every one asked of the page answered 200`);
		step(`the page says: ${result}`);
	} finally {
		await server.close();
	}
	console.log("consumer-test: PASS");
}

try {
	await main();
} catch (e) {
	if (!process.exitCode) {
		console.log(`consumer-test: FAIL -- ${e.message}`);
		process.exitCode = 1;
	}
}
