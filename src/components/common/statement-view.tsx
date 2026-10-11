import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sanitizeStatementHtml } from "@/lib/sanitize";
import type { StatementFormat } from "@/types/domain";

/** Server component. Markdown never renders raw HTML; HTML is re-sanitized at render time. */
export function StatementView({ statement, format }: { statement: string; format: StatementFormat }) {
  if (!statement.trim()) return null;
  if (format === "html") {
    return <div className="statement" dangerouslySetInnerHTML={{ __html: sanitizeStatementHtml(statement) }} />;
  }
  return (
    <div className="statement">
      <Markdown remarkPlugins={[remarkGfm]} skipHtml>
        {statement}
      </Markdown>
    </div>
  );
}
