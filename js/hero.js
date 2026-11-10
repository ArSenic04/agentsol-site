import { h, svg } from "./dom.js";
/**
 * The hero diagram: instruction files flow into Agentsol, which keeps line-level evidence;
 * your assistant reads and cites over MCP; every change ends with you. Solid lines are what
 * automated tests exercise today; the dashed assistant link is the intended client set,
 * not yet validated. All geometry is a code constant. Motion is a slow dash drift and one
 * orbiting dot, both removed under prefers-reduced-motion.
 */
const W = 450;
const CORE = { x: 225, y: 204, r: 42 };
const CHAR = 8.2; // approximate width of one 14px monospace character in viewBox units
const SOURCES = [
    { label: "AGENTS.md", x: 58, y: 68 },
    { label: "CLAUDE.md", x: 162, y: 34 },
    { label: "api/AGENTS.md", x: 288, y: 34 },
    { label: "SKILL.md", x: 400, y: 68 },
];
function pill(label, x, y) {
    const w = Math.round(label.length * CHAR + 24);
    return svg("g", { class: "g-source" }, svg("rect", { x: x - w / 2, y: y - 15, width: w, height: 30, rx: 15 }), svg("text", { x, y: y + 1, "text-anchor": "middle", "dominant-baseline": "middle", class: "g-mono" }, label));
}
function box(cls, x, y, title, sub) {
    const w = 160;
    return svg("g", { class: cls }, svg("rect", { x: x - w / 2, y: y - 26, width: w, height: 52, rx: 14 }), svg("text", { x, y: y - 6, "text-anchor": "middle", "dominant-baseline": "middle", class: "g-title" }, title), svg("text", { x, y: y + 13, "text-anchor": "middle", "dominant-baseline": "middle", class: "g-sub" }, sub));
}
export function heroDiagram() {
    const edges = SOURCES.map((s) => {
        const sy = s.y + 15;
        const ty = CORE.y - CORE.r - 4;
        const mid = (sy + ty) / 2;
        const d = `M${s.x} ${sy} C ${s.x} ${mid + 20}, ${CORE.x} ${mid - 10}, ${CORE.x} ${ty}`;
        // A solid base line (tested path) with a slow dotted drift on top showing the direction of reading.
        return svg("g", {}, svg("path", { class: "g-edge g-read", d }), svg("path", { class: "g-edge g-flow", d }));
    });
    const assistant = { x: 100, y: 346 };
    const person = { x: 350, y: 346 };
    const art = svg("svg", { viewBox: `0 0 ${W} 384`, class: "g", "aria-hidden": "true", focusable: "false", preserveAspectRatio: "xMidYMid meet" }, svg("g", { class: "g-edges" }, ...edges), svg("path", { class: "g-edge g-assist", d: `M${CORE.x - 30} ${CORE.y + 30} C ${CORE.x - 50} ${CORE.y + 60}, ${assistant.x + 50} ${assistant.y - 80}, ${assistant.x + 50} ${assistant.y - 28}` }), svg("path", { class: "g-edge g-person", d: `M${CORE.x + 30} ${CORE.y + 30} C ${CORE.x + 50} ${CORE.y + 60}, ${person.x - 50} ${person.y - 80}, ${person.x - 50} ${person.y - 28}` }), svg("text", { x: assistant.x + 30, y: assistant.y - 44, "text-anchor": "end", class: "g-edge-label" }, "reads · cites lines"), svg("text", { x: person.x - 30, y: person.y - 44, "text-anchor": "start", class: "g-edge-label" }, "diff waits for you"), ...SOURCES.map((s) => pill(s.label, s.x, s.y)), svg("circle", { class: "g-orbit", cx: CORE.x, cy: CORE.y, r: CORE.r + 20 }), svg("g", { class: "g-spin" }, svg("circle", { class: "g-orbit-dot", cx: CORE.x + CORE.r + 20, cy: CORE.y, r: 4 })), svg("circle", { class: "g-core", cx: CORE.x, cy: CORE.y, r: CORE.r }), svg("text", { x: CORE.x, y: CORE.y - 5, "text-anchor": "middle", "dominant-baseline": "middle", class: "g-core-title" }, "Agentsol"), svg("text", { x: CORE.x, y: CORE.y + 14, "text-anchor": "middle", "dominant-baseline": "middle", class: "g-core-sub" }, "evidence"), box("g-assistant", assistant.x, assistant.y, "Your assistant", "over MCP"), box("g-human", person.x, person.y, "You approve", "in your terminal"));
    return h("figure", { class: "hero-art" }, h("div", { class: "hero-art-frame" }, art), h("figcaption", { class: "legend" }, h("span", { class: "sr-only" }, "Diagram: instruction files such as AGENTS.md, CLAUDE.md and SKILL.md feed Agentsol, which keeps line-level evidence. Your assistant reads and cites those lines over MCP. Every change waits for you to approve in your terminal. "), h("span", { class: "legend-item" }, h("span", { class: "swatch swatch-solid", attrs: { "aria-hidden": "true" } }), "Exercised by automated tests today"), h("span", { class: "legend-item" }, h("span", { class: "swatch swatch-dashed", attrs: { "aria-hidden": "true" } }), "Assistant apps it is built for (Claude Code, Codex, Cursor), not yet validated")));
}
