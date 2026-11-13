import { findClaudeImports } from "./core/claudeImports.js";
import { handoffPrompt } from "./core/handoff.js";
import { instructionRisks } from "./core/risks.js";
import { isSecretLikeDirName, isSecretLikeFileName, redactLines } from "./core/secrets.js";
import { h, plural, replace, route } from "./dom.js";
import { codeBlock } from "./workspace.js";
const FORMATS = { "AGENTS.md": "agents-md", "AGENTS.override.md": "agents-override-md", "CLAUDE.md": "claude-md", "CLAUDE.local.md": "claude-local-md", "SKILL.md": "skill-md" };
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "vendor", ".venv", "venv", "target"]);
const MAX_FILE_BYTES = 1024 * 1024;
const SKILL_NAME = /^[\p{Ll}\p{Nd}]+(?:-[\p{Ll}\p{Nd}]+)*$/u;
const basename = (p) => p.slice(p.lastIndexOf("/") + 1);
const dirOf = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const scopeDir = (s) => (s.format === "claude-md" && basename(dirOf(s.relPath)) === ".claude" ? dirOf(dirOf(s.relPath)) : dirOf(s.relPath));
const isSameOrBelow = (dir, anc) => anc === "" || dir === anc || dir.startsWith(`${anc}/`);
function normalize(joined) {
    const out = [];
    for (const part of joined.split("/")) {
        if (part === "" || part === ".")
            continue;
        if (part === "..") {
            if (out.length === 0)
                return null;
            out.pop();
        }
        else
            out.push(part);
    }
    return out.join("/");
}
/** Reads top-level `key: value` pairs, including folded and literal blocks. Not a full YAML parser. */
function readFrontmatter(lines) {
    if (lines[0]?.trim() !== "---")
        return { kind: "none" };
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
    if (end === -1)
        return { kind: "error", message: "Frontmatter starts with --- but never closes.", endLine: Math.min(lines.length, 20) };
    const data = {};
    const keyLines = {};
    let current = null;
    for (let i = 1; i < end; i++) {
        const l = lines[i] ?? "";
        const m = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(l);
        if (m) {
            const key = m[1] ?? "";
            let v = (m[2] ?? "").trim().replace(/\s+#.*$/, "");
            if (/^["'].*["']$/.test(v))
                v = v.slice(1, -1);
            current = /^[|>][+-]?$/.test(v) || v === "" ? key : null;
            data[key] = /^[|>][+-]?$/.test(v) ? "" : v;
            keyLines[key] = i + 1;
        }
        else if (/^\s+\S/.test(l) && current) {
            data[current] = `${data[current] ?? ""} ${l.trim()}`.trim();
        }
        else if (l.trim() !== "" && !l.trim().startsWith("#")) {
            return { kind: "error", message: `Line ${i + 1} of the frontmatter is not a simple key: value pair.`, endLine: end + 1 };
        }
    }
    return { kind: "ok", data, keyLines, endLine: end + 1 };
}
function check(sources, known) {
    const out = [];
    const add = (r) => { out.push(r); };
    for (const s of sources) {
        if (s.lines.every((l) => l.trim() === "")) {
            add({ checkId: "D00", severity: "info", message: "File is empty or whitespace-only; clients skip or gain nothing from it.", relPath: s.relPath, line: 1 });
            continue;
        }
        if (s.format === "skill-md") {
            const fm = readFrontmatter(s.lines);
            if (fm.kind === "none")
                add({ checkId: "D01", severity: "error", message: "SKILL.md has no YAML frontmatter; the spec requires `name` and `description`.", relPath: s.relPath, line: 1 });
            else if (fm.kind === "error")
                add({ checkId: "D01", severity: "error", message: fm.message, relPath: s.relPath, line: 1 });
            else {
                const folder = basename(dirOf(s.relPath));
                const name = fm.data["name"];
                if (!name)
                    add({ checkId: "D02", severity: "error", message: "Frontmatter `name` is missing.", relPath: s.relPath, line: 1 });
                else {
                    const problems = [];
                    if (name.length > 64)
                        problems.push("is longer than 64 characters");
                    if (!SKILL_NAME.test(name))
                        problems.push("must use lowercase letters, digits and single hyphens, not starting or ending with a hyphen");
                    if (folder && name !== folder)
                        problems.push(`does not match its folder name \`${folder}\``);
                    if (problems.length)
                        add({ checkId: "D02", severity: "error", message: `Skill name \`${name}\` ${problems.join("; ")}.`, relPath: s.relPath, line: fm.keyLines["name"] ?? 1 });
                }
                const desc = fm.data["description"];
                if (!desc)
                    add({ checkId: "D03", severity: "error", message: "Frontmatter `description` is missing or empty.", relPath: s.relPath, line: 1 });
                else if (desc.length > 1024)
                    add({ checkId: "D03", severity: "error", message: `Description is ${desc.length} characters; the spec maximum is 1024.`, relPath: s.relPath, line: fm.keyLines["description"] ?? 1 });
                const compat = fm.data["compatibility"];
                if (compat && compat.length > 500)
                    add({ checkId: "D04", severity: "warn", message: `compatibility is ${compat.length} characters; the spec maximum is 500.`, relPath: s.relPath, line: fm.keyLines["compatibility"] ?? 1 });
                const body = s.lines.length - fm.endLine;
                if (body > 500)
                    add({ checkId: "D07", severity: "info", message: `SKILL.md body is ${body} lines; the spec recommends under 500.`, relPath: s.relPath, line: fm.endLine + 1 });
            }
        }
        if (s.format === "claude-md" || s.format === "claude-local-md") {
            for (const imp of findClaudeImports(s.lines)) {
                if (imp.kind === "home")
                    continue;
                if (imp.kind === "absolute") {
                    add({ checkId: "D09", severity: "info", message: `Import \`@${imp.raw}\` is an absolute path outside the project; not inspected.`, relPath: s.relPath, line: imp.line });
                    continue;
                }
                const target = normalize(`${dirOf(s.relPath)}/${imp.raw}`);
                if (target === null) {
                    add({ checkId: "D09", severity: "warn", message: `Import \`@${imp.raw}\` resolves outside the project root.`, relPath: s.relPath, line: imp.line });
                    continue;
                }
                if (target.split("/").some((p) => isSecretLikeDirName(p) || isSecretLikeFileName(p))) {
                    add({ checkId: "D09", severity: "warn", message: `Import \`@${imp.raw}\` has a secret-like name. Importing it would send that file to the model.`, relPath: s.relPath, line: imp.line });
                    continue;
                }
                if (known && !known.has(target))
                    add({ checkId: "D09", severity: "warn", message: `Import \`@${imp.raw}\` points to \`${target}\`, which is not in the selected folder.`, relPath: s.relPath, line: imp.line });
            }
            if (s.lines.length > 200)
                add({ checkId: "D07", severity: "info", message: `File is ${s.lines.length} lines; Anthropic recommends under 200 lines per CLAUDE.md.`, relPath: s.relPath, line: 1 });
        }
        if ((s.format === "agents-md" || s.format === "agents-override-md") && s.bytes > 32 * 1024)
            add({ checkId: "D07", severity: "warn", message: `File is ${s.bytes} bytes; Codex stops adding instruction files at 32 KiB combined by default.`, relPath: s.relPath, line: 1 });
        if (s.format === "agents-md") {
            const dir = scopeDir(s);
            const override = sources.find((o) => o.format === "agents-override-md" && scopeDir(o) === dir && o.lines.some((l) => l.trim() !== ""));
            if (override)
                add({ checkId: "D08", severity: "info", message: `Codex reads \`${override.relPath}\` instead of this AGENTS.md in the same directory.`, relPath: s.relPath, line: 1 });
            const claude = sources.find((o) => (o.format === "claude-md" || o.format === "claude-local-md") && isSameOrBelow(dir, scopeDir(o)));
            if (claude)
                add({ checkId: "D08", severity: "info", message: `By default Claude Code reads CLAUDE.md instead of AGENTS.md here (\`${claude.relPath}\` applies). Codex and Cursor still read this file.`, relPath: s.relPath, line: 1 });
        }
        for (const r of instructionRisks(s.lines))
            add({ checkId: r.checkId, severity: r.severity, message: r.message, relPath: s.relPath, line: r.line });
        if (s.redacted.length)
            add({ checkId: "D12", severity: "warn", message: `${plural(s.redacted.length, "line")} contain secret-like text (masked below). Every assistant that reads this file sees the original.`, relPath: s.relPath, line: s.redacted[0] ?? 1 });
    }
    const seen = new Map();
    for (const s of sources) {
        const mine = new Set();
        s.lines.forEach((raw, i) => {
            const key = raw.trim().replace(/\s+/g, " ");
            if (key.length < 24 || key.startsWith("```") || s.redacted.includes(i + 1) || mine.has(key))
                return;
            mine.add(key);
            seen.set(key, [...(seen.get(key) ?? []), { relPath: s.relPath, line: i + 1 }]);
        });
    }
    let dups = 0;
    for (const list of seen.values()) {
        const first = list[0];
        if (list.length < 2 || !first || dups++ >= 25)
            continue;
        add({ checkId: "D10", severity: "info", message: `The same line appears in ${list.length} files (${list.map((o) => `${o.relPath}:${o.line}`).join(", ")}). Identical text, not a conflict.`, relPath: first.relPath, line: first.line });
    }
    return out;
}
function toSrc(relPath, text, bytes) {
    const format = FORMATS[basename(relPath)];
    if (!format)
        return null;
    const r = redactLines(text.replace(/^﻿/, "").split(/\r?\n/));
    return { relPath, format, lines: r.lines, redacted: r.redacted.map((x) => x.line), bytes };
}
const prompt = (sources, results) => handoffPrompt(sources, results.map((r) => `[${r.checkId}] ${r.relPath}:${r.line} ${r.message}`));
export function renderChecker(root) {
    const results = h("div", { class: "results", attrs: { "aria-live": "polite" } });
    const status = h("p", { class: "muted small", attrs: { role: "status" } });
    const show = (sources, known, skipped) => {
        if (sources.length === 0) {
            replace(results, h("div", { class: "state" }, h("p", { class: "state-title" }, "No instruction files found"), h("p", {}, "Agentsol looks for AGENTS.md, AGENTS.override.md, CLAUDE.md, CLAUDE.local.md and SKILL.md. Try the project's top folder.")));
            return;
        }
        sources.sort((a, b) => a.relPath.localeCompare(b.relPath));
        const found = check(sources, known);
        const by = (sev) => found.filter((r) => r.severity === sev).length;
        const chip = { error: "chip-bad", warn: "chip-warn", info: "chip-muted" };
        const srcOf = new Map(sources.map((s) => [s.relPath, s]));
        replace(results, h("h2", { attrs: { id: "results-title" } }, found.length ? `${plural(found.length, "finding")} in ${plural(sources.length, "file")}` : `No structural problems in ${plural(sources.length, "file")}`), h("div", { class: "score" }, h("div", { class: "stat" }, h("span", { class: "stat-n" }, String(by("error"))), h("span", { class: "stat-l" }, "errors")), h("div", { class: "stat" }, h("span", { class: "stat-n" }, String(by("warn"))), h("span", { class: "stat-l" }, "warnings")), h("div", { class: "stat" }, h("span", { class: "stat-n" }, String(by("info"))), h("span", { class: "stat-l" }, "notes")), h("div", { class: "stat" }, h("span", { class: "stat-n" }, String(sources.length)), h("span", { class: "stat-l" }, "files read"))), skipped ? h("p", { class: "muted small" }, `${plural(skipped, "file")} skipped: secret-like names, dependency folders, or larger than 1 MB.`) : null, h("ul", { class: "result-list" }, ...found.map((r) => {
            const s = srcOf.get(r.relPath);
            const text = s?.lines[r.line - 1];
            return h("li", { class: "result" }, h("div", { class: "finding-top" }, h("span", { class: `chip ${chip[r.severity]}` }, r.severity), h("span", { class: "check" }, r.checkId), h("span", { class: "loc" }, `${r.relPath}:${r.line}`)), h("p", { class: "finding-msg" }, r.message), text !== undefined && text.trim() !== "" ? h("pre", { class: "code" }, h("span", { class: "line cited" }, h("span", { class: "ln", attrs: { "aria-hidden": "true" } }, String(r.line)), h("span", { class: "lt" }, text))) : null);
        })), h("div", { class: "handoff-box" }, h("h3", {}, "Go deeper with any AI"), h("p", {}, "Facts are only half of it. Copy this prompt into ChatGPT, Gemini, Claude, Grok or any other chat to look for contradictions and vague rules, with quoted lines. It includes your files with secret-like text masked. Pasting it sends that text to the provider you choose."), codeBlock(prompt(sources, found).split("\n"), { label: "Prompt for any AI", wrap: true }), h("p", { class: "muted small" }, "Want your assistant to cite lines directly and keep proposals as diffs you approve? ", h("a", { href: route("#/setup") }, "Install the MCP server"), ".")));
        document.getElementById("results-title")?.scrollIntoView({ block: "start" });
    };
    const readFiles = async (files) => {
        replace(status, "Reading files in this tab…");
        const sources = [];
        const known = new Set();
        let skipped = 0;
        for (const f of files) {
            const rel = (f.webkitRelativePath || f.name).split("/").slice(f.webkitRelativePath ? 1 : 0).join("/");
            const parts = rel.split("/");
            if (parts.slice(0, -1).some((p) => SKIP_DIRS.has(p) || isSecretLikeDirName(p)))
                continue;
            known.add(rel);
            if (!FORMATS[basename(rel)])
                continue;
            if (isSecretLikeFileName(basename(rel)) || f.size > MAX_FILE_BYTES) {
                skipped++;
                continue;
            }
            const s = toSrc(rel, await f.text(), f.size);
            if (s)
                sources.push(s);
        }
        replace(status, "");
        show(sources, files.some((f) => f.webkitRelativePath) ? known : null, skipped);
    };
    const folderInput = h("input", { class: "file-input", attrs: { type: "file", webkitdirectory: "", multiple: "", id: "pick-folder", tabindex: "-1", "aria-hidden": "true" }, onChange: () => void readFiles([...(folderInput.files ?? [])]) });
    const filesInput = h("input", { class: "file-input", attrs: { type: "file", multiple: "", accept: ".md,text/markdown,text/plain", id: "pick-files", tabindex: "-1", "aria-hidden": "true" }, onChange: () => void readFiles([...(filesInput.files ?? [])]) });
    const nameSel = h("select", { attrs: { id: "paste-name", "aria-label": "File type" } }, ...["AGENTS.md", "CLAUDE.md", "SKILL.md", "AGENTS.override.md"].map((n) => h("option", { attrs: { value: n } }, n)));
    const area = h("textarea", { attrs: { id: "paste-text", rows: "10", spellcheck: "false", placeholder: "Paste the contents of an AGENTS.md, CLAUDE.md or SKILL.md…", "aria-label": "Instruction file text" } });
    const drop = h("div", { class: "drop" }, h("h2", {}, "Drop in a project. Get the facts in a second."), h("p", { class: "muted" }, "Choose your project folder. Agentsol reads only instruction files, skips dependency and secret-like folders, and masks key-like text before showing anything."), h("div", { class: "cta-row" }, h("button", { class: "btn btn-primary", attrs: { type: "button" }, onClick: () => folderInput.click() }, "Choose a project folder"), h("button", { class: "btn", attrs: { type: "button" }, onClick: () => filesInput.click() }, "Choose files")), h("p", { class: "muted small" }, "Your browser may ask to “upload” the folder. Nothing is uploaded: the files are read inside this tab, and this site has no server to send them to."), folderInput, filesInput);
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("is-over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("is-over"); void readFiles([...(e.dataTransfer?.files ?? [])]); });
    replace(root, h("section", { class: "page page-wide" }, h("p", { class: "eyebrow" }, h("span", { class: "pulse", attrs: { "aria-hidden": "true" } }), "Browser checker · nothing to install"), h("h1", { class: "page-title", attrs: { tabindex: "-1", id: "page-title" } }, "Check your agent instructions ", h("span", { class: "grad" }, "right here")), h("p", { class: "lede" }, "The same deterministic checks the CLI runs on skill frontmatter, imports, file precedence, size limits, secrets and duplicates, done entirely in your browser. Then hand the masked files to any AI with one prompt."), drop, h("div", { class: "paste" }, h("h2", { class: "small" }, "Or paste a single file"), area, h("div", { class: "paste-row" }, h("label", { class: "field", attrs: { for: "paste-name" } }, "Treat it as", nameSel), h("button", { class: "btn", attrs: { type: "button" }, onClick: () => {
            const s = toSrc(nameSel.value, area.value, new TextEncoder().encode(area.value).length);
            show(s ? [s] : [], null, 0);
        } }, "Check pasted text"))), status, results, h("p", { class: "muted small" }, "The browser checker is a lite port of the CLI checks: its frontmatter reader handles simple YAML only, and it cannot follow imports outside the folder you pick. For tracked versions, assistant citations and reviewed diffs, use the ", h("a", { href: route("#/setup") }, "MCP server"), ".")));
}
