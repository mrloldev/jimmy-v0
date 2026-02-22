import { buildFullHtmlReact } from "./html-template";

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
  /\n\s*```\s*(?:html|javascript|js|jsx)\s*$/i,
];

const TRAILING_ARTIFACTS =
  /[\s\n]*(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?::\d+)?[\s\n]*$/i;
const LEADING_JUNK = /^\s*[=*\s]+\n?/;

function stripExplanations(react: string): string {
  let trimmed = react.trim();
  while (LEADING_JUNK.test(trimmed)) {
    trimmed = trimmed.replace(LEADING_JUNK, "");
  }
  trimmed = trimmed.replace(TRAILING_ARTIFACTS, "");
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
  "===REACT===",
];

function normalizeMarkers(raw: string): string {
  return raw
    .replace(/={2,}\s*RESPONSE\s*={2,}/gi, "===RESPONSE===")
    .replace(/={2,}\s*HEAD\s*={2,}/gi, "===HEAD===")
    .replace(/={2,}\s*CSS\s*={2,}/gi, "===CSS===")
    .replace(/={2,}\s*REACT\s*={2,}/gi, "===REACT===")
    .replace(/==RESPONSE==/g, "===RESPONSE===")
    .replace(/==HEAD==/g, "===HEAD===")
    .replace(/==CSS==/g, "===CSS===")
    .replace(/==REACT==/g, "===REACT===");
}

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
  react: string;
} {
  const normalized = normalizeMarkers(raw);
  const responseMarker = "===RESPONSE===";
  const headMarker = "===HEAD===";
  const cssMarker = "===CSS===";
  const reactMarker = "===REACT===";

  let rawContent = normalized;
  const firstBlock = rawContent.indexOf(responseMarker);
  if (firstBlock === -1 && rawContent.includes(reactMarker)) {
    const firstReact = rawContent.indexOf(reactMarker);
    if (firstReact > 0) rawContent = rawContent.slice(firstReact);
  } else if (firstBlock > 0) {
    rawContent = rawContent.slice(firstBlock);
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
    .replace(/^\s*=+\s*\n?/, "")
    .trim();
  if (!(cleaned.includes("===") || cleaned.includes("{{"))) {
    userResponse = cleaned.split("\n")[0]?.trim() ?? cleaned;
  }
  const hasReact =
    extractBlockContent(rawContent, reactMarker, getNextStart(reactMarker))
      .length > 0;
  if (!userResponse && hasReact) {
    userResponse = "Your app preview is ready.";
  }

  const head = extractBlockContent(
    rawContent,
    headMarker,
    getNextStart(headMarker),
  );
  const css = present.some((x) => x.m === cssMarker)
    ? extractBlockContent(rawContent, cssMarker, getNextStart(cssMarker))
    : "";
  const reactRaw = extractBlockContent(
    rawContent,
    reactMarker,
    rawContent.length,
  );
  const react = stripExplanations(reactRaw);

  return { userResponse, head, css, react };
}

const BLOCKED_HEAD_PATTERNS = [
  /tailwindcss|@tailwind|lucide|daisyui|cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare/i,
  /next\.svg/,
  /italics?/i,
];

const PLACEHOLDER_HEAD =
  /^(empty\.?\s*(fonts only if requested\.?)?|leave empty\.?\s*(output nothing\.?)?|nothing\.?)$/i;

function sanitizeHead(head: string): string {
  const trimmed = head.trim();
  if (PLACEHOLDER_HEAD.test(trimmed)) return "";
  return trimmed
    .split("\n")
    .filter((line) => {
      const lineTrimmed = line.trim();
      const lower = lineTrimmed.toLowerCase();
      if (BLOCKED_HEAD_PATTERNS.some((p) => p.test(lower))) return false;
      if (PLACEHOLDER_HEAD.test(lineTrimmed)) return false;
      return true;
    })
    .join("\n")
    .trim();
}

const PLACEHOLDER_CSS = /^(leave empty\.?|output nothing\.?|nothing\.?)$/i;
const INSTRUCTION_CSS =
  /^(leave empty\.?\s*)?(daisyui and tailwind are pre-loaded|use tailwind utility classes).*/is;

function sanitizeCss(css: string): string {
  const trimmed = css.trim();
  if (!trimmed) return "";
  if (PLACEHOLDER_CSS.test(trimmed)) return "";
  if (INSTRUCTION_CSS.test(trimmed)) return "";
  return trimmed;
}

export function buildFullDocument(
  react: string,
  head?: string,
  baseUrl?: string,
  css?: string,
): string {
  const cleanHead = head ? sanitizeHead(head) : undefined;
  const cleanCss = css ? sanitizeCss(css) : undefined;
  return buildFullHtmlReact(react, cleanHead, baseUrl, cleanCss);
}
