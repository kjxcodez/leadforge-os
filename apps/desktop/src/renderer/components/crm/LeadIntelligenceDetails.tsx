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
  Coins, 
  Search,
  Activity,
  Bookmark
} from 'lucide-react';

interface LeadIntelligenceDetailsProps {
  companyId: string;
}

export default function LeadIntelligenceDetails({ companyId }: LeadIntelligenceDetailsProps) {
  const { activeWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [intel, setIntel] = useState<any>(null);

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
        // Wait and refresh
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
      <div className="p-6 text-center text-xs text-muted-foreground animate-pulse">
        Analyzing lead intelligence data...
      </div>
    );
  }

  if (!intel || !intel.opportunityScore) {
    return (
      <div className="bg-card border border-border-subtle rounded-xl p-5 space-y-4 text-center font-sans">
        <Cpu className="w-8 h-8 text-muted-foreground/60 mx-auto animate-bounce" />
        <div>
          <h3 className="text-xs font-bold text-foreground">No Intelligence Profile</h3>
          <p className="text-[10px] text-muted-foreground mt-1 max-w-xs mx-auto">
            Extract technical signals, buying intent, decision-maker hierarchy, and AI opening lines for this lead.
          </p>
        </div>
        <Button size="sm" onClick={handleEnrich} disabled={enriching} className="w-full">
          {enriching ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1 text-accent" />}
          Enrich Lead Profile
        </Button>
      </div>
    );
  }

  const score = intel.opportunityScore;
  const comp = intel.companyIntelligence;
  const web = intel.websiteIntelligence;
  const contacts = intel.contactIntelligences;

  const scoreColor = score.overallScore >= 75 
    ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' 
    : score.overallScore >= 45 
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' 
      : 'text-blue-400 bg-blue-500/10 border-blue-500/20';

  const scoreBadge = score.overallScore >= 75 ? 'Hot Lead' : score.overallScore >= 45 ? 'Warm Lead' : 'Cold Lead';

  return (
    <div className="space-y-6 font-sans select-none">
      {/* ── Opportunity Score Header ────────────────────────────────────── */}
      <div className="bg-card border border-border-subtle rounded-xl p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full filter blur-xl"></div>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${scoreColor}`}>
                {scoreBadge}
              </span>
              {score.overallScore >= 75 && <Flame className="w-4 h-4 text-rose-500 animate-pulse" />}
            </div>
            <h2 className="text-xl font-bold text-foreground">{score.overallScore}% Overall Score</h2>
          </div>
          <Button size="icon" variant="outline" onClick={handleEnrich} disabled={enriching} className="h-8 w-8 rounded-lg">
            {enriching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />}
          </Button>
        </div>

        {/* Breakdown bar */}
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <div className="bg-sunken/40 rounded-lg p-2 border border-border-subtle/50">
            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Fit</span>
            <span className="text-xs font-bold text-foreground mt-0.5 block">{score.fitScore}%</span>
          </div>
          <div className="bg-sunken/40 rounded-lg p-2 border border-border-subtle/50">
            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Size</span>
            <span className="text-xs font-bold text-foreground mt-0.5 block">{score.sizeScore}%</span>
          </div>
          <div className="bg-sunken/40 rounded-lg p-2 border border-border-subtle/50">
            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Intent</span>
            <span className="text-xs font-bold text-foreground mt-0.5 block">{score.intentScore}%</span>
          </div>
          <div className="bg-sunken/40 rounded-lg p-2 border border-border-subtle/50">
            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Urgency</span>
            <span className="text-xs font-bold text-foreground mt-0.5 block">{score.urgencyScore}%</span>
          </div>
        </div>

        {/* Explainable Why Log */}
        {score.explanation && (
          <div className="mt-4 bg-sunken/55 border border-border/40 rounded-lg p-3 space-y-1.5">
            <div className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider flex items-center gap-1">
              <Activity className="w-3 h-3 text-accent" />
              <span>Score Explanations</span>
            </div>
            <div className="text-[11px] text-foreground opacity-90 font-medium whitespace-pre-line leading-relaxed">
              {score.explanation}
            </div>
          </div>
        )}
      </div>

      {/* ── AI personalized Insights ────────────────────────────────────── */}
      <div className="bg-card border border-border-subtle rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span>AI Lead Intelligence</span>
        </h3>

        {comp?.summary && (
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Company Summary</span>
            <p className="text-xs text-foreground/90 leading-relaxed font-medium">{comp.summary}</p>
          </div>
        )}

        {/* Opening line */}
        <div className="space-y-2 pt-1 border-t border-border-subtle/40">
          <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Custom Outreach Angle</span>
          <div className="bg-sunken/50 border border-accent/15 rounded-lg p-3 text-[11px] italic text-foreground leading-relaxed">
            "Saw that you guys are building out your digital infrastructure..."
          </div>
        </div>
      </div>

      {/* ── Company Profiler (Tech Stack, Revenue, Signals) ────────────────── */}
      <div className="bg-card border border-border-subtle rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span>Profile Specifications</span>
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Est. Revenue</span>
            <p className="text-xs font-semibold text-foreground">{comp?.estimatedRevenue || 'Unknown'}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Business Model</span>
            <p className="text-xs font-semibold text-foreground">{comp?.businessModel || 'B2B'}</p>
          </div>
        </div>

        {/* Tech stack */}
        {comp?.techStack && comp.techStack.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-border-subtle/40">
            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Technologies Detected</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {comp.techStack.map((tech: string, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-sunken border border-border/60 text-[10px] font-medium text-foreground">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Missing information */}
        {comp?.missingInformation && comp.missingInformation.length > 0 && (
          <div className="bg-amber-500/[0.03] border border-amber-500/10 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-[10px] text-amber-400/90 leading-relaxed font-medium">
              <span className="font-bold text-amber-400">Missing Information</span>: {comp.missingInformation.join(', ')}
            </div>
          </div>
        )}
      </div>

      {/* ── Testimonials & Case Studies (Social Proof) ────────────────────── */}
      {web && (web.buyingSignals?.length > 0 || web.testimonialsCaseStudies?.length > 0) && (
        <div className="bg-card border border-border-subtle rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Social Proof & Buying Intent</span>
          </h3>

          <div className="space-y-3">
            {web.buyingSignals?.length > 0 && (
              <div className="space-y-1">
                <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Detected Buying Signals</span>
                <div className="flex flex-col gap-1 mt-1">
                  {web.buyingSignals.map((sig: string, i: number) => (
                    <div key={i} className="text-[11px] text-foreground/80 font-medium flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                      <span>{sig}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {web.testimonialsCaseStudies?.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-border-subtle/30">
                <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Case Studies & Social Proof</span>
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
