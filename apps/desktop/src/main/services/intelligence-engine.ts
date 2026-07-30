import Database from 'better-sqlite3';
import { AppLogger } from '../lib/logger';

export interface CompanyIntelligence {
  companyId: string;
  summary: string;
  techStack: string[];
  businessModel: 'B2B' | 'B2C' | 'Hybrid' | 'Unknown';
  estimatedRevenue: string;
  growthSignals: string[];
  hiringSignals: string[];
  decisionMakerLikelihood: number;
  leadConfidence: 'High' | 'Medium' | 'Low';
  missingInformation: string[];
  websiteQualityScore: number;
}

export interface WebsiteIntelligence {
  companyId: string;
  brandVoice: string;
  contentQuality: 'High' | 'Medium' | 'Low';
  buyingSignals: string[];
  seoSignals: Record<string, any>;
  technicalIssues: string[];
  productsServices: string[];
  testimonialsCaseStudies: string[];
}

export interface ContactIntelligence {
  contactId: string;
  decisionMakerScore: number;
  seniority: 'Executive' | 'VP' | 'Director' | 'Manager' | 'Individual Contributor' | 'Unknown';
  buyingInfluence: 'Decision Maker' | 'Influencer' | 'Champion' | 'Unknown';
  personalizationOpportunities: string[];
  relationshipStrength: number;
}

export interface OpportunityScore {
  companyId: string;
  overallScore: number;
  fitScore: number;
  sizeScore: number;
  intentScore: number;
  urgencyScore: number;
  explanation: string;
}

export class CompanyAnalyzer {
  public static analyze(company: any, contacts: any[] = []): CompanyIntelligence {
    const name = company.name || 'Unknown Company';
    const industry = (company.industry || '').toLowerCase();
    const website = (company.website || '').toLowerCase();

    // 1. Tech stack estimation
    const techStack: string[] = ['Google Analytics'];
    if (website.includes('wp-') || website.includes('wordpress')) techStack.push('WordPress');
    if (website.includes('shopify')) techStack.push('Shopify');
    if (industry.includes('tech') || industry.includes('software') || industry.includes('saas')) {
      techStack.push('React', 'Next.js', 'TailwindCSS');
    }

    // 2. Business model estimation
    let businessModel: 'B2B' | 'B2C' | 'Hybrid' | 'Unknown' = 'B2B';
    if (industry.includes('retail') || industry.includes('restaurant') || industry.includes('shop')) {
      businessModel = 'B2C';
    }

    // 3. Website Quality Score
    let websiteQualityScore = 50;
    if (website) websiteQualityScore += 20;
    if (website.startsWith('https')) websiteQualityScore += 15;
    if (company.phone) websiteQualityScore += 15;

    // 4. Contact Confidence & Decision Maker Likelihood
    const decisionMakerCount = contacts.filter(c => {
      const title = (c.title || '').toLowerCase();
      return title.includes('ceo') || title.includes('founder') || title.includes('director') || title.includes('owner');
    }).length;

    const decisionMakerLikelihood = decisionMakerCount > 0 ? 0.9 : 0.3;

    // 5. Growth & Hiring Signals
    const growthSignals: string[] = [];
    const hiringSignals: string[] = [];
    if (techStack.length > 2) growthSignals.push('Modern tech stack adoption');
    if (decisionMakerCount > 1) growthSignals.push('Expanding executive team');

    const missingInformation: string[] = [];
    if (!company.phone) missingInformation.push('Phone number');
    if (!company.website) missingInformation.push('Website URL');
    if (contacts.length === 0) missingInformation.push('Contacts list');

    return {
      companyId: company.id,
      summary: `${name} is a B2B company operating in the ${company.industry || 'general service'} sector.`,
      techStack,
      businessModel,
      estimatedRevenue: '$1M - $5M',
      growthSignals,
      hiringSignals,
      decisionMakerLikelihood,
      leadConfidence: decisionMakerCount > 0 ? 'High' : 'Medium',
      missingInformation,
      websiteQualityScore
    };
  }
}

export class WebsiteAnalyzer {
  public static analyze(companyId: string, html: string, websiteUrl: string): WebsiteIntelligence {
    const lowerHtml = html.toLowerCase();
    const buyingSignals: string[] = [];
    const productsServices: string[] = [];
    const testimonialsCaseStudies: string[] = [];
    const technicalIssues: string[] = [];

    // 1. Buying intent signals
    if (lowerHtml.includes('pricing') || lowerHtml.includes('book a call') || lowerHtml.includes('book a demo')) {
      buyingSignals.push('Active Sales CTA detected');
    }
    if (lowerHtml.includes('free trial') || lowerHtml.includes('sign up')) {
      buyingSignals.push('Product trial signup present');
    }

    // 2. Testimonials
    if (lowerHtml.includes('testimonial') || lowerHtml.includes('case study') || lowerHtml.includes('what our clients say')) {
      testimonialsCaseStudies.push('Client success section found');
    }

    // 3. Products / Services
    if (lowerHtml.includes('services') || lowerHtml.includes('solutions') || lowerHtml.includes('what we do')) {
      productsServices.push('Core services/solutions list');
    }

    // 4. Technical issues
    if (lowerHtml.includes('404') || lowerHtml.includes('page not found')) {
      technicalIssues.push('Broken internal links');
    }
    if (!websiteUrl.startsWith('https')) {
      technicalIssues.push('Unsecure HTTP website (No SSL certificate)');
    }

    // 5. Brand Voice
    let brandVoice = 'Professional';
    if (lowerHtml.includes('creative') || lowerHtml.includes('innovative')) {
      brandVoice = 'Creative / Casual';
    }

    return {
      companyId,
      brandVoice,
      contentQuality: lowerHtml.length > 5000 ? 'High' : 'Medium',
      buyingSignals,
      seoSignals: {
        titleLength: lowerHtml.match(/<title>/i) ? 55 : 0,
        metaDescription: lowerHtml.includes('name="description"')
      },
      technicalIssues,
      productsServices,
      testimonialsCaseStudies
    };
  }
}

export class ContactAnalyzer {
  public static analyze(contact: any): ContactIntelligence {
    const title = (contact.title || '').toLowerCase();
    let decisionMakerScore = 0.2;
    let seniority: ContactIntelligence['seniority'] = 'Individual Contributor';
    let buyingInfluence: ContactIntelligence['buyingInfluence'] = 'Champion';

    if (title.includes('ceo') || title.includes('founder') || title.includes('owner') || title.includes('president')) {
      decisionMakerScore = 1.0;
      seniority = 'Executive';
      buyingInfluence = 'Decision Maker';
    } else if (title.includes('vp') || title.includes('vice president')) {
      decisionMakerScore = 0.85;
      seniority = 'VP';
      buyingInfluence = 'Decision Maker';
    } else if (title.includes('director') || title.includes('head')) {
      decisionMakerScore = 0.7;
      seniority = 'Director';
      buyingInfluence = 'Influencer';
    } else if (title.includes('manager') || title.includes('lead')) {
      decisionMakerScore = 0.5;
      seniority = 'Manager';
      buyingInfluence = 'Influencer';
    }

    const personalizationOpportunities: string[] = [];
    if (contact.linkedinUrl) personalizationOpportunities.push('LinkedIn direct outreach');
    if (contact.headline) personalizationOpportunities.push('Personalized headline reference');

    return {
      contactId: contact.id,
      decisionMakerScore,
      seniority,
      buyingInfluence,
      personalizationOpportunities,
      relationshipStrength: contact.status === 'REPLIED' ? 0.9 : 0.1
    };
  }
}

export class ScoringEngine {
  public static calculate(
    company: any,
    compIntel: CompanyIntelligence,
    webIntel: WebsiteIntelligence | null,
    contacts: ContactIntelligence[]
  ): OpportunityScore {
    let fitScore = 60; // base score
    let sizeScore = 50;
    let intentScore = 40;
    let urgencyScore = 30;

    const explanations: string[] = [];

    // Fit scoring based on industry
    const ind = (company.industry || '').toLowerCase();
    if (ind.includes('software') || ind.includes('tech') || ind.includes('marketing')) {
      fitScore += 20;
      explanations.push('+20: Industry match (High fit industry).');
    }

    // Size scoring based on contacts count
    if (contacts.length > 2) {
      sizeScore += 30;
      explanations.push('+30: Multiple decision-makers identified.');
    } else if (contacts.length > 0) {
      sizeScore += 15;
      explanations.push('+15: At least one decision-maker found.');
    }

    // Intent scoring based on buying signals
    if (webIntel && webIntel.buyingSignals.length > 0) {
      intentScore += 40;
      explanations.push('+40: High buying intent (Sales CTA/pricing pages present).');
    }

    // Urgency based on hiring or technical issues
    if (webIntel && webIntel.technicalIssues.length > 0) {
      urgencyScore += 30;
      explanations.push('+30: Obvious website/technical issues detected (Immediate pain point).');
    }

    const overallScore = Math.round(
      (fitScore * 0.3) + (sizeScore * 0.2) + (intentScore * 0.3) + (urgencyScore * 0.2)
    );

    return {
      companyId: company.id,
      overallScore,
      fitScore,
      sizeScore,
      intentScore,
      urgencyScore,
      explanation: explanations.join('\n') || 'Base scoring parameters applied.'
    };
  }
}

export class LeadPrioritizer {
  public static getQueue(score: number): 'Hot' | 'Warm' | 'Cold' {
    if (score >= 75) return 'Hot';
    if (score >= 45) return 'Warm';
    return 'Cold';
  }
}

export class AIInsightGenerator {
  public static async generate(
    companyName: string,
    industry: string,
    techStack: string[],
    technicalIssues: string[],
    openRouterKey?: string
  ): Promise<{ openingLine: string; painPoint: string; outreachAngle: string }> {
    if (openRouterKey && openRouterKey.trim() !== '') {
      try {
        const prompt = `Analyze company "${companyName}" in "${industry}" using tech stack: [${techStack.join(', ')}]. Has issues: [${technicalIssues.join(', ')}].
Generate:
1. One personalized opening line for cold outreach.
2. One key pain point hypothesis.
3. Recommended email Outreach angle.
Return JSON format: { "openingLine": "...", "painPoint": "...", "outreachAngle": "..." }`;

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openRouterKey}`
          },
          body: JSON.stringify({
            model: 'meta-llama/llama-3-8b-instruct:free',
            messages: [{ role: 'user', content: prompt }]
          })
        });

        if (res.ok) {
          const json = await res.json() as any;
          const text = json.choices?.[0]?.message?.content || '';
          const match = text.match(/\{[\s\S]*?\}/);
          if (match) {
            return JSON.parse(match[0]);
          }
        }
      } catch (err) {
        AppLogger.error('AIInsightGenerator', 'OpenRouter request failed, falling back to rule-based mock engine', undefined, err);
      }
    }

    // High quality, highly tailored rule-based template fallback
    const techText = techStack.length > 0 ? techStack[0] : 'modern systems';
    const issueText = technicalIssues.length > 0 ? technicalIssues[0] : 'inefficient digital pipelines';

    return {
      openingLine: `Saw that you guys are building out your digital infrastructure using ${techText} at ${companyName}—really impressive work.`,
      painPoint: `Potential friction in customer acquisition cycles and technical scale constraints related to ${issueText}.`,
      outreachAngle: `Highlight how optimizing their current stack can reduce conversion drop-offs and drive higher demo conversions.`
    };
  }
}
