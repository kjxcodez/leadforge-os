/**
 * Lead Intelligence Trust Engine — Automated Regression Tests
 */

import { describe, it, expect } from 'vitest';
import {
  CompanyAnalyzer,
  WebsiteAnalyzer,
  ContactAnalyzer,
  ScoringEngine,
  LeadPrioritizer,
  AIInsightGenerator
} from '../services/intelligence-engine';

describe('Lead Intelligence Trust Engine Suite', () => {
  describe('Section 1: Zero Fake Defaults & Honest State', () => {
    it('returns zero defaults and 0% ground score when company has no evidence', () => {
      const emptyCompany = {
        id: 'c-empty-001',
        name: 'Blank Enterprise',
        industry: '',
        website: ''
      };

      const res = CompanyAnalyzer.analyze(emptyCompany, []);
      const intel = res.companyIntelligence;

      expect(intel.techStack.length).toBe(0);
      expect(intel.estimatedRevenue).toBe('Unknown');
      expect(intel.businessModel).toBe('Unknown');

      const emptyScore = ScoringEngine.calculate(emptyCompany, intel, null, []);
      expect(emptyScore.overallScore).toBe(0);
    });
  });

  describe('Section 2: Deterministic Evidence & Claim Model', () => {
    it('extracts technologies, verified claims, and buying signals deterministically from HTML', () => {
      const company = {
        id: 'c-web-101',
        name: 'SaaSify Inc',
        industry: 'Software',
        website: 'https://saasify.io',
        phone: '+1-800-555-0199'
      };

      const html = `
        <html>
          <head>
            <title>SaaSify — NextGen Automation</title>
            <script src="https://www.googletagmanager.com/gtag/js?id=UA-12345"></script>
            <link rel="stylesheet" href="https://cdn.tailwindcss.com">
          </head>
          <body>
            <h1>Pricing & Demo</h1>
            <a href="/pricing">View Pricing</a>
            <a href="/trial">Start Free Trial</a>
          </body>
        </html>
      `;

      const compRes = CompanyAnalyzer.analyze(company, [], html);
      const webRes = WebsiteAnalyzer.analyze(company.id, html, company.website);

      expect(compRes.companyIntelligence.techStack).toContain('Google Analytics');
      expect(compRes.companyIntelligence.techStack).toContain('TailwindCSS');
      expect(compRes.claims.length).toBeGreaterThan(0);
      expect(compRes.claims[0]!.verificationStatus).toBe('VERIFIED');
      expect(compRes.companyIntelligence.businessModel).toBe('B2B');
      expect(compRes.inferences.length).toBeGreaterThan(0);
      expect(compRes.inferences[0]!.inferenceMethod).toBe('RULE_HEURISTIC');
      expect(webRes.websiteIntelligence.buyingSignals.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Section 3: Score Provenance & Missing-Data Safety', () => {
    it('produces explainable score with explicit provenance additions', () => {
      const company = {
        id: 'c-score-202',
        name: 'GrowthCorp',
        industry: 'Marketing',
        website: 'https://growthcorp.com',
        location: 'Chicago, IL',
        phone: '+1-312-555-0100'
      };

      const compIntel: any = {
        companyId: company.id,
        techStack: ['HubSpot', 'Google Analytics'],
        businessModel: 'B2B',
        growthSignals: ['Modern stack adoption']
      };

      const webIntel: any = {
        companyId: company.id,
        buyingSignals: ['Active Sales CTA detected'],
        technicalIssues: ['Unsecure HTTP website (No SSL certificate)'],
        testimonialsCaseStudies: ['Client success section found']
      };

      const contacts: any[] = [
        {
          contactId: 'ct-1',
          decisionMakerScore: 1.0,
          seniority: 'Executive',
          buyingInfluence: 'Decision Maker',
          personalizationOpportunities: ['LinkedIn'],
          relationshipStrength: 0.1
        }
      ];

      const score = ScoringEngine.calculate(company, compIntel, webIntel, contacts);

      expect(score.overallScore).toBeGreaterThan(0);
      expect(score.overallScore).toBeLessThanOrEqual(100);
      expect(score.provenance && score.provenance.length > 0).toBe(true);

      const industryProv = score.provenance?.find((p) => p.factor === 'High Fit Industry');
      expect(industryProv).toBeDefined();
      expect(industryProv!.points).toBe(40);
      expect(score.explanation).toContain('+40: High Fit Industry');
    });
  });

  describe('Section 4: ContactAnalyzer & Queue Prioritization', () => {
    it('analyzes contact seniority and assigns queues accurately', () => {
      const ceoResult = ContactAnalyzer.analyze({ id: 'cnt-1', title: 'Chief Executive Officer' });
      expect(ceoResult.decisionMakerScore).toBe(1.0);
      expect(ceoResult.seniority).toBe('Executive');

      const unknownContact = ContactAnalyzer.analyze({ id: 'cnt-2', title: '' });
      expect(unknownContact.decisionMakerScore).toBe(0.0);
      expect(unknownContact.seniority).toBe('Unknown');

      expect(LeadPrioritizer.getQueue(85)).toBe('Hot');
      expect(LeadPrioritizer.getQueue(50)).toBe('Warm');
      expect(LeadPrioritizer.getQueue(0)).toBe('Cold');
    });
  });

  describe('Section 5: AIInsightGenerator Fallback', () => {
    it('generates non-fabricated insight hooks', async () => {
      const result = await AIInsightGenerator.generate(
        'TechCorp',
        'Software',
        ['React'],
        ['Unsecure HTTP website']
      );

      expect(result.openingLine.length).toBeGreaterThan(10);
      expect(result.painPoint.length).toBeGreaterThan(5);
      expect(result.outreachAngle.length).toBeGreaterThan(5);
    });
  });
});
