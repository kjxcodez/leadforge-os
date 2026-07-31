export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ApprovalRequirement {
  readonly required: boolean;
  readonly reason?: string;
  readonly riskLevel: RiskLevel;
}
