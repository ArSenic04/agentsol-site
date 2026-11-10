import { append, codePre, docHref, h, plural, replace, route } from "./dom.js";
import { CHECK_NAMES, FRESH, NOT_READ, PLATFORM_LABEL } from "./labels.js";
const TABS = [
    { id: "findings", label: "Findings" },
    { id: "files", label: "Files" },
    { id: "changes", label: "Proposed changes" },
    { id: "scope", label: "Load order" },
];
const enc = encodeURIComponent;
function errorBox(title, message, retry) {
    return h("div", { class: "state state-error", attrs: { role: "alert" } }, h("p", { class: "state-title" }, title), h("p", {}, message), retry ? h("button", { class: "btn", attrs: { type: "button" }, onClick: retry }, "Try again") : null);
}
function loadingBox(label) {
    return h("div", { class: "state state-loading", attrs: { role: "status", "aria-live": "polite" } }, h("span", { class: "spinner", attrs: { "aria-hidden": "true" } }), h("span", {}, label));
}
function chip(text, tone) {
    return h("span", { class: `chip chip-${tone}` }, text);
}
function severityChip(sev) {
    return chip(sev, sev === "error" ? "bad" : sev === "warn" ? "warn" : "muted");
}
async function all(reqs) {
    const entries = await Promise.all(Object.entries(reqs).map(async ([k, p]) => [k, await p]));
    const out = {};
    for (const [k, r] of entries) {
        if (!r.ok)
            return { ok: false, message: r.message };
        out[k] = r.value;
    }
    // Each key maps to the awaited value of its own request.
    return { ok: true, value: out };
}
export function renderWorkspace(root, source, ctx) {
    const isDemo = source.mode === "demo";
    const sourceCache = new Map();
    const readSource = (id) => {
        let p = sourceCache.get(id);
        if (!p) {
            p = source.get(`/api/sources/${enc(id)}`);
            sourceCache.set(id, p);
        }
        return p;
    };
    const banner = isDemo
        ? h("div", { class: "mode-banner mode-demo", attrs: { role: "note" } }, h("strong", {}, "Synthetic demo. "), "Everything here is real Agentsol output for a made-up project, recorded when this site was built", ctx.builtAt ? ` (${new Date(ctx.builtAt).toLocaleString()})` : "", ". The “possible” finding and the proposed change were prewritten by the demo script to exercise the protocol; no AI wrote them.")
        : h("div", { class: "mode-banner mode-local", attrs: { role: "note" } }, h("strong", {}, "Your local workspace, read-only. "), "Served from 127.0.0.1 by the process you started. Nothing here can scan, edit, approve or apply. Use the CLI for that.");
    const body = h("div", { class: "ws-body" });
    replace(root, h("div", { class: "ws" }, h("header", { class: "ws-head" }, h("p", { class: "eyebrow" }, isDemo ? "Interactive demo" : "Local workspace"), h("h1", { class: "ws-title", attrs: { tabindex: "-1", id: "page-title" } }, isDemo ? "Paper Lantern, a synthetic project" : "Your Agentsol workspace"), banner), body));
    const loadStatus = async () => {
        replace(body, loadingBox("Loading workspace status…"));
        const st = await source.get("/api/status");
        if (!st.ok) {
            replace(body, errorBox("Could not load the workspace", st.message, () => void loadStatus()));
            return;
        }
        if (st.value.projects.length === 0) {
            replace(body, h("div", { class: "state state-empty" }, h("p", { class: "state-title" }, "No projects registered in this workspace yet"), h("p", {}, "Register a folder from your own terminal, then scan it:"), codeBlock(["npm run cli -- --workspace <workspace> project add /path/to/project", "npm run cli -- --workspace <workspace> scan <projectId>"]), h("p", { class: "muted" }, "The website never registers or scans folders itself.")));
            return;
        }
        const projects = st.value.projects;
        const picker = projects.length > 1
            ? h("label", { class: "field" }, h("span", {}, "Project"), h("select", {
                attrs: { id: "project-select" },
                onChange: (e) => {
                    const t = e.target;
                    if (t instanceof HTMLSelectElement)
                        void loadProject(t.value);
                },
            }, ...projects.map((p) => h("option", { attrs: { value: p.projectId } }, p.name))))
            : null;
        const projectArea = h("div", { class: "project-area" });
        replace(body, picker, projectArea, h("ul", { class: "caveats" }, ...st.value.caveats.map((c) => h("li", {}, c))));
        let token = 0;
        const loadProject = async (projectId) => {
            const mine = ++token;
            replace(projectArea, loadingBox("Loading project…"));
            const status = projects.find((p) => p.projectId === projectId);
            if (!status)
                return;
            const id = enc(projectId);
            const r = await all({
                sources: source.get(`/api/projects/${id}/sources`),
                findings: source.get(`/api/projects/${id}/findings`),
                proposals: source.get(`/api/projects/${id}/proposals`),
                freshness: source.get(`/api/projects/${id}/freshness`),
            });
            if (mine !== token)
                return;
            if (!r.ok) {
                replace(projectArea, errorBox("Could not load this project", r.message, () => void loadProject(projectId)));
                return;
            }
            renderProject(projectArea, { status, ...r.value });
        };
        const first = projects[0];
        if (first)
            void loadProject(first.projectId);
    };
    const renderProject = (area, d) => {
        const panels = new Map();
        const tabButtons = [];
        const select = (t, focus) => {
            for (const b of tabButtons) {
                const on = b.dataset["tab"] === t;
                b.setAttribute("aria-selected", String(on));
                b.tabIndex = on ? 0 : -1;
                if (on && focus)
                    b.focus();
            }
            for (const [k, p] of panels)
                p.hidden = k !== t;
        };
        const tablist = h("div", { class: "tabs", attrs: { role: "tablist", "aria-label": "Workspace views" } });
        TABS.forEach((t, i) => {
            const count = t.id === "findings" ? d.findings.findings.length : t.id === "files" ? d.sources.sources.length : t.id === "changes" ? d.proposals.proposals.length : null;
            const b = h("button", {
                class: "tab",
                attrs: { role: "tab", type: "button", id: `tab-${t.id}`, "aria-controls": `panel-${t.id}`, "data-tab": t.id, "aria-selected": "false", tabindex: "-1" },
                onClick: () => select(t.id, false),
                onKeydown: (e) => {
                    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                    if (e.key === "Home" || e.key === "End" || dir !== 0) {
                        e.preventDefault();
                        const next = e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : (i + dir + TABS.length) % TABS.length;
                        const nt = TABS[next];
                        if (nt)
                            select(nt.id, true);
                    }
                },
            }, t.label, count !== null ? h("span", { class: "tab-count" }, String(count)) : null);
            tabButtons.push(b);
            tablist.appendChild(b);
        });
        for (const t of TABS) {
            const p = h("section", { class: "panel", attrs: { role: "tabpanel", id: `panel-${t.id}`, "aria-labelledby": `tab-${t.id}`, tabindex: "0" } });
            panels.set(t.id, p);
        }
        renderFindings(panels.get("findings"), d);
        renderFiles(panels.get("files"), d);
        renderChanges(panels.get("changes"), d);
        renderScope(panels.get("scope"), d);
        replace(area, overview(d), tablist, ...panels.values());
        select("findings", false);
    };
    // Overview -----------------------------------------------------------------
    const overview = (d) => {
        const s = d.status;
        const scanText = s.scan.state === "never_scanned" ? "Never scanned" : s.scan.state === "refused" ? `Scan refused: ${s.scan.reason}` : `Scanned ${new Date(s.scan.at).toLocaleString()}`;
        const coverage = s.scan.state === "scanned"
            ? s.scan.partial
                ? h("details", { class: "partial" }, h("summary", {}, chip("Partial coverage", "warn"), " What the last scan could not inspect"), h("ul", {}, ...s.scan.partialReasons.map((r) => h("li", {}, r))))
                : chip("Full coverage of supported files", "ok")
            : null;
        const f = s.freshness;
        const fresh = f.state === "not_checked" ? chip("Freshness not checked", "muted")
            : f.state === "unknown" ? chip(`Disk state unknown (${f.reason.replaceAll("_", " ")})`, "bad")
                : f.state === "changes_detected" ? chip("Files changed since the scan", "warn")
                    : f.state === "incomplete" ? chip("Freshness incomplete", "muted")
                        : chip("No known changes since the scan", "ok");
        const stat = (n, label) => h("div", { class: "stat" }, h("span", { class: "stat-n" }, String(n)), h("span", { class: "stat-l" }, label));
        return h("section", { class: "overview", attrs: { "aria-label": "Project overview" } }, h("div", { class: "overview-line" }, h("h2", { class: "project-name" }, s.name), h("span", { class: "muted" }, scanText)), h("div", { class: "stats" }, stat(s.sources.present, "files read"), stat(s.notRead.total, "not read"), stat(s.findings.structural, "facts"), stat(s.findings.semantic, "possible"), stat(s.proposals.pending, "pending changes")), h("div", { class: "overview-flags" }, coverage, fresh, s.sources.withRedactedLines > 0 ? chip(`${plural(s.sources.withRedactedLines, "file")} with redacted lines`, "warn") : null, s.findings.staleHidden > 0 ? chip(`${s.findings.staleHidden} stale finding(s) hidden`, "muted") : null), isDemo ? h("p", { class: "muted small" }, "Freshness in the demo was recorded at build time; there are no files on disk to compare against now.") : null);
    };
    // Findings -----------------------------------------------------------------
    const renderFindings = (panel, d) => {
        if (!panel)
            return;
        const rank = { error: 0, warn: 1, info: 2 };
        const findings = [...d.findings.findings].sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3));
        if (findings.length === 0) {
            append(panel, [h("div", { class: "state state-empty" }, h("p", { class: "state-title" }, "No current findings"), h("p", {}, "That means none of Agentsol's checks matched. It does not mean the instructions are correct or complete."))]);
            return;
        }
        const detail = h("div", { class: "detail", attrs: { "aria-live": "polite" } }, h("p", { class: "muted" }, "Select a finding to see its evidence."));
        const buttons = [];
        const show = (f, btn) => {
            for (const b of buttons)
                b.setAttribute("aria-pressed", String(b === btn));
            void renderFindingDetail(detail, f).then(() => revealOnNarrow(detail));
        };
        const group = (title, note, list) => list.length === 0 ? null :
            h("div", { class: "group" }, h("h3", { class: "group-title" }, title, h("span", { class: "muted" }, ` · ${note}`)), h("ul", { class: "finding-list" }, ...list.map((f) => {
                const ev = f.evidence[0];
                const btn = h("button", { class: "finding", attrs: { type: "button", "aria-pressed": "false", "data-finding": f.id } }, h("span", { class: "finding-top" }, severityChip(f.severity), h("span", { class: "check" }, f.checkId), h("span", { class: "check-name" }, CHECK_NAMES[f.checkId] ?? "")), h("span", { class: "finding-msg" }, f.kind === "semantic" ? f.title : f.message), ev ? h("span", { class: "loc" }, `${ev.relPath}:${ev.startLine}${ev.endLine !== ev.startLine ? `–${ev.endLine}` : ""}${f.evidence.length > 1 ? ` +${f.evidence.length - 1}` : ""}`) : null);
                btn.addEventListener("click", () => show(f, btn));
                buttons.push(btn);
                return h("li", {}, btn);
            })));
        append(panel, [
            h("div", { class: "split" }, h("div", { class: "split-list" }, group("Facts", "deterministic checks", findings.filter((f) => f.kind === "structural")), group("Possible", "reported by an assistant, unverified", findings.filter((f) => f.kind === "semantic")), d.findings.staleHidden > 0 ? h("p", { class: "muted small" }, `${d.findings.staleHidden} finding(s) cite older file versions and are hidden.`) : null), detail),
        ]);
    };
    const renderFindingDetail = async (detail, f) => {
        replace(detail, loadingBox("Loading evidence…"));
        const blocks = [];
        for (const ev of f.evidence) {
            const r = await readSource(ev.sourceId);
            if (!r.ok) {
                blocks.push(errorBox(`Could not load ${ev.relPath}`, r.message));
                continue;
            }
            const stale = r.value.versionId !== ev.versionId;
            blocks.push(evidenceBlock(r.value, ev.startLine, ev.endLine, stale));
        }
        const doc = f.kind === "structural" ? docHref(f.docUrl) : null;
        replace(detail, h("div", { class: "detail-head" }, severityChip(f.severity), h("span", { class: "check" }, f.checkId), f.kind === "semantic" ? chip("Possible · unverified", "possible") : chip("Fact", "fact")), h("h3", { class: "detail-title" }, f.kind === "semantic" ? f.title : CHECK_NAMES[f.checkId] ?? f.title), h("p", { class: "detail-msg" }, f.message), f.kind === "semantic"
            ? h("p", { class: "muted small" }, `Reported by ${f.reporter}, confidence ${f.confidence}. Agentsol verified that the quoted lines exist in the current file version; it did not verify the claim itself.`, isDemo ? " In this demo the finding was prewritten by the demo script." : "")
            : null, f.checkId === "D10" ? h("p", { class: "note" }, "Identical text in two files is layering, not a conflict.") : null, h("h4", { class: "evidence-title" }, f.evidence.length > 1 ? "Evidence (quoted from each file)" : "Evidence"), ...blocks, f.kind === "semantic" && f.suggestedFix ? h("p", {}, h("strong", {}, "Suggested fix (assistant-written): "), f.suggestedFix) : null, doc ? h("p", { class: "small" }, h("a", { href: doc, external: true }, "Format documentation"), h("span", { class: "muted" }, " (opens an external site)")) : null);
    };
    const evidenceBlock = (src, start, end, stale) => {
        const from = Math.max(1, start - 2);
        const to = Math.min(src.lineCount, end + 2);
        const redacted = new Set(src.redactedLines);
        return h("figure", { class: "evidence" }, h("figcaption", {}, h("span", { class: "path" }, src.relPath), ` lines ${start}${end !== start ? `–${end}` : ""}`, stale ? chip("file has changed since", "warn") : null), codePre({ class: "code", attrs: { tabindex: "0", role: "region", "aria-label": `${src.relPath} lines ${from} to ${to}` } }, ...src.lines.filter((l) => l.n >= from && l.n <= to).map((l) => h("span", { class: `line${l.n >= start && l.n <= end ? " cited" : ""}${redacted.has(l.n) ? " redacted" : ""}` }, h("span", { class: "ln", attrs: { "aria-hidden": "true" } }, String(l.n)), h("span", { class: "lt" }, l.text || " "), "\n"))));
    };
    // Files --------------------------------------------------------------------
    const renderFiles = (panel, d) => {
        if (!panel)
            return;
        const freshBy = new Map(d.freshness.sources.map((s) => [s.sourceId, s.state]));
        const viewer = h("div", { class: "detail", attrs: { "aria-live": "polite" } }, h("p", { class: "muted" }, "Select a file to read it as the assistant would (numbered, redacted)."));
        const buttons = [];
        const open = async (sourceId, btn) => {
            for (const b of buttons)
                b.setAttribute("aria-pressed", String(b === btn));
            replace(viewer, loadingBox("Loading file…"));
            revealOnNarrow(viewer);
            const r = await readSource(sourceId);
            if (!r.ok) {
                replace(viewer, errorBox("Could not read this file", r.message));
                return;
            }
            const redacted = new Set(r.value.redactedLines);
            replace(viewer, h("h3", { class: "detail-title path" }, r.value.relPath), h("p", { class: "muted small" }, `${plural(r.value.lineCount, "line")}. ${r.value.notice}`), codePre({ class: "code", attrs: { tabindex: "0", role: "region", "aria-label": `Contents of ${r.value.relPath}` } }, ...r.value.lines.map((l) => h("span", { class: `line${redacted.has(l.n) ? " redacted" : ""}` }, h("span", { class: "ln", attrs: { "aria-hidden": "true" } }, String(l.n)), h("span", { class: "lt" }, l.text || " "), "\n"))), r.value.truncated ? h("p", { class: "muted small" }, "Truncated to the first 400 lines.") : null);
        };
        const rows = d.sources.sources.map((s) => {
            const fs = freshBy.get(s.sourceId);
            const fl = fs ? FRESH[fs] : null;
            const btn = h("button", { class: "file", attrs: { type: "button", "aria-pressed": "false" } }, h("span", { class: "path" }, s.relPath), h("span", { class: "file-meta" }, s.format, ` · ${plural(s.lineCount, "line")}`, s.redactedLineCount > 0 ? ` · ${s.redactedLineCount} redacted` : ""), fl ? chip(fl.label, fl.tone) : null);
            btn.addEventListener("click", () => void open(s.sourceId, btn));
            buttons.push(btn);
            return h("li", {}, btn);
        });
        append(panel, [
            h("div", { class: "split" }, h("div", { class: "split-list" }, h("h3", { class: "group-title" }, "Read", h("span", { class: "muted" }, " · supported instruction files")), rows.length > 0 ? h("ul", { class: "file-list" }, ...rows) : h("p", { class: "muted" }, "No instruction files were found."), h("h3", { class: "group-title" }, "Not read", h("span", { class: "muted" }, " · on purpose, with the reason")), d.sources.notRead.length > 0
                ? h("ul", { class: "notread" }, ...d.sources.notRead.map((e) => h("li", {}, h("span", { class: "path" }, e.relPath), h("span", { class: "muted small" }, NOT_READ[e.reason] ?? e.reason))))
                : h("p", { class: "muted small" }, "Nothing was skipped by name."), h("p", { class: "muted small" }, "Secret-like files (for example .env) are counted but never named or opened.")), viewer),
        ]);
    };
    // Changes ------------------------------------------------------------------
    const renderChanges = (panel, d) => {
        if (!panel)
            return;
        const list = d.proposals.proposals;
        if (list.length === 0) {
            append(panel, [h("div", { class: "state state-empty" }, h("p", { class: "state-title" }, "No proposed changes"), h("p", {}, "When an assistant proposes an edit through MCP, it appears here for you to review. Nothing is ever written until you approve and apply it in your terminal."))]);
            return;
        }
        append(panel, list.map((p) => proposalCard(p)));
    };
    const proposalCard = (p) => {
        const ws = isDemo ? "<demo workspace>" : "<your workspace>";
        const cmds = [`npm run cli -- --workspace ${ws} review ${p.proposalId}`, `npm run cli -- --workspace ${ws} approve ${p.proposalId}`, `npm run cli -- --workspace ${ws} apply ${p.proposalId}`];
        return h("article", { class: "proposal", attrs: { "aria-label": `Proposal ${p.proposalId}` } }, h("div", { class: "proposal-head" }, h("h3", { class: "path" }, p.relPath), chip(p.status, p.status === "pending" ? "warn" : p.status === "applied" ? "ok" : "muted"), p.baseIsCurrent ? null : chip("file changed since; cannot be applied", "bad")), h("p", { class: "muted small" }, `Proposed by ${p.author} · ${new Date(p.createdAt).toLocaleString()} · ${p.proposalId}`), h("p", {}, h("span", { class: "label" }, "Rationale (written by the assistant, untrusted): "), p.rationale), diffView(p.diff), h("aside", { class: "handoff" }, h("h4", {}, "Your decision happens in your terminal"), h("p", {}, "This page cannot approve or apply anything. Run these yourself, in a normal terminal (approval is refused inside coding-agent terminals). The CLI shows the diff again and asks you to type a one-time code."), codeBlock(cmds), isDemo ? h("p", { class: "muted small" }, "Run ", h("code", {}, "npm run demo"), " locally to get a real demo workspace and its exact commands.") : null));
    };
    const diffView = (diff) => codePre({ class: "code diff", attrs: { tabindex: "0", role: "region", "aria-label": "Proposed diff" } }, ...diff.split("\n").map((line) => {
        const cls = line.startsWith("+++") || line.startsWith("---") ? "d-file" : line.startsWith("@@") ? "d-hunk" : line.startsWith("+") ? "d-add" : line.startsWith("-") ? "d-del" : "d-ctx";
        const sr = cls === "d-add" ? "Added: " : cls === "d-del" ? "Removed: " : "";
        return h("span", { class: `line ${cls}` }, sr ? h("span", { class: "sr-only" }, sr) : null, line || " ", "\n");
    }));
    // Scope --------------------------------------------------------------------
    const renderScope = (panel, d) => {
        if (!panel)
            return;
        const out = h("div", { class: "scope-out", attrs: { "aria-live": "polite" } });
        const targets = isDemo ? ctx.scopeTargets ?? [] : [];
        let platform = "claude-code";
        let target = targets[0] ?? "src/index.ts";
        const run = async () => {
            replace(out, loadingBox("Resolving…"));
            const r = await source.get(`/api/projects/${enc(d.status.projectId)}/scope?target=${enc(target)}&platform=${enc(platform)}`);
            if (!r.ok) {
                replace(out, errorBox("Could not resolve", r.message));
                return;
            }
            const v = r.value;
            replace(out, h("p", { class: "note" }, h("strong", {}, "Modeled, not observed. "), `This is Agentsol's model of ${PLATFORM_LABEL[v.platform] ?? v.platform}'s documented defaults (coverage: ${v.coverage}). It has not been checked against a running client.`), h("ol", { class: "chain" }, ...v.chain.map((c) => h("li", {}, h("span", { class: "path" }, c.relPath), chip(c.when === "launch" ? "at launch" : "on demand", "muted"), c.sourceId ? chip("read by Agentsol", "ok") : chip("present, not read", "warn"), h("span", { class: "muted small chain-reason" }, c.reason)))), v.chain.length === 0 ? h("p", { class: "muted" }, "No project instruction files would load for this target, by this model.") : null, h("h4", {}, "Assumptions"), h("ul", { class: "small" }, ...v.assumptions.map((a) => h("li", {}, a))), h("h4", {}, "Not inspected"), h("ul", { class: "small" }, ...v.notInspected.map((a) => h("li", {}, a))));
        };
        const platformSel = h("select", { attrs: { id: "scope-platform" }, onChange: (e) => { if (e.target instanceof HTMLSelectElement) {
                platform = e.target.value;
                void run();
            } } }, ...Object.entries(PLATFORM_LABEL).map(([k, label]) => h("option", { attrs: { value: k } }, label)));
        const targetInput = isDemo
            ? h("select", { attrs: { id: "scope-target" }, onChange: (e) => { if (e.target instanceof HTMLSelectElement) {
                    target = e.target.value;
                    void run();
                } } }, ...targets.map((t) => h("option", { attrs: { value: t } }, t)))
            : h("input", { attrs: { id: "scope-target", value: target, spellcheck: "false", autocomplete: "off", placeholder: "services/api/handler.ts" } });
        const form = h("form", {
            class: "scope-form",
            onSubmit: (e) => {
                e.preventDefault();
                if (targetInput instanceof HTMLInputElement)
                    target = targetInput.value.trim();
                void run();
            },
        }, h("label", { class: "field", attrs: { for: "scope-platform" } }, h("span", {}, "Client")), platformSel, h("label", { class: "field", attrs: { for: "scope-target" } }, h("span", {}, "File being worked on")), targetInput, isDemo ? null : h("button", { class: "btn", attrs: { type: "submit" } }, "Resolve"));
        append(panel, [h("p", { class: "lede-sm" }, "Which project instruction files would a client load when working on a given file?"), form, out]);
        void run();
    };
    void loadStatus();
}
/** On single-column layouts the detail pane sits below a long list; bring it into view. */
function revealOnNarrow(el) {
    if (!window.matchMedia("(max-width: 60rem)").matches)
        return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
}
/**
 * Copyable commands or config. Shell commands soft-wrap (one line per command, continuation
 * lines indented); wrapping is visual only, so selected or copied text keeps the exact bytes.
 * Config keeps its layout and scrolls sideways instead (wrap: false).
 */
export function codeBlock(lines, opts = {}) {
    const text = lines.join("\n");
    const wrap = opts.wrap ?? true;
    const status = h("span", { class: "copy-status", attrs: { role: "status", "aria-live": "polite" } });
    const btn = h("button", {
        class: "btn btn-small copy",
        attrs: { type: "button" },
        onClick: () => {
            const done = (ok) => {
                replace(status, ok ? "Copied" : "Select the text to copy");
                window.setTimeout(() => replace(status), 2500);
            };
            if (navigator.clipboard?.writeText)
                navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
            else
                done(false);
        },
    }, "Copy");
    return h("div", { class: "cmd" }, codePre({ class: `code cmd-code${wrap ? " cmd-wrap" : ""}`, attrs: { tabindex: "0", role: "region", "aria-label": opts.label ?? (lines.length === 1 ? "Command" : "Commands") } }, ...lines.map((l) => h("span", { class: "line" }, l || " ", "\n"))), h("div", { class: "cmd-actions" }, btn, status));
}
export { route };
