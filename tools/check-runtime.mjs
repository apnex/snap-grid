#!/usr/bin/env node
// check-runtime - the runtime check (the design's section 7.2; CONTRACT.md SG10 and I11): fails when a
// built file of a component meant for every runtime imports a bare specifier or a `node:` module, holds
// a dynamic `import(`, or names `process`, `require`, `Buffer`, `window`, `document`, `self`, `global`
// or `globalThis` -- so the whole of the module graph loads with its first import, in Node and in a
// browser alike.
//
// The files are tokenized with TypeScript's own scanner (ts.createScanner), so comments, strings,
// template literals and regular-expression literals are told apart from code; a name in a comment or a
// string is not a finding, and an import's specifier is read from its string token. Whether a `/` begins
// a regular expression is decided from the token before it, as a parser would: after a value -- a name,
// a literal, `)`, `]` or `}` -- it divides, and anywhere else it begins a regular expression. A name read
// as a member, after `.` or `?.`, is not the global. A string, template, comment or regular expression
// the scanner reports left open fails the check rather than being guessed at.
//
// Usage:  node tools/check-runtime.mjs [DIR_OR_FILE ...]    (default: dist, its .js files)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const K = ts.SyntaxKind;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const RUNTIME_NAMES = ["process", "require", "Buffer", "window", "document", "self", "global", "globalThis"];

// a `/` after one of these divides; after anything else it begins a regular expression
const ENDS_VALUE = new Set([
	K.Identifier, K.PrivateIdentifier, K.NumericLiteral, K.BigIntLiteral, K.StringLiteral, K.RegularExpressionLiteral,
	K.NoSubstitutionTemplateLiteral, K.TemplateTail, K.CloseParenToken, K.CloseBracketToken, K.CloseBraceToken,
	K.ThisKeyword, K.SuperKeyword, K.NullKeyword, K.TrueKeyword, K.FalseKeyword, K.PlusPlusToken, K.MinusMinusToken,
]);
const MEMBER = new Set([K.DotToken, K.QuestionDotToken]);
const isKeyword = (kind) => kind >= K.FirstKeyword && kind <= K.LastKeyword;

/** The significant tokens of JavaScript source: [{ kind, text, value, line }], comments and whitespace left out. */
export function tokenize(source) {
	const errors = [];
	const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, source, (message, length) => {
		errors.push(`${ts.flattenDiagnosticMessageText(message.message, "\n")} (offset ${scanner.getTokenEnd?.() ?? 0}, length ${length})`);
	});
	const tokens = [];
	const braces = [];
	for (;;) {
		let kind = scanner.scan();
		if (kind === K.EndOfFileToken) break;
		const prev = tokens[tokens.length - 1];
		const beforePrev = tokens[tokens.length - 2];
		if (kind === K.SlashToken || kind === K.SlashEqualsToken) {
			const divides = prev !== undefined && (ENDS_VALUE.has(prev.kind) || (isKeyword(prev.kind) && beforePrev !== undefined && MEMBER.has(beforePrev.kind)));
			if (!divides) kind = scanner.reScanSlashToken();
		}
		if (kind === K.OpenBraceToken || kind === K.DollarBraceToken) braces.push("code");
		else if (kind === K.TemplateHead) braces.push("template");
		else if (kind === K.CloseBraceToken && braces.pop() === "template") {
			kind = scanner.reScanTemplateToken(false);
			if (kind === K.TemplateMiddle) braces.push("template");
		}
		const start = scanner.getTokenStart();
		tokens.push({ kind, text: scanner.getTokenText(), value: scanner.getTokenValue(), line: source.slice(0, start).split("\n").length });
	}
	if (errors.length) throw new Error(`check-runtime: the scanner could not read the file: ${errors.join("; ")}`);
	return tokens;
}

/** Every runtime finding in a built file's source: [{ line, finding }]. */
export function findRuntimeUses(source) {
	const tokens = tokenize(source);
	const found = [];
	tokens.forEach((t, i) => {
		const prev = tokens[i - 1];
		const next = tokens[i + 1];
		const asMember = prev !== undefined && MEMBER.has(prev.kind);
		if (t.kind === K.ImportKeyword && !asMember && next?.kind === K.OpenParenToken) found.push({ line: t.line, finding: "holds a dynamic import(" });
		const specifier = (t.kind === K.FromKeyword || (t.kind === K.ImportKeyword && !asMember)) && next?.kind === K.StringLiteral ? next.value : null;
		if (specifier !== null && !specifier.startsWith("./") && !specifier.startsWith("../")) found.push({ line: t.line, finding: `imports "${specifier}", which is not a relative file` });
		// require and global are contextual keywords to the scanner, so a name is any identifier or keyword token
		if ((t.kind === K.Identifier || isKeyword(t.kind)) && !asMember && RUNTIME_NAMES.includes(t.text)) found.push({ line: t.line, finding: `names ${t.text}` });
	});
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
			uses = findRuntimeUses(fs.readFileSync(file, "utf8"));
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
