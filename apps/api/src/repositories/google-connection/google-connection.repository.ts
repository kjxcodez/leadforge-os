import { BaseRepository } from '../base/base.repository.js';
import { GoogleConnectionModel, type GoogleConnectionDocument } from '../../db/models/google-connection.model.js';

export class GoogleConnectionRepository extends BaseRepository<GoogleConnectionDocument> {
  constructor(workspaceId?: string) {
    super(GoogleConnectionModel, workspaceId);
  }

  public async findByGoogleAccountId(googleAccountId: string): Promise<GoogleConnectionDocument | null> {
    return this.findOne({ googleAccountId });
  }

  public async findByEmail(email: string): Promise<GoogleConnectionDocument | null> {
    return this.findOne({ email: email.toLowerCase().trim() });
  }

  public async findActiveConnections(): Promise<GoogleConnectionDocument[]> {
    return this.findMany({ status: 'active' });
  }

  public async updateTokens(
    id: string,
    tokens: {
      accessToken?: string;
      refreshToken?: string;
      tokenExpiresAt?: Date | null;
      grantedScopes?: string[];
    }
  ): Promise<GoogleConnectionDocument | null> {
    const updateSet: any = { updatedAt: new Date() };
    if (tokens.accessToken !== undefined) updateSet.encryptedAccessToken = tokens.accessToken;
    if (tokens.refreshToken !== undefined) updateSet.encryptedRefreshToken = tokens.refreshToken;
    if (tokens.tokenExpiresAt !== undefined) updateSet.tokenExpiresAt = tokens.tokenExpiresAt;
    if (tokens.grantedScopes !== undefined) updateSet.grantedScopes = tokens.grantedScopes;

    return this.atomicFindOneAndUpdate(
      { _id: id },
      { $set: updateSet }
    );
  }

  public async updateCapabilityStatus(
    id: string,
    status: {
      gmailStatus?: 'connected' | 'reauth_required' | 'revoked' | 'error';
      driveStatus?: 'authorized' | 'not_authorized' | 'reauth_required' | 'revoked' | 'error';
      status?: 'active' | 'reauth_required' | 'disconnected';
      lastError?: string | null;
      lastVerifiedAt?: Date | null;
    }
  ): Promise<GoogleConnectionDocument | null> {
    const updateSet: any = { updatedAt: new Date(), ...status };
    return this.atomicFindOneAndUpdate(
      { _id: id },
      { $set: updateSet }
    );
  }

  public async disconnect(id: string): Promise<GoogleConnectionDocument | null> {
    return this.atomicFindOneAndUpdate(
      { _id: id },
      {
        $set: {
          status: 'disconnected',
          gmailStatus: 'revoked',
          driveStatus: 'revoked',
          encryptedAccessToken: null,
          tokenExpiresAt: null,
          updatedAt: new Date()
        }
      }
    );
  }
}
