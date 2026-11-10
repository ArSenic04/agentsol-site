var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
const isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function toResult(status, body) {
    if (status >= 200 && status < 300) {
        // Trust boundary: these bodies come from Agentsol's own API contract (see contract.ts).
        return { ok: true, value: body };
    }
    const err = isRecord(body) && isRecord(body["error"]) ? body["error"] : {};
    const code = typeof err["code"] === "string" ? err["code"] : "error";
    const message = typeof err["message"] === "string" ? err["message"] : `Request failed (${status})`;
    return { ok: false, status, code, message };
}
let demoBundle = null;
/** Loads the recorded demo once. Returns null if this build has no demo data. */
export function loadDemoBundle() {
    demoBundle ??= (async () => {
        try {
            const spec = "./demo-data.js";
            const mod = await import(__rewriteRelativeImportExtension(spec, true));
            if (!isRecord(mod) || !isRecord(mod["default"]))
                return null;
            const d = mod["default"];
            if (typeof d["builtAt"] !== "string" || !isRecord(d["responses"]) || !Array.isArray(d["scopeTargets"]))
                return null;
            const responses = {};
            for (const [k, v] of Object.entries(d["responses"])) {
                if (isRecord(v) && typeof v["status"] === "number")
                    responses[k] = { status: v["status"], body: v["body"] };
            }
            return { builtAt: d["builtAt"], responses, scopeTargets: d["scopeTargets"].filter((x) => typeof x === "string") };
        }
        catch {
            return null;
        }
    })();
    return demoBundle;
}
export function demoSource(bundle) {
    return {
        mode: "demo",
        async get(path) {
            const r = bundle.responses[path];
            if (!r)
                return { ok: false, status: 404, code: "not_in_demo", message: "This view is not part of the recorded demo." };
            return toResult(r.status, r.body);
        },
    };
}
export function localSource() {
    return {
        mode: "local",
        async get(path) {
            let res;
            try {
                res = await fetch(path, { method: "GET", credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
            }
            catch {
                return { ok: false, status: 0, code: "unreachable", message: "The local Agentsol server is not reachable. Is it still running?" };
            }
            const type = res.headers.get("content-type") ?? "";
            if (!type.startsWith("application/json"))
                return { ok: false, status: res.status, code: "not_json", message: `Unexpected response (${res.status}).` };
            return toResult(res.status, await res.json());
        },
    };
}
/** True only when this page is served by the local bridge (not by a static host). */
export async function detectLocalBridge() {
    const r = await localSource().get("/api/health");
    return r.ok && r.value.product === "agentsol" && r.value.mode === "local";
}
