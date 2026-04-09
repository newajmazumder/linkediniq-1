import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { cn } from "@/lib/utils";

type CampaignRichTextProps = {
  content: unknown;
  variant?: "assistant" | "user";
  className?: string;
};

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "u"],
};

const humanizeKey = (key: string) =>
  key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatScalar = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const objectToMarkdown = (value: unknown, depth = 0): string => {
  const indent = "  ".repeat(depth);

  if (value === null || value === undefined || value === "") return "";

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return `${indent}${formatScalar(value)}`;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item === null || item === undefined || item === "") return null;

        if (typeof item === "object") {
          const nested = objectToMarkdown(item, depth + 1);
          return nested ? `${indent}-\n${nested}` : null;
        }

        return `${indent}- ${formatScalar(item)}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => {
      if (item === null || item === undefined || item === "") return null;
      if (Array.isArray(item) && item.length === 0) return null;

      if (typeof item === "object") {
        const nested = objectToMarkdown(item, depth + 1);
        return nested ? `${indent}- **${humanizeKey(key)}:**\n${nested}` : `${indent}- **${humanizeKey(key)}:**`;
      }

      return `${indent}- **${humanizeKey(key)}:** ${formatScalar(item)}`;
    })
    .filter(Boolean)
    .join("\n");
};

const normalizeRichText = (content: unknown) => {
  if (typeof content === "string") return content.replace(/\r\n/g, "\n").trim();
  if (content === null || content === undefined) return "";
  if (typeof content === "object") return objectToMarkdown(content).trim();
  return String(content).trim();
};

const CampaignRichText = ({ content, variant = "assistant", className }: CampaignRichTextProps) => {
  const markdown = normalizeRichText(content);

  if (!markdown) return null;

  const codeSurfaceClass = variant === "user" ? "bg-primary-foreground/15" : "bg-secondary";
  const quoteBorderClass = variant === "user" ? "border-primary-foreground/30" : "border-border";
  const tableBorderClass = variant === "user" ? "border-primary-foreground/20" : "border-border";

  return (
    <div className={cn("text-sm leading-7 text-current break-words", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={{
          p: ({ children }) => <p className="my-2 whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="whitespace-pre-wrap">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-current">{children}</strong>,
          em: ({ children }) => <em className="italic text-current">{children}</em>,
          u: ({ children }) => <u className="underline underline-offset-2">{children}</u>,
          blockquote: ({ children }) => (
            <blockquote className={cn("my-3 border-l-2 pl-4 italic text-current", quoteBorderClass)}>{children}</blockquote>
          ),
          hr: () => <hr className={cn("my-4", tableBorderClass)} />,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className={cn("w-full border-collapse text-left", tableBorderClass)}>{children}</table>
            </div>
          ),
          th: ({ children }) => <th className={cn("border px-3 py-2 font-semibold", tableBorderClass)}>{children}</th>,
          td: ({ children }) => <td className={cn("border px-3 py-2 align-top", tableBorderClass)}>{children}</td>,
          code: ({ className, children }) => {
            const isBlock = Boolean(className);

            return isBlock ? (
              <code className={cn("font-mono text-xs text-current", className)}>{children}</code>
            ) : (
              <code className={cn("rounded px-1.5 py-0.5 font-mono text-[0.92em] text-current", codeSurfaceClass)}>{children}</code>
            );
          },
          pre: ({ children }) => <pre className={cn("my-3 overflow-x-auto rounded-xl p-3", codeSurfaceClass)}>{children}</pre>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              {children}
            </a>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
};

export default CampaignRichText;