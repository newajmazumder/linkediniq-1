// Tiny helper to turn a stored draft's `custom_content` blob back into
// hook/body/cta segments for the PostCard preview.
export const splitDraftContent = (content: string | null | undefined): { hook: string; body: string; cta: string } => {
  const text = (content || "").trim();
  if (!text) return { hook: "", body: "", cta: "" };
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length === 1) return { hook: blocks[0], body: "", cta: "" };
  if (blocks.length === 2) return { hook: blocks[0], body: "", cta: blocks[1] };
  return {
    hook: blocks[0],
    body: blocks.slice(1, -1).join("\n\n"),
    cta: blocks[blocks.length - 1],
  };
};
