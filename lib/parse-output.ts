import { buildFullHtml } from "./html-template";

function extractInlineScripts(html: string): { html: string; scripts: string[] } {
  const scripts: string[] = [];
  const withoutScripts = html.replace(
    /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi,
    (match, content) => {
      const typeMatch = match.match(/type\s*=\s*["']([^"']+)["']/i);
      const type = typeMatch?.[1]?.toLowerCase();
      if (type === "text/template" || type === "text/x-handlebars-template") {
        return match;
      }
      scripts.push(content.trim());
      return "";
    },
  );
  return { html: withoutScripts.trim(), scripts };
}

function removeDuplicateTemplatePlaceholders(html: string): string {
  const templateIds: string[] = [];
  const scriptTemplateRe =
    /<script[^>]*\btype\s*=\s*["']text\/template["'][^>]*\bid\s*=\s*["']([^"']+)["']|<script[^>]*\bid\s*=\s*["']([^"']+)["'][^>]*\btype\s*=\s*["']text\/template["']/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptTemplateRe.exec(html))) {
    templateIds.push(m[1] || m[2] || "");
  }
  const ids = [...new Set(templateIds.filter(Boolean))];
  let result = html;
  for (const id of ids) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(
        `<(div|span|p)[^>]*id\\s*=\\s*["']${escaped}["'][^>]*>\\s*</\\1>`,
        "gi",
      ),
      "",
    );
  }
  return result;
}

function fixTemplateInWrongPlace(html: string): string {
  let result = removeDuplicateTemplatePlaceholders(html);
  const templateInside = /<(ul|div)([^>]*)>[\s\S]*?<script[^>]*type\s*=\s*["']text\/(template|x-handlebars-template)["'][^>]*>[\s\S]*?<\/script>[\s\S]*?<\/\1>/i;
  if (templateInside.test(result)) {
    result = result.replace(
      /<(ul|div)([^>]*)>([\s\S]*?)<script\s+([^>]*type\s*=\s*["']text\/(template|x-handlebars-template)["'][^>]*)>([\s\S]*?)<\/script>([\s\S]*?)<\/\1>/gi,
      (_m, tag, attrs, before, scriptAttrs, scriptContent, after) => {
        const idMatch = attrs.match(/id\s*=\s*["']([^"']+)["']/);
        const containerId = idMatch?.[1] ?? "list";
        const tplIdMatch = scriptAttrs.match(/id\s*=\s*["']([^"']+)["']/);
        const tplId = tplIdMatch?.[1] ?? containerId.replace(/-list$/, "-tpl");
        return `<${tag}${attrs}>${before}${after}</${tag}>\n  <script ${scriptAttrs}>${scriptContent}</script>`;
      },
    );
  }
  const hasTemplateScript =
    /<script[^>]*type\s*=\s*["']text\/(template|x-handlebars-template)["'][^>]*>/i.test(
      result,
    );
  if (hasTemplateScript) {
    return result;
  }
  const handlebarsBlock = result.match(/\{\{#each[\s\S]*?\{\{\/each\}\}/);
  if (!handlebarsBlock) {
    return result;
  }

  const templateContent = handlebarsBlock[0];
  const eachMatch = result.match(/\{\{#each\s+(\w+)\s*\}\}/);
  const dataVar = eachMatch?.[1] ?? "items";
  const tplId = dataVar.replace(/s$/, "") + "-tpl";
  const containerId = dataVar.replace(/s$/, "") + "-list";

  const containerPattern = new RegExp(
    `<((?:div|ul))([^>]*)>\\s*${templateContent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*</\\1>`,
    "i",
  );
  return result.replace(containerPattern, (_match, tag, attrs) => {
    const hasId = /id\s*=/.test(attrs);
    const attrsWithId = hasId ? attrs : ` id="${containerId}"${attrs}`;
    return `<${tag}${attrsWithId}></${tag}>\n  <script type="text/template" id="${tplId}">\n${templateContent}\n  </script>`;
  });
}

const EXPLANATION_PATTERNS = [
  /\n\s*Changes include:/i,
  /\n\s*Please note/i,
  /\n\s*I also removed/i,
  /\n\s*You may also need/i,
  /\n\s*Note:/i,
  /\n\s*Please note that/i,
  /\n\s*```\s*$/,
  /<\|stats\|>/,
  /\n\s*This code creates/i,
  /\n\s*This code\s/i,
  /\n\s*If you'd like/i,
  /\n\s*Let me know/i,
  /\n\s*Also,?\s/i,
  /\n\s*I've used the requested/i,
  /\n\s*The (?:code|app) (?:has been )?tested/i,
  /\n\s*```\s*(?:html|javascript|js)\s*$/i,
];

const JS_BAD_PATTERNS = [
  /document\.getElementById\s*\(\s*["']add-btn["']\s*\)\.click\s*\(\s*\)\s*;?\s*\n?/g,
];

function stripExplanations(js: string): string {
  const trimmed = js.trim();
  let cutAt = trimmed.length;
  for (const pattern of EXPLANATION_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match && match.index !== undefined && match.index < cutAt) {
      cutAt = match.index;
    }
  }
  return trimmed.slice(0, cutAt).trim();
}

const ALL_MARKERS = [
  "===RESPONSE===",
  "===HEAD===",
  "===CSS===",
  "===HTML===",
  "===JS===",
];

function extractBlockContent(
  raw: string,
  marker: string,
  nextMarkerStart: number,
): string {
  const idx = raw.indexOf(marker);
  if (idx === -1) return "";
  return raw.slice(idx + marker.length, nextMarkerStart).trim();
}

export function parseStructuredOutput(raw: string): {
  userResponse: string;
  head: string;
  css: string;
  html: string;
  js: string;
} {
  const responseMarker = "===RESPONSE===";
  const headMarker = "===HEAD===";
  const cssMarker = "===CSS===";
  const htmlMarker = "===HTML===";
  const jsMarker = "===JS===";

  let rawContent = raw;
  const firstBlock = raw.indexOf(responseMarker);
  if (firstBlock === -1 && raw.includes(htmlMarker)) {
    const firstHtml = raw.indexOf(htmlMarker);
    if (firstHtml > 0) rawContent = raw.slice(firstHtml);
  } else if (firstBlock > 0) {
    rawContent = raw.slice(firstBlock);
  }

  const positions = ALL_MARKERS.map((m) => ({ m, i: rawContent.indexOf(m) }));
  const present = positions.filter((x) => x.i !== -1);
  present.sort((a, b) => a.i - b.i);

  const getNextStart = (marker: string) => {
    const markerPos = rawContent.indexOf(marker);
    if (markerPos === -1) return rawContent.length;
    const after = present.filter((x) => x.i > markerPos);
    return after.length > 0 ? after[0]!.i : rawContent.length;
  };

  let userResponse = "";
  const respContent = extractBlockContent(
    rawContent,
    responseMarker,
    getNextStart(responseMarker),
  ).slice(0, 200);
  const cleaned = respContent
    .replace(/^###\s*[\w\s]+\s*###?/g, "")
    .replace(/\n###\s*/g, " ")
    .trim();
  if (!cleaned.includes("===") && !cleaned.includes("{{")) {
    userResponse = cleaned.split("\n")[0]?.trim() ?? cleaned;
  }
  const hasHtml = extractBlockContent(rawContent, htmlMarker, getNextStart(htmlMarker)).length > 0;
  if (!userResponse && hasHtml) {
    userResponse = "Your app preview is ready.";
  }

  const head = extractBlockContent(rawContent, headMarker, getNextStart(headMarker));
  const css = present.some((x) => x.m === cssMarker)
    ? extractBlockContent(rawContent, cssMarker, getNextStart(cssMarker))
    : "";
  const html = extractBlockContent(rawContent, htmlMarker, getNextStart(htmlMarker));
  let jsRaw = extractBlockContent(rawContent, jsMarker, rawContent.length);
  jsRaw = JS_BAD_PATTERNS.reduce((s, p) => s.replace(p, ""), jsRaw);
  const js = stripExplanations(jsRaw);

  return { userResponse, head, css, html, js };
}

const BLOCKED_HEAD_PATTERNS = [
  /tailwindcss|@tailwind|lucide|daisyui|handlebars|ejs|cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare/i,
  /next\.svg/,
  /italics?/i,
];

function sanitizeHead(head: string): string {
  return head
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      const lower = trimmed.toLowerCase();
      if (BLOCKED_HEAD_PATTERNS.some((p) => p.test(lower))) {
        return false;
      }
      return true;
    })
    .join("\n")
    .trim();
}

export function buildFullDocument(
  html: string,
  js: string,
  head?: string,
  baseUrl?: string,
  css?: string,
): string {
  const fixedHtml = fixTemplateInWrongPlace(html);
  const { html: cleanHtml, scripts } = extractInlineScripts(fixedHtml);
  const mergedJs =
    js.trim().length > 0 ? js.trim() : scripts.filter(Boolean).join("\n\n");
  const cleanHead = head ? sanitizeHead(head) : undefined;
  return buildFullHtml(cleanHtml, mergedJs, cleanHead, baseUrl, css);
}
