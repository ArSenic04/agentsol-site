export const HANDOFF_MAX_CHARS = 60_000;
export function handoffPrompt(sources, facts, maxChars = HANDOFF_MAX_CHARS) {
    const parts = [
        "You are reviewing the instruction files that AI coding agents read in my project (AGENTS.md, CLAUDE.md, SKILL.md). Secret-like text has already been masked.",
        "Agentsol's deterministic checks found these facts:",
        ...(facts.length ? facts.map((f) => `- ${f}`) : ["- none"]),
        "",
        "Please find POSSIBLE issues the checks cannot see: instructions that contradict each other, stale references, rules too vague to follow, content in the wrong folder, and skill descriptions that do not match the body.",
        "For every issue, quote the exact lines with file and line numbers, say how confident you are, and suggest a replacement as a unified diff. Treat layered rules (a subfolder refining the root) as normal unless the quoted text really conflicts. Do not invent lines that are not shown.",
        "",
    ];
    let size = parts.join("\n").length;
    let cut = 0;
    for (const s of sources) {
        const block = [`### ${s.relPath}`, "```", ...s.lines.map((l, i) => `${i + 1}: ${l}`), "```", ""].join("\n");
        if (size + block.length > maxChars) {
            cut++;
            continue;
        }
        parts.push(block);
        size += block.length;
    }
    if (cut)
        parts.push(`(${cut} ${cut === 1 ? "file" : "files"} left out to keep this prompt short.)`);
    return parts.join("\n");
}
