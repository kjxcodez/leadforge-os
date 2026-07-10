import { OutreachRepository } from "../../repositories/outreach/outreach.repository.js";
import type { OutreachDocument } from "../../db/models/outreach.model.js";
import { createOutreachDtoSchema, type CreateOutreachDto } from "@leadforge/schema";

export class OutreachService {
  private outreachRepository: OutreachRepository;

  constructor(workspaceId: string) {
    this.outreachRepository = new OutreachRepository(workspaceId);
  }

  public async getOutreachById(id: string): Promise<OutreachDocument> {
    return this.outreachRepository.findById(id);
  }

  public async listOutreach(page?: number, limit?: number): Promise<{ data: OutreachDocument[]; total: number }> {
    return this.outreachRepository.paginate({}, page, limit);
  }

  public async createOutreach(dto: CreateOutreachDto): Promise<OutreachDocument> {
    const validated = createOutreachDtoSchema.parse(dto);
    return this.outreachRepository.create({
      ...validated,
      attempts: 0,
      status: validated.status || "pending",
    });
  }

  public async updateOutreach(id: string, data: Partial<OutreachDocument>): Promise<OutreachDocument> {
    return this.outreachRepository.update(id, data);
  }

  public async deleteOutreach(id: string): Promise<boolean> {
    return this.outreachRepository.delete(id);
  }
}
