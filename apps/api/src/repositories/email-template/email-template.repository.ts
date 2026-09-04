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
  ): Promise<{ subject: string; body: string; variables: string[]; attachments: any[]; version: number } | null> {
    const current = await this.findById(templateId);
    if (current && (current.version || 1) === version) {
      return {
        subject: current.subject,
        body: current.body,
        variables: current.variables || [],
        attachments: current.attachments || [],
        version: current.version || 1
      };
    }

    const archived = await TemplateVersionModel.findOne({
      templateId,
      version,
      ...(this.workspaceId ? { workspaceId: this.workspaceId } : {})
    });

    if (archived) {
      return {
        subject: archived.subject,
        body: archived.body,
        variables: archived.variables || [],
        attachments: archived.attachments || [],
        version: archived.version
      };
    }

    return current
      ? {
          subject: current.subject,
          body: current.body,
          variables: current.variables || [],
          attachments: current.attachments || [],
          version: current.version || 1
        }
      : null;
  }
}
