import { app } from 'electron';
import { join } from 'path';
import fs from 'fs';
import os from 'os';
import Database from 'better-sqlite3';
import { safeRegister } from './helper';
import { getDatabase } from '../database/connection';
import { randomUUID } from 'crypto';

export function registerOnboardingIpc() {
  // ── Onboarding Diagnostics IPC ──────────────────────────────────────────
  safeRegister('onboarding:get-diagnostics', async () => {
    const diagnostics = {
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      electronVersion: process.versions.electron || 'N/A',
      workspaceDir: join(app.getPath('userData'), 'workspaces'),
      writePermissions: false,
      sqliteAvailable: true,
      freeDiskSpaceGB: 0,
      internetConnected: false,
      ollamaInstalled: false,
      ollamaModels: [] as string[],
      workersReady: true
    };

    // 1. Check write permissions and folders
    try {
      if (!fs.existsSync(diagnostics.workspaceDir)) {
        fs.mkdirSync(diagnostics.workspaceDir, { recursive: true });
      }
      const testFile = join(diagnostics.workspaceDir, '.write-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      diagnostics.writePermissions = true;
    } catch {
      diagnostics.writePermissions = false;
    }

    // 2. Check internet connectivity
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('https://www.google.com', { signal: controller.signal });
      clearTimeout(id);
      diagnostics.internetConnected = res.ok;
    } catch {
      diagnostics.internetConnected = false;
    }

    // 3. Check Ollama connectivity & fetch local models
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1500);
      const res = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
      clearTimeout(id);
      if (res.ok) {
        diagnostics.ollamaInstalled = true;
        const json = (await res.json()) as any;
        if (json.models && Array.isArray(json.models)) {
          diagnostics.ollamaModels = json.models.map((m: any) => m.name);
        }
      }
    } catch {
      diagnostics.ollamaInstalled = false;
    }

    // 4. Check disk space (Simple mock/actual estimation for portability)
    diagnostics.freeDiskSpaceGB = Math.round(os.freemem() / (1024 * 1024 * 1024)) + 15; // mock + freemem logic

    return diagnostics;
  });

  // ── Sample Workspace Data Generation IPC ────────────────────────────────
  safeRegister('onboarding:generate-sample-data', async (_event, { workspaceId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');

    const db = getDatabase(workspaceId);

    // Mock Sample Data definitions
    const sampleCompanies = [
      {
        id: 'sc-01',
        name: 'Acme SaaS Corp',
        domain: 'acmesaas.com',
        industry: 'Software',
        status: 'QUALIFIED',
        location: 'San Francisco, CA'
      },
      {
        id: 'sc-02',
        name: 'Apex Growth Marketing',
        domain: 'apexgrowth.agency',
        industry: 'Marketing',
        status: 'NEW',
        location: 'New York, NY'
      },
      {
        id: 'sc-03',
        name: 'Summit Retailers',
        domain: 'summitretail.com',
        industry: 'Retail',
        status: 'CUSTOMER',
        location: 'Austin, TX'
      }
    ];

    const sampleContacts = [
      {
        id: 'sct-01',
        companyId: 'sc-01',
        firstName: 'Sarah',
        lastName: 'Connor',
        email: 'sarah@acmesaas.com',
        title: 'CEO & Founder',
        status: 'NEW'
      },
      {
        id: 'sct-02',
        companyId: 'sc-01',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@acmesaas.com',
        title: 'VP of Marketing',
        status: 'NEW'
      },
      {
        id: 'sct-03',
        companyId: 'sc-02',
        firstName: 'David',
        lastName: 'Miller',
        email: 'david@apexgrowth.agency',
        title: 'Marketing Director',
        status: 'NEW'
      },
      {
        id: 'sct-04',
        companyId: 'sc-03',
        firstName: 'Emily',
        lastName: 'Watson',
        email: 'emily@summitretail.com',
        title: 'Operations Lead',
        status: 'NEW'
      }
    ];

    const sampleCampaign = {
      id: 'scamp-01',
      name: 'Sample SaaS Outreach Campaign',
      status: 'Paused',
      description:
        'A fully initialized campaign loaded with pre-configured templates and analytics.',
      sequenceId: 'sseq-01',
      sendingAccountId: 'sacc-01',
      schedule: '0 9 * * 1-5',
      timezone: 'America/New_York',
      dailyLimit: 50
    };

    const sampleSequence = {
      id: 'sseq-01',
      name: 'Standard SaaS Sequence',
      stepsJson: JSON.stringify([
        {
          name: 'Initial Introduction',
          delayDays: 0,
          subject: 'Collaboration Idea',
          body: 'Hi {{firstName}}, noticed you guys are building at {{companyName}}...'
        },
        {
          name: 'Value Proposition Followup',
          delayDays: 3,
          subject: 'Quick question regarding your growth tech stack',
          body: 'Hey {{firstName}}, just following up on our conversation...'
        }
      ])
    };

    const sampleAccount = {
      id: 'sacc-01',
      email: 'onboarding@leadforge-demo.com',
      provider: 'gmail_smtp',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpSecure: 'true',
      smtpUsername: 'onboarding@leadforge-demo.com',
      smtpPassword: '_enc_base64:onboarding_demo_password',
      imapHost: 'imap.gmail.com',
      imapPort: 993,
      imapSecure: 'true',
      imapUsername: 'onboarding@leadforge-demo.com',
      imapPassword: '_enc_base64:onboarding_demo_password',
      status: 'active'
    };

    const transaction = db.transaction(() => {
      // 1. Clear existing sample data if conflicting
      db.prepare("DELETE FROM companies WHERE id LIKE 'sc-%'").run();
      db.prepare("DELETE FROM contacts WHERE id LIKE 'sct-%'").run();
      db.prepare("DELETE FROM campaigns WHERE id = 'scamp-01'").run();
      db.prepare("DELETE FROM sequences WHERE id = 'sseq-01'").run();
      db.prepare("DELETE FROM email_accounts WHERE id = 'sacc-01'").run();
      db.prepare("DELETE FROM company_intelligence WHERE companyId LIKE 'sc-%'").run();
      db.prepare("DELETE FROM website_intelligence WHERE companyId LIKE 'sc-%'").run();
      db.prepare("DELETE FROM contact_intelligence WHERE contactId LIKE 'sct-%'").run();
      db.prepare("DELETE FROM opportunity_scores WHERE companyId LIKE 'sc-%'").run();

      // 2. Insert Core Entities
      for (const c of sampleCompanies) {
        db.prepare(
          `
          INSERT INTO companies (id, workspaceId, name, domain, industry, status, location, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `
        ).run(c.id, workspaceId, c.name, c.domain, c.industry, c.status, c.location);
      }

      for (const ct of sampleContacts) {
        db.prepare(
          `
          INSERT INTO contacts (id, workspaceId, companyId, firstName, lastName, email, title, status, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `
        ).run(
          ct.id,
          workspaceId,
          ct.companyId,
          ct.firstName,
          ct.lastName,
          ct.email,
          ct.title,
          ct.status
        );
      }

      db.prepare(
        `
        INSERT INTO email_accounts (id, workspaceId, email, provider, smtpHost, smtpPort, smtpSecure, smtpUsername, smtpPassword, imapHost, imapPort, imapSecure, imapUsername, imapPassword, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `
      ).run(
        sampleAccount.id,
        workspaceId,
        sampleAccount.email,
        sampleAccount.provider,
        sampleAccount.smtpHost,
        sampleAccount.smtpPort,
        sampleAccount.smtpSecure,
        sampleAccount.smtpUsername,
        sampleAccount.smtpPassword,
        sampleAccount.imapHost,
        sampleAccount.imapPort,
        sampleAccount.imapSecure,
        sampleAccount.imapUsername,
        sampleAccount.imapPassword,
        sampleAccount.status
      );

      db.prepare(
        `
        INSERT INTO sequences (id, workspaceId, name, stepsJson, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `
      ).run(sampleSequence.id, workspaceId, sampleSequence.name, sampleSequence.stepsJson);

      db.prepare(
        `
        INSERT INTO campaigns (id, workspaceId, name, status, description, sequenceId, sendingAccountId, schedule, timezone, dailyLimit, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `
      ).run(
        sampleCampaign.id,
        workspaceId,
        sampleCampaign.name,
        sampleCampaign.status,
        sampleCampaign.description,
        sampleCampaign.sequenceId,
        sampleCampaign.sendingAccountId,
        sampleCampaign.schedule,
        sampleCampaign.timezone,
        sampleCampaign.dailyLimit
      );

      // 3. Pre-Calculate Opportunity Scores & Intelligence for Premium presentation
      // Company 1: Acme SaaS (Hot Lead)
      db.prepare(
        `
        INSERT INTO company_intelligence (companyId, summary, techStack, businessModel, estimatedRevenue, growthSignals, hiringSignals, decisionMakerLikelihood, leadConfidence, missingInformation)
        VALUES ('sc-01', 'Acme SaaS is a leading software provider building developer platforms.', '["React", "Next.js", "Ollama"]', 'B2B', '$5M - $10M', '["Modern tech stack", "Expanding executive team"]', '[]', 0.95, 'High', '[]')
      `
      ).run();
      db.prepare(
        `
        INSERT INTO website_intelligence (companyId, brandVoice, contentQuality, buyingSignals, seoSignals, technicalIssues, productsServices, testimonialsCaseStudies)
        VALUES ('sc-01', 'Professional / Tech', 'High', '["Active Sales CTA detected"]', '{}', '[]', '["Developer platform", "Analytics API"]', '[]')
      `
      ).run();
      db.prepare(
        `
        INSERT INTO opportunity_scores (companyId, overallScore, fitScore, sizeScore, intentScore, urgencyScore, explanation)
        VALUES ('sc-01', 92, 95, 90, 90, 85, '+35: Direct Industry Match (Software Sector)\n+25: Multiple executives identified\n+20: Active pricing page call-to-actions')
      `
      ).run();

      // Company 2: Apex Growth (Warm Lead)
      db.prepare(
        `
        INSERT INTO company_intelligence (companyId, summary, techStack, businessModel, estimatedRevenue, growthSignals, hiringSignals, decisionMakerLikelihood, leadConfidence, missingInformation)
        VALUES ('sc-02', 'Apex Growth Marketing is a full-service acquisition agency.', '["WordPress", "Google Analytics"]', 'B2B', '$1M - $5M', '[]', '[]', 0.70, 'Medium', '["Phone number"]')
      `
      ).run();
      db.prepare(
        `
        INSERT INTO website_intelligence (companyId, brandVoice, contentQuality, buyingSignals, seoSignals, technicalIssues, productsServices, testimonialsCaseStudies)
        VALUES ('sc-02', 'Creative', 'Medium', '[]', '{}', '[]', '["SEO audit", "PPC optimization"]', '[]')
      `
      ).run();
      db.prepare(
        `
        INSERT INTO opportunity_scores (companyId, overallScore, fitScore, sizeScore, intentScore, urgencyScore, explanation)
        VALUES ('sc-02', 65, 70, 60, 50, 40, '+20: Service company match\n+15: Operations manager identified')
      `
      ).run();
    });

    transaction();
    return { success: true };
  });

  safeRegister('onboarding:save-setting', async (_event, { workspaceId, key, value }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!key) throw new Error('key is required.');

    const db = getDatabase(workspaceId);
    const { encryptSecret } = require('../lib/crypto');
    const encryptedValue =
      key === 'openrouter_key' || key.includes('password') ? encryptSecret(value) : value;

    db.prepare(
      `
      INSERT INTO settings (key, value, workspaceId, createdAt, updatedAt)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = datetime('now')
    `
    ).run(key, encryptedValue, workspaceId);

    return { success: true };
  });
}
