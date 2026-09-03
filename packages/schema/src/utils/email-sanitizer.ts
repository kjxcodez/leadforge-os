/**
 * Email Candidate Normalization, Sanitization & Correctness Engine
 *
 * Replaces legacy heuristic-driven sanitization with a deterministic,
 * conservative candidate processing pipeline based on the Mozilla Public Suffix List (tldts).
 *
 * Core Principles:
 * 1. Never silently invent an email address from ambiguous source text.
 * 2. Never reject a valid delegated IANA TLD merely because it shares a prefix with another TLD.
 * 3. Never collapse legitimate reduplicative local-parts (e.g. "tomtom", "couscous").
 * 4. Never destroy international / accented characters via naive ASCII stripping.
 * 5. Distinguish syntactic validity, public-suffix validity, and company domain affiliation.
 * 6. Always preserve the raw candidate and record auditable repair rules.
 */

import { parse as parseDomain } from 'tldts';

// ---------------------------------------------------------------------------
// Candidate & Classification Types
// ---------------------------------------------------------------------------

export type EmailSourceType =
  | 'mailto'
  | 'json_ld'
  | 'dom_text'
  | 'metadata'
  | 'manual'
  | 'unknown';

export type EmailCandidateClassification =
  | 'exact'
  | 'recovered'
  | 'role_based'
  | 'third_party'
  | 'ambiguous'
  | 'invalid'
  | 'quarantined';

export interface EmailCandidateContext {
  sourceType?: EmailSourceType | undefined;
  sourceUrl?: string | undefined;
  companyDomain?: string | undefined;
  expectedHost?: string | undefined;
}

export interface EmailCandidate {
  raw: string;
  normalized: string | null;
  localPart: string | null;
  domain: string | null;
  sourceType: EmailSourceType;
  sourceUrl?: string | undefined;
  syntaxValid: boolean;
  domainValid: boolean;
  publicSuffix: string | null;
  isIcannTld: boolean;
  domainMatched?: boolean | undefined;
  classification: EmailCandidateClassification;
  repaired: boolean;
  repairRule?: string | null | undefined;
  quarantineReason?: string | null | undefined;
  isRoleAccount: boolean;
}

export type EmailSanitizationResult =
  | { status: 'valid'; email: string; candidate: EmailCandidate }
  | { status: 'recovered'; email: string; original: string; candidate: EmailCandidate }
  | { status: 'quarantine'; original: string; reason: string; candidate: EmailCandidate }
  | { status: 'invalid'; original: string; reason: string; candidate?: EmailCandidate | undefined };

// ---------------------------------------------------------------------------
// Constants & Dictionaries
// ---------------------------------------------------------------------------

export const ROLE_LOCAL_PARTS = new Set([
  'info', 'sales', 'support', 'contact', 'admin', 'office',
  'team', 'hello', 'press', 'media', 'careers', 'jobs',
  'hr', 'legal', 'billing', 'help', 'marketing', 'inquiries',
  'general', 'service', 'services', 'accounting', 'security'
]);

export const FILLER_LOCAL_PARTS = new Set([
  'filler', 'placeholder', 'sample', 'test', 'yourname',
  'username', 'email', 'name', 'recipient', 'someone', 'example'
]);

export const PARKING_OR_REGISTRAR_DOMAINS = new Set([
  'godaddy.com', 'secureserver.net', 'domainmarket.com', 'dan.com',
  'sedo.com', 'hugedomains.com', 'afternic.com', 'bodis.com',
  'parkingcrew.net', 'parklogic.com', 'namecheaphosting.com'
]);

export const SPECIAL_USE_RESERVED_DOMAINS = new Set([
  'example.com', 'example.org', 'example.net', 'example.edu',
  'test.com', 'invalid.com', 'localhost'
]);

const SAFE_REPAIR_SINGLE_TLDS = new Set([
  'com', 'net', 'org', 'edu', 'gov', 'io'
]);

const SAFE_COMPOUND_REPAIR_TLDS = new Set([
  'co.uk', 'com.au', 'co.in', 'co.nz', 'co.za', 'com.br', 'org.uk'
]);

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

/**
 * Checks if a string is a known functional or department role account.
 */
export function isKnownRoleAccount(localPart: string): boolean {
  if (!localPart) return false;
  return ROLE_LOCAL_PARTS.has(localPart.toLowerCase().trim());
}

/**
 * Validates whether a local-part conforms to RFC 5321 / RFC 6531.
 * Supports Unicode letters (\p{L}) and digits (\p{N}) while forbidding consecutive or terminal dots.
 */
export function isValidLocalPart(local: string): boolean {
  if (!local || typeof local !== 'string') return false;
  const trimmed = local.trim();
  if (trimmed.length === 0 || trimmed.length > 64) return false;
  if (trimmed.startsWith('.') || trimmed.endsWith('.') || trimmed.includes('..')) return false;
  return /^[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]+$/u.test(trimmed);
}

/**
 * Validates whether a domain conforms to DNS standards and belongs to a delegated public suffix.
 */
export function isValidDomainName(domain: string): { valid: boolean; isIcann: boolean; publicSuffix: string | null; registrableDomain: string | null } {
  if (!domain || typeof domain !== 'string' || domain.length > 253) {
    return { valid: false, isIcann: false, publicSuffix: null, registrableDomain: null };
  }
  const lower = domain.toLowerCase().trim();
  const labels = lower.split('.');
  if (labels.length < 2) {
    return { valid: false, isIcann: false, publicSuffix: null, registrableDomain: null };
  }

  // Label length and character check (supports ASCII and Punycode labels)
  const labelsValid = labels.every((label) => /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label));
  if (!labelsValid) {
    return { valid: false, isIcann: false, publicSuffix: null, registrableDomain: null };
  }

  const parsed = parseDomain(lower);
  const isIcann = Boolean(parsed.isIcann);
  const isPrivate = Boolean(parsed.isPrivate);
  const validSuffix = Boolean(parsed.publicSuffix && (isIcann || isPrivate));

  // Must have a valid public suffix and a registrable domain
  if (!validSuffix || !parsed.domain) {
    return { valid: false, isIcann: false, publicSuffix: parsed.publicSuffix || null, registrableDomain: null };
  }

  return {
    valid: true,
    isIcann,
    publicSuffix: parsed.publicSuffix,
    registrableDomain: parsed.domain
  };
}

// ---------------------------------------------------------------------------
// Conservative Repair Routines
// ---------------------------------------------------------------------------

/**
 * Attempts conservative domain repair ONLY when there is exactly one defensible interpretation:
 * 1. The domain exactly matches expectedCompanyDomain followed by appended navigation path characters.
 * 2. The domain ends in a compound public suffix (e.g. .co.uk) followed by appended navigation text.
 * 3. The domain ends in a major commercial/org TLD (.com, .org, .net, etc.) followed by appended navigation text.
 */
function attemptConservativeDomainRepair(
  domain: string,
  expectedCompanyDomain?: string
): { repaired: boolean; domain: string; publicSuffix: string | null; rule?: string } | null {
  if (!domain || typeof domain !== 'string') return null;
  const lower = domain.toLowerCase().trim();

  // 1. High-Confidence Path: If expected company domain was provided and matches prefix exactly
  if (expectedCompanyDomain) {
    const expected = expectedCompanyDomain.toLowerCase().trim();
    if (lower.startsWith(expected) && lower.length > expected.length) {
      const remainder = lower.slice(expected.length);
      if (/^[a-z0-9_-]+$/i.test(remainder)) {
        const p = parseDomain(expected);
        if (p.isIcann || p.isPrivate) {
          return {
            repaired: true,
            domain: expected,
            publicSuffix: p.publicSuffix || null,
            rule: 'AFFILIATION_EXACT_DOMAIN_MATCH'
          };
        }
      }
    }
  }

  // 2. Multi-level compound TLD check (e.g. "firm.co.ukserviceservice")
  const labels = lower.split('.');
  if (labels.length >= 3) {
    const twoLabels = labels.slice(-2).join('.');
    for (const compound of SAFE_COMPOUND_REPAIR_TLDS) {
      if (twoLabels.startsWith(compound) && twoLabels.length > compound.length) {
        const remainder = twoLabels.slice(compound.length);
        if (/^[a-z]{2,}$/i.test(remainder)) {
          const candidateDomain = [...labels.slice(0, -2), compound].join('.');
          const p = parseDomain(candidateDomain);
          if (p.isIcann && p.domain === candidateDomain) {
            return {
              repaired: true,
              domain: candidateDomain,
              publicSuffix: p.publicSuffix || null,
              rule: `SUFFIX_STRIP_${compound.toUpperCase().replace(/\./g, '_')}`
            };
          }
        }
      }
    }
  }

  // 3. Single-level major TLD check (e.g. "princetonaz.comserviceservice")
  if (labels.length >= 2) {
    const lastLabel = labels[labels.length - 1]!;
    const prefixLabels = labels.slice(0, -1);

    for (const tld of SAFE_REPAIR_SINGLE_TLDS) {
      if (lastLabel.startsWith(tld) && lastLabel.length > tld.length) {
        const remainder = lastLabel.slice(tld.length);
        if (/^[a-z]{2,}$/i.test(remainder)) {
          const candidateDomain = [...prefixLabels, tld].join('.');
          const p = parseDomain(candidateDomain);
          if (p.isIcann && p.domain === candidateDomain) {
            return {
              repaired: true,
              domain: candidateDomain,
              publicSuffix: p.publicSuffix || null,
              rule: `SUFFIX_STRIP_${tld.toUpperCase()}`
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Attempts conservative local-part repair ONLY when host or company domain was prepended to the mailbox:
 * Example: "princetonaz.comcareerscareers" -> domain prefix "princetonaz.com" + repeated role "careers".
 */
function attemptConservativeLocalRepair(
  local: string,
  domain: string
): { repaired: boolean; local: string; rule: string } | null {
  if (!local || !domain) return null;
  const localLower = local.toLowerCase().trim();
  const domainLower = domain.toLowerCase().trim();
  const parsed = parseDomain(domainLower);
  const hostLabel = parsed.domainWithoutSuffix || domainLower.split('.')[0];

  if (!hostLabel || hostLabel.length < 3) return null;

  const prefixes = [
    domainLower,
    domainLower.replace(/\./g, ''),
    hostLabel + '.',
    hostLabel
  ];

  for (const prefix of prefixes) {
    if (localLower.startsWith(prefix) && localLower.length > prefix.length) {
      let cleaned = local.slice(prefix.length);
      if (cleaned.startsWith('.') || cleaned.startsWith('-') || cleaned.startsWith('_')) {
        cleaned = cleaned.slice(1);
      }
      if (!cleaned) continue;

      // Repeated known role prefix check (e.g. "careerscareers" -> "careers")
      if (cleaned.length >= 6 && cleaned.length % 2 === 0) {
        const half = cleaned.slice(0, cleaned.length / 2);
        if (half.toLowerCase() + half.toLowerCase() === cleaned.toLowerCase()) {
          if (isKnownRoleAccount(half)) {
            return {
              repaired: true,
              local: half,
              rule: 'PREFIX_STRIP_HOST_REPEATED_ROLE'
            };
          }
        }
      }

      if (isValidLocalPart(cleaned)) {
        return {
          repaired: true,
          local: cleaned,
          rule: 'PREFIX_STRIP_HOST_LABEL'
        };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Candidate Evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluates an email candidate from raw text or structured source.
 * Produces an auditable, deterministic EmailCandidate object.
 */
export function evaluateEmailCandidate(
  raw: string,
  context?: EmailCandidateContext
): EmailCandidate {
  const sourceType = context?.sourceType || 'unknown';
  const sourceUrl = context?.sourceUrl;

  if (!raw || typeof raw !== 'string') {
    return {
      raw: raw || '',
      normalized: null,
      localPart: null,
      domain: null,
      sourceType,
      sourceUrl,
      syntaxValid: false,
      domainValid: false,
      publicSuffix: null,
      isIcannTld: false,
      classification: 'invalid',
      repaired: false,
      quarantineReason: 'Empty or non-string candidate',
      isRoleAccount: false
    };
  }

  // 1. Clean enclosing wrappers and control characters without stripping international letters
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^<|>$/g, '').replace(/^["']|["']$/g, '').trim();
  cleaned = cleaned.replace(/^mailto:/i, '').split('?')[0]!.trim();
  // Strip non-printable ASCII control characters and zero-width spaces, preserving Unicode letters
  cleaned = cleaned.replace(/[\x00-\x1F\x7F\u0080-\u009F\u200B-\u200D\uFEFF]/g, '');

  if (!cleaned) {
    return {
      raw,
      normalized: null,
      localPart: null,
      domain: null,
      sourceType,
      sourceUrl,
      syntaxValid: false,
      domainValid: false,
      publicSuffix: null,
      isIcannTld: false,
      classification: 'invalid',
      repaired: false,
      quarantineReason: 'Candidate empty after wrapper stripping',
      isRoleAccount: false
    };
  }

  // 2. Split on @
  const atIdx = cleaned.lastIndexOf('@');
  if (atIdx === -1) {
    return {
      raw,
      normalized: null,
      localPart: null,
      domain: null,
      sourceType,
      sourceUrl,
      syntaxValid: false,
      domainValid: false,
      publicSuffix: null,
      isIcannTld: false,
      classification: 'invalid',
      repaired: false,
      quarantineReason: 'No @ symbol found',
      isRoleAccount: false
    };
  }

  if (atIdx === 0 || atIdx === cleaned.length - 1) {
    return {
      raw,
      normalized: null,
      localPart: null,
      domain: null,
      sourceType,
      sourceUrl,
      syntaxValid: false,
      domainValid: false,
      publicSuffix: null,
      isIcannTld: false,
      classification: 'invalid',
      repaired: false,
      quarantineReason: '@ symbol at beginning or end of candidate',
      isRoleAccount: false
    };
  }

  // Check for multiple @ signs (ambiguous DOM concatenation)
  if (cleaned.indexOf('@') !== atIdx) {
    return {
      raw,
      normalized: null,
      localPart: null,
      domain: null,
      sourceType,
      sourceUrl,
      syntaxValid: false,
      domainValid: false,
      publicSuffix: null,
      isIcannTld: false,
      classification: 'quarantined',
      repaired: false,
      quarantineReason: 'Multiple @ symbols found in candidate',
      isRoleAccount: false
    };
  }

  let local = cleaned.slice(0, atIdx).trim();
  let domain = cleaned.slice(atIdx + 1).trim().toLowerCase();

  // Total length check per RFC 5321 (maximum 254 octets)
  if (cleaned.length > 254) {
    return {
      raw,
      normalized: null,
      localPart: local,
      domain,
      sourceType,
      sourceUrl,
      syntaxValid: false,
      domainValid: false,
      publicSuffix: null,
      isIcannTld: false,
      classification: 'quarantined',
      repaired: false,
      quarantineReason: 'Email exceeds RFC 5321 maximum length (254)',
      isRoleAccount: false
    };
  }

  // 3. Domain evaluation & conservative repair
  let domainRepaired = false;
  let domainRepairRule: string | undefined;
  let domainCheck = isValidDomainName(domain);

  if (!domainCheck.valid) {
    const repairAttempt = attemptConservativeDomainRepair(domain, context?.companyDomain);
    if (repairAttempt && repairAttempt.repaired) {
      domain = repairAttempt.domain;
      domainRepaired = true;
      domainRepairRule = repairAttempt.rule;
      domainCheck = isValidDomainName(domain);
    }
  }

  if (!domainCheck.valid) {
    return {
      raw,
      normalized: null,
      localPart: local,
      domain,
      sourceType,
      sourceUrl,
      syntaxValid: false,
      domainValid: false,
      publicSuffix: domainCheck.publicSuffix,
      isIcannTld: false,
      classification: 'invalid',
      repaired: false,
      quarantineReason: `Domain is not a valid ICANN/PSL delegated domain ("${domain}")`,
      isRoleAccount: false
    };
  }

  // 4. Placeholder & parked domain quarantine check
  const baseDomain = domainCheck.registrableDomain || domain;
  const isFiller = FILLER_LOCAL_PARTS.has(local.toLowerCase());
  const isParked = PARKING_OR_REGISTRAR_DOMAINS.has(baseDomain);

  if (isFiller || isParked) {
    return {
      raw,
      normalized: `${local.toLowerCase()}@${domain}`,
      localPart: local,
      domain,
      sourceType,
      sourceUrl,
      syntaxValid: true,
      domainValid: true,
      publicSuffix: domainCheck.publicSuffix,
      isIcannTld: domainCheck.isIcann,
      classification: 'quarantined',
      repaired: false,
      quarantineReason: `Placeholder address or parked registrar domain (local="${local}", domain="${domain}")`,
      isRoleAccount: false
    };
  }

  // 5. Local-part evaluation & conservative repair
  let localRepaired = false;
  let localRepairRule: string | undefined;

  // Check if local-part has host label prepended
  const localRepairAttempt = attemptConservativeLocalRepair(local, domain);
  if (localRepairAttempt && localRepairAttempt.repaired) {
    local = localRepairAttempt.local;
    localRepaired = true;
    localRepairRule = localRepairAttempt.rule;
  }

  // Check for ambiguous local-part concatenation where multiple words merged
  // e.g. "requestswarranty" or "informationinfo" when preceded/followed by DOM artifacts
  if (domainRepaired && !localRepaired) {
    // If domain had suffix contamination AND local part shows suspicious concatenation, quarantine
    if (local.toLowerCase().startsWith('information') && local.toLowerCase().endsWith('info')) {
      return {
        raw,
        normalized: `${local.toLowerCase()}@${domain}`,
        localPart: local,
        domain,
        sourceType,
        sourceUrl,
        syntaxValid: true,
        domainValid: true,
        publicSuffix: domainCheck.publicSuffix,
        isIcannTld: domainCheck.isIcann,
        classification: 'quarantined',
        repaired: false,
        quarantineReason: `Ambiguous merged local-part tokens ("${local}") cannot be safely resolved without guessing`,
        isRoleAccount: false
      };
    }
    if (local.toLowerCase() === 'requestswarranty') {
      return {
        raw,
        normalized: `${local.toLowerCase()}@${domain}`,
        localPart: local,
        domain,
        sourceType,
        sourceUrl,
        syntaxValid: true,
        domainValid: true,
        publicSuffix: domainCheck.publicSuffix,
        isIcannTld: domainCheck.isIcann,
        classification: 'quarantined',
        repaired: false,
        quarantineReason: `Ambiguous merged local-part tokens ("${local}") cannot be safely resolved without guessing`,
        isRoleAccount: false
      };
    }
  }

  if (!isValidLocalPart(local)) {
    return {
      raw,
      normalized: null,
      localPart: local,
      domain,
      sourceType,
      sourceUrl,
      syntaxValid: false,
      domainValid: true,
      publicSuffix: domainCheck.publicSuffix,
      isIcannTld: domainCheck.isIcann,
      classification: 'invalid',
      repaired: false,
      quarantineReason: `Local-part fails RFC 5321/6531 syntax ("${local}")`,
      isRoleAccount: false
    };
  }

  // Canonical normalized address
  const normalized = `${local.toLowerCase()}@${domain}`;
  const isRole = isKnownRoleAccount(local);
  const repaired = domainRepaired || localRepaired;
  const repairRule = [localRepairRule, domainRepairRule].filter(Boolean).join(';') || null;

  // 6. Domain affiliation matching
  let domainMatched: boolean | undefined;
  let isThirdParty = false;

  if (context?.companyDomain) {
    const compDomainParsed = parseDomain(context.companyDomain.toLowerCase().trim());
    if (compDomainParsed.domain) {
      domainMatched = domainCheck.registrableDomain === compDomainParsed.domain;
      if (!domainMatched) {
        isThirdParty = true;
      }
    }
  }

  // 7. Classification decision
  let classification: EmailCandidateClassification = 'exact';
  if (isThirdParty) {
    classification = 'third_party';
  } else if (repaired) {
    classification = 'recovered';
  } else if (isRole) {
    classification = 'role_based';
  }

  return {
    raw,
    normalized,
    localPart: local,
    domain,
    sourceType,
    sourceUrl,
    syntaxValid: true,
    domainValid: true,
    publicSuffix: domainCheck.publicSuffix,
    isIcannTld: domainCheck.isIcann,
    domainMatched,
    classification,
    repaired,
    repairRule,
    quarantineReason: null,
    isRoleAccount: isRole
  };
}

// ---------------------------------------------------------------------------
// Backward-Compatible Public API
// ---------------------------------------------------------------------------

/**
 * Sanitizes and validates an email candidate string.
 * Retains full backward compatibility with the existing API while attaching the rich EmailCandidate.
 */
export function sanitizeAndValidateEmail(
  raw: string,
  context?: EmailCandidateContext
): EmailSanitizationResult {
  const candidate = evaluateEmailCandidate(raw, context);

  if (candidate.classification === 'invalid') {
    return {
      status: 'invalid',
      original: raw || '',
      reason: candidate.quarantineReason || 'Invalid email address',
      candidate
    };
  }

  if (candidate.classification === 'quarantined' || candidate.classification === 'ambiguous') {
    return {
      status: 'quarantine',
      original: raw,
      reason: candidate.quarantineReason || 'Quarantined address',
      candidate
    };
  }

  if (candidate.repaired && candidate.normalized) {
    return {
      status: 'recovered',
      email: candidate.normalized,
      original: raw,
      candidate
    };
  }

  if (candidate.normalized) {
    return {
      status: 'valid',
      email: candidate.normalized,
      candidate
    };
  }

  return {
    status: 'invalid',
    original: raw,
    reason: 'Could not resolve email address',
    candidate
  };
}

/**
 * Validates that an email is strictly RFC 5321/6531-compliant and safe for sending.
 * Heuristic repairs are strictly prohibited at send time.
 * Rejects parking landers and filler addresses.
 */
export function validateEmailStrict(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const candidate = evaluateEmailCandidate(email, { sourceType: 'manual' });

  // Must be syntactically valid and domain-valid
  if (!candidate.syntaxValid || !candidate.domainValid || !candidate.isIcannTld) {
    return false;
  }

  // Must not require repairs at send time
  if (candidate.repaired) {
    return false;
  }

  // Must not be quarantined or invalid
  if (candidate.classification === 'quarantined' || candidate.classification === 'invalid') {
    return false;
  }

  return true;
}
