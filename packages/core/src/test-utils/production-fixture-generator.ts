/**
 * LeadForge OS — Production-Like Deterministic Fixture Generator
 *
 * Generates high-volume, seeded, reproducible synthetic data fixtures
 * (thousands of contacts, campaigns, executions, deliveries, mailboxes, and inbound events)
 * for soak testing, concurrency stress, and production qualification without customer data.
 */

export class DeterministicRandom {
  private seed: number;

  constructor(seed: number = 1337) {
    this.seed = seed >>> 0;
  }

  /**
   * Mulberry32 32-bit pseudo-random generator
   */
  next(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Cannot pick from empty array');
    return items[this.nextInt(0, items.length - 1)]!;
  }

  boolean(probabilityTrue = 0.5): boolean {
    return this.next() < probabilityTrue;
  }
}

export interface SyntheticWorkspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface SyntheticMailbox {
  id: string;
  workspaceId: string;
  email: string;
  displayName: string;
  status: 'connected' | 'disconnected' | 'error';
  healthState: 'HEALTHY' | 'COOLDOWN' | 'AUTH_REQUIRED' | 'DEGRADED' | 'BLOCKED';
  dailyLimit: number;
  sentToday: number;
}

export interface SyntheticContact {
  id: string;
  workspaceId: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  status: 'NEW' | 'CONTACTED' | 'REPLIED' | 'BOUNCED' | 'UNSUBSCRIBED' | 'DO_NOT_CONTACT';
  emailStatus: 'VALID' | 'INVALID' | 'SUPPRESSED';
  secondaryEmails: string[];
}

export interface SyntheticCampaign {
  id: string;
  workspaceId: string;
  name: string;
  status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'COMPLETED';
  pauseReason?: 'USER_REQUESTED' | 'MAILBOX_COOLDOWN' | null;
  mailboxId: string;
  stepsCount: number;
}

export interface SyntheticExecution {
  id: string;
  workspaceId: string;
  campaignId: string;
  contactId: string;
  currentStep: number;
  state: 'PENDING' | 'WAITING' | 'RUNNING' | 'COMPLETED' | 'STOPPED' | 'FAILED';
  nextDueAt: string;
}

export interface SyntheticDelivery {
  id: string;
  workspaceId: string;
  campaignId: string;
  executionId: string;
  contactId: string;
  accountId: string;
  direction: 'OUTBOUND' | 'INBOUND';
  status: 'PENDING' | 'SENT' | 'FAILED';
  stepIndex: number;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  templateVersion: number;
  messageFingerprint: string;
  createdAt: string;
}

const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Sam', 'Chris', 'Pat', 'Riley', 'Avery'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
const DOMAINS = ['techcorp.com', 'innovate.io', 'apexsolutions.net', 'vanguardglobal.org', 'crestline.co'];

export class ProductionFixtureGenerator {
  private rng: DeterministicRandom;

  constructor(seed: number = 42) {
    this.rng = new DeterministicRandom(seed);
  }

  generateWorkspaces(count: number): SyntheticWorkspace[] {
    const list: SyntheticWorkspace[] = [];
    for (let i = 0; i < count; i++) {
      const id = `ws_synth_${String(i).padStart(4, '0')}`;
      list.push({
        id,
        name: `Enterprise Workspace ${i + 1}`,
        slug: `workspace-${i + 1}`,
        createdAt: new Date(1700000000000 + i * 86400000).toISOString()
      });
    }
    return list;
  }

  generateMailboxes(workspaceId: string, count: number): SyntheticMailbox[] {
    const list: SyntheticMailbox[] = [];
    for (let i = 0; i < count; i++) {
      const id = `mbx_${workspaceId}_${i}`;
      const name = this.rng.pick(FIRST_NAMES);
      list.push({
        id,
        workspaceId,
        email: `${name.toLowerCase()}.${i}@leadforge-test.internal`,
        displayName: `${name} Rep`,
        status: 'connected',
        healthState: 'HEALTHY',
        dailyLimit: 200,
        sentToday: this.rng.nextInt(0, 50)
      });
    }
    return list;
  }

  generateContacts(workspaceId: string, count: number): SyntheticContact[] {
    const list: SyntheticContact[] = [];
    for (let i = 0; i < count; i++) {
      const id = `cnt_${workspaceId}_${String(i).padStart(5, '0')}`;
      const first = this.rng.pick(FIRST_NAMES);
      const last = this.rng.pick(LAST_NAMES);
      const domain = this.rng.pick(DOMAINS);
      const email = `${first.toLowerCase()}.${last.toLowerCase()}_${i}@${domain}`;
      const hasSecondary = this.rng.boolean(0.2);

      const prefix = domain.split('.')[0] || 'CORP';
      list.push({
        id,
        workspaceId,
        firstName: first,
        lastName: last,
        email,
        companyName: `${prefix.toUpperCase()} Inc`,
        status: 'NEW',
        emailStatus: 'VALID',
        secondaryEmails: hasSecondary ? [`${first.toLowerCase()}_alt${i}@personal.test`] : []
      });
    }
    return list;
  }

  generateCampaigns(workspaceId: string, mailboxId: string, count: number): SyntheticCampaign[] {
    const list: SyntheticCampaign[] = [];
    for (let i = 0; i < count; i++) {
      const id = `cmp_${workspaceId}_${String(i).padStart(3, '0')}`;
      list.push({
        id,
        workspaceId,
        name: `Synthetic Outreach Wave ${i + 1}`,
        status: 'RUNNING',
        pauseReason: null,
        mailboxId,
        stepsCount: 3
      });
    }
    return list;
  }

  generateExecutions(campaign: SyntheticCampaign, contacts: SyntheticContact[]): SyntheticExecution[] {
    const list: SyntheticExecution[] = [];
    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i]!;
      list.push({
        id: `exec_${campaign.id}_${c.id}`,
        workspaceId: campaign.workspaceId,
        campaignId: campaign.id,
        contactId: c.id,
        currentStep: 0,
        state: 'PENDING',
        nextDueAt: new Date(Date.now() + i * 100).toISOString()
      });
    }
    return list;
  }

  generateDeliveries(
    executions: SyntheticExecution[],
    contactsMap: Map<string, SyntheticContact>,
    mailbox: SyntheticMailbox,
    stepIndex: number = 0
  ): SyntheticDelivery[] {
    const list: SyntheticDelivery[] = [];
    for (let i = 0; i < executions.length; i++) {
      const exec = executions[i]!;
      const contact = contactsMap.get(exec.contactId);
      if (!contact) continue;

      const id = `del_${exec.id}_s${stepIndex}`;
      list.push({
        id,
        workspaceId: exec.workspaceId,
        campaignId: exec.campaignId,
        executionId: exec.id,
        contactId: exec.contactId,
        accountId: mailbox.id,
        direction: 'OUTBOUND',
        status: 'SENT',
        stepIndex,
        senderEmail: mailbox.email,
        recipientEmail: contact.email,
        subject: `Partnership Inquiry for ${contact.companyName}`,
        templateVersion: 1,
        messageFingerprint: `sha256_${exec.id}_s${stepIndex}`,
        createdAt: new Date(Date.now() + i * 50).toISOString()
      });
    }
    return list;
  }
}
