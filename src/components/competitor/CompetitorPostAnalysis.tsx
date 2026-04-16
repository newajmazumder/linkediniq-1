import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Flame, Shield, Target, TrendingUp, AlertTriangle, Brain,
  Swords, Zap, BarChart3, Users, ChevronRight, Copy, CheckCircle2,
  Eye, MessageSquare, ImageIcon, Lightbulb, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface CompetitorPostAnalysisProps {
  analysis: any;
  onNavigateToCreate?: (data: any) => void;
  postContent: string;
}

const threatColor = (level: string) => {
  switch (level) {
    case "high": return "text-red-600 bg-red-500/10 border-red-500/30";
    case "medium": return "text-amber-600 bg-amber-500/10 border-amber-500/30";
    case "low": return "text-green-600 bg-green-500/10 border-green-500/30";
    default: return "text-muted-foreground bg-muted/50 border-border";
  }
};

const scoreBg = (score: number) => {
  if (score >= 8) return "bg-green-500";
  if (score >= 5) return "bg-amber-500";
  return "bg-red-500";
};

export function CompetitorPostAnalysis({ analysis, onNavigateToCreate, postContent }: CompetitorPostAnalysisProps) {
  const [copied, setCopied] = useState(false);
  const a = analysis;
  if (!a || Object.keys(a).length === 0) return null;

  const impact = a.impact_panel;
  const weaknesses = a.exploitable_weaknesses;
  const strengths = a.strength_analysis;
  const marketFit = a.market_fit_analysis;
  const behavioral = a.behavioral_insight;
  const winningMove = a.winning_move;
  const outperform = a.outperform_version;
  const benchmark = a.competitive_benchmark;

  const copyOutperform = () => {
    if (outperform) {
      navigator.clipboard.writeText(outperform);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border-t border-border bg-muted/10 space-y-0">
      {/* 1. IMPACT PANEL — Sticky, color-coded */}
      {impact && (
        <div className="sticky top-0 z-10 bg-gradient-to-r from-card via-card to-card border-b border-border p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Competitor Impact</h3>
            <Badge className={cn("text-[9px] h-5 px-2 ml-auto", threatColor(impact.competitive_threat_level))}>
              {impact.competitive_threat_level} threat
            </Badge>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <ScoreCell label="Hook Strength" value={`${impact.hook_strength}/10`} color={scoreBg(impact.hook_strength)} />
            <ScoreCell label="Engagement" value={impact.engagement_potential} level={impact.engagement_potential} />
            <ScoreCell label="Conversion" value={impact.conversion_intent_strength} level={impact.conversion_intent_strength} />
            <ScoreCell label="Market Fit" value={marketFit?.local_relevance_score || "—"} level={marketFit?.local_relevance_score} />
          </div>

          {impact.verdict && (
            <div className="bg-foreground/5 border border-border rounded-lg p-3">
              <p className="text-xs font-semibold text-foreground">→ {impact.verdict}</p>
            </div>
          )}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* 2. WHERE YOU CAN BEAT THEM */}
        {weaknesses && weaknesses.length > 0 && (
          <div className="rounded-xl border-2 border-red-500/20 bg-red-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-red-500" />
              <h3 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Where You Can Beat Them</h3>
            </div>
            <div className="space-y-2">
              {weaknesses.slice(0, 4).map((w: any, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground">{w.weakness}</p>
                    {w.how_to_exploit && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">→ {w.how_to_exploit}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. WHAT THEY DID RIGHT */}
        {strengths && strengths.why_it_works && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <h3 className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">What They Did Right</h3>
              {strengths.should_replicate && (
                <Badge variant="outline" className={cn("text-[9px] h-5 px-2 ml-auto",
                  strengths.should_replicate === "yes" ? "border-green-500/30 text-green-600" :
                  strengths.should_replicate === "partial" ? "border-amber-500/30 text-amber-600" :
                  "border-red-500/30 text-red-500"
                )}>
                  Replicate: {strengths.should_replicate}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{strengths.why_it_works}</p>
            {strengths.strong_lines?.length > 0 && (
              <div className="space-y-1">
                {strengths.strong_lines.map((line: string, i: number) => (
                  <p key={i} className="text-xs text-foreground/80 pl-2 border-l-2 border-green-500/40 italic">"{line}"</p>
                ))}
              </div>
            )}
            {strengths.replicate_note && (
              <p className="text-[11px] text-green-700 dark:text-green-400 font-medium">💡 {strengths.replicate_note}</p>
            )}
          </div>
        )}

        {/* 4. MARKET FIT ANALYSIS */}
        {marketFit && (marketFit.bd_fit || marketFit.us_fit) && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Market Fit Analysis</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {marketFit.bd_fit && (
                <MarketFitCard flag="🇧🇩" market="Bangladesh" score={marketFit.bd_fit.score} assessment={marketFit.bd_fit.assessment} />
              )}
              {marketFit.us_fit && (
                <MarketFitCard flag="🇺🇸" market="United States" score={marketFit.us_fit.score} assessment={marketFit.us_fit.assessment} />
              )}
            </div>
            {marketFit.market_gap_opportunity && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Market Gap Opportunity</p>
                <p className="text-xs text-foreground">{marketFit.market_gap_opportunity}</p>
              </div>
            )}
          </div>
        )}

        {/* 5. WHY THIS WORKS / FAILS (Psychology) */}
        {behavioral && (
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              <h3 className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Why This Works / Fails</h3>
            </div>
            {behavioral.psychology_summary && (
              <p className="text-xs font-medium text-foreground">{behavioral.psychology_summary}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {behavioral.scroll_stop_power && (
                <PsychCard label="Scroll Stop Power" value={behavioral.scroll_stop_power} icon={<Eye className="h-3 w-3" />} />
              )}
              {behavioral.engagement_trigger && (
                <PsychCard label="Engagement Trigger" value={behavioral.engagement_trigger} icon={<MessageSquare className="h-3 w-3" />} />
              )}
              {behavioral.attention_drop_point && (
                <PsychCard label="Attention Drop" value={behavioral.attention_drop_point} icon={<AlertTriangle className="h-3 w-3" />} />
              )}
            </div>
          </div>
        )}

        {/* 6. YOUR WINNING MOVE */}
        {winningMove && (
          <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-card to-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Your Winning Move</h3>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {winningMove.better_hook && (
                <WinningMoveItem label="Better Hook" value={winningMove.better_hook} color="bg-green-500/10 border-green-500/20" labelColor="text-green-700 dark:text-green-400" />
              )}
              {winningMove.better_angle && (
                <WinningMoveItem label="Better Angle" value={winningMove.better_angle} color="bg-blue-500/10 border-blue-500/20" labelColor="text-blue-700 dark:text-blue-400" />
              )}
              {winningMove.better_cta && (
                <WinningMoveItem label="Better CTA" value={winningMove.better_cta} color="bg-amber-500/10 border-amber-500/20" labelColor="text-amber-700 dark:text-amber-400" />
              )}
              {winningMove.strategic_advantage && (
                <WinningMoveItem label="Strategic Advantage" value={winningMove.strategic_advantage} color="bg-primary/10 border-primary/20" labelColor="text-primary" />
              )}
            </div>
          </div>
        )}

        {/* 7. OUTPERFORM VERSION */}
        {outperform && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Outperform This Post</h3>
              </div>
              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={copyOutperform}>
                {copied ? <><CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Copied</> : <><Copy className="h-2.5 w-2.5 mr-1" /> Copy</>}
              </Button>
            </div>
            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{outperform}</p>
            </div>
            <div className="flex gap-2">
              {onNavigateToCreate && (
                <>
                  <Button size="sm" className="h-7 text-xs" onClick={() => onNavigateToCreate({
                    title: "Outperform competitor post",
                    rewrite_source: outperform,
                    auto_generate: false,
                    prefilled_content: outperform,
                  })}>
                    <Zap className="h-3 w-3 mr-1" /> Use This Version
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onNavigateToCreate({
                    title: "Outperform competitor post",
                    rewrite_source: outperform,
                    auto_generate: true,
                  })}>
                    Refine Further
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* 8. COMPETITIVE BENCHMARK */}
        {benchmark && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Competitive Benchmark</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {benchmark.hook_vs_standard && (
                <BenchmarkItem label="Hook vs Standard" value={benchmark.hook_vs_standard} />
              )}
              {benchmark.engagement_vs_top && (
                <BenchmarkItem label="Engagement vs Top" value={benchmark.engagement_vs_top} />
              )}
              {benchmark.cta_vs_best_practice && (
                <BenchmarkItem label="CTA vs Best Practice" value={benchmark.cta_vs_best_practice} />
              )}
            </div>
          </div>
        )}

        {/* 9. DEEP ANALYSIS — Collapsible */}
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 px-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors group">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
            <span className="text-xs font-semibold text-muted-foreground">Deep Analysis Details</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            {a.audience_targeting && (
              <DetailSection icon={<Users className="h-3.5 w-3.5" />} title="Audience Targeting">
                <p className="text-xs text-muted-foreground"><strong>Target:</strong> {a.audience_targeting.who_targeted}</p>
                <p className="text-xs text-muted-foreground"><strong>Awareness:</strong> {a.audience_targeting.awareness_level}</p>
                {a.audience_targeting.relevance_to_user && <p className="text-xs text-primary/80 mt-1 italic">→ {a.audience_targeting.relevance_to_user}</p>}
              </DetailSection>
            )}
            {a.creative_analysis && (
              <DetailSection icon={<ImageIcon className="h-3.5 w-3.5 text-purple-500" />} title="Creative Analysis">
                {a.creative_analysis.visual_assessment && <p className="text-xs text-muted-foreground">{a.creative_analysis.visual_assessment}</p>}
                {a.creative_analysis.message_alignment && <p className="text-xs text-muted-foreground"><strong>Visual-Message Fit:</strong> {a.creative_analysis.message_alignment}</p>}
              </DetailSection>
            )}
            {a.engagement_insight && a.engagement_insight !== "skip" && (
              <DetailSection icon={<BarChart3 className="h-3.5 w-3.5" />} title="Engagement Insight">
                <p className="text-xs text-muted-foreground">{a.engagement_insight}</p>
              </DetailSection>
            )}
            {a.improvement_suggestions?.length > 0 && (
              <DetailSection icon={<Lightbulb className="h-3.5 w-3.5 text-blue-500" />} title="Improvements">
                {a.improvement_suggestions.map((s: string, i: number) => <p key={i} className="text-xs text-muted-foreground">• {s}</p>)}
              </DetailSection>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

function ScoreCell({ label, value, color, level }: { label: string; value: string; color?: string; level?: string }) {
  const levelColor = level === "high" ? "text-green-600" : level === "medium" ? "text-amber-600" : level === "low" ? "text-red-500" : "text-foreground";
  return (
    <div className="bg-muted/50 rounded-lg p-2 text-center">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      {color ? (
        <div className="flex items-center justify-center gap-1 mt-1">
          <div className={cn("h-2 w-2 rounded-full", color)} />
          <p className="text-sm font-bold text-foreground">{value}</p>
        </div>
      ) : (
        <p className={cn("text-sm font-bold capitalize mt-1", levelColor)}>{value}</p>
      )}
    </div>
  );
}

function MarketFitCard({ flag, market, score, assessment }: { flag: string; market: string; score: string; assessment: string }) {
  const scoreColor = score === "high" ? "border-green-500/30 bg-green-500/5" : score === "medium" ? "border-amber-500/30 bg-amber-500/5" : "border-red-500/30 bg-red-500/5";
  return (
    <div className={cn("rounded-lg border p-3 space-y-1", scoreColor)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">{flag} {market}</span>
        <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5 capitalize",
          score === "high" ? "text-green-600 border-green-500/30" :
          score === "medium" ? "text-amber-600 border-amber-500/30" :
          "text-red-500 border-red-500/30"
        )}>{score}</Badge>
      </div>
      <p className="text-[11px] text-muted-foreground">{assessment}</p>
    </div>
  );
}

function PsychCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-purple-500/5 border border-purple-500/15 rounded-lg p-2 space-y-1">
      <p className="text-[9px] font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1">{icon} {label}</p>
      <p className="text-[11px] text-foreground">{value}</p>
    </div>
  );
}

function WinningMoveItem({ label, value, color, labelColor }: { label: string; value: string; color: string; labelColor: string }) {
  return (
    <div className={cn("border rounded-lg p-3 space-y-1", color)}>
      <p className={cn("text-[10px] font-bold uppercase tracking-wider", labelColor)}>{label}</p>
      <p className="text-xs text-foreground">{value}</p>
    </div>
  );
}

function BenchmarkItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-2 space-y-0.5">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-[11px] text-foreground font-medium">{value}</p>
    </div>
  );
}

function DetailSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">{icon} {title}</p>
      <div className="pl-5 space-y-0.5">{children}</div>
    </div>
  );
}