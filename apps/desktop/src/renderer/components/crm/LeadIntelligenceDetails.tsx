import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { Button } from '../ui/button';
import {
  Sparkles,
  Cpu,
  Layers,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  Flame,
  Activity,
  ShieldCheck,
  HelpCircle,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Badge } from '../ui/badge';

interface LeadIntelligenceDetailsProps {
  companyId: string;
}

export default function LeadIntelligenceDetails({ companyId }: LeadIntelligenceDetailsProps) {
  const { activeWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [intel, setIntel] = useState<any>(null);
  const [showProvenanceDetails, setShowProvenanceDetails] = useState(false);

  const fetchIntel = async () => {
    if (!activeWorkspace?.id || !companyId) return;
    setLoading(true);
    try {
      const res = await window.ipc.invoke('intelligence:get', {
        workspaceId: activeWorkspace.id,
        companyId
      });
      setIntel(res);
    } catch (err) {
      console.error('Failed to load lead intelligence:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntel();
  }, [companyId, activeWorkspace?.id]);

  const handleEnrich = async () => {
    if (!activeWorkspace?.id || !companyId) return;
    setEnriching(true);
    try {
      const res = await window.ipc.invoke('intelligence:trigger', {
        workspaceId: activeWorkspace.id,
        companyId
      });
      if (res.success) {
        alert('Enrichment job successfully queued. Please monitor progress in the Queue Monitor.');
        setTimeout(fetchIntel, 3000);
      }
    } catch (err: any) {
      alert(`Enrichment failed: ${err.message || err}`);
    } finally {
      setEnriching(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-xs text-muted-foreground animate-pulse font-sans select-none">
        Analyzing lead intelligence trust data...
      </div>
    );
  }

  if (!intel || !intel.opportunityScore) {
    return (
      <div className="bg-card border border-border-subtle rounded-none p-5 space-y-4 text-center font-sans select-none">
        <Cpu className="w-8 h-8 text-muted-foreground/60 mx-auto animate-bounce" />
        <div>
          <h3 className="text-xs font-bold text-foreground">No Intelligence Profile</h3>
          <p className="text-[10px] text-muted-foreground mt-1 max-w-xs mx-auto">
            Extract verified technical signals, buying intent, decision-maker hierarchy, and score provenance for this lead.
          </p>
        </div>
        <Button size="sm" onClick={handleEnrich} disabled={enriching} className="w-full rounded-none">
          {enriching ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 mr-1 text-primary-foreground" />
          )}
          Enrich Lead Profile
        </Button>
      </div>
    );
  }

  const score = intel.opportunityScore;
  const comp = intel.companyIntelligence;
  const web = intel.websiteIntelligence;
  const inferences: any[] = intel.inferences || [];
  const claims: any[] = intel.claims || [];
  const sources: any[] = intel.sources || [];
  const provenance: any[] = score?.provenance || [];

  const bmInference = inferences.find((inf) => inf.field === 'businessModel');

  const scoreColor =
    score.overallScore >= 75
      ? 'text-danger bg-danger-muted border-danger/20'
      : score.overallScore >= 45
      ? 'text-warning bg-warning-muted border-warning/20'
      : 'text-muted-foreground bg-surface-3 border-border-subtle';

  const scoreBadge =
    score.overallScore >= 75 ? 'Hot Lead' : score.overallScore >= 45 ? 'Warm Lead' : 'Cold / Unscored';

  return (
    <div className="space-y-6 font-sans select-none">
      {/* ── Opportunity Score Header & Provenance ───────────────────────── */}
      <div className="bg-card border border-border-subtle rounded-none p-5 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold border ${scoreColor}`}>
                {scoreBadge}
              </span>
              {score.overallScore >= 75 && (
                <Flame className="w-4 h-4 text-danger animate-pulse" />
              )}
            </div>
            <h2 className="text-xl font-bold text-foreground font-mono">
              {score.overallScore}% Grounded Score
            </h2>
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={handleEnrich}
            disabled={enriching}
            className="h-8 w-8 rounded-none"
          >
            {enriching ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </Button>
        </div>

        {/* Breakdown bar */}
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <div className="bg-surface-3 rounded-none p-2 border border-border-subtle/50">
            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">
              Fit
            </span>
            <span className="text-xs font-bold text-foreground mt-0.5 block font-mono">
              {score.fitScore}%
            </span>
          </div>
          <div className="bg-surface-3 rounded-none p-2 border border-border-subtle/50">
            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">
              Size
            </span>
            <span className="text-xs font-bold text-foreground mt-0.5 block font-mono">
              {score.sizeScore}%
            </span>
          </div>
          <div className="bg-surface-3 rounded-none p-2 border border-border-subtle/50">
            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">
              Intent
            </span>
            <span className="text-xs font-bold text-foreground mt-0.5 block font-mono">
              {score.intentScore}%
            </span>
          </div>
          <div className="bg-surface-3 rounded-none p-2 border border-border-subtle/50">
            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">
              Urgency
            </span>
            <span className="text-xs font-bold text-foreground mt-0.5 block font-mono">
              {score.urgencyScore}%
            </span>
          </div>
        </div>

        {/* Score Provenance Accordion */}
        <div className="mt-4 border-t border-border-subtle/50 pt-3">
          <button
            onClick={() => setShowProvenanceDetails(!showProvenanceDetails)}
            className="w-full flex items-center justify-between text-[10px] uppercase font-extrabold text-muted-foreground hover:text-foreground tracking-wider"
          >
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-primary" />
              <span>Score Provenance & Explanations</span>
            </div>
            {showProvenanceDetails ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showProvenanceDetails && (
            <div className="mt-3 space-y-2 bg-surface-3 border border-border-subtle rounded-none p-3 text-[11px] font-mono leading-relaxed">
              {provenance.length > 0 ? (
                provenance.map((p: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 border-b border-border-subtle/30 pb-1.5 last:border-0 last:pb-0">
                    <span className="text-success font-bold shrink-0">+{p.points}</span>
                    <div>
                      <span className="font-bold text-foreground">{p.factor}</span>
                      <span className="text-muted-foreground block text-[10px] font-sans">{p.reason}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground text-[10px] font-sans italic">
                  No verified evidence signals detected. Score remains 0%.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Company Profiler (Trust-Aware) ──────────────────────────────── */}
      <div className="bg-card border border-border-subtle rounded-none p-5 space-y-4">
        <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
          <Layers className="w-3.5 h-3.5 text-info" />
          <span>Trust Specifications</span>
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {/* Estimated Revenue */}
          <div className="space-y-1 bg-surface-3 p-3 border border-border-subtle/50">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">
                Est. Revenue
              </span>
              <span className="px-1.5 py-0.5 rounded-none bg-muted/40 text-muted-foreground text-[9px] font-bold border border-border-subtle flex items-center gap-1">
                <HelpCircle className="w-2.5 h-2.5" />
                UNKNOWN
              </span>
            </div>
            <p className="text-xs font-semibold text-muted-foreground font-mono mt-1">
              {comp?.estimatedRevenue && comp.estimatedRevenue !== 'Unknown'
                ? comp.estimatedRevenue
                : 'Unknown — No reliable evidence found'}
            </p>
          </div>

          {/* Business Model */}
          <div className="space-y-1 bg-surface-3 p-3 border border-border-subtle/50">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">
                Business Model
              </span>
              {comp?.businessModel !== 'Unknown' ? (
                <span className="px-1.5 py-0.5 rounded-none bg-warning/10 text-warning border border-warning/30 text-[9px] font-bold flex items-center gap-1">
                  <Info className="w-2.5 h-2.5" />
                  INFERRED {bmInference?.confidence ? `· ${Math.round(bmInference.confidence * 100)}%` : ''}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded-none bg-muted/40 text-muted-foreground text-[9px] font-bold border border-border-subtle flex items-center gap-1">
                  <HelpCircle className="w-2.5 h-2.5" />
                  UNKNOWN
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-foreground mt-1">
              {comp?.businessModel || 'Unknown'}
            </p>
            {bmInference && (
              <p className="text-[9px] text-muted-foreground leading-tight mt-1">
                Reason: {bmInference.reason}
              </p>
            )}
          </div>
        </div>

        {/* Technologies Detected (Verified Evidence) */}
        <div className="space-y-2 pt-2 border-t border-border-subtle/40">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">
              Technologies Detected
            </span>
            {comp?.techStack && comp.techStack.length > 0 ? (
              <span className="px-1.5 py-0.5 rounded-none bg-success/10 text-success border border-success/30 text-[9px] font-bold flex items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5" />
                VERIFIED ({comp.techStack.length})
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded-none bg-muted/40 text-muted-foreground text-[9px] font-bold border border-border-subtle flex items-center gap-1">
                <HelpCircle className="w-2.5 h-2.5" />
                UNKNOWN
              </span>
            )}
          </div>

          {comp?.techStack && comp.techStack.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {comp.techStack.map((tech: string, i: number) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-none bg-surface-3 border border-success/30 text-[10px] font-medium text-foreground flex items-center gap-1"
                >
                  <CheckCircle2 className="w-2.5 h-2.5 text-success" />
                  {tech}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground italic bg-surface-3 p-2 border border-border-subtle/40">
              No technology footprints detected in company source inspection.
            </div>
          )}
        </div>

        {/* Missing Information */}
        {comp?.missingInformation && comp.missingInformation.length > 0 && (
          <div className="bg-warning-muted border border-warning/20 rounded-none p-3 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
            <div className="text-[10px] text-warning/90 leading-relaxed font-medium">
              <span className="font-bold text-warning">Missing Information</span>:{' '}
              {comp.missingInformation.join(', ')}
            </div>
          </div>
        )}
      </div>

      {/* ── Testimonials & Case Studies (Social Proof) ────────────────────── */}
      {web && (web.buyingSignals?.length > 0 || web.testimonialsCaseStudies?.length > 0) && (
        <div className="bg-card border border-border-subtle rounded-none p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
              <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              <span>Social Proof & Buying Intent</span>
            </h3>
            <span className="px-1.5 py-0.5 rounded-none bg-success/10 text-success border border-success/30 text-[9px] font-bold flex items-center gap-1">
              <ShieldCheck className="w-2.5 h-2.5" />
              VERIFIED
            </span>
          </div>

          <div className="space-y-3">
            {web.buyingSignals?.length > 0 && (
              <div className="space-y-1">
                <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">
                  Detected Buying Signals
                </span>
                <div className="flex flex-col gap-1 mt-1">
                  {web.buyingSignals.map((sig: string, i: number) => (
                    <div
                      key={i}
                      className="text-[11px] text-foreground/80 font-medium flex items-center gap-1.5"
                    >
                      <TrendingUp className="w-3 h-3 text-success" />
                      <span>{sig}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {web.testimonialsCaseStudies?.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-border-subtle/30">
                <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">
                  Case Studies & Social Proof
                </span>
                <div className="text-[11px] text-muted-foreground italic mt-1">
                  {web.testimonialsCaseStudies.join(', ')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
