import "server-only";
import sanitizeHtml from "sanitize-html";

export const ALLOWED_IMAGE_HOSTS = new Set(["assets.leetcode.com", "leetcode.com"]);

export function isAllowedImageUrl(src: string): boolean {
  try {
    const u = new URL(src);
    return u.protocol === "https:" && ALLOWED_IMAGE_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "div", "span", "strong", "b", "em", "i", "u", "s", "code", "pre", "kbd",
    "sup", "sub", "ul", "ol", "li", "blockquote", "img", "a",
    "h3", "h4", "h5", "table", "thead", "tbody", "tr", "th", "td", "hr",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
    img: ["src", "alt", "width", "height"],
    "*": [],
  },
  allowedSchemes: ["https"],
  allowedSchemesByTag: { a: ["https", "http"], img: ["https"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  // Drop images from hosts we do not allow (no tracking pixels / arbitrary hosts).
  exclusiveFilter: (frame) => frame.tag === "img" && !isAllowedImageUrl(frame.attribs.src ?? ""),
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: "noopener noreferrer nofollow", target: "_blank" },
    }),
  },
};

/** Strict allowlist sanitizer for imported problem statements. */
export function sanitizeStatementHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}

/** Plain text from HTML (for search). */
export function htmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
