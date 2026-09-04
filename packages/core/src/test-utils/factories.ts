/**
 * LeadForge OS — Reusable Test Data Factories
 *
 * Provides typed builder helpers for generating valid, minimal entity records
 * across unit, integration, and contract test suites without duplicating large fixtures.
 */

import { randomUUID } from 'crypto';

export interface TestWorkspace {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export function createTestWorkspace(overrides: Partial<TestWorkspace> = {}): TestWorkspace {
  const id = overrides.id || `ws_${randomUUID()}`;
  return {
    id,
    name: 'Test Workspace',
    slug: `test-workspace-${id.substring(3, 9)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  workspaceId: string;
  role: string;
}

export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const id = overrides.id || `usr_${randomUUID()}`;
  return {
    id,
    email: `user_${id.substring(4, 10)}@example.com`,
    name: 'Test Engineer',
    workspaceId: overrides.workspaceId || `ws_${randomUUID()}`,
    role: 'owner',
    ...overrides
  };
}

export interface TestCompany {
  id: string;
  workspaceId: string;
  name: string;
  domain: string;
  industry?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  country?: string | undefined;
  status: string;
}

export function createTestCompany(overrides: Partial<TestCompany> = {}): TestCompany {
  const id = overrides.id || `comp_${randomUUID()}`;
  return {
    id,
    workspaceId: overrides.workspaceId || `ws_${randomUUID()}`,
    name: 'Acme Technologies',
    domain: 'acme.com',
    industry: 'Software',
    city: 'San Francisco',
    state: 'CA',
    country: 'USA',
    status: 'QUALIFIED',
    ...overrides
  };
}

export interface TestContact {
  id: string;
  workspaceId: string;
  companyId?: string | undefined;
  firstName: string;
  lastName: string;
  email: string;
  title?: string | undefined;
  status: string;
  emailStatus: string;
  provenance?: {
    sourceType: string;
    sourceUrl?: string | undefined;
    companyDomain?: string | undefined;
  } | undefined;
}

export function createTestContact(overrides: Partial<TestContact> = {}): TestContact {
  const id = overrides.id || `cont_${randomUUID()}`;
  return {
    id,
    workspaceId: overrides.workspaceId || `ws_${randomUUID()}`,
    firstName: 'Sarah',
    lastName: 'Connor',
    email: `sarah_${id.substring(5, 11)}@example.com`,
    title: 'Operations Director',
    status: 'NEW',
    emailStatus: 'VALID',
    provenance: {
      sourceType: 'mailto',
      companyDomain: 'example.com'
    },
    ...overrides
  };
}

export interface TestEmailAccount {
  id: string;
  workspaceId: string;
  email: string;
  name: string;
  provider: 'gmail' | 'smtp';
  status: 'connected' | 'disconnected' | 'reauth_required';
  dailyLimit: number;
  hourlyLimit: number;
  dailySent: number;
  hourlySent: number;
}

export function createTestEmailAccount(overrides: Partial<TestEmailAccount> = {}): TestEmailAccount {
  const id = overrides.id || `acc_${randomUUID()}`;
  return {
    id,
    workspaceId: overrides.workspaceId || `ws_${randomUUID()}`,
    email: `outbound_${id.substring(4, 10)}@company.com`,
    name: 'Outbound Mailbox',
    provider: 'gmail',
    status: 'connected',
    dailyLimit: 100,
    hourlyLimit: 20,
    dailySent: 0,
    hourlySent: 0,
    ...overrides
  };
}

export interface TestCampaign {
  id: string;
  workspaceId: string;
  name: string;
  status: string;
  dailyLimit: number;
  timezone: string;
  sequenceId?: string | undefined;
  sendingAccountId?: string | undefined;
}

export function createTestCampaign(overrides: Partial<TestCampaign> = {}): TestCampaign {
  const id = overrides.id || `camp_${randomUUID()}`;
  return {
    id,
    workspaceId: overrides.workspaceId || `ws_${randomUUID()}`,
    name: 'Q3 Enterprise Outbound',
    status: 'DRAFT',
    dailyLimit: 50,
    timezone: 'UTC',
    sequenceId: overrides.sequenceId || `seq_${randomUUID()}`,
    sendingAccountId: overrides.sendingAccountId || `acc_${randomUUID()}`,
    ...overrides
  };
}

export interface TestDelivery {
  id: string;
  workspaceId: string;
  campaignId?: string | undefined;
  sequenceId?: string | undefined;
  executionId?: string | undefined;
  contactId: string;
  accountId: string;
  recipientEmail: string;
  senderEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string | undefined;
  status: string;
  direction: 'OUTBOUND' | 'INBOUND';
  providerMessageId?: string | null | undefined;
  providerThreadId?: string | null | undefined;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export function createTestDelivery(overrides: Partial<TestDelivery> = {}): TestDelivery {
  const id = overrides.id || `del_${randomUUID()}`;
  const contactId = overrides.contactId || `cont_${randomUUID()}`;
  const campaignId = overrides.campaignId || `camp_${randomUUID()}`;
  return {
    id,
    workspaceId: overrides.workspaceId || `ws_${randomUUID()}`,
    campaignId,
    contactId,
    accountId: overrides.accountId || `acc_${randomUUID()}`,
    recipientEmail: 'contact@example.com',
    senderEmail: 'sender@company.com',
    subject: 'Quick question regarding partnership',
    bodyText: 'Hi Sarah, are you available for a quick call?',
    status: 'QUEUED',
    direction: 'OUTBOUND',
    providerMessageId: null,
    providerThreadId: null,
    idempotencyKey: `send:${campaignId}:${contactId}:step0`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

export interface TestEmailEvent {
  id: string;
  workspaceId: string;
  deliveryId: string;
  type: string;
  recipientEmail: string;
  timestamp: Date;
  dedupeKey: string;
  metadata?: Record<string, any> | undefined;
}

export function createTestEmailEvent(overrides: Partial<TestEmailEvent> = {}): TestEmailEvent {
  const id = overrides.id || `evt_${randomUUID()}`;
  const deliveryId = overrides.deliveryId || `del_${randomUUID()}`;
  const type = overrides.type || 'OPENED';
  return {
    id,
    workspaceId: overrides.workspaceId || `ws_${randomUUID()}`,
    deliveryId,
    type,
    recipientEmail: 'contact@example.com',
    timestamp: new Date(),
    dedupeKey: `${deliveryId}:${type}:initial`,
    metadata: {},
    ...overrides
  };
}
