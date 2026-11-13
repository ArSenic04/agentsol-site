// Pattern lists for risky content: instruction lines that steer an assistant toward unsafe
// actions, and code lines that open common vulnerabilities. Shared by the CLI checks, session
// review and the in-browser checker, so it has to stay free of Node built-ins and dependencies.
export const INJECTION = /\b(ignore|disregard|forget)\s+(all\s+|any\s+)?(the\s+|your\s+)?(previous|prior|above|earlier|system)\s+(instructions|prompts|rules|directions)|\byou are now (a|an|in)\b|\bnew (system )?instructions\s*:|<\/?(system|im_start|im_end)>|<\|im_start\|>|\bdo not (tell|inform|alert|show) the user\b|\bwithout (telling|asking|informing|alerting) the user\b|\b(hide|conceal) (this|it|these)\s+from\s+the user\b/i;
// Zero-width, bidirectional-control and Unicode tag characters: invisible to a reader, read by the model.
// The zero-width joiner is left out because emoji sequences use it.
const HIDDEN = /[\u200b\u200c\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]|[\u{e0000}-\u{e007f}]/gu;
const NEGATED = /\b(never|don'?t|do not|avoid|must not|mustn'?t|should not|shouldn'?t|forbid(den)?|prohibit(ed)?|not allowed|refuse|instead of|rather than)\b/i;
const RISKY_RULES = [
    { re: /\b(curl|wget|iwr)\b[^|;\n]*\|\s*(sudo\s+)?(ba|z)?sh\b|\b(curl|wget)\b[^|;\n]*\|\s*(sudo\s+)?(python3?|node|perl|ruby)\b/i, what: "pipe a downloaded script straight into a shell" },
    { re: /--no-verify\b|\bHUSKY=0\b/, what: "skip git hooks (--no-verify)" },
    { re: /--dangerously-skip-permissions|--dangerously-bypass-approvals-and-sandbox|--yolo\b|\bbypassPermissions\b|\bdanger-full-access\b/, what: "turn off permission prompts or the sandbox" },
    { re: /\bgit\s+push\s+(\S+\s+)*(-f|--force)(\s|$)/, what: "force-push" },
    { re: /\b(skip|disable|delete|remove|comment out|mark as skipped)\s+(the\s+|any\s+|all\s+)?(failing\s+|broken\s+|flaky\s+)?tests?\b/i, what: "skip or delete failing tests" },
    { re: /\bcurl\b[^\n]*\s(-k|--insecure)\b|\bverify\s*=\s*False\b|rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED|\b(disable|turn off)\s+(ssl|tls|certificate)\s+(verification|checks?)/i, what: "turn off TLS certificate checks" },
    { re: /\bchmod\s+(-R\s+)?(0?777|a\+rwx)\b/, what: "make files writable by everyone (chmod 777)" },
    { re: /\brm\s+-[a-zA-Z]*[rR][a-zA-Z]*\s+(\/|~|\$HOME)(\s|$|\*)/, what: "recursively delete the disk root or home folder" },
    { re: /\b(commit|push|upload|paste|post|send|log|print|echo)\b[^.\n]{0,40}\b(\.env\b|secrets?\b|api[ _-]?keys?\b|credentials\b|access tokens?\b|passwords?\b)/i, what: "commit, send or print secrets" },
    { re: /-auto-approve\b|\bkubectl\s+delete\b[^\n]*--all\b|\bDROP\s+(TABLE|DATABASE)\b/i, what: "run destructive infrastructure or database commands" },
];
/** Finds hidden characters, prompt-injection phrasing and rules that tell an assistant to do something unsafe. */
export function instructionRisks(lines) {
    const out = [];
    let fenced = false;
    lines.forEach((text, i) => {
        const line = i + 1;
        const hidden = text.match(HIDDEN) ?? [];
        if (hidden.length > 0) {
            const codes = [...new Set(hidden.map((c) => `U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`))].slice(0, 4).join(", ");
            out.push({ checkId: "D14", severity: "error", line, message: `Line has ${hidden.length} invisible character${hidden.length === 1 ? "" : "s"} (${codes}). People reviewing the file cannot see them, but assistants read them; this is how hidden instructions are smuggled into rules files. Remove them.` });
        }
        if (/^\s*(```|~~~)/.test(text))
            fenced = !fenced;
        if (INJECTION.test(text)) {
            out.push({ checkId: "D15", severity: "error", line, message: "Line reads like a prompt injection (telling the assistant to ignore its instructions or hide things from you). Check who added it." });
        }
        const negated = NEGATED.test(text);
        const asks = negated ? [] : RISKY_RULES.filter((r) => r.re.test(text)).map((r) => r.what);
        if (asks.length > 0)
            out.push({ checkId: "D13", severity: "warn", line, message: `${fenced ? "An example command here" : "This line"} tells assistants to ${asks.join(" and to ")}. If that is not intended, reword it as a rule against it.` });
    });
    return out;
}
const CODE_RISKS = [
    { re: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0|\bverify\s*=\s*False\b|InsecureSkipVerify\s*:\s*true|CURLOPT_SSL_VERIFY(PEER|HOST)\s*,\s*(0|false)|\bssl\._create_unverified_context\s*\(|check_hostname\s*=\s*False/, what: "turns off TLS certificate checks" },
    { re: /\bsubprocess\.\w+\([^)]*shell\s*=\s*True|\bos\.(system|popen)\s*\(\s*f?["'][^"']*(\{|%s|["']\s*\+)|\bexec(Sync)?\s*\(\s*`[^`]*\$\{|\bexec(Sync)?\s*\(\s*["'][^"']*["']\s*\+/, what: "runs a shell command built from variables (command injection)" },
    { re: /(^|[^\w.])eval\s*\(\s*[A-Za-z_$]|\bnew\s+Function\s*\(\s*[A-Za-z_$]/, what: "runs code from a string (eval)" },
    { re: /\bpickle\.loads?\s*\(|\byaml\.load\s*\((?![^)]*Loader\s*=\s*(yaml\.)?SafeLoader)|\bmarshal\.loads\s*\(|\bunserialize\s*\(\s*\$|new\s+ObjectInputStream\s*\(/, what: "deserializes untrusted data (pickle, yaml.load and similar)" },
    { re: /\b(execute|query|raw|exec)\s*\(\s*(f["'][^"']*\b(SELECT|INSERT|UPDATE|DELETE)\b[^"']*\{|["'][^"']*\b(SELECT|INSERT|UPDATE|DELETE)\b[^"']*["']\s*(\+|%\s*[(\w]|\.format\()|`[^`]*\b(SELECT|INSERT|UPDATE|DELETE)\b[^`]*\$\{)/i, what: "builds a SQL query by pasting in values (SQL injection)" },
    { re: /\.inner[H]TML\s*=\s*[^"'`\s;]|\.inner[H]TML\s*=\s*`[^`]*\$\{|dangerouslySetInnerHTML\s*=\s*\{|\bdocument\.write\s*\(|\bmark_safe\s*\(|\bv-html\s*=|\|\s*safe\s*\}\}/, what: "puts unescaped HTML into a page (cross-site scripting)" },
    { re: /Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*["']|allow_origins\s*=\s*\[\s*["']\*["']|\borigin\s*:\s*["']\*["'][^\n]*credentials\s*:\s*true|credentials\s*:\s*true[^\n]*\borigin\s*:\s*["']\*["']/, what: "lets any website call this server (CORS *)" },
    { re: /\bchmod(Sync)?\s*\([^)]*0o?777|\bos\.chmod\s*\([^)]*0o?777/, what: "makes a file writable by everyone (777)" },
    { re: /\bcreateHash\s*\(\s*["'](md5|sha1)["']\s*\)[^\n]*password|\bhashlib\.(md5|sha1)\s*\([^\n]*password/i, what: "hashes passwords with MD5 or SHA-1" },
    { re: /\bDEBUG\s*=\s*True\b|\.run\([^)]*debug\s*=\s*True/, what: "turns on debug mode, which can expose internals" },
];
/** Distinct vulnerability kinds introduced by these added code lines. Callers subtract what was removed. */
export function codeRisks(lines) {
    const out = new Set();
    for (const l of lines) {
        if (/^\s*(\/\/|#|\*|\/\*)/.test(l))
            continue;
        for (const r of CODE_RISKS)
            if (r.re.test(l))
                out.add(r.what);
    }
    return [...out];
}
