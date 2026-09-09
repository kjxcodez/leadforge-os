import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CampaignService } from './campaign.service.js';
import { CampaignModel } from '../../db/models/campaign.model.js';
import { CampaignRepository } from '../../repositories/campaign/campaign.repository.js';
import { ConflictError } from '../../errors/index.js';

// Mocks
vi.mock('../../db/models/campaign.model.js', () => ({
  CampaignModel: {
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
    updateMany: vi.fn()
  }
}));

vi.mock('../../repositories/campaign/campaign.repository.js', () => {
  return {
    CampaignRepository: class {
      findById = vi.fn();
      paginate = vi.fn();
      create = vi.fn();
      delete = vi.fn();
    }
  };
});

vi.mock('../../db/models/index.js', () => ({
  JobModel: {
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 })
  },
  SequenceExecutionModel: {
    find: vi.fn().mockReturnValue({ distinct: vi.fn().mockResolvedValue([]) }),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 })
  }
}));

describe('Phase 3 — Server-Side Campaign Idempotency Suite', () => {
  const workspaceId = 'ws_phase3_test';
  let campaignService: CampaignService;
  let mockRepo: any;

  beforeEach(() => {
    vi.clearAllMocks();
    campaignService = new CampaignService(workspaceId);
    mockRepo = (campaignService as any).campaignRepository;
  });

  it('creates campaign and persists idempotencyKey on initial submission', async () => {
    const idempotencyKey = 'key_unique_initial_1';
    (CampaignModel.findOne as any).mockResolvedValue(null);

    const mockCreated = {
      _id: 'camp_created_1',
      id: 'camp_created_1',
      workspaceId,
      name: 'Spring Outreach',
      idempotencyKey,
      status: 'ACTIVE',
      createdAt: new Date()
    };
    mockRepo.create.mockResolvedValue(mockCreated);

    const result = await campaignService.createCampaign({
      name: 'Spring Outreach',
      idempotencyKey
    } as any);

    expect(result).toEqual(mockCreated);
    expect(CampaignModel.findOne).toHaveBeenCalledWith({
      workspaceId,
      idempotencyKey,
      deletedAt: null
    });
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Spring Outreach',
        idempotencyKey
      })
    );
  });

  it('returns existing campaign when duplicate request arrives within 60 seconds (no second record created)', async () => {
    const idempotencyKey = 'key_duplicate_window_60s';
    const createdAt = new Date(Date.now() - 25000); // 25 seconds ago (< 60s)

    const existingCampaign = {
      _id: 'camp_existing_1',
      id: 'camp_existing_1',
      workspaceId,
      name: 'Spring Outreach',
      idempotencyKey,
      status: 'ACTIVE',
      createdAt
    };
    (CampaignModel.findOne as any).mockResolvedValue(existingCampaign);

    const result = await campaignService.createCampaign({
      name: 'Spring Outreach',
      idempotencyKey
    } as any);

    expect(result).toBe(existingCampaign);
    // Crucial requirement: repository.create must NOT be called for duplicate
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('deterministically resolves concurrent duplicate race when unique constraint collision occurs', async () => {
    const idempotencyKey = 'key_concurrent_race_1';

    // 1. Concurrent check: findOne returns null for both simultaneous requests
    (CampaignModel.findOne as any)
      .mockResolvedValueOnce(null) // First check finds nothing
      .mockResolvedValueOnce({    // Second check after 11000 collision finds the winner's record
        _id: 'camp_winner_1',
        id: 'camp_winner_1',
        workspaceId,
        name: 'Race Campaign',
        idempotencyKey,
        status: 'ACTIVE',
        createdAt: new Date()
      });

    // 2. repo.create throws ConflictError (code 11000)
    const duplicateKeyError = new ConflictError(
      'A record with this unique constraint already exists.',
      { idempotencyKey }
    );
    (duplicateKeyError as any).code = 11000;
    mockRepo.create.mockRejectedValue(duplicateKeyError);

    const result = await campaignService.createCampaign({
      name: 'Race Campaign',
      idempotencyKey
    } as any);

    expect(result).toBeDefined();
    expect((result as any).id).toBe('camp_winner_1');
  });

  it('rejects duplicate request when idempotency window exceeds 60 seconds', async () => {
    const idempotencyKey = 'key_stale_expired_window';
    const createdAt = new Date(Date.now() - 75000); // 75 seconds ago (> 60s)

    const staleCampaign = {
      _id: 'camp_stale_1',
      id: 'camp_stale_1',
      workspaceId,
      name: 'Stale Campaign',
      idempotencyKey,
      status: 'ACTIVE',
      createdAt
    };
    (CampaignModel.findOne as any).mockResolvedValue(staleCampaign);

    await expect(
      campaignService.createCampaign({
        name: 'Stale Campaign',
        idempotencyKey
      } as any)
    ).rejects.toThrow(ConflictError);

    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('creates campaign normally without idempotency checks when no key is provided', async () => {
    const mockCreated = {
      _id: 'camp_no_key_1',
      id: 'camp_no_key_1',
      workspaceId,
      name: 'Standard Campaign',
      status: 'DRAFT',
      createdAt: new Date()
    };
    mockRepo.create.mockResolvedValue(mockCreated);

    const result = await campaignService.createCampaign({
      name: 'Standard Campaign'
    });

    expect(result).toEqual(mockCreated);
    expect(CampaignModel.findOne).not.toHaveBeenCalled();
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Standard Campaign'
      })
    );
  });
});
