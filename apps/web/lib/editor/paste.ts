const BLOCKED_TAGS = /<(script|style|iframe|object|embed|link|meta|form)(\s[^>]*)?>[\s\S]*?<\/\1>/gi;
const BLOCKED_EMPTY_TAGS = /<(script|style|iframe|object|embed|link|meta|form)(\s[^>]*)?\/?>/gi;
const EVENT_ATTRS = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URL = /javascript:/gi;

/**
 * Strip executable markup from pasted HTML. Tiptap still maps the remainder
 * onto the document schema, so unknown tags disappear; this pass is the extra
 * guard against scripts, iframes, and inline handlers from external sites.
 */
export function sanitizePastedHtml(html: string): string {
  if (!html) {
    return "";
  }
  if (typeof DOMParser !== "undefined") {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    parsed.querySelectorAll("script,style,iframe,object,embed,link,meta,form").forEach((el) => el.remove());
    parsed.querySelectorAll("*").forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim().toLowerCase();
        if (name.startsWith("on") || value.startsWith("javascript:")) {
          el.removeAttribute(attr.name);
        }
      }
    });
    return parsed.body.innerHTML;
  }
  return html.replace(BLOCKED_TAGS, "").replace(BLOCKED_EMPTY_TAGS, "").replace(EVENT_ATTRS, "").replace(JS_URL, "");
}
