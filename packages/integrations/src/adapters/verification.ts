import type { BaseAdapter } from '../common/adapter';
import type { IntegrationMetadata, IntegrationStatus } from '../common/types';

export interface VerificationResult {
  email: string;
  valid: boolean;
  score: number; // 0 to 100
  disposable: boolean;
  role: boolean;
}

export interface VerificationAdapter extends BaseAdapter {
  verifyEmail(email: string): Promise<VerificationResult>;
}

// Stub implementation
export class StubVerificationAdapter implements VerificationAdapter {
  public getMetadata(): IntegrationMetadata {
    return {
      id: 'stub-verification',
      name: 'Stub Verification (Dev Mode)',
      type: 'verification',
      version: '1.0.0',
    };
  }

  public async testConnection(): Promise<IntegrationStatus> {
    return { connected: true };
  }

  public async verifyEmail(email: string): Promise<VerificationResult> {
    console.log(`[StubVerification] Verifying email: ${email}`);
    const valid = !email.endsWith('.invalid') && !email.includes('bounce');
    return {
      email,
      valid,
      score: valid ? 95 : 10,
      disposable: false,
      role: email.startsWith('info') || email.startsWith('contact'),
    };
  }
}
