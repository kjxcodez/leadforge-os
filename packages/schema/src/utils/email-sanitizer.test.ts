/**
 * Deterministic Test Suite: Email Candidate Normalization & Validation
 *
 * Covers all corruption classes, invariants, and structural categories
 * defined in Phase 2: Email Discovery Remediation.
 */

import {
  evaluateEmailCandidate,
  sanitizeAndValidateEmail,
  validateEmailStrict,
  type EmailCandidate
} from './email-sanitizer.js';

interface TestCase {
  category: string;
  name: string;
  input: string;
  context?: {
    companyDomain?: string;
    sourceType?: 'mailto' | 'json_ld' | 'dom_text' | 'metadata' | 'manual';
    sourceUrl?: string;
  };
  expectedStatus: 'valid' | 'recovered' | 'quarantine' | 'invalid';
  expectedEmail?: string;
  expectedClassification?: string;
  expectedRepaired?: boolean;
  expectedDomainMatched?: boolean;
  validateStrictExpected?: boolean;
}

const corpus: TestCase[] = [
  // ── Category A: Direct Valid Addresses ──
  {
    category: 'A: Direct Valid',
    name: 'Simple standard address',
    input: 'john@example.com',
    expectedStatus: 'valid',
    expectedEmail: 'john@example.com',
    expectedClassification: 'exact',
    expectedRepaired: false,
    validateStrictExpected: true
  },
  {
    category: 'A: Direct Valid',
    name: 'Dot-separated personal address',
    input: 'john.smith@example.com',
    expectedStatus: 'valid',
    expectedEmail: 'john.smith@example.com',
    expectedClassification: 'exact',
    expectedRepaired: false,
    validateStrictExpected: true
  },
  {
    category: 'A: Direct Valid',
    name: 'Hyphen-separated personal address',
    input: 'john-smith@example.com',
    expectedStatus: 'valid',
    expectedEmail: 'john-smith@example.com',
    expectedClassification: 'exact',
    expectedRepaired: false,
    validateStrictExpected: true
  },
  {
    category: 'A: Direct Valid',
    name: 'Standard role account',
    input: 'sales@example.com',
    expectedStatus: 'valid',
    expectedEmail: 'sales@example.com',
    expectedClassification: 'role_based',
    expectedRepaired: false,
    validateStrictExpected: true
  },

  // ── Category B: Modern gTLDs (Must NOT be rejected by ccTLD prefix matching) ──
  {
    category: 'B: Modern gTLDs',
    name: '.plumbing (must not be rejected by .pl prefix)',
    input: 'contact@city.plumbing',
    expectedStatus: 'valid',
    expectedEmail: 'contact@city.plumbing',
    expectedClassification: 'role_based',
    expectedRepaired: false,
    validateStrictExpected: true
  },
  {
    category: 'B: Modern gTLDs',
    name: '.catering (must not be rejected by .ca prefix)',
    input: 'info@green.catering',
    expectedStatus: 'valid',
    expectedEmail: 'info@green.catering',
    expectedClassification: 'role_based',
    expectedRepaired: false,
    validateStrictExpected: true
  },
  {
    category: 'B: Modern gTLDs',
    name: '.company (must not be rejected by .co prefix)',
    input: 'hello@acme.company',
    expectedStatus: 'valid',
    expectedEmail: 'hello@acme.company',
    expectedClassification: 'role_based',
    expectedRepaired: false,
    validateStrictExpected: true
  },
  {
    category: 'B: Modern gTLDs',
    name: '.dental (must not be rejected by .de prefix)',
    input: 'team@metro.dental',
    expectedStatus: 'valid',
    expectedEmail: 'team@metro.dental',
    expectedClassification: 'role_based',
    expectedRepaired: false,
    validateStrictExpected: true
  },
  {
    category: 'B: Modern gTLDs',
    name: '.fitness (must not be rejected by .fi prefix)',
    input: 'contact@zone.fitness',
    expectedStatus: 'valid',
    expectedEmail: 'contact@zone.fitness',
    expectedClassification: 'role_based',
    expectedRepaired: false,
    validateStrictExpected: true
  },
  {
    category: 'B: Modern gTLDs',
    name: '.menu (must not be rejected by .me prefix)',
    input: 'reservations@bistro.menu',
    expectedStatus: 'valid',
    expectedEmail: 'reservations@bistro.menu',
    expectedClassification: 'exact',
    expectedRepaired: false,
    validateStrictExpected: true
  },

  // ── Category C: Country Code & Compound Public Suffixes ──
  {
    category: 'C: ccTLD & Compound',
    name: 'Germany (.de) ccTLD',
    input: 'hans@firm.de',
    expectedStatus: 'valid',
    expectedEmail: 'hans@firm.de',
    expectedClassification: 'exact',
    expectedRepaired: false,
    validateStrictExpected: true
  },
  {
    category: 'C: ccTLD & Compound',
    name: 'United Kingdom compound (.co.uk)',
    input: 'support@domain.co.uk',
    expectedStatus: 'valid',
    expectedEmail: 'support@domain.co.uk',
    expectedClassification: 'role_based',
    expectedRepaired: false,
    validateStrictExpected: true
  },
  {
    category: 'C: ccTLD & Compound',
    name: 'Australia compound (.com.au)',
    input: 'accounts@company.com.au',
    expectedStatus: 'valid',
    expectedEmail: 'accounts@company.com.au',
    expectedClassification: 'exact',
    expectedRepaired: false,
    validateStrictExpected: true
  },
  {
    category: 'C: ccTLD & Compound',
    name: 'India compound (.co.in)',
    input: 'info@biz.co.in',
    expectedStatus: 'valid',
    expectedEmail: 'info@biz.co.in',
    expectedClassification: 'role_based',
    expectedRepaired: false,
    validateStrictExpected: true
  },

  // ── Category D: Subdomains ──
  {
    category: 'D: Subdomains',
    name: 'Enterprise regional subdomain',
    input: 'sales@eu.example.com',
    expectedStatus: 'valid',
    expectedEmail: 'sales@eu.example.com',
    expectedClassification: 'role_based',
    expectedRepaired: false,
    validateStrictExpected: true
  },
  {
    category: 'D: Subdomains',
    name: 'Departmental subdomain',
    input: 'jobs@careers.example.com',
    expectedStatus: 'valid',
    expectedEmail: 'jobs@careers.example.com',
    expectedClassification: 'role_based',
    expectedRepaired: false,
    validateStrictExpected: true
  },

  // ── Category E: Legitimate Reduplicative Words (MUST NOT BE MUTATED) ──
  {
    category: 'E: Legitimate Reduplicative',
    name: '"tomtom" brand/mailbox',
    input: 'tomtom@example.com',
    expectedStatus: 'valid',
    expectedEmail: 'tomtom@example.com',
    expectedClassification: 'exact',
    expectedRepaired: false,
    validateStrictExpected: true
  },
  {
    category: 'E: Legitimate Reduplicative',
    name: '"couscous" brand/mailbox',
    input: 'couscous@kitchen.com',
    expectedStatus: 'valid',
    expectedEmail: 'couscous@kitchen.com',
    expectedClassification: 'exact',
    expectedRepaired: false,
    validateStrictExpected: true
  },
  {
    category: 'E: Legitimate Reduplicative',
    name: '"pawpaw" brand/mailbox',
    input: 'pawpaw@pets.com',
    expectedStatus: 'valid',
    expectedEmail: 'pawpaw@pets.com',
    expectedClassification: 'exact',
    expectedRepaired: false,
    validateStrictExpected: true
  },
  {
    category: 'E: Legitimate Reduplicative',
    name: '"chacha" mailbox',
    input: 'chacha@dance.com',
    expectedStatus: 'valid',
    expectedEmail: 'chacha@dance.com',
    expectedClassification: 'exact',
    expectedRepaired: false,
    validateStrictExpected: true
  },

  // ── Category F: DOM Concatenation & Enclosing Wrappers ──
  {
    category: 'F: Enclosing Wrappers',
    name: 'Angle brackets <...>',
    input: '<careers@example.com>',
    expectedStatus: 'valid',
    expectedEmail: 'careers@example.com',
    expectedClassification: 'role_based',
    validateStrictExpected: true
  },
  {
    category: 'F: Enclosing Wrappers',
    name: 'mailto: URI with subject query parameter',
    input: 'mailto:support@company.com?subject=Inquiry',
    expectedStatus: 'valid',
    expectedEmail: 'support@company.com',
    expectedClassification: 'role_based',
    validateStrictExpected: true
  },

  // ── Category G: Leading Hostname Contamination ──
  {
    category: 'G: Leading Contamination',
    name: 'Production Case 1: Host prefix + repeated role',
    input: 'princetonaz.comcareerscareers@princetonaz.com',
    expectedStatus: 'recovered',
    expectedEmail: 'careers@princetonaz.com',
    expectedClassification: 'recovered',
    expectedRepaired: true,
    validateStrictExpected: false // Repaired emails fail strict send gate
  },
  {
    category: 'G: Leading Contamination',
    name: 'Host prefix before personal name',
    input: 'example.comjohn.smith@example.com',
    expectedStatus: 'recovered',
    expectedEmail: 'john.smith@example.com',
    expectedClassification: 'recovered',
    expectedRepaired: true,
    validateStrictExpected: false
  },

  // ── Category H: Trailing Path Contamination ──
  {
    category: 'H: Trailing Contamination',
    name: 'Production Case 2: Concatenated footer link text',
    input: 'bidsestimating@princetonaz.comserviceservice',
    expectedStatus: 'recovered',
    expectedEmail: 'bidsestimating@princetonaz.com',
    expectedClassification: 'recovered',
    expectedRepaired: true,
    validateStrictExpected: false
  },
  {
    category: 'H: Trailing Contamination',
    name: 'Appended path token on compound TLD (.co.uk)',
    input: 'firm@company.co.ukserviceservice',
    expectedStatus: 'recovered',
    expectedEmail: 'firm@company.co.uk',
    expectedClassification: 'recovered',
    expectedRepaired: true,
    validateStrictExpected: false
  },
  {
    category: 'H: Trailing Contamination',
    name: 'Appended path token on compound TLD (.com.au)',
    input: 'admin@firm.com.auserviceservice',
    expectedStatus: 'recovered',
    expectedEmail: 'admin@firm.com.au',
    expectedClassification: 'recovered',
    expectedRepaired: true,
    validateStrictExpected: false
  },

  // ── Category I: Both-Sided Contamination ──
  {
    category: 'I: Both-Sided Contamination',
    name: 'Host prefix on local + path suffix on domain',
    input: 'princetonaz.comcareers@princetonaz.comservices',
    expectedStatus: 'recovered',
    expectedEmail: 'careers@princetonaz.com',
    expectedClassification: 'recovered',
    expectedRepaired: true,
    validateStrictExpected: false
  },

  // ── Category J: Ambiguous Local-Part Corruption (MUST QUARANTINE, NEVER GUESS) ──
  {
    category: 'J: Ambiguous Local-Part',
    name: 'Production Case 3: Concatenated words with trailing suffix',
    input: 'requestswarranty@princetonaz.comrfps',
    expectedStatus: 'quarantine',
    expectedClassification: 'quarantined',
    validateStrictExpected: false
  },
  {
    category: 'J: Ambiguous Local-Part',
    name: 'Production Case 4: Navigation word merged with role token',
    input: 'informationinfo@princetonaz.comwarranty',
    expectedStatus: 'quarantine',
    expectedClassification: 'quarantined',
    validateStrictExpected: false
  },

  // ── Category K: Third-Party Attribution Separation ──
  {
    category: 'K: Third-Party Separation',
    name: 'External agency credit on company website',
    input: 'support@webdesignagency.com',
    context: {
      companyDomain: 'acmeplumbing.com',
      sourceType: 'dom_text'
    },
    expectedStatus: 'valid',
    expectedEmail: 'support@webdesignagency.com',
    expectedClassification: 'third_party',
    expectedDomainMatched: false,
    validateStrictExpected: true
  },
  {
    category: 'K: Third-Party Separation',
    name: 'Matched company domain',
    input: 'contact@acmeplumbing.com',
    context: {
      companyDomain: 'acmeplumbing.com',
      sourceType: 'mailto'
    },
    expectedStatus: 'valid',
    expectedEmail: 'contact@acmeplumbing.com',
    expectedClassification: 'role_based',
    expectedDomainMatched: true,
    validateStrictExpected: true
  },

  // ── Category L: Placeholder & Parking Domains ──
  {
    category: 'L: Placeholder & Parked',
    name: 'Production Case 5: Filler local on GoDaddy parked page',
    input: 'filler@godaddy.combookingsmy',
    expectedStatus: 'quarantine',
    expectedClassification: 'quarantined',
    validateStrictExpected: false
  },
  {
    category: 'L: Placeholder & Parked',
    name: 'Placeholder address on RFC 2606 example domain',
    input: 'test@example.com',
    expectedStatus: 'quarantine',
    expectedClassification: 'quarantined',
    validateStrictExpected: false
  },
  {
    category: 'L: Placeholder & Parked',
    name: 'Sample on Dan.com parked lander',
    input: 'sample@dan.com',
    expectedStatus: 'quarantine',
    expectedClassification: 'quarantined',
    validateStrictExpected: false
  },

  // ── Category M: Internationalized Addresses ──
  {
    category: 'M: Internationalized',
    name: 'German umlaut in local-part (must not strip to mller)',
    input: 'müller@logistics.de',
    expectedStatus: 'valid',
    expectedEmail: 'müller@logistics.de',
    expectedClassification: 'exact',
    expectedRepaired: false,
    validateStrictExpected: true
  },
  {
    category: 'M: Internationalized',
    name: 'Spanish accent in local-part (must not strip to jos)',
    input: 'josé@empresa.es',
    expectedStatus: 'valid',
    expectedEmail: 'josé@empresa.es',
    expectedClassification: 'exact',
    expectedRepaired: false,
    validateStrictExpected: true
  },

  // ── Category N: Malformed Inputs ──
  {
    category: 'N: Malformed Inputs',
    name: 'Missing local-part',
    input: '@example.com',
    expectedStatus: 'invalid',
    expectedClassification: 'invalid',
    validateStrictExpected: false
  },
  {
    category: 'N: Malformed Inputs',
    name: 'Missing domain',
    input: 'hello@',
    expectedStatus: 'invalid',
    expectedClassification: 'invalid',
    validateStrictExpected: false
  },
  {
    category: 'N: Malformed Inputs',
    name: 'No @ symbol',
    input: 'plainaddress.com',
    expectedStatus: 'invalid',
    expectedClassification: 'invalid',
    validateStrictExpected: false
  },
  {
    category: 'N: Malformed Inputs',
    name: 'Multiple @ symbols (DOM concatenation of multiple emails)',
    input: 'first@domain.comsecond@domain.com',
    expectedStatus: 'quarantine',
    expectedClassification: 'quarantined',
    validateStrictExpected: false
  },
  {
    category: 'N: Malformed Inputs',
    name: 'Non-existent bogus TLD',
    input: 'contact@firm.xyznotarealtld123',
    expectedStatus: 'invalid',
    expectedClassification: 'invalid',
    validateStrictExpected: false
  }
];

// ---------------------------------------------------------------------------
// Test Runner
// ---------------------------------------------------------------------------

let passedCount = 0;
let failedCount = 0;

console.log('=================================================================');
console.log('RUNNING DETERMINISTIC EMAIL CANDIDATE CORRECTNESS CORPUS');
console.log('=================================================================\n');

for (const t of corpus) {
  const result = sanitizeAndValidateEmail(t.input, t.context);
  const candidate = evaluateEmailCandidate(t.input, t.context);

  let success = true;
  const errors: string[] = [];

  // Check Status
  if (result.status !== t.expectedStatus) {
    success = false;
    errors.push(`Status mismatch: expected "${t.expectedStatus}", got "${result.status}"`);
  }

  // Check Email
  if (t.expectedEmail) {
    const actualEmail = (result as any).email;
    if (actualEmail !== t.expectedEmail) {
      success = false;
      errors.push(`Email mismatch: expected "${t.expectedEmail}", got "${actualEmail}"`);
    }
  }

  // Check Classification
  if (t.expectedClassification && candidate.classification !== t.expectedClassification) {
    success = false;
    errors.push(`Classification mismatch: expected "${t.expectedClassification}", got "${candidate.classification}"`);
  }

  // Check Repaired flag
  if (t.expectedRepaired !== undefined && candidate.repaired !== t.expectedRepaired) {
    success = false;
    errors.push(`Repaired flag mismatch: expected ${t.expectedRepaired}, got ${candidate.repaired}`);
  }

  // Check Domain Matched flag
  if (t.expectedDomainMatched !== undefined && candidate.domainMatched !== t.expectedDomainMatched) {
    success = false;
    errors.push(`DomainMatched mismatch: expected ${t.expectedDomainMatched}, got ${candidate.domainMatched}`);
  }

  // Check Strict Sending Gate
  if (t.validateStrictExpected !== undefined) {
    const strictPass = validateEmailStrict(t.input);
    if (strictPass !== t.validateStrictExpected) {
      success = false;
      errors.push(`validateEmailStrict mismatch: expected ${t.validateStrictExpected}, got ${strictPass}`);
    }
  }

  // Check Idempotency Property: candidate.normalized passed back in must yield same normalized
  if (candidate.normalized && candidate.classification !== 'invalid') {
    const secondPass = evaluateEmailCandidate(candidate.normalized, t.context);
    if (secondPass.normalized !== candidate.normalized) {
      success = false;
      errors.push(`Idempotency failure: 2nd pass normalized "${secondPass.normalized}" != 1st pass "${candidate.normalized}"`);
    }
  }

  if (success) {
    passedCount++;
    console.log(`[PASS] [${t.category}] ${t.name}`);
  } else {
    failedCount++;
    console.error(`[FAIL] [${t.category}] ${t.name}`);
    console.error(`       Input: "${t.input}"`);
    for (const err of errors) {
      console.error(`       -> ${err}`);
    }
  }
}

console.log('\n=================================================================');
console.log(`TOTAL TESTS: ${corpus.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
console.log('=================================================================');

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('ALL DETERMINISTIC CANDIDATE CORRECTNESS TESTS PASSED!');
}
