const DEFAULT_FONTS =
  '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet">';

const BASE_STYLES = `
  body { min-height: 100vh; -webkit-font-smoothing: antialiased; font-family: 'DM Sans', system-ui, sans-serif; }
  input, button, select, textarea { font: inherit; }
  input:focus, button:focus { outline: none; }
`;

function getBaseTag(baseUrl?: string): string {
  if (baseUrl && typeof baseUrl === "string" && baseUrl.startsWith("http")) {
    const origin = baseUrl.replace(/\/$/, "");
    return `<base href="${origin}/" />`;
  }
  return "";
}

function escapeScriptContent(s: string): string {
  return s.replace(/<\/script>/gi, "<\\/script>");
}

const LEADING_JUNK = /^\s*[=*\s]+\n?/;
const VALID_CODE_START =
  /^\s*(?:function|const|let|var|class|import|export)\b/m;
const LONE_EQUALS_LINE = /^\s*={1,3}\s*$/gm;
const TRAILING_ARTIFACTS =
  /[\s\n]*(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?::\d+)?[\s\n]*$/i;
const UUID_ANYWHERE =
  /[\s\n]*(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?::\d+)?[\s\n]*/gi;

function stripMarkdownCodeBlock(code: string): string {
  let s = code
    .replace(/^\s*```(?:jsx?|javascript|tsx?|typescript)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .replace(LONE_EQUALS_LINE, "")
    .trim();
  while (LEADING_JUNK.test(s)) {
    s = s.replace(LEADING_JUNK, "");
  }
  const m = s.match(VALID_CODE_START);
  if (m) {
    const idx = s.search(VALID_CODE_START);
    if (idx > 0) s = s.slice(idx);
  }
  return s.trim();
}

function stripImports(code: string): string {
  return code
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*/g, "")
    .replace(/\s*export\s+default\s+\w+\s*;?\s*$/gm, "")
    .trim();
}

function fixCommonMistakes(code: string): string {
  let s = code
    .replace(/t\.reported/g, "t.completed")
    .replace(/: t\)\)\)/g, ": t))")
    .replace(
      /className="([^"]*)"\s*\+\s*\(([^)]+)\)/g,
      'className={"$1" + ($2)}',
    )
    .replace(/dangerouslySetInnerHTML=\{[^}]*getStats\(\)[^}]*\}/g, "")
    .replace(/dangerouslySetInnerHTML=\{[^}]*\}/g, "");
  const misplacedUseEffect =
    /(return\s*\([\s\S]*?\n\s*\)\s*;)\s*(useEffect\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\},\s*\[[^\]]*\]\s*\)\s*;)\s*return\s*<[^>]+>[^<]*<\/[^>]+>\s*;/;
  s = s.replace(misplacedUseEffect, "$2\n\n$1");
  s = s.replace(/\s*return\s*<button[^>]*>[^<]*<\/button>\s*;(?=\s*})/g, "");
  s = s.replace(
    /\n\s*\)\s*;\s*useEffect\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\},\s*\[[^\]]*\]\s*\)\s*;(?=\s*})/g,
    "\n  );",
  );
  const misplacedInputVal =
    /\n\s*const \[inputVal, setInputVal\] = useState\(""\);\s*\n(\s*return \()/;
  if (misplacedInputVal.test(s)) {
    s = s.replace(misplacedInputVal, "\n$1");
    s = s.replace(
      /(const \[tasks, setTasks\] = useState\(\[\]\);\s*\n)/,
      '$1  const [inputVal, setInputVal] = useState("");\n',
    );
  }
  if (
    s.includes('value={""}') &&
    s.includes("New task") &&
    !s.includes("[inputVal, setInputVal]")
  ) {
    s = s.replace(
      /const \[tasks, setTasks\] = useState\(\[\]\);\s*\n/,
      'const [tasks, setTasks] = useState([]);\n  const [inputVal, setInputVal] = useState("");\n',
    );
    s = s.replace('value={""}', "value={inputVal}");
    s = s.replace(
      /onChange=\{e=>handleFilter\(e\)\}/g,
      "onChange={e=>setInputVal(e.target.value)}",
    );
    s = s.replace(
      /const name = "New Task";\s*\n\s*setTasks/,
      'const name = inputVal.trim() || "New Task"; setInputVal("");\n    setTasks',
    );
  }
  if (
    (s.includes("inputVal.trim()") || s.includes("value={inputVal}")) &&
    !s.includes("[inputVal, setInputVal]")
  ) {
    s = s.replace(
      /(const \[tasks, setTasks\] = useState\(\[\]\);\s*\n)/,
      '$1  const [inputVal, setInputVal] = useState("");\n',
    );
  }
  return s;
}

function stripRenderCalls(code: string): string {
  return code
    .replace(
      /\s*return\s+ReactDOM\.createRoot\s*\([^;]+\)\.render\s*\([^;]+\)\s*;?\s*/g,
      "\n",
    )
    .replace(
      /\s*ReactDOM\.createRoot\s*\([^;]+\)\.render\s*\([^;]+\)\s*;?\s*/g,
      "\n",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripTrailingArtifacts(code: string): string {
  return code.replace(TRAILING_ARTIFACTS, "").trim();
}

function stripAllUuids(code: string): string {
  return code
    .replace(UUID_ANYWHERE, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripNonAsciiNoise(code: string): string {
  return code.replace(/[^\t\n\r -~]/g, "");
}

function normalizeTodoAddHandler(code: string): string {
  const looksLikeTodo =
    code.includes("const [tasks, setTasks]") &&
    code.includes("const [inputVal, setInputVal]") &&
    code.includes("const add = () =>");
  if (!looksLikeTodo) return code;
  return code.replace(
    /const add = \(\) => \{[\s\S]*?\n\s*\};/,
    `const add = () => {
    const name = inputVal.trim();
    if (name) {
      setTasks([...tasks, { name, completed: false }]);
      setInputVal("");
    }
  };`,
  );
}

function repairCommonTail(code: string): string {
  let s = code.trim();
  if (s.includes("<main") && !s.includes("</main>")) {
    s += "\n    </main>";
  }
  if (/return\s*\(/.test(s) && !/return\s*\([\s\S]*\)\s*;\s*}$/m.test(s)) {
    s += "\n  );";
  }
  if (!s.endsWith("}")) {
    s += "\n}";
  }
  return s;
}

function ensureRenderCall(code: string): string {
  const cleaned = stripAllUuids(stripTrailingArtifacts(code));
  const withoutRender = stripRenderCalls(cleaned).trim();
  const lastBrace = withoutRender.lastIndexOf("}");
  const appCode =
    lastBrace >= 0
      ? withoutRender.slice(0, lastBrace + 1).trim()
      : withoutRender;
  const baseCode = appCode.endsWith("}") ? appCode : withoutRender;
  const finalCode = repairCommonTail(baseCode);
  return `${finalCode}\n\nReactDOM.createRoot(document.getElementById("root")).render(<App />);`;
}

function truncateToRenderCall(code: string): string {
  const re = /ReactDOM\.createRoot\s*\([^;]+\)\.render\s*\([^;]+\)\s*;?/g;
  let lastEnd = -1;
  for (let m = re.exec(code); m !== null; m = re.exec(code)) {
    lastEnd = m.index + m[0].length;
  }
  return lastEnd >= 0 ? code.slice(0, lastEnd).trim() : code;
}

function getBodyStyle(css?: string): string {
  if (!css?.trim()) return "";
  const safe = css.replace(/<\/style>/gi, "").trim();
  return safe ? `<style>${safe}</style>\n  ` : "";
}

const REACT_BASE_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  {{BASE_TAG}}
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css" />
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  ${DEFAULT_FONTS}
  <style>${BASE_STYLES}</style>
  {{HEAD_CONTENT}}
  <title>Preview</title>
</head>
<body data-theme="cupcake" class="min-h-screen bg-base-200">
  {{BODY_STYLE}}
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect } = React;
    const lucide = typeof window !== "undefined" && window.lucide ? window.lucide : { createIcons: function() {} };
    const LucideIcon = ({ name, icon, size, className, ...props }) => React.createElement("i", { "data-lucide": name || icon, className, ...props });
    {{REACT_CONTENT}}
  </script>
</body>
</html>`;

export function buildFullHtmlReact(
  reactContent: string,
  headContent?: string,
  baseUrl?: string,
  bodyCss?: string,
): string {
  let processed = stripMarkdownCodeBlock(reactContent);
  processed = stripAllUuids(processed);
  processed = stripNonAsciiNoise(processed);
  processed = stripImports(processed);

  processed = fixCommonMistakes(processed);
  processed = normalizeTodoAddHandler(processed);

  processed = ensureRenderCall(processed);
  processed = truncateToRenderCall(processed);
  processed = stripTrailingArtifacts(processed);

  const safe = escapeScriptContent(processed.trim());

  return REACT_BASE_TEMPLATE.replace("{{BASE_TAG}}", getBaseTag(baseUrl))
    .replace(
      "{{HEAD_CONTENT}}",
      headContent?.trim() ? headContent.trim() + "\n  " : "",
    )
    .replace("{{BODY_STYLE}}", getBodyStyle(bodyCss))
    .replace("{{REACT_CONTENT}}", safe);
}
