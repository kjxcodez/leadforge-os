import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailTemplateRepository } from '../../repositories/email-template/email-template.repository.js';
import { EmailDeliveryRepository } from '../../repositories/email-delivery/email-delivery.repository.js';
import { EmailService } from '../../services/email/email.service.js';
import { EmailDomainError } from '../../services/email/types.js';

// Mock Models
const mockTemplateVersionCreate = vi.fn();
const mockTemplateVersionFindOne = vi.fn();
const mockEmailAccountFindOne = vi.fn().mockResolvedValue({
  _id: 'acc_1',
  email: 'sender@leadforge.ai',
  status: 'connected'
});

vi.mock('../../db/models/email-account.model.js', () => {
  return {
    EmailAccountModel: {
      findOne: (...args: any[]) => mockEmailAccountFindOne(...args),
      find: vi.fn(),
      create: vi.fn(),
      updateOne: vi.fn(),
      findOneAndUpdate: vi.fn()
    }
  };
});

vi.mock('../../db/models/email-template.model.js', () => {
  return {
    EmailTemplateModel: {
      findOne: vi.fn(),
      findOneAndUpdate: vi.fn(),
      find: vi.fn(),
      create: vi.fn()
    },
    TemplateVersionModel: {
      create: (...args: any[]) => mockTemplateVersionCreate(...args),
      findOne: (...args: any[]) => mockTemplateVersionFindOne(...args)
    }
  };
});

describe('Phase 13 — Email Templates & Message Composition Hardening Contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmailAccountFindOne.mockResolvedValue({
      _id: 'acc_1',
      email: 'sender@leadforge.ai',
      status: 'connected'
    });
  });

  describe('Contract 1: Template Version Increment & Historical Archiving', () => {
    it('archives prior state into TemplateVersionModel and increments version monotonically on update', async () => {
      const repo = new EmailTemplateRepository('ws_123');

      // Mock existing template at version 1
      const existingDoc: any = {
        _id: 'tpl_100',
        workspaceId: 'ws_123',
        name: 'Initial Pitch',
        subject: 'Quick question {{contact.firstName}}',
        body: 'Hello {{contact.firstName}}',
        variables: ['contact.firstName'],
        attachments: [],
        version: 1
      };

      vi.spyOn(repo, 'findById').mockResolvedValue(existingDoc);
      const updateSpy = vi.spyOn(repo, 'update').mockImplementation(async (id, updateDoc) => ({
        ...existingDoc,
        ...updateDoc,
        _id: id
      }));

      mockTemplateVersionCreate.mockResolvedValue({
        _id: 'ver_doc_1',
        templateId: 'tpl_100',
        version: 1
      });

      const updated = await repo.updateWithVersioning('tpl_100', {
        subject: 'Updated question {{contact.firstName}}'
      } as any);

      // Verify prior state was archived into TemplateVersionModel with version 1
      expect(mockTemplateVersionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws_123',
          templateId: 'tpl_100',
          version: 1,
          subject: 'Quick question {{contact.firstName}}'
        })
      );

      // Verify active template was bumped to version 2
      expect(updateSpy).toHaveBeenCalledWith('tpl_100', {
        subject: 'Updated question {{contact.firstName}}',
        version: 2
      });
      expect(updated?.version).toBe(2);
    });

    it('findVersion returns active document when requested version matches current, or archived snapshot if historical', async () => {
      const repo = new EmailTemplateRepository('ws_123');

      const currentActive: any = {
        _id: 'tpl_100',
        workspaceId: 'ws_123',
        name: 'Initial Pitch',
        subject: 'Version 2 Subject',
        body: 'Version 2 Body',
        variables: ['contact.firstName'],
        attachments: [],
        version: 2
      };

      vi.spyOn(repo, 'findById').mockResolvedValue(currentActive);

      // Requesting current version (v2) returns active without querying TemplateVersionModel
      const currentVer = await repo.findVersion('tpl_100', 2);
      expect(currentVer?.version).toBe(2);
      expect(currentVer?.subject).toBe('Version 2 Subject');
      expect(mockTemplateVersionFindOne).not.toHaveBeenCalled();

      // Requesting historical version (v1) queries TemplateVersionModel
      mockTemplateVersionFindOne.mockResolvedValue({
        templateId: 'tpl_100',
        version: 1,
        subject: 'Version 1 Subject',
        body: 'Version 1 Body',
        variables: ['contact.firstName'],
        attachments: []
      });

      const historicalVer = await repo.findVersion('tpl_100', 1);
      expect(mockTemplateVersionFindOne).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 'tpl_100',
          version: 1,
          workspaceId: 'ws_123'
        })
      );
      expect(historicalVer?.version).toBe(1);
      expect(historicalVer?.subject).toBe('Version 1 Subject');
    });
  });

  describe('Contract 2: Subject Line CRLF Rejection in EmailService', () => {
    it('throws INVALID_SUBJECT EmailDomainError if subject contains CRLF header injection', async () => {
      const emailService = new EmailService('ws_123');

      // Subject with CRLF
      await expect(
        emailService.send({
          accountId: 'acc_1',
          to: 'valid.recipient@example.com',
          subject: 'Special Offer\r\nBcc: evil@attacker.com'
        })
      ).rejects.toThrowError(/INVALID_SUBJECT|Email subject is invalid/);

      try {
        await emailService.send({
          accountId: 'acc_1',
          to: 'valid.recipient@example.com',
          subject: 'Special Offer\r\nBcc: evil@attacker.com'
        });
      } catch (err: any) {
        expect(err).toBeInstanceOf(EmailDomainError);
        expect(err.code).toBe('INVALID_SUBJECT');
      }

      // Subject that is only whitespace/newlines
      await expect(
        emailService.send({
          accountId: 'acc_1',
          to: 'valid.recipient@example.com',
          subject: '\r\n   \n'
        })
      ).rejects.toThrowError(/INVALID_SUBJECT|Email subject is invalid/);
    });
  });

  describe('Contract 3: Delivery Reservation Idempotency & Token Preservation', () => {
    it('preserves existing open and click tracking tokens on delivery reclaim/retry', async () => {
      const repo = new EmailDeliveryRepository('ws_123');

      const existingDoc: any = {
        _id: 'del_123',
        workspaceId: 'ws_123',
        status: 'FAILED',
        idempotencyKey: 'idem_456',
        openTrackingToken: 'original_open_token_123456789012',
        clickTrackingTokens: [{ token: 'original_click_tok', targetUrl: 'https://example.com' }],
        templateId: 'tpl_100',
        templateVersion: 1,
        messageFingerprint: 'existing_fingerprint_hash',
        attempt: 1
      };

      vi.spyOn(repo, 'findOne').mockResolvedValue(existingDoc);
      const updateSpy = vi.spyOn(repo, 'atomicFindOneAndUpdate').mockResolvedValue({
        ...existingDoc,
        status: 'SENDING',
        attempt: 2
      });

      const result = await repo.reserveDelivery({
        workspaceId: 'ws_123',
        accountId: 'acc_1',
        sequenceId: 'seq_1',
        executionId: 'exec_1',
        stepIndex: 0,
        contactId: 'cnt_1',
        senderEmail: 'sender@leadforge.ai',
        recipientEmail: 'recipient@example.com',
        subject: 'Retry Subject',
        idempotencyKey: 'idem_456',
        openTrackingToken: 'fresh_generated_token_should_be_ignored',
        clickTrackingTokens: [{ token: 'fresh_click_tok', targetUrl: 'https://example.com' }]
      } as any);

      expect(result.isAlreadySent).toBe(false);
      expect(updateSpy).toHaveBeenCalledWith(
        { _id: 'del_123' },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'SENDING',
            openTrackingToken: 'original_open_token_123456789012',
            clickTrackingTokens: [{ token: 'original_click_tok', targetUrl: 'https://example.com' }],
            templateId: 'tpl_100',
            templateVersion: 1,
            messageFingerprint: 'existing_fingerprint_hash'
          }),
          $inc: { attempt: 1 }
        })
      );
    });

    it('persists templateId, templateVersion, variablesSnapshot, and messageFingerprint on fresh reservation', async () => {
      const repo = new EmailDeliveryRepository('ws_123');

      vi.spyOn(repo, 'findOne').mockResolvedValue(null);
      const createSpy = vi.spyOn(repo, 'create').mockImplementation(async (doc: any) => ({
        ...doc,
        _id: doc._id || 'del_new'
      }));

      await repo.reserveDelivery({
        workspaceId: 'ws_123',
        accountId: 'acc_1',
        sequenceId: 'seq_1',
        executionId: 'exec_1',
        stepIndex: 0,
        contactId: 'cnt_1',
        senderEmail: 'sender@leadforge.ai',
        recipientEmail: 'recipient@example.com',
        subject: 'Fresh Subject',
        idempotencyKey: 'idem_fresh',
        templateId: 'tpl_200',
        templateVersion: 3,
        variablesSnapshot: { 'contact.firstName': 'Bob' },
        messageFingerprint: 'sha256_fresh_fingerprint'
      } as any);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws_123',
          templateId: 'tpl_200',
          templateVersion: 3,
          variablesSnapshot: { 'contact.firstName': 'Bob' },
          messageFingerprint: 'sha256_fresh_fingerprint',
          status: 'SENDING',
          attempt: 1
        })
      );
    });
  });
});
