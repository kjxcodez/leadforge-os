import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Sparkles, HelpCircle, X, ChevronRight, ChevronLeft } from 'lucide-react';

interface TourStep {
  targetId: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'nav-discovery',
    title: 'Lead Discovery',
    description:
      'Scrape companies directly from Google Maps and crawl their sites to find contact emails.',
    position: 'right'
  },
  {
    targetId: 'nav-companies',
    title: 'Local CRM',
    description: 'Manage discovered companies and view their AI-derived fit scores and summaries.',
    position: 'right'
  },
  {
    targetId: 'nav-campaigns',
    title: 'Outreach Campaigns',
    description:
      'Define email sequences, connect SMTP accounts, and enroll leads into active automated campaigns.',
    position: 'right'
  },
  {
    targetId: 'nav-queue',
    title: 'Background Queue Monitor',
    description:
      'Trace background crawlers, enrichment status, pings, and thread concurrency levels.',
    position: 'right'
  },
  {
    targetId: 'nav-settings',
    title: 'Workspace Settings',
    description: 'Reconfigure SMTP, OpenRouter keys, check updates, or replay this guide anytime.',
    position: 'top'
  }
];

export default function ProductTour() {
  const [active, setActive] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    const isTourActive = localStorage.getItem('product_tour_active') === 'true';
    if (isTourActive) {
      setActive(true);
      setCurrentStep(0);
    }
  }, []);

  const current = TOUR_STEPS[currentStep];

  useEffect(() => {
    if (!active || !current) return;

    // Helper to calculate target coordinate highlights
    const locateElement = () => {
      const el = document.getElementById(current.targetId);
      if (el) {
        const rect = el.getBoundingClientRect();
        let top = rect.top;
        let left = rect.left;

        if (current.position === 'right') {
          left = rect.right + 12;
          top = rect.top + rect.height / 2 - 80;
        } else if (current.position === 'top') {
          top = rect.top - 170;
          left = rect.left + rect.width / 2 - 120;
        } else if (current.position === 'bottom') {
          top = rect.bottom + 12;
          left = rect.left + rect.width / 2 - 120;
        }

        setCoords({ top: Math.max(20, top), left: Math.max(20, left) });
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add(
          'ring-2',
          'ring-accent',
          'ring-offset-2',
          'ring-offset-background',
          'transition-all'
        );
      }
    };

    // Delay slightly to allow layout calculations
    const timeout = setTimeout(locateElement, 150);

    return () => {
      clearTimeout(timeout);
      const el = document.getElementById(current.targetId);
      if (el) {
        el.classList.remove('ring-2', 'ring-accent', 'ring-offset-2', 'ring-offset-background');
      }
    };
  }, [currentStep, active]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleClose = () => {
    setActive(false);
    localStorage.removeItem('product_tour_active');
  };

  if (!active || !current) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none select-none font-sans">
      {/* Background shadow layer */}
      <div
        className="absolute inset-0 bg-background/25 pointer-events-auto"
        onClick={handleClose}
      ></div>

      {/* Tour Card */}
      <div
        className="absolute w-64 bg-card/95 backdrop-blur-md border border-accent/25 rounded-xl p-4.5 shadow-2xl space-y-3.5 pointer-events-auto transition-all duration-300 animate-in zoom-in-95"
        style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase font-bold text-accent tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>
              Interactive Tour ({currentStep + 1}/{TOUR_STEPS.length})
            </span>
          </span>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1">
          <h3 className="text-xs font-bold text-foreground">{current.title}</h3>
          <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">
            {current.description}
          </p>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border-subtle/50">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 rounded"
            disabled={currentStep === 0}
            onClick={handleBack}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            className="h-6.5 text-[10px] font-bold px-3 rounded"
            onClick={handleNext}
          >
            {currentStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}{' '}
            <ChevronRight className="w-3 h-3 ml-0.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
