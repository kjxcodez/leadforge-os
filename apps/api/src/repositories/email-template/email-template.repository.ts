import { BaseRepository } from '../base/base.repository.js';
import {
  EmailTemplateModel,
  type EmailTemplateDocument,
  TemplateVersionModel,
  type TemplateVersionDocument
} from '../../db/models/email-template.model.js';

export class EmailTemplateRepository extends BaseRepository<EmailTemplateDocument> {
  constructor(workspaceId?: string) {
    super(EmailTemplateModel, workspaceId);
  }

  public async findByName(name: string): Promise<EmailTemplateDocument | null> {
    return this.findOne({ name });
  }

  /**
   * Updates an email template while preserving an immutable historical snapshot in TemplateVersionModel.
   * Increments the template version monotonically.
   */
  public async updateWithVersioning(
    id: string,
    dto: Partial<EmailTemplateDocument>
  ): Promise<EmailTemplateDocument | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const currentVersion = existing.version || 1;

    // 1. Archive prior state into TemplateVersionModel
    try {
      await TemplateVersionModel.create({
        workspaceId: existing.workspaceId,
        templateId: existing._id.toString(),
        version: currentVersion,
        name: existing.name,
        subject: existing.subject,
        body: existing.body,
        variables: existing.variables || [],
        attachments: existing.attachments || []
      });
    } catch (err: any) {
      // If version snapshot already exists (e.g. unique constraint), proceed
      if (err?.code !== 11000) {
        console.warn('[EmailTemplateRepository] Warning archiving template version snapshot:', err);
      }
    }

    // 2. Increment version and save updated template
    const nextVersion = currentVersion + 1;
    return this.update(id, {
      ...dto,
      version: nextVersion
    });
  }

  /**
   * Retrieves a specific historical version snapshot of a template.
   * If the requested version is the current version, returns the active document.
   */
  public async findVersion(
    templateId: string,
    version: number
  ): Promise<{
    id: string;
    templateId: string;
    workspaceId?: string;
    name: string;
    subject: string;
    body: string;
    variables: string[];
    attachments: any[];
    version: number;
    createdAt?: Date;
  } | null> {
    let current: EmailTemplateDocument | null = null;
    try {
      current = await this.findById(templateId);
    } catch {
      // If the active template is deleted or does not exist in the current collection,
      // proceed to check archived historical snapshots in TemplateVersionModel
      current = null;
    }

    if (current && (current.version || 1) === version) {
      return {
        id: current._id ? current._id.toString() : (current as any).id || templateId,
        templateId: current._id ? current._id.toString() : (current as any).id || templateId,
        workspaceId: current.workspaceId,
        name: current.name,
        subject: current.subject,
        body: current.body,
        variables: current.variables || [],
        attachments: current.attachments || [],
        version: current.version || 1,
        createdAt: current.createdAt
      };
    }

    const archived = await TemplateVersionModel.findOne({
      templateId,
      version,
      ...(this.workspaceId ? { workspaceId: this.workspaceId } : {})
    });

    if (archived) {
      return {
        id: (archived as any)._id ? (archived as any)._id.toString() : (archived as any).id || templateId,
        templateId: archived.templateId || templateId,
        workspaceId: archived.workspaceId,
        name: archived.name || '',
        subject: archived.subject,
        body: archived.body,
        variables: archived.variables || [],
        attachments: archived.attachments || [],
        version: archived.version,
        createdAt: archived.createdAt
      };
    }

    // Strictly return null if the requested historical version does not exist.
    // Never fall back to an active template with a differing version.
    return null;
  }
}
