const ROUTE = /^#\/[a-z-]*$/;
export function route(r) {
    if (!ROUTE.test(r))
        throw new Error("invalid internal route");
    return brand(r);
}
function brand(s) {
    // The single place a string becomes a SafeHref; callers above validate first.
    return s;
}
/** Documentation pages Agentsol's own checks link to, plus its npm package page. Anything else is shown as plain text. */
const DOC_URLS = new Set([
    "https://www.npmjs.com/package/agentsol",
    "https://agentskills.io/specification",
    "https://code.claude.com/docs/en/memory",
    "https://learn.chatgpt.com/docs/agent-configuration/agents-md",
]);
export function docHref(url) {
    return DOC_URLS.has(url) ? brand(url) : null;
}
const ATTR = /^(aria-[a-z]+|data-[a-z-]+|role|tabindex|type|for|title|name|value|placeholder|autocomplete|spellcheck|lang|id|class|inputmode|aria-controls)$/;
export function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    if (props.class)
        el.className = props.class;
    for (const [k, v] of Object.entries(props.attrs ?? {})) {
        if (!ATTR.test(k))
            throw new Error(`attribute not allowed: ${k}`);
        el.setAttribute(k, v);
    }
    if (props.href !== undefined) {
        el.setAttribute("href", props.href);
        if (props.external) {
            el.setAttribute("rel", "noopener noreferrer");
            el.setAttribute("target", "_blank");
        }
    }
    if (props.hidden)
        el.hidden = true;
    if (props.disabled)
        el.setAttribute("disabled", "");
    const base = el;
    if (props.onClick)
        base.addEventListener("click", props.onClick);
    if (props.onKeydown)
        base.addEventListener("keydown", props.onKeydown);
    if (props.onChange)
        base.addEventListener("change", props.onChange);
    if (props.onInput)
        base.addEventListener("input", props.onInput);
    if (props.onSubmit)
        base.addEventListener("submit", props.onSubmit);
    append(el, children);
    return el;
}
export function append(el, children) {
    for (const c of children) {
        if (c === null || c === undefined || c === false)
            continue;
        el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    }
}
export function clear(el) {
    while (el.firstChild)
        el.removeChild(el.firstChild);
}
/** Replaces content and keeps it announced for screen readers if it is a live region. */
export function replace(el, ...children) {
    clear(el);
    append(el, children);
}
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/**
 * A code block that keeps its lines intact and scrolls sideways when they are long. The
 * block is focusable (arrow keys scroll it); when it overflows, a right-edge fade and a short
 * hint show that more text is there, because overlay scrollbars are often invisible.
 */
export function codePre(props, ...children) {
    const pre = h("pre", props, ...children);
    const hint = h("p", { class: "scroll-hint", hidden: true }, "Long lines: scroll sideways, or focus the block and use the arrow keys.");
    const frame = h("div", { class: "code-frame" }, pre);
    const update = () => {
        const over = pre.scrollWidth > pre.clientWidth + 1;
        hint.hidden = !over;
        frame.classList.toggle("is-overflowing", over);
        frame.classList.toggle("at-end", pre.scrollLeft + pre.clientWidth >= pre.scrollWidth - 1);
    };
    new ResizeObserver(update).observe(pre);
    pre.addEventListener("scroll", update, { passive: true });
    return h("div", { class: "code-wrap" }, frame, hint);
}
const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_TAGS = new Set(["svg", "g", "path", "rect", "circle", "text", "line"]);
const SVG_ATTR = /^(viewBox|class|d|x|y|x1|y1|x2|y2|cx|cy|r|rx|ry|width|height|text-anchor|dominant-baseline|aria-hidden|focusable|preserveAspectRatio|role)$/;
/**
 * Decorative SVG built from code-owned constants only (never from project data). Tags and
 * attributes come from a fixed allowlist; text is set as text nodes.
 */
export function svg(tag, attrs = {}, ...children) {
    if (!SVG_TAGS.has(tag))
        throw new Error(`svg tag not allowed: ${tag}`);
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (!SVG_ATTR.test(k))
            throw new Error(`svg attribute not allowed: ${k}`);
        el.setAttribute(k, String(v));
    }
    for (const c of children)
        el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return el;
}
