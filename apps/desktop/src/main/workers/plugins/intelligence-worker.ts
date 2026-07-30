import Database from 'better-sqlite3';
import { join } from 'path';
import type { JobContext } from '../../../shared/types/job';
import {
  CompanyAnalyzer,
  WebsiteAnalyzer,
  ContactAnalyzer,
  ScoringEngine,
  AIInsightGenerator
} from '../../services/intelligence-engine';

export async function executeIntelligenceEnrichment(ctx: JobContext): Promise<any> {
  const companyId: string = ctx.payload.companyId || '';
  if (!companyId) {
    throw new Error('Missing required payload parameter: companyId');
  }

  ctx.emitLog(`Starting Lead Intelligence enrichment for Company: ${companyId}`, 'info');

  const dbDir = process.env.WORKSPACES_DB_DIR || '';
  if (!dbDir) {
    throw new Error('WORKSPACES_DB_DIR env variable is required for background workers.');
  }

  const dbPath = join(dbDir, `leadforge_${ctx.workspaceId}.db`);
  const db = new Database(dbPath);

  try {
    // 1. Load raw company record
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
    if (!company) {
      throw new Error(`Company not found with ID: ${companyId}`);
    }
    ctx.updateProgress(10, { description: 'Loaded raw company records' });

    // 2. Load contacts associated with this company
    const contacts = db.prepare('SELECT * FROM contacts WHERE companyId = ?').all(companyId) as any[];
    ctx.updateProgress(20, { description: `Found ${contacts.length} associated contact(s)` });

    // 3. Analyze company & contacts
    const compIntel = CompanyAnalyzer.analyze(company, contacts);
    const contactIntels = contacts.map(c => ContactAnalyzer.analyze(c));

    // 4. Check if website html has been crawled
    // We can query from page_crawls or similar if available, or simulate website html analysis
    const crawlerRow = db.prepare(`
      SELECT html FROM page_crawls WHERE companyId = ? ORDER BY id DESC LIMIT 1
    `).get(companyId) as { html: string } | undefined;

    const htmlContent = crawlerRow?.html || '<html><body>Mock site content</body></html>';
    const webIntel = WebsiteAnalyzer.analyze(companyId, htmlContent, company.website || '');
    ctx.updateProgress(45, { description: 'Completed company and website technical analysis' });

    // 5. Calculate opportunity scores
    const opportunityScore = ScoringEngine.calculate(company, compIntel, webIntel, contactIntels);
    ctx.updateProgress(65, { description: 'Opportunity scoring calculations completed' });

    // 6. Generate AI personalized insights
    const openRouterKey = ctx.payload._secrets?.['openrouter_key'] || '';
    const aiInsights = await AIInsightGenerator.generate(
      company.name,
      company.industry || '',
      compIntel.techStack,
      webIntel.technicalIssues,
      openRouterKey
    );
    ctx.updateProgress(85, { description: 'AI opening lines and objection models generated' });

    // 7. Write to SQLite in a single transaction
    const writeTx = db.transaction(() => {
      // Save Company Intelligence
      db.prepare(`
        INSERT INTO company_intelligence (
          companyId, summary, techStack, businessModel, estimatedRevenue,
          growthSignals, hiringSignals, decisionMakerLikelihood, leadConfidence, missingInformation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(companyId) DO UPDATE SET
          summary=excluded.summary, techStack=excluded.techStack, businessModel=excluded.businessModel,
          estimatedRevenue=excluded.estimatedRevenue, growthSignals=excluded.growthSignals,
          hiringSignals=excluded.hiringSignals, decisionMakerLikelihood=excluded.decisionMakerLikelihood,
          leadConfidence=excluded.leadConfidence, missingInformation=excluded.missingInformation
      `).run(
        companyId,
        compIntel.summary,
        JSON.stringify(compIntel.techStack),
        compIntel.businessModel,
        compIntel.estimatedRevenue,
        JSON.stringify(compIntel.growthSignals),
        JSON.stringify(compIntel.hiringSignals),
        compIntel.decisionMakerLikelihood,
        compIntel.leadConfidence,
        JSON.stringify(compIntel.missingInformation)
      );

      // Save Website Intelligence
      db.prepare(`
        INSERT INTO website_intelligence (
          companyId, brandVoice, contentQuality, buyingSignals, seoSignals,
          technicalIssues, productsServices, testimonialsCaseStudies
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(companyId) DO UPDATE SET
          brandVoice=excluded.brandVoice, contentQuality=excluded.contentQuality,
          buyingSignals=excluded.buyingSignals, seoSignals=excluded.seoSignals,
          technicalIssues=excluded.technicalIssues, productsServices=excluded.productsServices,
          testimonialsCaseStudies=excluded.testimonialsCaseStudies
      `).run(
        companyId,
        webIntel.brandVoice,
        webIntel.contentQuality,
        JSON.stringify(webIntel.buyingSignals),
        JSON.stringify(webIntel.seoSignals),
        JSON.stringify(webIntel.technicalIssues),
        JSON.stringify(webIntel.productsServices),
        JSON.stringify(webIntel.testimonialsCaseStudies)
      );

      // Save Contacts Intelligence
      for (const ci of contactIntels) {
        db.prepare(`
          INSERT INTO contact_intelligence (
            contactId, decisionMakerScore, seniority, buyingInfluence,
            personalizationOpportunities, relationshipStrength
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(contactId) DO UPDATE SET
            decisionMakerScore=excluded.decisionMakerScore, seniority=excluded.seniority,
            buyingInfluence=excluded.buyingInfluence, personalizationOpportunities=excluded.personalizationOpportunities,
            relationshipStrength=excluded.relationshipStrength
        `).run(
          ci.contactId,
          ci.decisionMakerScore,
          ci.seniority,
          ci.buyingInfluence,
          JSON.stringify(ci.personalizationOpportunities),
          ci.relationshipStrength
        );
      }

      // Save Opportunity Scores
      db.prepare(`
        INSERT INTO opportunity_scores (
          companyId, overallScore, fitScore, sizeScore, intentScore, urgencyScore, explanation
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(companyId) DO UPDATE SET
          overallScore=excluded.overallScore, fitScore=excluded.fitScore,
          sizeScore=excluded.sizeScore, intentScore=excluded.intentScore,
          urgencyScore=excluded.urgencyScore, explanation=excluded.explanation
      `).run(
        companyId,
        opportunityScore.overallScore,
        opportunityScore.fitScore,
        opportunityScore.sizeScore,
        opportunityScore.intentScore,
        opportunityScore.urgencyScore,
        opportunityScore.explanation
      );
    });

    writeTx();
    ctx.updateProgress(100, { description: 'Intelligence enrichment successfully written to local SQLite database.' });
    ctx.emitLog(`Lead Intelligence enrichment completed for Company: ${companyId}. Score: ${opportunityScore.overallScore}`, 'info');

    return {
      success: true,
      overallScore: opportunityScore.overallScore,
      aiInsights
    };
  } catch (err: any) {
    ctx.emitLog(`Intelligence enrichment failed: ${err.message}`, 'error');
    throw err;
  } finally {
    db.close();
  }
}
