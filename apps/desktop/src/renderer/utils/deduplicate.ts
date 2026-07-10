/**
 * Deduplication Engine.
 * Cross-references Discovery result metrics with existing cached CRM companies and contacts
 * using similarity matching on domains, emails, and normalized company names.
 */

export interface DeduplicationMatch {
  isCompanyDuplicate: boolean;
  matchedCompany?: any;
  duplicateContacts: Array<{
    firstName: string;
    email: string;
    matchedContact: any;
  }>;
}

/**
 * Normalizes a company name by removing whitespace, punctuation, and converting to lowercase.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Normalizes domain strings to clean protocols, subdomains, and trailing slashes.
 */
function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

/**
 * Scans local cached CRM companies and contacts to find similarities.
 */
export function checkDeduplication(
  result: { companyName: string; website?: string | null; contacts?: any[] },
  existingCompanies: any[],
  existingContacts: any[]
): DeduplicationMatch {
  const match: DeduplicationMatch = {
    isCompanyDuplicate: false,
    duplicateContacts: [],
  };

  const cleanResultName = normalizeName(result.companyName);
  const cleanResultDomain = result.website ? normalizeDomain(result.website) : '';

  // 1. Scan companies for matches
  for (const comp of existingCompanies) {
    const cleanCompName = normalizeName(comp.name || '');
    const cleanCompDomain = comp.domain ? normalizeDomain(comp.domain) : '';

    const nameMatch = cleanResultName && cleanResultName === cleanCompName;
    const domainMatch = cleanResultDomain && cleanResultDomain === cleanCompDomain;

    if (nameMatch || domainMatch) {
      match.isCompanyDuplicate = true;
      match.matchedCompany = comp;
      break; // Found first matching company
    }
  }

  // 2. Scan contacts for matches based on email
  if (result.contacts && result.contacts.length > 0) {
    for (const rawCont of result.contacts) {
      if (rawCont.email) {
        const matched = existingContacts.find(
          (c) => c.email && c.email.toLowerCase() === rawCont.email.toLowerCase()
        );
        if (matched) {
          match.duplicateContacts.push({
            firstName: rawCont.firstName,
            email: rawCont.email,
            matchedContact: matched,
          });
        }
      }
    }
  }

  return match;
}
