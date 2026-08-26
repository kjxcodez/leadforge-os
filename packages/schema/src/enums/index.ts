export enum CompanyStatus {
  LEAD = 'LEAD',
  QUALIFIED = 'QUALIFIED',
  CUSTOMER = 'CUSTOMER',
  ARCHIVED = 'ARCHIVED'
}

export enum OpportunityStage {
  PROSPECTING = 'PROSPECTING',
  QUALIFICATION = 'QUALIFICATION',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  CLOSED_WON = 'CLOSED_WON',
  CLOSED_LOST = 'CLOSED_LOST'
}

export enum OutreachChannel {
  EMAIL = 'EMAIL',
  LINKEDIN = 'LINKEDIN',
  CALL = 'CALL'
}

/**
 * Email account provider identifiers. `gmail_oauth` represents a Gmail
 * mailbox connected through Google OAuth 2.0 (Gmail API, gmail.send scope).
 */
export enum EmailAccountProvider {
  GMAIL_OAUTH = 'gmail_oauth',
  OTHER = 'other'
}

/**
 * Mailbox connection states.
 * - CONNECTED: OAuth tokens valid and sending is permitted.
 * - REAUTH_REQUIRED: access/refresh token expired, revoked, or invalid —
 *   the user must re-authorize the mailbox.
 * - DISCONNECTED: the mailbox was intentionally disconnected/revoked.
 * - FAILED: last verification/send attempt failed.
 * - DISABLED: account administratively disabled.
 */
export enum EmailAccountStatus {
  CONNECTED = 'connected',
  REAUTH_REQUIRED = 'reauth_required',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed',
  DISABLED = 'disabled'
}

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER'
}

export enum WorkflowStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR'
}

export enum WorkflowStepType {
  DISCOVER = 'DISCOVER',
  ENRICH = 'ENRICH',
  VERIFY = 'VERIFY',
  QUALIFY = 'QUALIFY',
  SEND = 'SEND'
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED'
}

export enum ContactStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  REPLIED = 'REPLIED',
  BOUNCED = 'BOUNCED',
  UNSUBSCRIBED = 'UNSUBSCRIBED'
}

export enum ErrorCode {
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500
}

export enum WorkspaceRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  READ_ONLY = 'READ_ONLY',
  BILLING = 'BILLING'
}

export enum WorkspacePermission {
  MANAGE_WORKSPACE = 'MANAGE_WORKSPACE',
  INVITE_MEMBERS = 'INVITE_MEMBERS',
  MANAGE_MEMBERS = 'MANAGE_MEMBERS',
  TRANSFER_OWNERSHIP = 'TRANSFER_OWNERSHIP',
  VIEW_SETTINGS = 'VIEW_SETTINGS',
  CREATE_CAMPAIGNS = 'CREATE_CAMPAIGNS'
}

export enum WorkspaceMemberStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED'
}

export enum AutomationTriggerType {
  CONTACT_CREATED = 'CONTACT_CREATED',
  COMPANY_CREATED = 'COMPANY_CREATED',
  DISCOVERY_IMPORT_COMPLETED = 'DISCOVERY_IMPORT_COMPLETED',
  CAMPAIGN_COMPLETED = 'CAMPAIGN_COMPLETED',
  EMAIL_SENT = 'EMAIL_SENT',
  EMAIL_REPLIED = 'EMAIL_REPLIED',
  EMAIL_BOUNCED = 'EMAIL_BOUNCED',
  TAG_ADDED = 'TAG_ADDED',
  PIPELINE_STAGE_CHANGED = 'PIPELINE_STAGE_CHANGED',
  MANUAL = 'MANUAL'
}

export enum AutomationActionType {
  WAIT = 'WAIT',
  SEND_EMAIL = 'SEND_EMAIL',
  ASSIGN_TAG = 'ASSIGN_TAG',
  REMOVE_TAG = 'REMOVE_TAG',
  CREATE_NOTE = 'CREATE_NOTE',
  MOVE_PIPELINE_STAGE = 'MOVE_PIPELINE_STAGE',
  START_CAMPAIGN = 'START_CAMPAIGN',
  STOP_CAMPAIGN = 'STOP_CAMPAIGN',
  ASSIGN_OWNER = 'ASSIGN_OWNER',
  CREATE_ACTIVITY = 'CREATE_ACTIVITY',
  FINISH_SEQUENCE = 'FINISH_SEQUENCE'
}

export enum AutomationConditionType {
  HAS_TAG = 'HAS_TAG',
  NO_REPLY_RECEIVED = 'NO_REPLY_RECEIVED',
  REPLY_RECEIVED = 'REPLY_RECEIVED',
  EMAIL_BOUNCED = 'EMAIL_BOUNCED',
  CAMPAIGN_FINISHED = 'CAMPAIGN_FINISHED',
  PIPELINE_STAGE = 'PIPELINE_STAGE',
  LEAD_SCORE = 'LEAD_SCORE',
  COMPANY_INDUSTRY = 'COMPANY_INDUSTRY',
  COMPANY_SIZE = 'COMPANY_SIZE'
}

export enum SequenceStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED'
}

export enum ExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  WAITING = 'WAITING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}
