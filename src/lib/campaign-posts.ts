export type CampaignPostLifecycle = "planned" | "drafted" | "scheduled" | "posted" | "missed";

type DeriveLifecycleInput = {
  planStatus?: string | null;
  linkedDraftId?: string | null;
  linkedPostId?: string | null;
  draftStatus?: string | null;
  scheduledAt?: string | null;
};

export const deriveCampaignPostLifecycle = ({
  planStatus,
  linkedDraftId,
  linkedPostId,
  draftStatus,
  scheduledAt,
}: DeriveLifecycleInput): CampaignPostLifecycle => {
  if (linkedPostId || planStatus === "posted" || draftStatus === "posted") return "posted";
  if (planStatus === "missed") return "missed";
  if (draftStatus === "scheduled" || planStatus === "scheduled" || !!scheduledAt) return "scheduled";
  if (linkedDraftId || draftStatus === "draft" || draftStatus === "approved" || planStatus === "drafted") return "drafted";
  return "planned";
};

export const planStatusFromDraftStatus = (draftStatus?: string | null): "drafted" | "scheduled" | "posted" | null => {
  if (!draftStatus) return null;
  if (draftStatus === "scheduled") return "scheduled";
  if (draftStatus === "posted") return "posted";
  if (draftStatus === "draft" || draftStatus === "approved") return "drafted";
  return null;
};

type CampaignPostPreview = {
  title: string | null;
  snippet: string | null;
  cta: string | null;
};

const truncate = (value: string, max: number) => value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;

export const extractCampaignPostPreview = (content?: string | null): CampaignPostPreview => {
  if (!content) return { title: null, snippet: null, cta: null };

  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return { title: null, snippet: null, cta: null };

  const title = truncate(lines[0], 96);
  const remaining = lines.slice(1);
  const ctaCandidate = [...lines].reverse().find((line) =>
    /(book|demo|reply|comment|send|dm|message|talk|call|link|learn more|get started|apply)/i.test(line),
  );
  const bodyLines = ctaCandidate ? remaining.filter((line) => line !== ctaCandidate) : remaining;

  return {
    title,
    snippet: bodyLines.length > 0 ? truncate(bodyLines.slice(0, 2).join(" "), 180) : null,
    cta: ctaCandidate ? truncate(ctaCandidate, 120) : null,
  };
};