import { docHref, h, replace, route } from "./dom.js";
import { codeBlock } from "./workspace.js";
function stepBlock(n, title, ...body) {
    return h("li", { class: "setup-step" }, h("h2", {}, h("span", { class: "step-n", attrs: { "aria-hidden": "true" } }, String(n)), title), ...body);
}
const NPM_PAGE = "https://www.npmjs.com/package/agentsol";
const PKG = ["-y", "-p", "agentsol@alpha", "agentsol-mcp"];
const JSON_CONFIG = [
    "{",
    "  \"mcpServers\": {",
    "    \"agentsol\": {",
    "      \"command\": \"npx\",",
    `      "args": [${PKG.map((a) => `"${a}"`).join(", ")}]`,
    "    }",
    "  }",
    "}",
];
/** One entry per assistant. Every one runs the same npm package on the person's own machine. */
export const CLIENTS = [
    { id: "claude-code", name: "Claude Code", where: "Run once in any terminal:", lines: [`claude mcp add agentsol -s user -- npx ${PKG.join(" ")}`] },
    { id: "codex", name: "Codex", where: "Run once (the Codex CLI, IDE extension and app share this config):", lines: [`codex mcp add agentsol -- npx ${PKG.join(" ")}`] },
    { id: "gemini", name: "Gemini CLI", where: "Run once in any terminal:", lines: [`gemini mcp add -s user agentsol npx ${PKG.join(" ")}`], note: "Gemini CLI loads MCP servers only in folders you trust. If agentsol shows as disabled, trust the folder when Gemini asks." },
    { id: "vscode", name: "VS Code", where: "Run once (GitHub Copilot agent mode reads it):", lines: [`code --add-mcp '{"name":"agentsol","command":"npx","args":[${PKG.map((a) => `"${a}"`).join(",")}]}'`] },
    { id: "cursor", name: "Cursor", where: "Add to ~/.cursor/mcp.json:", wrap: false, lines: JSON_CONFIG },
    { id: "claude-desktop", name: "Claude Desktop", where: "Settings → Developer → Edit Config, then add:", wrap: false, lines: JSON_CONFIG, note: "Desktop apps may not see your shell PATH. If it fails to start, replace \"npx\" with the output of: which npx" },
    { id: "windsurf", name: "Windsurf", where: "Add to ~/.codeium/windsurf/mcp_config.json:", wrap: false, lines: JSON_CONFIG },
];
/** Accessible tabs: one panel per client, arrow keys move between tabs. */
export function installPicker() {
    const tabs = [];
    const panels = [];
    const select = (i, focus) => {
        tabs.forEach((t, j) => {
            t.setAttribute("aria-selected", String(i === j));
            t.setAttribute("tabindex", i === j ? "0" : "-1");
            const p = panels[j];
            if (p)
                p.hidden = i !== j;
        });
        if (focus)
            tabs[i]?.focus();
    };
    CLIENTS.forEach((c, i) => {
        tabs.push(h("button", {
            class: "tab",
            attrs: { type: "button", role: "tab", id: `tab-${c.id}`, "aria-controls": `panel-${c.id}`, "aria-selected": String(i === 0), tabindex: i === 0 ? "0" : "-1" },
            onClick: () => select(i, false),
            onKeydown: (e) => {
                const n = CLIENTS.length;
                const next = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
                if (next >= 0) {
                    e.preventDefault();
                    select(next, true);
                }
            },
        }, c.name));
        panels.push(h("div", { class: "picker-body", hidden: i !== 0, attrs: { role: "tabpanel", id: `panel-${c.id}`, "aria-labelledby": `tab-${c.id}`, tabindex: "0" } }, h("p", {}, c.where), codeBlock(c.lines, { label: `${c.name} setup`, wrap: c.wrap ?? true }), c.note ? h("p", { class: "muted small" }, c.note) : null));
    });
    return h("div", { class: "picker" }, h("div", { class: "tabs", attrs: { role: "tablist", "aria-label": "Choose your assistant" } }, ...tabs), ...panels);
}
export const SKILL_MD = [
    "---",
    "name: agentsol-audit",
    "description: Reviews coding-agent work with the Agentsol MCP server - the AGENTS.md, CLAUDE.md and SKILL.md files agents follow, what agents did in recent sessions, and how the AI apps on this machine are set up. Use when the user asks to check instructions, review what an agent did, or check their AI setup.",
    "---",
    "",
    "# Audit agent instructions with Agentsol",
    "",
    "1. Call projects_list. If the project is missing, ask the user to run `npx -y agentsol@alpha check` in it. You cannot register projects yourself.",
    "2. Call sources_scan, then findings_list. Report structural findings as facts, grouped by file.",
    "3. Call source_read on the files involved. Look for instructions that conflict, are stale or too vague.",
    "4. Submit each observation with findings_submit as a POSSIBLE issue, quoting the exact lines and the current versionId.",
    "5. For fixes, call change_propose. Never edit instruction files directly.",
    "6. End by telling the user to run `npx agentsol review <proposalId>` in their own terminal. Only they can approve or apply.",
    "",
    "## Review what agents did",
    "",
    "1. Call sessions_list, then session_review on the risky ones. Findings A01-A13 are facts; report them as facts.",
    "2. Grade a session with session_grade on the rubric (safety, instructions, verification, efficiency, scope), citing step numbers. Grades are your judgment and are labelled that way.",
    "",
    "## Check the AI setup",
    "",
    "Call setup_audit and explain the findings, most serious first, with the exact setting to change. Never change settings yourself.",
    "",
];
export function renderSetup(root) {
    const npmHref = docHref(NPM_PAGE);
    replace(root, h("section", { class: "page" }, h("p", { class: "eyebrow" }, h("span", { class: "pulse", attrs: { "aria-hidden": "true" } }), "Install · about two minutes · $0"), h("h1", { class: "page-title", attrs: { tabindex: "-1", id: "page-title" } }, "Give your assistant ", h("span", { class: "grad" }, "a reviewer for agent work")), h("p", { class: "lede" }, "Agentsol is one npm package (", npmHref ? h("a", { href: npmHref, external: true }, "npmjs.com/package/agentsol") : "npmjs.com/package/agentsol", ", early alpha, MIT). It runs on your machine, inside the AI subscription you already pay for. There is no Agentsol server, account or API key."), h("p", { class: "note" }, h("strong", {}, "Requirements: "), "Node.js 24 or newer. Clean npm installs are tested on macOS with Node 24.0.0, 24.22.2 and 26.8.2; Windows and Linux are untested. Commands below are for macOS and Linux shells."), h("ol", { class: "setup" }, stepBlock(1, "Run it in your project", h("p", {}, "From the project's top folder. It registers the folder in ", h("code", {}, "~/.agentsol"), ", reads only instruction files, and prints a report with every finding and its line. Nothing in your project changes, and nothing is installed globally. Home, system and broad folders are refused."), codeBlock(["cd your-project", "npx -y agentsol@alpha check"])), stepBlock(2, "Connect your assistant", h("p", {}, "Pick your app. Every option runs the same package through npx, so updates arrive with the next start. ", h("code", {}, "npx -y agentsol@alpha connect"), " prints the same lines in your terminal."), installPicker(), h("p", { class: "muted small" }, "Any other MCP client works the same way: command ", h("code", {}, "npx"), ", arguments ", h("code", {}, PKG.join(" ")), ". To keep data somewhere other than ", h("code", {}, "~/.agentsol"), ", set ", h("code", {}, "AGENTSOL_WORKSPACE"), " for both the CLI and the server.")), stepBlock(3, "Ask for an audit", h("p", {}, "In your assistant, say ", h("em", {}, "“Use agentsol to audit the agent instructions in this project.”"), " Clients that support MCP prompts also list ", h("code", {}, "/audit"), ", ", h("code", {}, "/fix"), ", ", h("code", {}, "/explain"), ", ", h("code", {}, "/review"), " (grade recent sessions) and ", h("code", {}, "/setup"), " (explain the setup audit). To make it a habit, save this skill as ", h("code", {}, ".claude/skills/agentsol-audit/SKILL.md"), " or wherever your client reads Agent Skills."), codeBlock(SKILL_MD, { label: "SKILL.md for agents", wrap: true })), stepBlock(4, "Review what your agents did", h("p", {}, "Agentsol reads the Claude Code and Codex transcripts already on your machine and flags risky steps. ", h("code", {}, "doctor"), " also checks the settings of every AI app you use. Both only read. In your assistant, ask ", h("em", {}, "“Use agentsol to review what my agents did this week”"), " or use ", h("code", {}, "/review"), "; it sees only sessions from projects you registered."), codeBlock(["npx -y agentsol@alpha sessions", "npx -y agentsol@alpha session <id> --timeline", "npx -y agentsol@alpha doctor"])), stepBlock(5, "No MCP? Use any chat AI", h("p", {}, "ChatGPT, Gemini, Claude.ai, Grok and other web chats cannot start local servers. This prints one prompt with your instruction files (secret-like text masked) and the facts Agentsol found. Paste it into the chat you already use. Pasting sends that text to its provider. No terminal at all? Use the ", h("a", { href: route("#/check") }, "browser checker"), "."), codeBlock(["npx -y agentsol@alpha prompt | pbcopy"]), h("p", { class: "muted small" }, "On Linux pipe to xclip -selection clipboard, on Windows to clip.")), stepBlock(6, "Review and decide, as a person", h("p", {}, "In a normal terminal, never through the assistant. Approve shows the diff again and asks for a one-time code; apply keeps a backup. Agent-driven terminals are refused. This human approve and apply flow has not yet been run end to end by a person through the published CLI."), codeBlock(["npx agentsol review <proposalId>", "npx agentsol approve <proposalId>", "npx agentsol apply <proposalId>"])), stepBlock(7, "Optional: the synthetic demo and this website, from source", h("p", {}, "The demo and the local website are not in the npm package. With a copy of the source repository:"), codeBlock(["npm ci", "npm run demo", "npm run web:build", "npm run web:local -- --workspace \"$TMPDIR/agentsol-demo/workspace\""]), h("p", {}, "Then open the address it prints and go to ", h("a", { href: route("#/workspace") }, "Workspace"), ". That server is read-only, bound to 127.0.0.1, and cannot scan, edit, approve or apply."))), h("p", { class: "muted small" }, "Protocol tests use the official MCP TypeScript SDK client over a real stdio process against the installed package. On a synthetic project, Claude Code ran the full audit through the packed 0.1.0-alpha.2 (scan, findings, a quoted possible issue, a stored proposal) and Gemini CLI connected and listed the tools. Other apps use the same standard config and have not been run yet. Session review and the setup audit (0.2.0-alpha.0) are covered by automated tests on synthetic transcripts and settings in a fake home folder.")));
}
