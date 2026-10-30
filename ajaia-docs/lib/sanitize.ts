// Defense in depth for imported HTML. Documents are only ever loaded through the
// TipTap editor, whose schema drops anything it does not know. This strips the
// obviously dangerous parts before the HTML is stored at all.

const BLOCKED_TAGS = ["script", "style", "iframe", "object", "embed", "link", "meta", "form"];

export function sanitizeHtml(html: string): string {
  let result = html;

  for (const tag of BLOCKED_TAGS) {
    const paired = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi");
    const single = new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi");
    result = result.replace(paired, "").replace(single, "");
  }

  // Inline event handlers such as onclick="..." or onerror=alert(1)
  result = result.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // javascript: and data: URLs in href or src
  result = result.replace(
    /\s(href|src)\s*=\s*("|')\s*(javascript|data|vbscript):[^"']*\2/gi,
    "",
  );

  return result;
}
