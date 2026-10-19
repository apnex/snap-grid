#!/usr/bin/env node
// check-runtime - the runtime check (the design's section 7.2; CONTRACT.md SG10 and I11): fails when a
// built file of a component meant for every runtime imports a bare specifier or a `node:` module, holds
// a dynamic `import(`, or names `process`, `require`, `Buffer`, `window`, `document`, `self`, `global`
// or `globalThis` -- so the whole of the module graph loads with its first import, in Node and in a
// browser alike.
//
// Comments and the text of strings are set aside first, so a name in a comment is not a finding; an
// import's specifier is read from its string. A name read as a member, after `.`, is not the global.
// The scanner reads tsc's output, which holds no regular-expression literal; it fails loudly on a
// string or comment left open rather than guess.
//
// Usage:  node tools/check-runtime.mjs [DIR_OR_FILE ...]    (default: dist, its .js files)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const RUNTIME_NAMES = ["process", "require", "Buffer", "window", "document", "self", "global", "globalThis"];

/**
 * Splits JavaScript source into code, with each string replaced by a marker `"S<n>"` and each comment by
 * a space, and the list of string values; template text counts as string, `${...}` inside it as code.
 */
export function maskSource(source) {
	let code = "";
	const strings = [];
	const braces = [];
	let i = 0;
	const fail = (what) => {
		throw new Error(`check-runtime: ${what} left open at offset ${i}`);
	};
	const readTemplate = () => {
		let text = "";
		while (i < source.length) {
			const ch = source[i];
			if (ch === "\\") { text += source.slice(i, i + 2); i += 2; continue; }
			if (ch === "`") { i++; return { text, closed: true }; }
			if (ch === "$" && source[i + 1] === "{") { i += 2; return { text, closed: false }; }
			text += ch;
			i++;
		}
		return fail("a template literal");
	};
	while (i < source.length) {
		const ch = source[i];
		const next = source[i + 1];
		if (ch === "/" && next === "/") {
			while (i < source.length && source[i] !== "\n") i++;
			code += " ";
		} else if (ch === "/" && next === "*") {
			const end = source.indexOf("*/", i + 2);
			if (end < 0) fail("a block comment");
			code += source.slice(i, end + 2).replace(/[^\n]/g, " ");
			i = end + 2;
		} else if (ch === '"' || ch === "'") {
			let j = i + 1, text = "";
			while (j < source.length && source[j] !== ch) {
				if (source[j] === "\n") { i = j; fail("a string"); }
				if (source[j] === "\\") { text += source.slice(j, j + 2); j += 2; } else text += source[j++];
			}
			if (j >= source.length) fail("a string");
			code += `"S${strings.length}"`;
			strings.push(text);
			i = j + 1;
		} else if (ch === "`") {
			i++;
			const part = readTemplate();
			code += `"S${strings.length}"`;
			strings.push(part.text);
			if (!part.closed) { braces.push("template"); code += "${"; }
		} else if (ch === "{") {
			braces.push("code");
			code += ch;
			i++;
		} else if (ch === "}") {
			const kind = braces.pop();
			i++;
			if (kind === "template") {
				const part = readTemplate();
				code += `}"S${strings.length}"`;
				strings.push(part.text);
				if (!part.closed) { braces.push("template"); code += "${"; }
			} else code += ch;
		} else {
			code += ch;
			i++;
		}
	}
	return { code, strings };
}

/** Every runtime finding in a built file's source: [{ line, finding }]. */
export function findRuntimeUses(source) {
	const { code, strings } = maskSource(source);
	const found = [];
	const lineOf = (offset) => code.slice(0, offset).split("\n").length;
	const specifier = (marker) => strings[Number(marker)];
	const imports = /\b(?:import|export)\b[^;"]*?\bfrom\s*"S(\d+)"|\bimport\s*"S(\d+)"/g;
	for (const m of code.matchAll(imports)) {
		const spec = specifier(m[1] ?? m[2]);
		if (!spec.startsWith("./") && !spec.startsWith("../")) found.push({ line: lineOf(m.index), finding: `imports "${spec}", which is not a relative file` });
	}
	for (const m of code.matchAll(/\bimport\s*\(/g)) found.push({ line: lineOf(m.index), finding: "holds a dynamic import(" });
	for (const m of code.matchAll(new RegExp(`(?<![.\\w$])(?:${RUNTIME_NAMES.join("|")})(?![\\w$])`, "g"))) {
		found.push({ line: lineOf(m.index), finding: `names ${m[0]}` });
	}
	return found.sort((a, b) => a.line - b.line);
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
		console.log("check-runtime: FAIL -- no built .js files found; run npm run build first");
		process.exit(1);
	}
	let findings = 0;
	for (const file of files) {
		for (const f of findRuntimeUses(fs.readFileSync(file, "utf8"))) {
			console.log(`  ${path.relative(process.cwd(), file)}:${f.line}  ${f.finding}`);
			findings++;
		}
	}
	if (findings) {
		console.log(`check-runtime: FAIL -- ${findings} runtime-specific use(s) in ${files.length} built file(s)`);
		process.exit(1);
	}
	console.log(`check-runtime: PASS -- ${files.length} built file(s) import only relative files and name no runtime's globals`);
}
