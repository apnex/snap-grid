#!/usr/bin/env node
// check-runtime - the runtime check (the design's section 7.2; CONTRACT.md SG10 and I11): fails when a
// built file of a component meant for every runtime imports a bare specifier or a `node:` module, holds
// a dynamic `import(`, or names `process`, `require`, `Buffer`, `window`, `document`, `self`, `global`
// or `globalThis` -- so the whole of the module graph loads with its first import, in Node and in a
// browser alike.
//
// Each file is parsed by TypeScript into a syntax tree (ts.createSourceFile, ScriptKind.JS, as a
// module), so comments, strings, template literals and regular-expression literals are what the
// language says they are, whatever token comes before them. The walk visits:
// - every import and export declaration, whose module specifier must be a relative file;
// - every call whose callee is the `import` keyword -- a dynamic import;
// - every identifier, except the name of a property access (`a.self`, `a?.self`), which is a member and
//   not the global; an object-literal key (`{ self: 1 }`) is an identifier and is counted.
// A file TypeScript cannot parse without a diagnostic fails the check rather than being guessed at.
//
// Usage:  node tools/check-runtime.mjs [DIR_OR_FILE ...]    (default: dist, its .js files)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const RUNTIME_NAMES = ["process", "require", "Buffer", "window", "document", "self", "global", "globalThis"];

/** A built file's syntax tree, parsed as an ES module; throws when TypeScript reports a parse diagnostic. */
export function parseModule(source, fileName = "built.js") {
	const file = ts.createSourceFile(fileName, source, { languageVersion: ts.ScriptTarget.Latest, impliedNodeFormat: ts.ModuleKind.ESNext }, true, ts.ScriptKind.JS);
	// parseDiagnostics is where createSourceFile keeps what the parser reported
	const diagnostics = file.parseDiagnostics ?? [];
	if (diagnostics.length) {
		const first = diagnostics[0];
		const line = file.getLineAndCharacterOfPosition(first.start ?? 0).line + 1;
		throw new Error(`check-runtime: TypeScript could not parse the file: line ${line}: ${ts.flattenDiagnosticMessageText(first.messageText, " ")}`);
	}
	return file;
}

/** Every runtime finding in a built file's source: [{ line, finding }], in source order. */
export function findRuntimeUses(source, fileName) {
	const file = parseModule(source, fileName);
	const found = [];
	const lineOf = (node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
	const visit = (node) => {
		if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
			const specifier = node.moduleSpecifier.text;
			if (!specifier.startsWith("./") && !specifier.startsWith("../")) found.push({ line: lineOf(node), finding: `imports "${specifier}", which is not a relative file` });
		}
		if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) found.push({ line: lineOf(node), finding: "holds a dynamic import(" });
		if (ts.isIdentifier(node) && RUNTIME_NAMES.includes(node.text)) {
			const member = ts.isPropertyAccessExpression(node.parent) && node.parent.name === node;
			if (!member) found.push({ line: lineOf(node), finding: `names ${node.text}` });
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
		console.log("check-runtime: FAIL -- no built .js files found; run npm run build first");
		process.exit(1);
	}
	let findings = 0;
	for (const file of files) {
		let uses;
		try {
			uses = findRuntimeUses(fs.readFileSync(file, "utf8"), path.basename(file));
		} catch (e) {
			uses = [{ line: 1, finding: e.message }];
		}
		for (const f of uses) {
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
