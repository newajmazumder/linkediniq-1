import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Flame, Shield, Target, TrendingUp, AlertTriangle, Brain,
  Swords, Zap, BarChart3, Users, ChevronRight, Copy, CheckCircle2,
  Eye, ImageIcon, Lightbulb, Globe, ArrowUp, ArrowDown, Minus,
  ListChecks, Clock, Crosshair, Layers, Rocket,
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

const verdictTypeConfig: Record<string, { bg: string; border: string; icon: string }> = {
  opportunity: { bg: "bg-green-500/8", border: "border-green-500/30", icon: "🟢" },
  monitor: { bg: "bg-amber-500/8", border: "border-amber-500/30", icon: "🟡" },
  threat: { bg: "bg-red-500/8", border: "border-red-500/30", icon: "🔴" },
};

const scoreBg = (score: number) => {
  if (score >= 8) return "bg-green-500";
  if (score >= 5) return "bg-amber-500";
  return "bg-red-500";
};

const directionIcon = (dir: string) => {
  if (dir === "weaker" || dir === "below_average" || dir === "weak") return <ArrowDown className="h-3 w-3 text-red-500" />;
  if (dir === "stronger" || dir === "above_average" || dir === "strong") return <ArrowUp className="h-3 w-3 text-green-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
};

export function CompetitorPostAnalysis({ analysis, onNavigateToCreate, postContent }: CompetitorPostAnalysisProps) {
  const [copied, setCopied] = useState(false);
  const a = analysis;
  if (!a || Object.keys(a).length === 0) return null;

  const verdictCard = a.verdict_card;
  const verdict = a.brutal_verdict;
  const impact = a.impact_panel;
  const weaknesses = a.exploitable_weaknesses;
  const strengths = a.strength_analysis;
  const marketFit = a.market_fit_analysis;
  const behavioral = a.behavioral_insight;
  const winningMove = a.winning_move;
  const execPlan = a.execution_plan;
  const outperform = a.outperform_version;
  const benchmark = a.competitive_benchmark;
  const priorities = a.priority_opportunities;
  const crossPost = a.cross_post_patterns;

  const copyOutperform = () => {
    if (outperform) {
      navigator.clipboard.writeText(outperform);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const vConfig = verdictTypeConfig[verdictCard?.verdict_type] || verdictTypeConfig.monitor;

  return (
    <div className="border-t border-border bg-muted/10 space-y-0">

      {/* ═══ 1. VERDICT CARD — Dominant ═══ */}
      {verdictCard ? (
        <div className={cn("border-b-2 px-4 py-4 space-y-2.5", vConfig.bg, vConfig.border)}>
          <div className="flex items-start gap-2">
            <span className="text-lg leading-none mt-0.5">{vConfig.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-base font-extrabold text-foreground tracking-tight leading-snug">
                {verdictCard.verdict_label || verdict}
              </p>
              {verdictCard.verdict_summary && (
                <p className="text-xs text-muted-foreground mt-0.5">→ {verdictCard.verdict_summary}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={cn("text-[10px] h-5 px-2 gap-1", threatColor(verdictCard.threat_level))}>
              📊 {verdictCard.threat_level} threat
            </Badge>
            <Badge variant="outline" className="text-[10px] h-5 px-2 gap-1 border-blue-500/30 text-blue-600 bg-blue-500/10">
              ⚡ {verdictCard.timing}
            </Badge>
            <Badge variant="outline" className="text-[10px] h-5 px-2 gap-1 border-purple-500/30 text-purple-600 bg-purple-500/10">
              🧠 {verdictCard.confidence} confidence
            </Badge>
          </div>
          {verdictCard.recommended_action && (
            <div className="bg-foreground/5 border border-border rounded-lg p-2">
              <p className="text-xs font-medium text-foreground">🎯 {verdictCard.recommended_action}</p>
            </div>
          )}
          {verdictCard.confidence_reason && (
            <p className="text-[11px] text-muted-foreground italic">🧠 {verdictCard.confidence_reason}</p>
          )}
        </div>
      ) : verdict && (
        <div className="bg-foreground/[0.03] border-b border-border px-4 py-3">
          <p className="text-sm font-bold text-foreground tracking-tight">{verdict}</p>
        </div>
      )}

      {/* ═══ 2. COMPETITOR IMPACT ═══ */}
      {impact && (
        <div className="sticky top-0 z-10 bg-card border-b border-border p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Competitor Impact</h3>
            <Badge className={cn("text-[9px] h-5 px-2 ml-auto", threatColor(impact.competitive_threat_level))}>
              {impact.competitive_threat_level} threat
            </Badge>
            {impact.threat_action && (
              <Badge variant="outline" className={cn("text-[9px] h-5 px-2",
                impact.threat_action === "must_respond" ? "border-red-500/40 text-red-600" :
                impact.threat_action === "learn" ? "border-amber-500/40 text-amber-600" :
                "border-green-500/40 text-green-600"
              )}>
                {impact.threat_action === "must_respond" ? "Must Respond" : impact.threat_action === "learn" ? "Learn From It" : "Safe to Ignore"}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            <ScoreCell label="Hook" value={`${impact.hook_strength}/10`} color={scoreBg(impact.hook_strength)} />
            <ScoreCell label="Engagement" value={impact.engagement_potential} level={impact.engagement_potential} />
            <ScoreCell label="Conversion" value={impact.conversion_intent_strength} level={impact.conversion_intent_strength} />
            <ScoreCell label="Market Fit" value={marketFit?.local_relevance_score || "—"} level={marketFit?.local_relevance_score} />
          </div>
          {impact.verdict && (
            <div className="bg-foreground/5 border border-border rounded-lg p-2.5">
              <p className="text-xs font-medium text-foreground">→ {impact.verdict}</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ 3. MARKET FIT TAGS ═══ */}
      {marketFit && (marketFit.bd_fit || marketFit.us_fit) && (
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">Market Fit</span>
          {marketFit.bd_fit && <FitTag flag="🇧🇩" label="BD" score={marketFit.bd_fit.score} />}
          {marketFit.us_fit && <FitTag flag="🇺🇸" label="US" score={marketFit.us_fit.score} />}
          {marketFit.market_gap_opportunity && (
            <p className="text-[11px] text-primary/80 w-full mt-1">💡 {marketFit.market_gap_opportunity}</p>
          )}
        </div>
      )}

      <div className="p-4 space-y-4">

        {/* ═══ 4. WHERE YOU CAN BEAT THEM ═══ */}
        {weaknesses && weaknesses.length > 0 && (
          <div className="rounded-xl border-2 border-red-500/20 bg-red-500/5 p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-red-500" />
              <h3 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Where You Can Beat Them</h3>
            </div>
            <div className="space-y-1">
              {weaknesses.slice(0, 4).map((w: any, i: number) => (
                <p key={i} className="text-xs text-foreground">
                  <span className="text-red-500 mr-1.5">❌</span>{w.weakness}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* ═══ 5. WHAT THEY DID RIGHT ═══ */}
        {strengths && strengths.why_it_works && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 space-y-2">
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
            {strengths.replicate_note && (
              <p className="text-[11px] text-green-700 dark:text-green-400 font-medium">💡 {strengths.replicate_note}</p>
            )}
          </div>
        )}

        {/* ═══ 6. BEHAVIORAL BREAKDOWN ═══ */}
        {behavioral && (
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              <h3 className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Why This Works / Fails</h3>
            </div>
            <div className="space-y-1">
              {behavioral.scroll_stop_power && <BehaviorLine label="Scroll Stop" value={behavioral.scroll_stop_power} />}
              {behavioral.engagement_trigger && <BehaviorLine label="Engagement" value={behavioral.engagement_trigger} />}
              {behavioral.attention_drop_point && <BehaviorLine label="Drop-off" value={behavioral.attention_drop_point} />}
            </div>
          </div>
        )}

        {/* ═══ 7. YOUR WINNING MOVE ═══ */}
        {winningMove && (
          <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-card to-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Your Winning Move</h3>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {winningMove.better_hook && <WinningMoveItem label="Better Hook" value={winningMove.better_hook} color="bg-green-500/10 border-green-500/20" labelColor="text-green-700 dark:text-green-400" />}
              {winningMove.better_angle && <WinningMoveItem label="Better Angle" value={winningMove.better_angle} color="bg-blue-500/10 border-blue-500/20" labelColor="text-blue-700 dark:text-blue-400" />}
              {winningMove.better_cta && <WinningMoveItem label="Better CTA" value={winningMove.better_cta} color="bg-amber-500/10 border-amber-500/20" labelColor="text-amber-700 dark:text-amber-400" />}
              {winningMove.strategic_advantage && <WinningMoveItem label="Strategic Advantage" value={winningMove.strategic_advantage} color="bg-primary/10 border-primary/20" labelColor="text-primary" />}
            </div>
          </div>
        )}

        {/* ═══ 8. OUTPERFORM THIS POST ═══ */}
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

        {/* ═══ 9. EXECUTION PLAN ═══ */}
        {execPlan && execPlan.steps && execPlan.steps.length > 0 && (
          <div className="rounded-xl border-2 border-green-500/25 bg-green-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-green-600" />
              <h3 className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">Execution Plan</h3>
            </div>
            <div className="space-y-1.5">
              {execPlan.steps.map((step: string, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                    i === 0 ? "border-green-500 bg-green-500/20" : "border-green-500/40"
                  )}>
                    <span className="text-[9px] font-bold text-green-700 dark:text-green-400">{i + 1}</span>
                  </div>
                  <p className={cn("text-xs", i === 0 ? "font-semibold text-foreground" : "text-muted-foreground")}>{step}</p>
                </div>
              ))}
            </div>
            {execPlan.timing_note && (
              <div className="flex items-center gap-1.5 pt-1 border-t border-green-500/20">
                <Clock className="h-3 w-3 text-green-600" />
                <p className="text-[11px] font-medium text-green-700 dark:text-green-400">{execPlan.timing_note}</p>
              </div>
            )}
            {onNavigateToCreate && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="h-7 text-xs" onClick={() => onNavigateToCreate({
                  title: "Post from competitor execution plan",
                  auto_generate: true,
                })}>
                  <Rocket className="h-3 w-3 mr-1" /> Create Post from This
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ═══ Fallback: old what_to_do_now ═══ */}
        {!execPlan?.steps && a.what_to_do_now && a.what_to_do_now.length > 0 && (
          <div className="rounded-xl border-2 border-green-500/25 bg-green-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-green-600" />
              <h3 className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">What To Do Now</h3>
            </div>
            <div className="space-y-1.5">
              {a.what_to_do_now.slice(0, 3).map((action: string, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                    i === 0 ? "border-green-500 bg-green-500/20" : "border-green-500/40"
                  )}>
                    <span className="text-[9px] font-bold text-green-700 dark:text-green-400">{i + 1}</span>
                  </div>
                  <p className={cn("text-xs", i === 0 ? "font-semibold text-foreground" : "text-muted-foreground")}>{action}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ 10. CROSS-POST INTELLIGENCE ═══ */}
        {crossPost && crossPost.patterns_detected && crossPost.patterns_detected.length > 0 && (
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-500" />
              <h3 className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Cross-Post Intelligence</h3>
            </div>
            <div className="space-y-1">
              {crossPost.patterns_detected.map((p: string, i: number) => (
                <p key={i} className="text-xs text-foreground"><span className="text-indigo-500 mr-1.5">🔍</span>{p}</p>
              ))}
            </div>
            {crossPost.strategic_opportunity && (
              <p className="text-[11px] text-indigo-700 dark:text-indigo-400 font-medium">🎯 {crossPost.strategic_opportunity}</p>
            )}
            {crossPost.recommendation && (
              <p className="text-[11px] text-muted-foreground italic">→ {crossPost.recommendation}</p>
            )}
          </div>
        )}

        {/* ═══ 11. PRIORITY OPPORTUNITIES ═══ */}
        {priorities && priorities.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-amber-600" />
              <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Priority Opportunities</h3>
            </div>
            <div className="space-y-1.5">
              {priorities.slice(0, 3).map((p: any, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5 mt-0.5 shrink-0",
                    p.impact === "high" ? "border-green-500/40 text-green-600 bg-green-500/10" :
                    p.impact === "medium" ? "border-amber-500/40 text-amber-600 bg-amber-500/10" :
                    "border-muted-foreground/40 text-muted-foreground"
                  )}>
                    {p.impact}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{p.label}</p>
                    <p className="text-[11px] text-muted-foreground">{p.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ 12. COMPETITIVE BENCHMARK ═══ */}
        {benchmark && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Competitive Benchmark</h3>
            </div>
            {benchmark.hook && benchmark.hook.competitor ? (
              <div className="space-y-2">
                <BenchmarkRow label="Hook Strength" competitor={benchmark.hook.competitor} standard={benchmark.hook.top_performers} opportunity={benchmark.hook.opportunity} direction={benchmark.hook.direction} />
                {benchmark.engagement && <BenchmarkRow label="Engagement" competitor={benchmark.engagement.competitor} standard={benchmark.engagement.industry_standard} opportunity={benchmark.engagement.your_expected} direction={benchmark.engagement.direction} />}
                {benchmark.cta && <BenchmarkRow label="CTA" competitor={benchmark.cta.competitor} standard={benchmark.cta.best_practice} direction={benchmark.cta.direction} />}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {benchmark.hook_vs_standard && <BenchmarkItem label="Hook" value={benchmark.hook_vs_standard} direction={benchmark.hook_direction} />}
                {benchmark.engagement_vs_top && <BenchmarkItem label="Engagement" value={benchmark.engagement_vs_top} direction={benchmark.engagement_direction} />}
                {benchmark.cta_vs_best_practice && <BenchmarkItem label="CTA" value={benchmark.cta_vs_best_practice} direction={benchmark.cta_direction} />}
              </div>
            )}
          </div>
        )}

        {/* ═══ 13. DEEP ANALYSIS — Collapsed ═══ */}
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
            {marketFit && (marketFit.bd_fit || marketFit.us_fit) && (
              <DetailSection icon={<Globe className="h-3.5 w-3.5 text-blue-500" />} title="Market Fit Detail">
                {marketFit.bd_fit && <p className="text-xs text-muted-foreground">🇧🇩 <strong>BD:</strong> {marketFit.bd_fit.assessment}</p>}
                {marketFit.us_fit && <p className="text-xs text-muted-foreground">🇺🇸 <strong>US:</strong> {marketFit.us_fit.assessment}</p>}
              </DetailSection>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

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

function FitTag({ flag, label, score }: { flag: string; label: string; score: string }) {
  const color = score === "high" ? "border-green-500/40 text-green-600 bg-green-500/10" :
    score === "medium" ? "border-amber-500/40 text-amber-600 bg-amber-500/10" :
    "border-red-500/40 text-red-500 bg-red-500/10";
  return (
    <Badge variant="outline" className={cn("text-[10px] h-5 px-2 gap-1", color)}>
      {flag} {label}: {score}
    </Badge>
  );
}

function BehaviorLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-xs text-foreground/80">
      <span className="font-semibold text-purple-600 dark:text-purple-400">{label}:</span>{" "}{value}
    </p>
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

function BenchmarkRow({ label, competitor, standard, opportunity, direction }: { label: string; competitor: string; standard: string; opportunity?: string; direction?: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-2.5 space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">{label}</p>
        {direction && directionIcon(direction)}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div><span className="text-muted-foreground">Competitor:</span> <span className="font-medium text-foreground">{competitor}</span></div>
        <div><span className="text-muted-foreground">Standard:</span> <span className="font-medium text-foreground">{standard}</span></div>
        {opportunity && <div><span className="text-muted-foreground">You:</span> <span className="font-medium text-green-600">{opportunity}</span></div>}
      </div>
    </div>
  );
}

function BenchmarkItem({ label, value, direction }: { label: string; value: string; direction?: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-2 space-y-0.5">
      <div className="flex items-center justify-between">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
        {direction && directionIcon(direction)}
      </div>
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
