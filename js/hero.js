import { h } from "./dom.js";
const ICON = { user: "›", call: "⏺", ok: "✓", warn: "!", poss: "?", wait: "⏸" };
const SESSION = [
    ["user", "Audit the agent instructions in this repo."],
    ["call", "sources_scan", "paper-lantern-demo"],
    ["ok", "5 instruction files read · CLAUDE.local.md and .env.local skipped"],
    ["call", "findings_list"],
    ["warn", "CLAUDE.md:4  @docs/style-guide.md does not exist"],
    ["warn", "AGENTS.md:5  secret-like text, masked before I saw it"],
    ["warn", "skills/changelog/SKILL.md  description is missing"],
    ["call", "source_read", "AGENTS.md, services/api/AGENTS.md"],
    ["poss", "Possible: root says npm, services/api says pnpm (both lines quoted)"],
    ["call", "change_propose", "AGENTS.md:3"],
    ["ok", "Diff stored. No file was changed."],
    ["wait", "Your turn: npx agentsol review <proposalId>"],
];
function line([kind, text, arg]) {
    return h("li", { class: `term-line t-${kind}` }, h("span", { class: "t-ico" }, ICON[kind]), h("span", { class: kind === "wait" ? "t-cursor" : "" }, text, arg ? h("span", { class: "t-arg" }, ` (${arg})`) : null));
}
export function heroDiagram() {
    return h("figure", { class: "hero-art" }, h("div", { class: "term", attrs: { "aria-hidden": "true" } }, h("div", { class: "term-bar" }, h("span", { class: "term-dot" }), h("span", { class: "term-dot" }), h("span", { class: "term-dot" }), h("span", { class: "term-title" }, "your assistant + agentsol mcp")), h("ol", { class: "term-body" }, ...SESSION.map(line))), h("figcaption", { class: "legend" }, h("span", { class: "sr-only" }, "Illustration of an assistant session: your assistant scans the project through Agentsol, lists findings such as a missing import and a masked secret, quotes two conflicting lines as a possible issue, and stores a proposed diff. The change waits for you to approve in your own terminal. "), h("span", { class: "legend-item" }, h("span", { class: "swatch", attrs: { "aria-hidden": "true" } }), "Illustrative session: real tool names and synthetic-demo results, exercised by automated tests today"), h("span", { class: "legend-item" }, h("span", { class: "swatch swatch-dashed", attrs: { "aria-hidden": "true" } }), "Assistant apps connect through their standard MCP config and are not yet validated")));
}
const BANNER = [
    " █████╗  ██████╗ ███████╗███╗   ██╗████████╗███████╗ ██████╗ ██╗     ",
    "██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝██╔════╝██╔═══██╗██║     ",
    "███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ███████╗██║   ██║██║     ",
    "██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ╚════██║██║   ██║██║     ",
    "██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ███████║╚██████╔╝███████╗",
    "╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝ ╚═════╝ ╚══════╝",
];
const NEXT_W = 62;
const boxRow = (runs) => {
    const len = runs.reduce((n, [, t]) => n + [...t].length, 0);
    return [["agent", "│ "], ...runs, ["", " ".repeat(Math.max(0, NEXT_W - len))], ["agent", " │"]];
};
/** `agentsol check` on a synthetic project, transcribed from a truecolor terminal. */
const REPORT = [
    [["agent", "◉ "], ["bold", "agentsol check"], ["muted", "  ~/code/my-app"]],
    [["agent", "✓ "], ["", "Registered "], ["bold", "my-app"], ["muted", " in ~/.agentsol"]],
    [["agent", "✓ "], ["", "Read 4 instruction files"], ["muted", " in 13 ms · nothing in your project was changed"]],
    [],
    [["sun", "◆ "], ["bold", "Findings"], ["", "  "], ["bad", "2 errors"], ["muted", " · "], ["warn", "2 warnings"], ["muted", " · "], ["info", "3 notes"]],
    [],
    [["bad", "  ✗ error  "], ["bold", "D02"], ["agent", "  skills/changelog/SKILL.md:2"], ["muted", "  fact"]],
    [["", "    Skill name `Changelog` must use lowercase letters, digits and single hyphens."]],
    [["muted", "       2 │ "], ["", "name: Changelog"]],
    [],
    [["warn", "  ▲ warn   "], ["bold", "D12"], ["agent", "  AGENTS.md:5"], ["muted", "  fact"]],
    [["", "    1 line contains secret-like text. Every assistant that reads this file sees it."]],
    [["muted", "       5 │ "], ["", "- token = [REDACTED:assignment]"]],
    [],
    [["warn", "  ▲ warn   "], ["bold", "D09"], ["agent", "  CLAUDE.md:3"], ["muted", "  fact"]],
    [["", "    Import `@docs/style-guide.md` points to `docs/style-guide.md`, which does not exist."]],
    [["muted", "       3 │ "], ["", "@docs/style-guide.md"]],
    [],
    [["agent", "╭─ "], ["bold", "Next"], ["agent", ` ${"─".repeat(NEXT_W - 5)}╮`]],
    boxRow([["agent", "1 "], ["", "Let your AI go deeper:  "], ["bold", "npx -y agentsol@alpha connect"]]),
    boxRow([["", "    then ask it: "], ["sun", "“Use agentsol to audit this project.”"]]),
    boxRow([["agent", "2 "], ["", "Any chat AI, no setup:  "], ["bold", "npx -y agentsol@alpha prompt"]]),
    [["agent", `╰${"─".repeat(NEXT_W + 2)}╯`]],
];
const runs = (row) => h("span", { class: "cli-line" }, ...row.map(([c, t]) => (c ? h("span", { class: `c-${c}` }, t) : t)), "\n");
const bannerRow = (row) => h("span", { class: "cli-line" }, ...row.split(/(█+)/).filter(Boolean).map((part) => (part.startsWith("█") ? part : h("span", { class: "cb-sh" }, part))), "\n");
/** The terminal UI, as text. Scrolls sideways on narrow screens instead of wrapping. */
export function cliShowcase() {
    return h("figure", { class: "cli-art" }, h("div", { class: "term" }, h("div", { class: "term-bar" }, h("span", { class: "term-dot" }), h("span", { class: "term-dot" }), h("span", { class: "term-dot" }), h("span", { class: "term-title" }, "~/code/my-app — npx -y agentsol@alpha check")), h("pre", { class: "cli", attrs: { tabindex: "0", role: "region", "aria-label": "Example agentsol check report in a terminal" } }, h("span", { class: "cli-banner", attrs: { "aria-hidden": "true" } }, ...BANNER.map(bannerRow)), ...REPORT.map(runs))), h("figcaption", { class: "legend" }, h("span", { class: "legend-item" }, "Transcribed from a real run on a synthetic project. Colors follow your terminal; NO_COLOR and pipes get plain text.")));
}
