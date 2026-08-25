import Database from 'better-sqlite3';
import { join } from 'path';
import { randomUUID } from 'crypto';
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

  const dbPath = ctx.dbPath || (process.env.WORKSPACES_DB_DIR ? join(process.env.WORKSPACES_DB_DIR, `leadforge_${ctx.workspaceId}.db`) : '');
  if (!dbPath) {
    throw new Error('Database path could not be resolved for background worker.');
  }

  const db = new Database(dbPath);

  try {
    // 1. Load raw company record
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
    if (!company) {
      throw new Error(`Company not found with ID: ${companyId}`);
    }
    ctx.updateProgress(10, { description: 'Loaded raw company records' });

    // 2. Load contacts associated with this company
    const contacts = db
      .prepare('SELECT * FROM contacts WHERE companyId = ?')
      .all(companyId) as any[];
    ctx.updateProgress(20, { description: `Found ${contacts.length} associated contact(s)` });

    // 3. Check if website HTML has been crawled in page_crawls
    let htmlContent = '';
    try {
      const crawlerRow = db
        .prepare(
          `
        SELECT html FROM page_crawls WHERE companyId = ? ORDER BY crawledAt DESC LIMIT 1
      `
        )
        .get(companyId) as { html: string } | undefined;
      if (crawlerRow?.html) {
        htmlContent = crawlerRow.html;
      }
    } catch {
      // Table missing or empty
    }

    // 4. Analyze company, website, and contacts
    const compRes = CompanyAnalyzer.analyze(company, contacts, htmlContent);
    const compIntel = compRes.companyIntelligence;

    const webRes = WebsiteAnalyzer.analyze(companyId, htmlContent, company.website || '');
    const webIntel = webRes.websiteIntelligence;

    const contactIntels = contacts.map((c) => ContactAnalyzer.analyze(c));
    ctx.updateProgress(45, { description: 'Completed company and website technical analysis' });

    // 5. Calculate grounded opportunity scores with provenance
    const opportunityScore = ScoringEngine.calculate(company, compIntel, webIntel, contactIntels);
    ctx.updateProgress(65, { description: 'Opportunity scoring calculations completed' });

    // 6. Generate AI personalized insights (or rule fallback)
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
    const now = new Date().toISOString();
    const sourceId = `src-${companyId}`;

    const writeTx = db.transaction(() => {
      // Save Intelligence Source
      db.prepare(
        `
        INSERT INTO intelligence_sources (id, workspaceId, companyId, sourceType, url, retrievedAt, status, retrievalMethod, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, 'SUCCESS', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET retrievedAt=excluded.retrievedAt, updatedAt=excluded.updatedAt
      `
      ).run(
        sourceId,
        ctx.workspaceId,
        companyId,
        company.website ? 'WEBSITE_HTML' : 'MANUAL_INPUT',
        company.website || null,
        now,
        htmlContent ? 'DETERMINISTIC_HTML' : 'MANUAL',
        now,
        now
      );

      // Save Evidence
      for (const ev of [...compRes.evidence, ...webRes.evidence]) {
        db.prepare(
          `
          INSERT INTO intelligence_evidence (id, workspaceId, companyId, sourceId, evidenceType, key, value, rawExcerpt, extractionMethod, observedAt, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET value=excluded.value, observedAt=excluded.observedAt
        `
        ).run(
          ev.id,
          ctx.workspaceId,
          companyId,
          sourceId,
          ev.evidenceType,
          ev.key,
          ev.value,
          ev.rawExcerpt || null,
          ev.extractionMethod,
          ev.observedAt,
          ev.createdAt
        );
      }

      // Save Claims
      for (const clm of [...compRes.claims, ...webRes.claims]) {
        db.prepare(
          `
          INSERT INTO intelligence_claims (id, workspaceId, companyId, evidenceIds, subject, predicate, objectValue, verificationStatus, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET objectValue=excluded.objectValue
        `
        ).run(
          clm.id,
          ctx.workspaceId,
          companyId,
          JSON.stringify(clm.evidenceIds),
          clm.subject,
          clm.predicate,
          clm.objectValue,
          clm.verificationStatus,
          clm.createdAt
        );
      }

      // Save Inferences
      for (const inf of compRes.inferences) {
        db.prepare(
          `
          INSERT INTO intelligence_inferences (id, workspaceId, companyId, supportingClaimIds, field, value, inferenceMethod, confidence, reason, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET value=excluded.value, reason=excluded.reason, confidence=excluded.confidence
        `
        ).run(
          inf.id,
          ctx.workspaceId,
          companyId,
          JSON.stringify(inf.supportingClaimIds),
          inf.field,
          inf.value,
          inf.inferenceMethod,
          inf.confidence,
          inf.reason,
          inf.createdAt
        );
      }

      // Save Company Intelligence (Backward-compatible cache)
      db.prepare(
        `
        INSERT INTO company_intelligence (
          companyId, summary, techStack, businessModel, estimatedRevenue,
          growthSignals, hiringSignals, decisionMakerLikelihood, leadConfidence, missingInformation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(companyId) DO UPDATE SET
          summary=excluded.summary, techStack=excluded.techStack, businessModel=excluded.businessModel,
          estimatedRevenue=excluded.estimatedRevenue, growthSignals=excluded.growthSignals,
          hiringSignals=excluded.hiringSignals, decisionMakerLikelihood=excluded.decisionMakerLikelihood,
          leadConfidence=excluded.leadConfidence, missingInformation=excluded.missingInformation
      `
      ).run(
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

      // Save Website Intelligence (Backward-compatible cache)
      db.prepare(
        `
        INSERT INTO website_intelligence (
          companyId, brandVoice, contentQuality, buyingSignals, seoSignals,
          technicalIssues, productsServices, testimonialsCaseStudies
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(companyId) DO UPDATE SET
          brandVoice=excluded.brandVoice, contentQuality=excluded.contentQuality,
          buyingSignals=excluded.buyingSignals, seoSignals=excluded.seoSignals,
          technicalIssues=excluded.technicalIssues, productsServices=excluded.productsServices,
          testimonialsCaseStudies=excluded.testimonialsCaseStudies
      `
      ).run(
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
        db.prepare(
          `
          INSERT INTO contact_intelligence (
            contactId, decisionMakerScore, seniority, buyingInfluence,
            personalizationOpportunities, relationshipStrength
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(contactId) DO UPDATE SET
            decisionMakerScore=excluded.decisionMakerScore, seniority=excluded.seniority,
            buyingInfluence=excluded.buyingInfluence, personalizationOpportunities=excluded.personalizationOpportunities,
            relationshipStrength=excluded.relationshipStrength
        `
        ).run(
          ci.contactId,
          ci.decisionMakerScore,
          ci.seniority,
          ci.buyingInfluence,
          JSON.stringify(ci.personalizationOpportunities),
          ci.relationshipStrength
        );
      }

      // Save Opportunity Scores with Provenance
      db.prepare(
        `
        INSERT INTO opportunity_scores (
          companyId, overallScore, fitScore, sizeScore, intentScore, urgencyScore, explanation, provenance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(companyId) DO UPDATE SET
          overallScore=excluded.overallScore, fitScore=excluded.fitScore,
          sizeScore=excluded.sizeScore, intentScore=excluded.intentScore,
          urgencyScore=excluded.urgencyScore, explanation=excluded.explanation,
          provenance=excluded.provenance
      `
      ).run(
        companyId,
        opportunityScore.overallScore,
        opportunityScore.fitScore,
        opportunityScore.sizeScore,
        opportunityScore.intentScore,
        opportunityScore.urgencyScore,
        opportunityScore.explanation,
        JSON.stringify(opportunityScore.provenance || [])
      );
    });

    writeTx();
    ctx.updateProgress(100, {
      description: 'Grounded intelligence enrichment successfully written to local SQLite database.'
    });
    ctx.emitLog(
      `Lead Intelligence enrichment completed for Company: ${companyId}. Honest Score: ${opportunityScore.overallScore}%`,
      'info'
    );

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
