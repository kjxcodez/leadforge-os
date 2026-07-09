/**
 * Centralized constant values module.
 * Never hardcode magic strings or numbers.
 */

export const API_VERSION = "1.0.0";
export const API_PREFIX = "/api/v1";

export const LIMITS = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  DB_POOL_MIN: 2,
  DB_POOL_MAX: 10,
};

export const TIMEOUTS = {
  DB_CONNECT_RETRY: 2000,
  DB_SELECTION_MS: 5000,
  SOCKET_MS: 45000,
};

export const COLLECTION_NAMES = {
  USERS: "users",
  SESSIONS: "sessions",
  ACCOUNTS: "accounts",
  VERIFICATIONS: "verifications",
  COMPANIES: "companies",
  CONTACTS: "contacts",
  CAMPAIGNS: "campaigns",
};
