import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { OutreachService } from '../../services/outreach/outreach.service.js';
import { EmailTemplateRepository } from '../../repositories/email-template/email-template.repository.js';
import { NotFoundError } from '../../errors/index.js';

// Mock MongoDB Models
const mockTemplateFindOne = vi.fn();
const mockTemplateDeleteOne = vi.fn();
const mockTemplateVersionFindOne = vi.fn();
const mockTemplateVersionCreate = vi.fn();

vi.mock('../../db/models/email-template.model.js', () => {
  return {
    EmailTemplateModel: {
      findOne: (...args: any[]) => {
        const promise = Promise.resolve(mockTemplateFindOne(...args));
        (promise as any).session = vi.fn().mockImplementation(() => promise);
        return promise;
      },
      deleteOne: (...args: any[]) => {
        const promise = Promise.resolve(mockTemplateDeleteOne(...args));
        (promise as any).session = vi.fn().mockImplementation(() => promise);
        return promise;
      },
      find: vi.fn(),
      create: vi.fn()
    },
    TemplateVersionModel: {
      findOne: (...args: any[]) => {
        const promise = Promise.resolve(mockTemplateVersionFindOne(...args));
        (promise as any).session = vi.fn().mockImplementation(() => promise);
        return promise;
      },
      create: (...args: any[]) => mockTemplateVersionCreate(...args)
    }
  };
});

describe('Phase 16 — Template Versioning & Deletion Safety Contracts (TPL-05, TPL-DELETE-15)', () => {
  const wsA = 'ws_alpha';
  const wsB = 'ws_bravo';
  const templateId = 'tpl_100';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Contract 1: Historical Version Retrieval & Workspace Isolation (TPL-05)', () => {
    it('retrieves active template version when version matches current', async () => {
      mockTemplateFindOne.mockResolvedValue({
        _id: templateId,
        workspaceId: wsA,
        name: 'Welcome Sequence',
        subject: 'Welcome to LeadForge v2',
        body: '<p>Hi {{contact.firstName}}</p>',
        variables: ['contact.firstName'],
        attachments: [],
        version: 2,
        createdAt: new Date('2026-01-01')
      });

      const service = new OutreachService(wsA);
      const res = await service.getTemplateVersion(templateId, 2);

      expect(res).toBeDefined();
      expect(res.version).toBe(2);
      expect(res.subject).toBe('Welcome to LeadForge v2');
      expect(mockTemplateVersionFindOne).not.toHaveBeenCalled();
    });

    it('retrieves archived historical snapshot when version is older than current', async () => {
      // Current is version 3
      mockTemplateFindOne.mockResolvedValue({
        _id: templateId,
        workspaceId: wsA,
        name: 'Welcome Sequence',
        subject: 'Welcome to LeadForge v3',
        body: '<p>Hi {{contact.firstName}} v3</p>',
        variables: ['contact.firstName'],
        attachments: [],
        version: 3,
        createdAt: new Date('2026-03-01')
      });

      // Historical version 1 exists in TemplateVersionModel
      mockTemplateVersionFindOne.mockResolvedValue({
        _id: 'ver_snap_1',
        templateId,
        workspaceId: wsA,
        name: 'Welcome Sequence',
        subject: 'Welcome to LeadForge v1',
        body: '<p>Hi {{contact.firstName}} v1</p>',
        variables: ['contact.firstName'],
        attachments: [],
        version: 1,
        createdAt: new Date('2026-01-01')
      });

      const service = new OutreachService(wsA);
      const res = await service.getTemplateVersion(templateId, 1);

      expect(res).toBeDefined();
      expect(res.version).toBe(1);
      expect(res.subject).toBe('Welcome to LeadForge v1');
      expect(mockTemplateVersionFindOne).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId,
          version: 1,
          workspaceId: wsA
        })
      );
    });

    it('strictly returns 404 NotFoundError when historical version does not exist (no unsafe fallback)', async () => {
      // Current is version 2
      mockTemplateFindOne.mockResolvedValue({
        _id: templateId,
        workspaceId: wsA,
        version: 2
      });
      // Version 99 does not exist
      mockTemplateVersionFindOne.mockResolvedValue(null);

      const service = new OutreachService(wsA);
      await expect(service.getTemplateVersion(templateId, 99)).rejects.toThrow(NotFoundError);
    });

    it('enforces workspace isolation: Workspace B cannot retrieve Workspace A template versions', async () => {
      // Template belongs to Workspace A, but Workspace B requests it
      mockTemplateFindOne.mockResolvedValue(null);
      mockTemplateVersionFindOne.mockResolvedValue(null);

      const serviceB = new OutreachService(wsB);
      await expect(serviceB.getTemplateVersion(templateId, 1)).rejects.toThrow(NotFoundError);

      expect(mockTemplateVersionFindOne).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId,
          version: 1,
          workspaceId: wsB
        })
      );
    });
  });

  describe('Contract 2: Template Deletion Immutability (TPL-DELETE-15)', () => {
    it('archives current version before deleting from active collection', async () => {
      mockTemplateFindOne.mockResolvedValue({
        _id: templateId,
        workspaceId: wsA,
        name: 'Cold Outreach Template',
        subject: 'Quick question for {{company.name}}',
        body: '<p>Hey there</p>',
        variables: ['company.name'],
        attachments: [],
        version: 1
      });

      const service = new OutreachService(wsA);
      await service.deleteTemplate(templateId);

      // Must archive version snapshot to TemplateVersionModel
      expect(mockTemplateVersionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: wsA,
          templateId,
          version: 1,
          subject: 'Quick question for {{company.name}}'
        })
      );

      // Must delete from EmailTemplateModel
      expect(mockTemplateDeleteOne).toHaveBeenCalledWith({
        _id: templateId,
        workspaceId: wsA
      });
    });

    it('allows historical version lookup even after active template is deleted', async () => {
      // Active template is deleted (findOne returns null)
      mockTemplateFindOne.mockResolvedValue(null);

      // Historical version still exists in TemplateVersionModel
      mockTemplateVersionFindOne.mockResolvedValue({
        _id: 'ver_snap_1',
        templateId,
        workspaceId: wsA,
        name: 'Cold Outreach Template',
        subject: 'Archived Subject v1',
        body: '<p>Archived Body v1</p>',
        variables: ['company.name'],
        attachments: [],
        version: 1,
        createdAt: new Date('2026-01-01')
      });

      const service = new OutreachService(wsA);
      const res = await service.getTemplateVersion(templateId, 1);

      expect(res).toBeDefined();
      expect(res.version).toBe(1);
      expect(res.subject).toBe('Archived Subject v1');
    });
  });

  describe('Contract 3: Preview with Historical Version', () => {
    it('previews historical version content when version parameter is provided', async () => {
      // Mock findVersion resolution
      mockTemplateFindOne.mockResolvedValue({
        _id: templateId,
        workspaceId: wsA,
        version: 3,
        subject: 'Latest Subject v3',
        body: 'Latest Body v3'
      });

      mockTemplateVersionFindOne.mockResolvedValue({
        templateId,
        workspaceId: wsA,
        version: 1,
        name: 'Template 1',
        subject: 'Preview Historical Subject v1 {{contact.firstName}}',
        body: 'Preview Historical Body v1 for {{company.name}}',
        variables: ['contact.firstName', 'company.name']
      });

      const service = new OutreachService(wsA);
      const preview = await service.previewTemplate(templateId, undefined, 1);

      expect(preview.subject).toContain('John');
      expect(preview.body).toContain('Acme Corp');
      expect(preview.subject).toContain('Historical Subject v1');
    });
  });
});
