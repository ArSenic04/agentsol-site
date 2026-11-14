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
/** `agentsol sessions` and `agentsol session <id>` on a synthetic transcript, transcribed from a real run. */
const SESSIONS = [
    [["agent", "◉ "], ["bold", "agentsol sessions"], ["muted", "  since 11/06/2026 · Claude Code and Codex"]],
    [],
    [["bad", "  ✗ risky   "], ["bold", "claude-531fdff16bae  "], ["muted", "Claude 2h ago  "], ["", "my-app"], ["muted", "    41 steps · 6 edited · 182k tok"]],
    [["warn", "  ▲ review  "], ["bold", "codex-9e04c2a1b7d3   "], ["muted", "Codex  1d ago  "], ["", "my-app"], ["muted", "    17 steps · 2 edited · 64k tok"]],
    [["ok", "  ✓ clean   "], ["bold", "claude-27b8e0f4c91a  "], ["muted", "Claude 3d ago  "], ["", "docs-site"], ["muted", " 12 steps · 1 edited · 31k tok"]],
    [],
    [["agent", "◉ "], ["bold", "session claude-531fdff16bae"], ["bad", "  ✗ risky"], ["muted", "  Claude Code"]],
    [],
    [["sun", "◆ "], ["bold", "Findings"], ["", "  "], ["bad", "1 error"], ["muted", " · "], ["warn", "2 warnings"], ["muted", " · "], ["info", "1 note"]],
    [],
    [["bad", "  ✗ error  "], ["bold", "A01"], ["", "  Destructive command"], ["muted", "  · step 38"]],
    [["", "    Recursively deleted your home folder."]],
    [["agent", "    rm -rf ~"]],
    [],
    [["warn", "  ▲ warn   "], ["bold", "A05"], ["", "  Safety check bypassed"], ["muted", "  · step 31"]],
    [["", "    Committed with --no-verify, skipping the repository's commit hooks."]],
    [["agent", "    git commit --no-verify -m wip"]],
    [],
    [["warn", "  ▲ warn   "], ["bold", "A06"], ["", "  Tests weakened or removed"], ["muted", "  · step 24"]],
    [["", "    Added 1 skipped or focused test, so part of the test suite no longer runs."]],
    [],
    [["info", "  ● note   "], ["bold", "A12"], ["", "  Edits never verified"], ["muted", "  · step 40"]],
    [["", "    Code changed after the last test, build or lint run."]],
    [],
    [["muted", "  Read from the transcript on this machine. Nothing was changed, and nothing was sent anywhere."]],
];
export function sessionShowcase() {
    return h("figure", { class: "cli-art" }, h("div", { class: "term" }, h("div", { class: "term-bar" }, h("span", { class: "term-dot" }), h("span", { class: "term-dot" }), h("span", { class: "term-dot" }), h("span", { class: "term-title" }, "~/code/my-app — npx -y agentsol@alpha sessions")), h("pre", { class: "cli", attrs: { tabindex: "0", role: "region", "aria-label": "Example agentsol sessions and session report in a terminal" } }, ...SESSIONS.map(runs))), h("figcaption", { class: "legend" }, h("span", { class: "legend-item" }, "Synthetic transcripts. Check ids, wording and layout are the CLI's own; the session list is illustrative.")));
}
const BOX = 62;
const ltop = (title) => [["", "  ╭─ "], ["bold", title], ["", ` ${"─".repeat(BOX - title.length - 3)}╮`]];
const lrow = (...parts) => [["", "  │ "], ...parts, ["", `${" ".repeat(Math.max(0, BOX - 1 - parts.reduce((n, p) => n + p[1].length, 0)))}│`]];
const lend = [["", `  ╰${"─".repeat(BOX)}╯`]];
/** `agentsol learn` on three synthetic Claude Code transcripts, transcribed from a real run. */
const LEARN = [
    [["sun", "◉ "], ["bold", "agentsol learn  "], ["muted", "my-app · since 10/15/2026 · 3 sessions read"]],
    [],
    ltop("What repeated mistakes cost"),
    lrow(["muted", "Time lost     "], ["bold", "24m"], ["muted", " of 29m active agent time (82%)"]),
    lrow(["muted", "Tokens lost   "], ["bold", "17k"], ["muted", " of 26k · 15 wasted steps"]),
    lrow(["muted", "Lessons       "], ["", "3 · "], ["ok", "3 new rules"]),
    lend,
    [],
    [["muted", "    1  "], ["bad", "fragile "], ["muted", "  3× in 3 sessions · 20m lost"]],
    [["", "         Agents broke and re-fixed `src/billing/invoice.ts` in 3 sessions."]],
    [["ok", "         rule  → "], ["bold", "After changing `src/billing/invoice.ts`, run"]],
    [["bold", "                 `pnpm test billing` before moving on."]],
    [["muted", "         seen in claude-015036e44317 step 3 · claude-3f070fb82352 step 3 · …"]],
    [],
    [["muted", "    2  "], ["warn", "command "], ["muted", "  3× in 3 sessions · 4m lost"]],
    [["", "         Agents use `npm` here, which fails; `pnpm` works (for example"]],
    [["", "         `pnpm test`)."]],
    [["ok", "         rule  → "], ["bold", "Use `pnpm`, not `npm` (for example `pnpm test`)."]],
    [["muted", "         seen in claude-015036e44317 step 1 · claude-3f070fb82352 step 1 · …"]],
    [],
    [["muted", "    3  "], ["sun", "you said"], ["muted", "  2× in 2 sessions"]],
    [["", "         You told agents this in 2 sessions: “never edit the generated files"]],
    [["", "         in gen/, run pnpm codegen”"]],
    [["ok", "         rule  → "], ["bold", "Never edit the generated files in gen/, run pnpm codegen."]],
    [["muted", "         seen in claude-3f070fb82352 step 2 · claude-a9e7b10d15f3 step 2"]],
    [],
    ltop("Next"),
    lrow(["agent", "1 "], ["", "Add 3 rules to AGENTS.md:  "], ["bold", "agentsol learn --propose"]),
    lrow(["muted", "  you read the diff, then approve and apply it yourself"]),
    lrow(["agent", "2 "], ["", "Or ask your AI:  "], ["sun", "/learn"], ["muted", "  · run it weekly"]),
    lend,
    [],
    [["muted", "  Read from transcripts on this machine. Nothing was sent anywhere, and no project file was changed."]],
];
/** `agentsol start` on a synthetic project with three past Claude Code sessions, transcribed from a real run. */
const START = [
    [["sun", "◉ "], ["bold", "agentsol start  "], ["muted", "~/code/my-app"]],
    [],
    [["ok", "  ✓ "], ["bold", "Project      "], ["", "registered my-app"], ["muted", " · 1 instruction file · "], ["ok", "no problems"]],
    [["agent", "  ? "], ["", "Connect agentsol to Claude Code? It runs "], ["bold", "claude mcp add"], ["muted", " (adds it to your user config)"], ["", " [Y/n] "], ["bold", "y"]],
    [["ok", "  ✓ "], ["bold", "Your AI      "], ["", "Claude Code"], ["muted", " · "], ["ok", "connected now"]],
    [["warn", "  ▲ "], ["bold", "Agent work   "], ["", "3 sessions"], ["muted", " · "], ["warn", "24m lost to repeat mistakes"], ["muted", " · "], ["ok", "none risky"]],
    [["ok", "  ✓ "], ["bold", "AI settings  "], ["ok", "nothing risky"]],
    [],
    ltop("Next"),
    lrow(["agent", "1 "], ["", "Stop 3 repeated mistakes:  "], ["bold", "agentsol learn --propose"]),
    lrow(["agent", "  "], ["muted", "adds the rules to your instruction file after you approve"]),
    lrow(["agent", "2 "], ["", "Restart your AI app, then ask:  "], ["sun", "“Use agentsol to audit"]),
    lrow(["agent", "  "], ["sun", "this project.”"], ["muted", "  or use "], ["bold", "/audit"], ["muted", " · "], ["bold", "/learn"], ["muted", " · "], ["bold", "/review"]),
    lend,
    [],
    [["muted", "  Nothing in your project was changed. Agentsol only reads; you approve every edit."]],
];
export function startShowcase() {
    return h("figure", { class: "cli-art" }, h("div", { class: "term" }, h("div", { class: "term-bar" }, h("span", { class: "term-dot" }), h("span", { class: "term-dot" }), h("span", { class: "term-dot" }), h("span", { class: "term-title" }, "~/code/my-app — npx -y agentsol@alpha start")), h("pre", { class: "cli", attrs: { tabindex: "0", role: "region", "aria-label": "Example agentsol start run in a terminal" } }, ...START.map(runs))), h("figcaption", { class: "legend" }, h("span", { class: "legend-item" }, "Transcribed from a real run on a synthetic project. It only connects apps you have installed, and only after you answer yes.")));
}
export function learnShowcase() {
    return h("figure", { class: "cli-art" }, h("div", { class: "term" }, h("div", { class: "term-bar" }, h("span", { class: "term-dot" }), h("span", { class: "term-dot" }), h("span", { class: "term-dot" }), h("span", { class: "term-title" }, "~/code/my-app — npx -y agentsol@alpha learn")), h("pre", { class: "cli", attrs: { tabindex: "0", role: "region", "aria-label": "Example agentsol learn report in a terminal" } }, ...LEARN.map(runs))), h("figcaption", { class: "legend" }, h("span", { class: "legend-item" }, "Transcribed from a real run on three synthetic transcripts. Your numbers come from your own sessions.")));
}
