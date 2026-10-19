#!/usr/bin/env node
// consumer-test - the consumer test (the design's section 7.3): the package as a consumer receives it.
//
// It packs the package, installs the file into an empty project with --omit=dev, imports every export by
// name in Node, then serves the installed files with a small static server and loads every export in
// headless Chrome through an import map made as draw makes its own: one entry per export, never a
// trailing-slash prefix, each export's address carrying the package's version. The page calls openGrid
// once and writes what it saw into the page, which Chrome's --dump-dom returns.
//
// Chrome is $CHROME, or google-chrome on PATH. It runs with a profile of its own in a scratch directory,
// so it never touches another Chrome on the machine. Nothing here needs an npm dependency.
//
// Usage:  node tools/consumer-test.mjs [--keep]
import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keep = process.argv.includes("--keep");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "snap-grid-consumer-"));
const fail = (message) => {
	console.log(`consumer-test: FAIL -- ${message}`);
	process.exitCode = 1;
	throw new Error(message);
};
const step = (message) => console.log(`  ${message}`);

async function main() {
	// 1. build, then pack, as a release does
	execFileSync("npm", ["run", "build"], { cwd: root, stdio: ["ignore", "ignore", "inherit"] });
	const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", scratch], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }));
	const tarball = path.join(scratch, packed[0].filename);
	const shipped = packed[0].files.map((f) => f.path).sort();
	step(`packed ${packed[0].filename}: ${shipped.length} files`);
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
	const requests = [];
	const server = http.createServer((req, res) => {
		const url = new URL(req.url, "http://localhost");
		let status = 404, body = "not found", type = "text/plain";
		if (url.pathname === "/" || url.pathname === "/index.html") {
			status = 200;
			body = page;
			type = "text/html; charset=utf-8";
		} else if (url.pathname.startsWith(base)) {
			const rel = decodeURIComponent(url.pathname.slice(base.length));
			const file = path.resolve(installed, "dist", rel);
			if (file.startsWith(path.join(installed, "dist") + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
				status = 200;
				body = fs.readFileSync(file);
				type = file.endsWith(".js") ? "text/javascript; charset=utf-8" : file.endsWith(".map") ? "application/json" : "text/plain";
			}
		}
		requests.push({ path: url.pathname, status });
		res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
		res.end(body);
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = `http://127.0.0.1:${server.address().port}/`;
	step(`serving the page and ${base} at ${address}`);

	// 6. headless Chrome, a profile of its own
	try {
		const chrome = process.env.CHROME || "google-chrome";
		const profile = path.join(scratch, "chrome-profile");
		const args = ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions", `--user-data-dir=${profile}`, "--virtual-time-budget=10000", "--dump-dom", address];
		const { stdout: dom } = await run(chrome, args, { timeout: 90000, maxBuffer: 1 << 24 });
		const result = dom.match(/<pre id="result">([^<]*)<\/pre>/)?.[1] ?? "";
		const missed = requests.filter((r) => r.status !== 200 && r.path !== "/favicon.ico");
		if (missed.length) fail(`requests not answered 200: ${missed.map((r) => `${r.path} ${r.status}`).join(", ")}`);
		for (const address of Object.values(entries)) if (!requests.some((r) => r.path === address)) fail(`Chrome never asked for ${address}`);
		if (!result.startsWith("snap-grid-ok ")) fail(`Chrome's page says: ${result || dom.slice(0, 400)}`);
		const { stdout: version } = await run(chrome, ["--version"]);
		step(`${version.trim()} loaded ${specifiers.join(" and ")} through the import map: ${requests.length} requests, every one asked of the page answered 200`);
		step(`the page says: ${result}`);
	} finally {
		server.close();
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
} finally {
	if (!keep) fs.rmSync(scratch, { recursive: true, force: true });
	else console.log(`  kept ${scratch}`);
}
