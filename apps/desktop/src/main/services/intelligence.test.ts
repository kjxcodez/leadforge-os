/**
 * Lead Intelligence Trust Engine — Automated Regression Tests
 *
 * Verification covers Phase 10D requirements:
 * 1. Zero hardcoded fake defaults (No 'Google Analytics', 'B2B', or '$1M-$5M' without evidence).
 * 2. Deterministic HTML extraction producing Evidence & Claims.
 * 3. Labeled Inferences with method and confidence.
 * 4. Grounded scoring starting at 0% baseline with explainable provenance.
 * 5. LeadPrioritizer queue assignments.
 */

import assert from 'assert';
import {
  CompanyAnalyzer,
  WebsiteAnalyzer,
  ContactAnalyzer,
  ScoringEngine,
  LeadPrioritizer,
  AIInsightGenerator
} from '../services/intelligence-engine';

const pass = (msg: string) => console.log(`  ✅ ${msg}`);
const fail = (msg: string, err?: any) => {
  console.error(`  ❌ ${msg}`, err || '');
  process.exitCode = 1;
};

// ── Section 1: Zero Fake Defaults & Honest State ─────────────────────────────
console.log('\n── Section 1: Zero Fake Defaults & Honest State ──');
{
  const emptyCompany = {
    id: 'c-empty-001',
    name: 'Blank Enterprise',
    industry: '',
    website: ''
  };

  const res = CompanyAnalyzer.analyze(emptyCompany, []);
  const intel = res.companyIntelligence;

  // 1. Tech stack must be empty when no HTML is analyzed
  assert.strictEqual(
    intel.techStack.length,
    0,
    'Tech stack MUST be empty when no HTML is analyzed (No fake Google Analytics)'
  );
  pass('Zero hardcoded Google Analytics default verified');

  // 2. Revenue must be Unknown
  assert.strictEqual(
    intel.estimatedRevenue,
    'Unknown',
    'Estimated revenue MUST be Unknown when no evidence exists'
  );
  pass('Zero hardcoded $1M-$5M revenue default verified');

  // 3. Business model must be Unknown without industry/evidence
  assert.strictEqual(
    intel.businessModel,
    'Unknown',
    'Business model MUST be Unknown when no evidence or industry exists'
  );
  pass('Zero hardcoded B2B business model default verified');

  // 4. Grounded score for empty company MUST be 0%
  const emptyScore = ScoringEngine.calculate(emptyCompany, intel, null, []);
  assert.strictEqual(
    emptyScore.overallScore,
    0,
    'Empty company with no evidence MUST score 0% (No ungrounded 46% base score)'
  );
  pass('Ground baseline score = 0% verified for un-analyzed companies');
}

// ── Section 2: Deterministic Evidence & Claim Model ────────────────────────
console.log('\n── Section 2: Deterministic Evidence & Claim Model ──');
{
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

  // Verified tech stack evidence
  assert.ok(
    compRes.companyIntelligence.techStack.includes('Google Analytics'),
    'Google Analytics should be extracted from gtag.js script tag'
  );
  assert.ok(
    compRes.companyIntelligence.techStack.includes('TailwindCSS'),
    'TailwindCSS should be extracted from tailwind link'
  );
  pass('Deterministic HTML technology extraction verified');

  // Verified claims
  assert.ok(compRes.claims.length > 0, 'Company claims list should not be empty');
  assert.strictEqual(compRes.claims[0]!.verificationStatus, 'VERIFIED');
  pass('Verified claims correctly created and linked');

  // Inferred business model from industry
  assert.strictEqual(compRes.companyIntelligence.businessModel, 'B2B');
  assert.ok(compRes.inferences.length > 0, 'Inferences array should contain B2B rule');
  assert.strictEqual(compRes.inferences[0]!.inferenceMethod, 'RULE_HEURISTIC');
  pass('Inferred business model correctly labeled with RULE_HEURISTIC method');

  // Website buying signals
  assert.ok(webRes.websiteIntelligence.buyingSignals.length >= 2);
  pass('Website buying intent signals extracted from HTML text');
}

// ── Section 3: Score Provenance & Missing-Data Safety ────────────────────────
console.log('\n── Section 3: Score Provenance & Missing-Data Safety ──');
{
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

  assert.ok(score.overallScore > 0 && score.overallScore <= 100);
  assert.ok(score.provenance && score.provenance.length > 0, 'Score MUST include detailed provenance items');

  const industryProv = score.provenance.find((p) => p.factor === 'High Fit Industry');
  assert.ok(industryProv, 'Provenance MUST reference industry fit factor');
  assert.strictEqual(industryProv!.points, 40);
  pass('Score component provenance verified');

  assert.ok(score.explanation.includes('+40: High Fit Industry'));
  pass('Formatted score explanation string contains explicit provenance additions');
}

// ── Section 4: ContactAnalyzer & Queue Prioritization ──────────────────────
console.log('\n── Section 4: ContactAnalyzer & Queue Prioritization ──');
{
  const ceoResult = ContactAnalyzer.analyze({ id: 'cnt-1', title: 'Chief Executive Officer' });
  assert.strictEqual(ceoResult.decisionMakerScore, 1.0);
  assert.strictEqual(ceoResult.seniority, 'Executive');
  pass('CEO contact analyzed correctly');

  const unknownContact = ContactAnalyzer.analyze({ id: 'cnt-2', title: '' });
  assert.strictEqual(unknownContact.decisionMakerScore, 0.0);
  assert.strictEqual(unknownContact.seniority, 'Unknown');
  pass('Empty title contact yields decisionMakerScore = 0.0 & Unknown seniority');

  assert.strictEqual(LeadPrioritizer.getQueue(85), 'Hot');
  assert.strictEqual(LeadPrioritizer.getQueue(50), 'Warm');
  assert.strictEqual(LeadPrioritizer.getQueue(0), 'Cold');
  pass('Lead prioritization queues verified (85→Hot, 50→Warm, 0→Cold)');
}

// ── Section 5: AIInsightGenerator Fallback ──────────────────────────────────
console.log('\n── Section 5: AIInsightGenerator Fallback ──');
(async () => {
  try {
    const result = await AIInsightGenerator.generate(
      'TechCorp',
      'Software',
      ['React'],
      ['Unsecure HTTP website']
    );

    assert.ok(result.openingLine && result.openingLine.length > 10);
    assert.ok(result.painPoint && result.painPoint.length > 5);
    assert.ok(result.outreachAngle && result.outreachAngle.length > 5);
    pass(`AIInsightGenerator generated non-fabricated insight hooks`);

    console.log('\n── ALL INTELLIGENCE TRUST REGRESSION TESTS PASSED ✅ ──\n');
  } catch (err: any) {
    fail('AIInsightGenerator test failed', err.message);
  }
})();
