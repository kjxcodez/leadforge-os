/**
 * Lead Intelligence Engine — Automated Tests
 *
 * Tests cover:
 * - CompanyAnalyzer output shape
 * - ContactAnalyzer decision-maker scoring
 * - ScoringEngine calculations and explanation text
 * - LeadPrioritizer queue assignments
 * - AIInsightGenerator rule-based fallback
 */

import assert from 'assert';
import {
  CompanyAnalyzer,
  ContactAnalyzer,
  ScoringEngine,
  LeadPrioritizer,
  AIInsightGenerator
} from '../services/intelligence-engine';

const pass = (msg: string) => console.log(`  ✅ ${msg}`);
const fail = (msg: string, err?: any) => { console.error(`  ❌ ${msg}`, err || ''); process.exitCode = 1; };

// ── Section 1: CompanyAnalyzer ──────────────────────────────────────────────
console.log('\n── CompanyAnalyzer ──');
{
  const company = {
    id: 'c-001',
    name: 'TechCorp AI',
    industry: 'Software',
    website: 'https://techcorp.ai',
    location: 'San Francisco, CA',
    phone: '+1-555-123-4567'
  };
  const contacts = [
    { id: 'ct-001', title: 'CEO & Founder' },
    { id: 'ct-002', title: 'Software Engineer' }
  ];
  const result = CompanyAnalyzer.analyze(company, contacts);

  assert.strictEqual(result.companyId, 'c-001', 'companyId should match');
  pass('companyId matches');

  assert.ok(result.techStack.length > 0, 'Tech stack should not be empty');
  pass('Tech stack is populated');

  assert.strictEqual(result.businessModel, 'B2B', 'Software company should be B2B');
  pass('Business model classified as B2B for Software industry');

  assert.ok(result.decisionMakerLikelihood > 0.5, 'Decision-maker likelihood should be high with CEO contact');
  pass(`Decision-maker likelihood is ${result.decisionMakerLikelihood}`);

  assert.strictEqual(result.leadConfidence, 'High', 'Lead confidence should be High with a CEO contact');
  pass('Lead confidence = High with CEO contact');
}

// ── Section 2: ContactAnalyzer ──────────────────────────────────────────────
console.log('\n── ContactAnalyzer ──');
{
  const ceoCnt = { id: 'ct-101', title: 'CEO', linkedinUrl: 'https://linkedin.com/in/johndoe', headline: 'Serial Entrepreneur' };
  const managerCnt = { id: 'ct-102', title: 'Marketing Manager', linkedinUrl: null, headline: null };
  const unknownCnt = { id: 'ct-103', title: '', linkedinUrl: null, headline: null };

  const ceoResult = ContactAnalyzer.analyze(ceoCnt);
  assert.strictEqual(ceoResult.decisionMakerScore, 1.0, 'CEO should have score 1.0');
  assert.strictEqual(ceoResult.seniority, 'Executive', 'CEO seniority should be Executive');
  assert.strictEqual(ceoResult.buyingInfluence, 'Decision Maker', 'CEO should be Decision Maker');
  assert.ok(ceoResult.personalizationOpportunities.length >= 2, 'CEO with LinkedIn + headline should have 2+ personalization hooks');
  pass('CEO analyzed correctly: score=1.0, Executive, Decision Maker, 2+ personalization hooks');

  const manResult = ContactAnalyzer.analyze(managerCnt);
  assert.strictEqual(manResult.decisionMakerScore, 0.5, 'Manager should have score 0.5');
  assert.strictEqual(manResult.seniority, 'Manager', 'Manager seniority should be Manager');
  pass('Manager analyzed correctly: score=0.5, Manager seniority');

  const unknownResult = ContactAnalyzer.analyze(unknownCnt);
  assert.ok(unknownResult.decisionMakerScore <= 0.2, 'Unknown contact should have low score');
  pass('Unknown contact correctly classified with low score');
}

// ── Section 3: ScoringEngine ────────────────────────────────────────────────
console.log('\n── ScoringEngine ──');
{
  const company = { id: 'c-002', name: 'MarTech Startup', industry: 'Marketing', website: 'https://martech.io' };
  const compIntel: any = { techStack: ['React', 'HubSpot', 'Segment'], businessModel: 'B2B', decisionMakerLikelihood: 0.9, leadConfidence: 'High' };
  const webIntel: any = {
    buyingSignals: ['Active Sales CTA detected', 'Product trial signup present'],
    technicalIssues: [],
    contentQuality: 'High'
  };
  const contacts: any[] = [
    { contactId: 'c1', decisionMakerScore: 1.0, seniority: 'Executive', buyingInfluence: 'Decision Maker', personalizationOpportunities: ['LinkedIn'], relationshipStrength: 0.1 },
    { contactId: 'c2', decisionMakerScore: 0.5, seniority: 'Manager', buyingInfluence: 'Influencer', personalizationOpportunities: [], relationshipStrength: 0.1 }
  ];

  const score = ScoringEngine.calculate(company, compIntel, webIntel, contacts);

  assert.ok(score.overallScore > 0 && score.overallScore <= 100, `Score should be 0-100, got ${score.overallScore}`);
  pass(`Overall score is valid: ${score.overallScore}`);

  assert.ok(score.fitScore >= 60, `Fit score should be ≥60 for Marketing industry, got ${score.fitScore}`);
  pass(`Fit score is ${score.fitScore} (Marketing industry match)`);

  assert.ok(score.intentScore > 40, `Intent score should be elevated with buying signals, got ${score.intentScore}`);
  pass(`Intent score elevated to ${score.intentScore} with active buying signals`);

  assert.ok(score.explanation && score.explanation.length > 5, 'Explanation should not be empty');
  pass('Score explanation is provided');

  assert.ok(score.explanation.includes('+'), 'Explanation should contain positive increment notation');
  pass('Score explanation contains increment notation');
}

// ── Section 4: LeadPrioritizer ──────────────────────────────────────────────
console.log('\n── LeadPrioritizer ──');
{
  assert.strictEqual(LeadPrioritizer.getQueue(85), 'Hot', 'Score 85 should map to Hot');
  pass('Score 85 → Hot Lead');

  assert.strictEqual(LeadPrioritizer.getQueue(75), 'Hot', 'Score 75 should map to Hot (boundary)');
  pass('Score 75 → Hot Lead (boundary)');

  assert.strictEqual(LeadPrioritizer.getQueue(60), 'Warm', 'Score 60 should map to Warm');
  pass('Score 60 → Warm Lead');

  assert.strictEqual(LeadPrioritizer.getQueue(45), 'Warm', 'Score 45 should map to Warm (boundary)');
  pass('Score 45 → Warm Lead (boundary)');

  assert.strictEqual(LeadPrioritizer.getQueue(30), 'Cold', 'Score 30 should map to Cold');
  pass('Score 30 → Cold Lead');

  assert.strictEqual(LeadPrioritizer.getQueue(0), 'Cold', 'Score 0 should map to Cold');
  pass('Score 0 → Cold Lead');
}

// ── Section 5: AIInsightGenerator (fallback mode) ───────────────────────────
console.log('\n── AIInsightGenerator (Fallback) ──');
(async () => {
  try {
    const result = await AIInsightGenerator.generate(
      'TechCorp AI',
      'Software',
      ['React', 'Next.js'],
      ['Unsecure HTTP website (No SSL certificate)']
      // No API key — should use rule-based fallback
    );

    assert.ok(result.openingLine && result.openingLine.length > 10, 'Opening line should be non-empty');
    pass(`Opening line: "${result.openingLine}"`);

    assert.ok(result.painPoint && result.painPoint.length > 5, 'Pain point hypothesis should be non-empty');
    pass(`Pain point: "${result.painPoint}"`);

    assert.ok(result.outreachAngle && result.outreachAngle.length > 5, 'Outreach angle should be non-empty');
    pass(`Outreach angle: "${result.outreachAngle}"`);

    console.log('\n── INTELLIGENCE ENGINE TESTS COMPLETE ──');
    if (process.exitCode === 1) {
      console.log('\n❌ SOME TESTS FAILED');
    } else {
      console.log('✅ ALL INTELLIGENCE ENGINE TESTS PASSED\n');
    }
  } catch (err: any) {
    fail('AIInsightGenerator test threw unexpectedly', err.message);
  }
})();
