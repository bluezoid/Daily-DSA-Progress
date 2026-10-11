import { codeToHtml } from "shiki";
import type { Language } from "@/lib/constants";

const SHIKI_LANG: Record<Language, string> = {
  python: "python",
  javascript: "javascript",
  typescript: "typescript",
  java: "java",
  cpp: "cpp",
  c: "c",
  go: "go",
  rust: "rust",
  other: "text",
};

/** Server-side syntax highlighting (no client JS). Falls back to plain text on error. */
export async function CodeBlock({ code, language, className }: { code: string; language: Language; className?: string }) {
  let html: string | null = null;
  try {
    html = await codeToHtml(code, {
      lang: SHIKI_LANG[language],
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: "light",
    });
  } catch {
    html = null;
  }
  return (
    <div className={`shiki-block overflow-hidden rounded-lg border ${className ?? ""}`}>
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="overflow-x-auto bg-muted/40 p-4 font-mono text-[0.82rem] leading-6">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
