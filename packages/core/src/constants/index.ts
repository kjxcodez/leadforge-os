export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

export const COLLECTION_NAMES = {
  COMPANIES: 'companies',
  CONTACTS: 'contacts',
  CAMPAIGNS: 'campaigns',
  WORKFLOWS: 'workflows',
  WORKSPACES: 'workspaces',
  USERS: 'users',
  SESSIONS: 'sessions',
  OPPORTUNITIES: 'opportunities',
  OUTREACH: 'outreach',
} as const;

export const LIMITS = {
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
  FILE_SIZE: {
    MAX_UPLOAD_MB: 10,
  },
  RATE_LIMIT: {
    PUBLIC_WINDOW_MS: 15 * 60 * 1000,
    PUBLIC_MAX_REQUESTS: 100,
  },
};

export const TIMEOUTS = {
  API_REQUEST: 30000,
  DB_CONNECTION: 10000,
  WORKFLOW_STEP: 60000,
};
