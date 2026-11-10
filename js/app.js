import { detectLocalBridge, demoSource, loadDemoBundle, localSource } from "./data.js";
import { h, replace } from "./dom.js";
import { renderLanding } from "./landing.js";
import { SERVED_BY } from "./mode.js";
import { renderSetup } from "./setup.js";
import { codeBlock, renderWorkspace } from "./workspace.js";
const TITLES = { "": "Agentsol: read your agent instructions together", demo: "Demo · Agentsol", workspace: "Workspace · Agentsol", setup: "Local setup · Agentsol" };
function currentRoute() {
    const m = /^#\/([a-z-]*)$/.exec(window.location.hash);
    const r = m?.[1] ?? "";
    return r in TITLES ? r : "";
}
async function render() {
    const main = document.getElementById("main");
    if (!main)
        return;
    const r = currentRoute();
    document.title = TITLES[r] ?? TITLES[""] ?? "Agentsol";
    for (const a of document.querySelectorAll("[data-nav]")) {
        if (a.dataset["nav"] === r)
            a.setAttribute("aria-current", "page");
        else
            a.removeAttribute("aria-current");
    }
    main.setAttribute("aria-busy", "true");
    if (r === "setup")
        renderSetup(main);
    else if (r === "demo") {
        const bundle = await loadDemoBundle();
        if (bundle)
            renderWorkspace(main, demoSource(bundle), { builtAt: bundle.builtAt, scopeTargets: bundle.scopeTargets });
        else
            replace(main, h("section", { class: "page" }, h("h1", { class: "page-title", attrs: { tabindex: "-1", id: "page-title" } }, "Demo unavailable"), h("div", { class: "state state-error", attrs: { role: "alert" } }, h("p", {}, "This build has no recorded demo data. Rebuild with npm run web:build."))));
    }
    else if (r === "workspace") {
        replace(main, h("section", { class: "page" }, h("div", { class: "state state-loading", attrs: { role: "status" } }, h("span", { class: "spinner", attrs: { "aria-hidden": "true" } }), "Looking for a local Agentsol server…")));
        // A static copy has no API, so it does not probe one.
        if (SERVED_BY === "local-bridge" && (await detectLocalBridge()))
            renderWorkspace(main, localSource(), {});
        else {
            replace(main, h("section", { class: "page" }, h("p", { class: "eyebrow" }, "Local workspace"), h("h1", { class: "page-title", attrs: { tabindex: "-1", id: "page-title" } }, "No local workspace connected"), h("div", { class: "state state-empty" }, h("p", {}, "This view only works when the page is served by the read-only Agentsol server on your own machine. It is never available on a public website. Start it from the project folder:"), codeBlock(["npm run web:build", "npm run web:local -- --workspace <your workspace folder>"], { label: "Commands to start the local server" }), h("p", { class: "muted small" }, "Then open the http://127.0.0.1 address it prints."))));
        }
    }
    else
        renderLanding(main, await loadDemoBundle());
    main.setAttribute("aria-busy", "false");
    window.scrollTo(0, 0);
    const title = document.getElementById("page-title");
    if (title && document.body.dataset["booted"] === "true")
        title.focus({ preventScroll: true });
    document.body.dataset["booted"] = "true";
}
window.addEventListener("hashchange", () => void render());
void render();
