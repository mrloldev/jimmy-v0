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

export const BASE_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  {{BASE_TAG}}
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css" />
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <script src="https://cdn.jsdelivr.net/npm/ejs@3.1.9/ejs.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/lucide@latest/dist/lucide.min.js"></script>
  ${DEFAULT_FONTS}
  <style>${BASE_STYLES}</style>
  {{HEAD_CONTENT}}
  <title>Preview</title>
</head>
<body data-theme="cupcake" class="min-h-screen bg-base-200">
  {{BODY_STYLE}}
  {{BODY_CONTENT}}
  <script>
  (function(){
    const storage={
      get:function(k,d){try{var v=localStorage.getItem(k);return v===null?d:JSON.parse(v);}catch(e){return d;}},
      set:function(k,v){localStorage.setItem(k,JSON.stringify(v));},
      remove:function(k){localStorage.removeItem(k);}
    };
    function run(){ try { {{SCRIPT_CONTENT}} } catch(e){ console.error("Preview script error:", e); } }
    function paintIcons(){ try { if(typeof lucide!=='undefined') lucide.createIcons(); } catch(e){ console.error("Lucide icons error:", e); } }
    function go(){ if(typeof ejs!=='undefined'&&typeof lucide!=='undefined'){ run(); setTimeout(paintIcons, 0); } else setTimeout(go, 20); }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', go);
    else go();
  })();
  </script>
</body>
</html>`;

function getBodyStyle(css?: string): string {
  if (!css?.trim()) return "";
  const safe = css
    .replace(/<\/style>/gi, "")
    .trim();
  return safe ? `<style>${safe}</style>\n  ` : "";
}

export function buildFullHtml(
  bodyContent: string,
  scriptContent: string,
  headContent?: string,
  baseUrl?: string,
  bodyCss?: string,
): string {
  return BASE_HTML_TEMPLATE.replace("{{BASE_TAG}}", getBaseTag(baseUrl))
    .replace(
      "{{HEAD_CONTENT}}",
      headContent?.trim() ? headContent.trim() + "\n  " : "",
    )
    .replace("{{BODY_STYLE}}", getBodyStyle(bodyCss))
    .replace("{{BODY_CONTENT}}", bodyContent)
    .replace("{{SCRIPT_CONTENT}}", scriptContent);
}
