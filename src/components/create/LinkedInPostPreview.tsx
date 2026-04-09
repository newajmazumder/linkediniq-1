import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Image as ImageIcon, Layers } from "lucide-react";

// ─── Formatting Engine ───

type BlockType = "hook" | "body" | "list" | "cta" | "empty";

type ContentBlock = {
  type: BlockType;
  text: string;
};

const CTA_KEYWORDS = [
  "comment", "dm", "click", "reply", "share", "follow", "subscribe",
  "sign up", "register", "download", "link", "bio", "কমেন্ট", "ডিএম",
];

function parseContent(content: string): ContentBlock[] {
  const lines = content.split("\n");
  const blocks: ContentBlock[] = [];
  let hookDone = false;
  let hookLineCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      blocks.push({ type: "empty", text: "" });
      continue;
    }

    // Hook: first 1-2 non-empty lines
    if (!hookDone && hookLineCount < 2) {
      blocks.push({ type: "hook", text: trimmed });
      hookLineCount++;
      // End hook after 2 lines or if next meaningful content follows
      if (hookLineCount >= 2) hookDone = true;
      continue;
    }
    hookDone = true;

    // List items
    if (/^[-•●▪▸►]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)) {
      blocks.push({ type: "list", text: trimmed });
      continue;
    }

    // CTA detection
    const lower = trimmed.toLowerCase();
    if (CTA_KEYWORDS.some((kw) => lower.includes(kw))) {
      blocks.push({ type: "cta", text: trimmed });
      continue;
    }

    blocks.push({ type: "body", text: trimmed });
  }

  return blocks;
}

// ─── Block Renderers ───

function RenderBlock({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "hook":
      return (
        <p className="text-[15px] font-semibold leading-snug text-foreground">
          {block.text}
        </p>
      );
    case "body":
      return (
        <p className="text-[14px] leading-relaxed text-foreground/90">
          {block.text}
        </p>
      );
    case "list":
      return (
        <p className="text-[14px] leading-relaxed text-foreground/90 pl-1">
          {block.text}
        </p>
      );
    case "cta":
      return (
        <p className="text-[14px] font-semibold leading-relaxed text-primary">
          {block.text}
        </p>
      );
    case "empty":
      return <div className="h-3" />;
    default:
      return null;
  }
}

// ─── Image Placeholder ───

function ImagePlaceholder({ ratio = "16:9" }: { ratio?: "16:9" | "1:1" }) {
  return (
    <div
      className={cn(
        "w-full rounded-lg border border-border bg-muted/50 flex items-center justify-center",
        ratio === "1:1" ? "aspect-square" : "aspect-video"
      )}
    >
      <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
        <ImageIcon className="h-8 w-8" />
        <span className="text-xs font-medium">Image Placeholder</span>
      </div>
    </div>
  );
}

// ─── Carousel Preview ───

function CarouselPreview({ slidesCount = 5 }: { slidesCount: number }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {Array.from({ length: slidesCount }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-[160px] h-[200px] rounded-lg border border-border bg-muted/40 flex flex-col items-center justify-center gap-2"
          >
            <Layers className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Slide {i + 1}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {slidesCount} slides
        </span>
        <div className="flex gap-1">
          {Array.from({ length: slidesCount }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                i === 0 ? "bg-foreground" : "bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── LinkedIn Profile Header ───

function LinkedInProfileHeader() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium">
        U
      </div>
      <div>
        <p className="text-[13px] font-semibold text-foreground leading-tight">
          Your Name
        </p>
        <p className="text-[11px] text-muted-foreground leading-tight">
          Your headline · 1h · 🌐
        </p>
      </div>
    </div>
  );
}

// ─── Engagement Bar ───

function EngagementBar() {
  return (
    <div className="border-t border-border pt-2 mt-1">
      <div className="flex justify-between text-muted-foreground">
        {["👍 Like", "💬 Comment", "🔄 Repost", "📤 Send"].map((action) => (
          <span key={action} className="text-[12px] font-medium px-2 py-1 rounded hover:bg-muted/50 cursor-default">
            {action}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───

export type PostPreviewProps = {
  type: "text" | "image_text" | "carousel";
  content: string;
  slidesCount?: number;
  metadata?: {
    postStyle?: string;
    tone?: string;
    hookType?: string;
  };
  firstComment?: string | null;
  contextRationale?: string | null;
  className?: string;
};

const PostPreview = ({
  type,
  content,
  slidesCount = 5,
  metadata,
  firstComment,
  contextRationale,
  className,
}: PostPreviewProps) => {
  const blocks = useMemo(() => parseContent(content), [content]);

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[600px] rounded-xl border border-border bg-card shadow-sm",
        className
      )}
    >
      {/* LinkedIn-style card */}
      <div className="p-4 space-y-3">
        {/* Profile header */}
        <LinkedInProfileHeader />

        {/* Rendered content blocks */}
        <div className="space-y-0.5">
          {blocks.map((block, i) => (
            <RenderBlock key={i} block={block} />
          ))}
        </div>

        {/* Type-specific media */}
        {type === "image_text" && (
          <ImagePlaceholder ratio="16:9" />
        )}

        {type === "carousel" && (
          <CarouselPreview slidesCount={slidesCount} />
        )}

        {/* Engagement bar */}
        <EngagementBar />
      </div>

      {/* Supplementary info below the card */}
      {(firstComment || contextRationale) && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          {firstComment && (
            <div className="rounded-md bg-secondary/50 p-2.5">
              <p className="text-[10px] font-medium text-muted-foreground mb-0.5">
                Suggested first comment
              </p>
              <p className="text-xs text-foreground leading-relaxed">
                {firstComment}
              </p>
            </div>
          )}
          {contextRationale && (
            <div className="rounded-md bg-amber-500/5 border border-amber-500/10 p-2.5">
              <p className="text-[10px] font-medium text-muted-foreground mb-0.5">
                Business context used
              </p>
              <p className="text-xs text-foreground leading-relaxed">
                {contextRationale}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PostPreview;
