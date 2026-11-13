const IMPORT = /(^|\s)@([^\s`]+)/g;
/**
 * Finds `@path` imports in a CLAUDE.md the way Claude Code documents them: outside
 * fenced code blocks and inline code spans. Paths with escaped spaces are not parsed.
 */
export function findClaudeImports(lines) {
    const out = [];
    let fence = null;
    lines.forEach((line, index) => {
        const fenceMatch = /^\s*(```|~~~)/.exec(line);
        if (fenceMatch) {
            const marker = fenceMatch[1] ?? "";
            fence = fence === null ? marker : fence === marker ? null : fence;
            return;
        }
        if (fence !== null)
            return;
        const withoutCode = line.replace(/`[^`]*`/g, " ");
        for (const m of withoutCode.matchAll(IMPORT)) {
            const raw = (m[2] ?? "").replace(/[),.;:!?]+$/, "");
            if (raw === "" || raw.includes("@") || raw.endsWith("\\"))
                continue;
            const kind = raw.startsWith("~/") ? "home" : raw.startsWith("/") ? "absolute" : "relative";
            out.push({ line: index + 1, raw, kind });
        }
    });
    return out;
}
