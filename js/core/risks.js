// Pattern lists for risky content: instruction lines that steer an assistant toward unsafe
// actions, and code lines that open common vulnerabilities. Shared by the CLI checks, session
// review and the in-browser checker, so it has to stay free of Node built-ins and dependencies.
export const INJECTION = /\b(ignore|disregard|forget)\s+(all\s+|any\s+)?(the\s+|your\s+)?(previous|prior|above|earlier|system)\s+(instructions|prompts|rules|directions)|\byou are now (a|an|in)\b|\bnew (system )?instructions\s*:|^\s*<(system|im_start|im_end)>|<\/(system|im_start|im_end)>|<\|im_start\|>|\bdo not (tell|inform|alert|show) the user\b|\bwithout (telling|asking|informing|alerting) the user\b|\b(hide|conceal) (this|it|these)\s+from\s+the user\b/i;
// Zero-width, bidirectional-control and Unicode tag characters: invisible to a reader, read by the model.
// The zero-width joiner is left out because emoji sequences use it.
const HIDDEN = /[\u200b\u200c\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]|[\u{e0000}-\u{e007f}]/gu;
const NEGATED = /\b(never|don'?t|do not|avoid|must not|mustn'?t|should not|shouldn'?t|forbid(den)?|prohibit(ed)?|not allowed|refuse|instead of|rather than)\b/i;
const RISKY_RULES = [
    { re: /\b(curl|wget|iwr)\b[^|;\n]*\|\s*(sudo\s+)?(ba|z)?sh\b|\b(curl|wget)\b[^|;\n]*\|\s*(sudo\s+)?(python3?|node|perl|ruby)\b/i, what: "pipe a downloaded script straight into a shell" },
    { re: /--no-verify\b|\bHUSKY=0\b/, what: "skip git hooks (--no-verify)" },
    { re: /--dangerously-skip-permissions|--dangerously-bypass-approvals-and-sandbox|--yolo\b|\bbypassPermissions\b|\bdanger-full-access\b/, what: "turn off permission prompts or the sandbox" },
    { re: /\bgit\s+push\s+(\S+\s+)*(-f|--force)(?![\w-])/, what: "force-push" },
    { re: /\b(skip|disable|delete|remove|comment out|mark as skipped)\s+(the\s+|any\s+|all\s+)?(failing\s+|broken\s+|flaky\s+)?tests?\b(?!\s+(data|fixtures?|files? (from|in)))/i, what: "skip or delete failing tests" },
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
const CREDENTIAL_PATHS = /["'`]\.(ssh|aws|gnupg|kube|docker)["'`]|(~|\$HOME|\$\{HOME\}|homedir\(\)[^\n]*)\/?\.ssh\b|\bid_(rsa|ed25519|ecdsa)\b|\.aws\/credentials|(~|\$HOME)\/\.(npmrc|netrc|pypirc|git-credentials)\b|\.docker\/config\.json|\.kube\/config|Library\/Keychains|\.config\/gcloud|\bwallet\.dat\b|(Chrome|Chromium|Brave|Edge|Firefox)[^\n]*(Login Data|Cookies|Local State|logins\.json)/;
const SCRIPT_RISKS = [
    { re: CREDENTIAL_PATHS, what: "reads credential files (SSH keys, cloud, npm or git tokens, browser passwords)", severity: "high" },
    { re: /\bcurl\b[^\n]*\s(-d|--data(-\w+)?|-F|--form|-T|--upload-file)\b|\bwget\b[^\n]*--post-(data|file)|\brequests\.(post|put)\s*\(|\bfetch\s*\([^)]*method\s*:\s*["'](POST|PUT)|\b(nc|ncat|netcat)\s+[\w.-]+\s+\d+|\/dev\/tcp\/|\burlopen\s*\([^)]*data\s*=|\bhttp\.request\s*\([^)]*method\s*:\s*["']POST|\bsocket\.(socket|create_connection)\s*\(|\bnet\.connect\s*\(/, what: "sends data to a remote server", severity: "medium" },
    { re: /\bresolve(4|6|Txt|Any)?\s*\(\s*`[^`]*\$\{|\bgethostbyname\s*\(\s*f["']/, what: "hides data inside DNS lookups, a common way to sneak secrets out", severity: "high" },
    { re: /\bbase64\s+(-d|-D|--decode)\b[^\n]*\|\s*(sudo\s+)?(ba|z)?sh\b|\beval\s*\(\s*(atob|Buffer\.from|base64|b64decode|codecs\.decode)|\bexec\s*\(\s*(base64\.)?b64decode|\bString\.fromCharCode\s*\([^)]{40,}/, what: "decodes hidden code and runs it", severity: "high" },
    { re: /\b(curl|wget|iwr)\b[^|;\n]*\|\s*(sudo\s+)?(ba|z)?sh\b|\b(curl|wget)\b[^|;\n]*\|\s*(sudo\s+)?(python3?|node|perl|ruby)\b(?!\s+-[a-z]*[ecp]\b)/i, what: "downloads a script and runs it unseen", severity: "high" },
    { re: /(>>|\btee\s+-a\b)\s*["']?(~|\$HOME)\/\.(bashrc|zshrc|zprofile|bash_profile|profile)\b|\bcrontab\s+(-\s|[^-l\s])|Library\/LaunchAgents\/|(>|\bcp\b[^\n]*|\bmv\b[^\n]*|\bln\b[^\n]*)\s*["']?\S*\.git\/hooks\//, what: "installs itself to run again later (shell startup, cron, launch agent or git hook)", severity: "high" },
    { re: /(>>?|\btee\b|writeFile\w*\s*\(|\bopen\s*\([^)]*["']w)[^\n]*(\.claude\/settings(\.local)?\.json|\.claude\.json\b|\.cursor\/mcp\.json|\.codex\/config\.toml|claude_desktop_config\.json)/, what: "rewrites AI assistant settings or permissions", severity: "high" },
    { re: /--dangerously-skip-permissions|--dangerously-bypass-approvals-and-sandbox|\bbypassPermissions\b/, what: "turns off the assistant's permission prompts", severity: "high" },
    { re: /\brm\s+-[a-zA-Z]*[rR][a-zA-Z]*\s+(\/|~|\$HOME)(\s|$|\*|\/\*)|\bmkfs\b|\bdd\b[^\n]*of=\/dev\/(disk|sd|nvme)/, what: "deletes the disk or home folder", severity: "high" },
    { re: /^\s*(printenv|env)\s*(\||>)|\bJSON\.stringify\s*\(\s*process\.env\s*\)|\bjson\.dumps\s*\(\s*(dict\s*\()?\s*os\.environ/, what: "collects every environment variable (where API keys usually live)", severity: "medium" },
    { re: /^\s*sudo\b/, what: "asks for administrator rights (sudo)", severity: "low", scriptsOnly: true },
];
// Lines that describe, test for or block a risky pattern (security hooks, docs, detection rules) rather than doing it.
const DESCRIBING = /(==|!=|=~)\s*["*]|\bgrep\s+-[a-zA-Z]*[qEeiw]|\bcase\s|re\.(search|match|compile|findall)\(|\.(test|match|includes)\(|RegExp\(|\\[sbdw][+*]?|\bpatterns?\b|\b(check(s|ing)? for|verify|detect(s|ed|ing)?|block(s|ed|ing)?|flag(s|ged)?|matches|dangerous|forbidden|e\.g\.|such as|for example|not recommended|analy[sz]e)\b|❌|"prompt"\s*:/i;
const TOOL_RISKS = [
    { re: /<\/?(important|system|instructions?|secret|hidden)\b[^>]*>/i, what: "hides instructions for the assistant inside an XML-style tag", severity: "high" },
    { re: /\bbefore (using|calling|running) (this|any|the) (tool|function)\b|\b(first|always) (read|open|cat|send|pass|include)\b[^.\n]{0,60}\b(file|contents?|key|token|config)\b/i, what: "tells the assistant to read or send something before it uses the tool", severity: "high" },
    { re: CREDENTIAL_PATHS, what: "mentions credential files (SSH keys, tokens, .env)", severity: "high" },
    { re: /\bmcp\.json\b|\.claude\.json\b|\.claude\/settings|\.codex\/config|claude_desktop_config|\.cursor\//, what: "mentions your AI app settings, where other servers' keys are stored", severity: "high" },
    { re: /\b(instead of|rather than|do not use|don'?t use|never use|replace)\s+(the\s+)?[`"']?[\w.-]+[`"']?\s+(tool|server|function)\b|\bwhen (the user|you) (asks?|calls?|uses?)\b[^.\n]{0,40}\b(tool|server)\b/i, what: "tries to change how the assistant uses other tools (tool shadowing)", severity: "high" },
    { re: /\b(do not|don'?t|never) (mention|tell|reveal|show|inform)\b|\b(silently|secretly|quietly|without (telling|asking))\b/i, what: "asks the assistant to keep something from you", severity: "high" },
];
const SCRIPT_FILE = /\.(sh|bash|zsh|py|js|mjs|cjs|ts|rb|pl|ps1|bat|cmd)$|(^|\/)(Makefile|Dockerfile)$/i;
const TEXT_FILE = /\.(md|mdx|txt|ya?ml|json|toml)$/i;
/** The line without quoted examples, so a skill that quotes an injection phrase to warn about it is not flagged. */
const unquote = (l) => l.replace(/"[^"\n]*"|“[^”\n]*”|'[^'\n]{8,}'|`[^`\n]*`/g, '""').replace(/\byou are now (a|an|in)\b/gi, "");
function toolTexts(def, at) {
    const out = [{ at, text: [def.title, def.description].filter((x) => typeof x === "string").join("\n") }];
    const walk = (node, where) => {
        if (!node || typeof node !== "object")
            return;
        for (const [k, v] of Object.entries(node)) {
            if ((k === "description" || k === "title" || k === "default") && typeof v === "string")
                out.push({ at: `${where}.${k}`, text: v });
            else
                walk(v, k === "properties" ? where : `${where}.${k}`);
        }
    };
    walk(def.inputSchema, `${at}.input`);
    return out;
}
function parseTools(text) {
    try {
        const j = JSON.parse(text);
        const o = j;
        const list = Array.isArray(j) ? j : Array.isArray(o.tools) ? o.tools : Array.isArray(o.result?.tools) ? o.result.tools : null;
        return list && list.length > 0 && list.every((t) => t && typeof t === "object" && typeof t.name === "string") ? list : null;
    }
    catch {
        return null;
    }
}
/** Safety report for a skill folder, an MCP tool list (tools/list JSON) or loose files, before anyone installs them. */
export function inspectFiles(files, opts = {}) {
    const findings = [];
    const add = (severity, p, line, what) => {
        if (!findings.some((f) => f.path === p && f.line === line && f.what === what))
            findings.push({ severity, path: p, line, what });
    };
    let kind = files.some((f) => /(^|\/)SKILL\.md$/i.test(f.path)) ? "skill" : "files";
    for (const f of files) {
        const tools = /\.json$/i.test(f.path) ? parseTools(f.text) : null;
        if (tools) {
            kind = "mcp";
            for (const t of tools) {
                const name = String(t.name);
                for (const { at, text } of toolTexts(t, name)) {
                    const where = `${f.path} › ${at}`;
                    if (text.match(HIDDEN))
                        add("high", where, 0, "contains invisible characters that only the assistant sees");
                    if (INJECTION.test(text))
                        add("high", where, 0, "reads like a prompt injection");
                    for (const r of TOOL_RISKS)
                        if (r.re.test(text))
                            add(r.severity, where, 0, r.what);
                    if (text.length > 1500)
                        add("low", where, 0, `is unusually long (${text.length} characters); long descriptions are where hidden instructions go`);
                }
            }
            continue;
        }
        const lines = f.text.split(/\r?\n/);
        const script = SCRIPT_FILE.test(f.path);
        if (opts.secretIn)
            lines.forEach((l, i) => { const label = opts.secretIn?.(l); if (label)
                add("medium", f.path, i + 1, `contains what looks like ${label} in plain text; if it is real, the publisher leaked it and anything using it runs on their account`); });
        if (script || TEXT_FILE.test(f.path)) {
            for (const r of instructionRisks(lines))
                if (!(r.checkId !== "D14" && (DESCRIBING.test(lines[r.line - 1] ?? "") || (r.checkId === "D15" && !INJECTION.test(unquote(lines[r.line - 1] ?? ""))))))
                    add(r.severity === "error" ? "high" : "medium", f.path, r.line, r.checkId === "D14" ? "contains invisible characters that only the assistant sees" : r.checkId === "D15" ? "reads like a prompt injection" : r.message.replace(/^(This line|An example command here) tells assistants to /, "tells the assistant to ").replace(/\. If that is not intended.*$/, ""));
        }
        let fence = false;
        lines.forEach((l, i) => {
            if (/^\s*(```|~~~)/.test(l)) {
                fence = !fence;
                return;
            }
            if (/^\s*(#(?!!)|\/\/|\*|<!--)/.test(l) && (script || fence))
                return;
            if (DESCRIBING.test(l) || NEGATED.test(l))
                return;
            if (script || fence || /^\s*\$ /.test(l) || /`[^`]*\b(curl|wget|base64|rm|crontab|tee|dd)\b[^`]*`/.test(l)) {
                for (const r of SCRIPT_RISKS)
                    if ((script || !r.scriptsOnly) && r.re.test(l))
                        add(r.severity, f.path, i + 1, r.what);
            }
        });
        const sendLine = findings.find((x) => x.path === f.path && x.what === "sends data to a remote server")?.line;
        if (sendLine && /\b(open|readFile\w*|cat)\s*\(?\s*["'][^"'\n]*\.env["']|JSON\.stringify\s*\(\s*process\.env\s*\)|\bos\.environ\s*\)/.test(f.text))
            add("high", f.path, sendLine, "sends your secrets (.env file or environment variables) to a remote server");
        if (script)
            for (const what of codeRisks(lines))
                add("medium", f.path, lines.findIndex((l) => CODE_RISKS.some((r) => r.what === what && r.re.test(l))) + 1, what);
    }
    const rank = { high: 0, medium: 1, low: 2 };
    const top = new Set(findings.filter((f) => f.severity === "high" && f.line > 0).map((f) => `${f.path}:${f.line}`));
    for (let i = findings.length - 1; i >= 0; i -= 1) {
        const f = findings[i];
        if (f && f.severity !== "high" && top.has(`${f.path}:${f.line}`))
            findings.splice(i, 1);
    }
    findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.path.localeCompare(b.path) || a.line - b.line);
    const verdict = findings.some((f) => f.severity === "high") ? "danger" : findings.some((f) => f.severity === "medium") ? "caution" : "clean";
    return { verdict, kind, scanned: files.length, findings };
}
