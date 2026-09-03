# LeadForge OS — Phase 2: Email Discovery Remediation Report

**Date**: September 4, 2026  
**Author**: LeadForge OS Reliability & Quality Engineering  
**Scope**: Candidate Normalization, Structural Validation, Public Suffix Delegation, Conservative Repair, and Candidate Correctness Engine  
**Status**: Implemented, Verified (42/42 Tests Passing), and Monorepo Typecheck Clean (20/20 Tasks)  

---

## 1. Corruption Taxonomy

To prevent ad-hoc patching of individual examples, the remediation is structured around an exhaustive classification of corruption patterns identified across web corpora and DOM extraction engines:

```text
CANDIDATE CORRUPTION TAXONOMY
│
├── 1. DOM Traversal & Boundary Concatenation
│   ├── Preceding Navigation Text (e.g. "careerscareers@...", "contactjohn@...")
│   ├── Trailing Navigation Text (e.g. ".comservices", ".comabout", ".comcontact")
│   ├── Double-Sided Boundary Concatenation (e.g. "company.comcontact@company.comservices")
│   ├── Adjacent Sibling Nodes (unspaced text across <span>, <label>, <button>, <address>)
│   └── Multi-Email Concatenation (adjacent <a> links producing multiple '@' signs)
│
├── 2. URL & Hostname Contamination
│   ├── Leading Hostname in Local-Part (e.g. "princetonaz.comcareers@princetonaz.com")
│   ├── Stripped Protocol Preceding Local-Part (e.g. "https://info@company.com")
│   └── Host Label Prefixing (e.g. "princetonazjohn@princetonaz.com")
│
├── 3. TLD & Public Suffix Contamination (Greedy RegEx Matches)
│   ├── Suffixing after Major TLD (e.g. ".comserviceservice", ".netcontact")
│   ├── Suffixing after Multi-Level ccTLD (e.g. ".co.ukserviceservice", ".com.auservices")
│   └── Repeated Suffix Word Patterns (e.g. "service" + "service")
│
├── 4. Local-Part Contamination & Ambiguity
│   ├── Ambiguous Merged Tokens (e.g. "requestswarranty@..." -> requests? warranty?)
│   ├── Merged Navigation Words (e.g. "informationinfo@...")
│   └── Legitimate Reduplicative Mailboxes (e.g. "tomtom", "couscous", "pawpaw", "chacha")
│
├── 5. Source & Attribution Contamination
│   ├── External Vendor Credits (e.g. "agency@webdesign.com" found on "plumbing.com")
│   ├── CMS & Platform Footers (e.g. "support@wordpress.com", "help@shopify.com")
│   └── Unrelated Widget Mailboxes (e.g. "privacy@cookiebot.com")
│
├── 6. Placeholder & Parked Content
│   ├── Generic Filler Local-Parts ("filler", "placeholder", "sample", "test", "yourname")
│   ├── Registrar Parking Templates ("godaddy.com", "dan.com", "sedo.com", "hugedomains.com")
│   └── Reserved Special-Use Domains (RFC 2606: "example.com", "test.com", "invalid.com")
│
└── 7. Legitimate Structural Complexity (Must NEVER Be Broken)
    ├── Modern Single-Level gTLDs (".plumbing", ".catering", ".company", ".dental", ".fitness", ".menu")
    ├── Multi-Level ccTLDs & Compound Suffixes (".co.uk", ".com.au", ".co.in", ".org.uk")
    ├── Subdomains & Regional Routing ("sales@eu.example.com", "jobs@careers.example.com")
    └── Internationalized Mailboxes (RFC 6531: "müller@...", "josé@...")
```

---

## 2. Current vs. Remediated Sanitizer Behavior

| Dimension | Legacy Sanitizer (`v1.1.0`) | Remediated Engine (`v1.1.1`) | Rationale / Architectural Impact |
| :--- | :--- | :--- | :--- |
| **TLD Delegation Check** | Hardcoded ~75 string array + `lower.startsWith(known)` prefix match. | Authoritative compiled Mozilla Public Suffix List via `tldts`. | Eliminates false rejections of all gTLDs sharing ccTLD prefixes (`.plumbing`, `.company`, `.catering`, etc.). |
| **Compound Public Suffixes** | Dead code: split domain on `.` and evaluated only `labels[labels.length - 1]`. | Full ICANN compound public suffix parsing (`.co.uk`, `.com.au`, `.co.in`). | Correctly validates multi-level domains without mangling or truncation. |
| **Character Normalization** | `raw.replace(/[^\x20-\x7E]/g, '')` stripped all characters outside 7-bit ASCII. | Strips only ASCII control codes (`[\x00-\x1F\x7F]`) and zero-width spaces; preserves Unicode letters (`\p{L}`). | Prevents destruction of European, Hispanic, and Asian names (`josé` $\rightarrow$ preserved, `müller` $\rightarrow$ preserved). |
| **Local-Part Reduplication** | Unconditional `half + half === cleaned -> cleaned = half`. | Restricted strictly to known role prefixes following a verified host prefix stripping. Legitimate names (`tomtom`, `couscous`) are preserved. | Prevents silent truncation of valid brands and employee names. |
| **Navigation Word Merging** | Hardcoded rule: `startsWith('information') && endsWith('info') -> 'info'`. | **REMOVED COMPLETELY**. Ambiguous merged local parts are quarantined rather than guessed. | Stop inventing addresses without explicit evidence. |
| **Domain Affiliation** | None. Any scraped email assigned to target company. | Contextual evaluation comparing candidate eTLD+1 against company domain eTLD+1. Flags mismatches as `third_party`. | Prevents attributing web design and SEO agencies as company staff. |
| **Candidate Object** | Minimal 4-variant string union `{ status, email }`. | Comprehensive, auditable `EmailCandidate` interface with syntax, PSL, affiliation, rule IDs, and provenance. | Downstream workers and API have full auditability for every decision. |
| **Strict Send Gate** | Pure regex check; allowed `filler@godaddy.com` and heuristic repairs. | Enforces strict syntax, ICANN PSL validity, forbids heuristic repairs, and rejects parked/filler addresses. | Absolute barrier protecting Gmail deliverability and sender reputation. |

---

## 3. Removed Unsafe Heuristics

The following heuristics were identified as dangerous and were excised from the codebase:

1. **Prefix-Based TLD Invalidation (`lower.startsWith(known)`)**:
   - *Classification*: `UNSAFE`.
   - *Problem*: Because `COMMON_TLDS` contained 2-letter ccTLDs (`pl`, `co`, `ca`, `de`, `fi`, `me`), all legitimate gTLDs starting with those letters were falsely rejected.
   - *Resolution*: Replaced with `tldts.parse()` validating against the official ICANN Mozilla Public Suffix List.
2. **Global Reduplicative Local-Part Truncation**:
   - *Classification*: `UNSAFE`.
   - *Problem*: Mutated legitimate mailboxes (`tomtom` $\rightarrow$ `tom`, `couscous` $\rightarrow$ `cous`).
   - *Resolution*: Truncation is forbidden unless there is deterministic proof of host-prefix contamination combined with a known functional role account (`careerscareers` $\rightarrow$ `careers`). Otherwise preserved verbatim.
3. **Hardcoded Navigation-Word Transformation (`informationinfo -> info`)**:
   - *Classification*: `UNSAFE`.
   - *Problem*: Guessed the intended mailbox without source proof.
   - *Resolution*: Ambiguous multi-word concatenations are classified as `QUARANTINED` with an auditable reason.
4. **Destructive Non-ASCII Stripping (`replace(/[^\x20-\x7E]/g, '')`)**:
   - *Classification*: `UNSAFE`.
   - *Problem*: Silently mutated international characters (`josé` $\rightarrow$ `jos`, `müller` $\rightarrow$ `mller`).
   - *Resolution*: Replaced with Unicode-aware control character stripping (`[\x00-\x1F\x7F\u0080-\u009F\u200B-\u200D\uFEFF]`), retaining full UTF-8 letter integrity.

---

## 4. The New Validation Model

The candidate processing pipeline strictly decouples syntax, public suffix delegation, and domain affiliation:

```text
RAW CANDIDATE STRING
        │
        ▼
[ 1. Wrapper & Control-Code Normalization ]
  • Strip angle brackets: <user@domain.com> -> user@domain.com
  • Strip mailto: and URL query parameters: mailto:user@domain.com?subject=Hi -> user@domain.com
  • Strip ASCII control codes & zero-width spaces; PRESERVE Unicode letters (\p{L})
        │
        ▼
[ 2. RFC 5321 / 6531 Structural Split ]
  • Check '@' count:
      - 0 or starts/ends with '@' -> INVALID
      - > 1 '@' -> QUARANTINED (Ambiguous multi-candidate concatenation)
  • Check length <= 254 octets
        │
        ▼
[ 3. Domain PSL Validation & Conservative Repair ]
  • Parse domain via Mozilla Public Suffix List (tldts)
  • If valid ICANN / Private PSL -> Domain Valid
  • If invalid -> Attempt Conservative Repair:
      a) Affiliation match with expected company domain + path suffix
      b) Compound suffix stripping (.co.ukserviceservice -> .co.uk)
      c) Major TLD suffix stripping (.comserviceservice -> .com)
  • If still invalid -> INVALID (quarantineReason: "Domain not a valid PSL delegated domain")
        │
        ▼
[ 4. Placeholder & Parking Gate ]
  • Local-part in FILLER_LOCAL_PARTS -> QUARANTINED
  • Domain in PARKING_OR_REGISTRAR_DOMAINS -> QUARANTINED
        │
        ▼
[ 5. Local-Part Validation & Conservative Repair ]
  • If host prefix prepended to local (company.comjohn -> john) -> RECOVERED
  • If ambiguous multi-word concatenation (requestswarranty) -> QUARANTINED
  • Check local-part syntax: ^[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]+$
        │
        ▼
[ 6. Affiliation & Role Classification ]
  • Compare candidate eTLD+1 against companyDomain eTLD+1:
      - Mismatched -> THIRD_PARTY
      - Matched / No context -> Evaluate Role vs Exact
  • Role account check (info, sales, admin, support, etc.)
        │
        ▼
AUDITABLE EmailCandidate PRODUCED
```

---

## 5. The Conservative Repair Model

Repair is strictly restricted to scenarios where exactly one defensible interpretation exists:

### Allowed Deterministic Repairs:
1. **Rule `AFFILIATION_EXACT_DOMAIN_MATCH`**:
   - *Condition*: Candidate domain begins with `expectedCompanyDomain` and is immediately followed by path/navigation characters (e.g. `mycompany.xyzcareers` when company domain is `mycompany.xyz`).
   - *Action*: Restore company domain; record applied rule.
2. **Rule `SUFFIX_STRIP_<TLD>` (Compound & Single)**:
   - *Condition*: Candidate domain ends in an unambiguous major suffix (`.com`, `.net`, `.org`, `.edu`, `.gov`, `.io`, `.co.uk`, `.com.au`, `.co.in`) followed by $\ge 2$ alphabetical path characters (e.g. `princetonaz.comserviceservice` $\rightarrow$ `princetonaz.com`).
   - *Action*: Strip path characters; verify restored domain is ICANN-delegated.
3. **Rule `PREFIX_STRIP_HOST_LABEL`**:
   - *Condition*: Local-part begins with the exact domain name or registered host label (e.g. `example.comjohn.smith@example.com` or `princetonazjohn@princetonaz.com`).
   - *Action*: Strip the host prefix; verify the remaining local part is syntactically valid.
4. **Rule `PREFIX_STRIP_HOST_REPEATED_ROLE`**:
   - *Condition*: Host prefix stripped, and remaining local part consists of an exact duplicate of a known functional role account (`careerscareers` $\rightarrow$ `careers`).
   - *Action*: Collapse role token; record applied rule.

### Prohibited / Quarantined Cases (No Guessing):
- **Ambiguous concatenated local-parts**: `requestswarranty@princetonaz.com` could be `requests@`, `warranty@`, or a combined mailbox. **QUARANTINED**.
- **Navigation words merged with roles**: `informationinfo@princetonaz.com`. **QUARANTINED**.
- **Arbitrary 2-letter ccTLD suffix stripping**: An invalid TLD like `bad.notarealtld` is NOT sliced at `no` into `bad.no`. **REJECTED AS INVALID**.

---

## 6. The Intermediate Candidate Model

The `EmailCandidate` interface provides complete traceability for every discovered candidate:

```typescript
export interface EmailCandidate {
  raw: string;                          // Unmodified extracted candidate string
  normalized: string | null;            // Canonical lowercased email address
  localPart: string | null;             // Extracted local-part
  domain: string | null;                // Extracted domain name
  sourceType: EmailSourceType;          // 'mailto' | 'json_ld' | 'dom_text' | 'metadata' | 'manual'
  sourceUrl?: string | undefined;       // Webpage URL where candidate was discovered
  syntaxValid: boolean;                 // RFC 5321 / RFC 6531 structural compliance
  domainValid: boolean;                 // Domain syntax and label validity
  publicSuffix: string | null;          // Resolved public suffix (e.g. "co.uk", "plumbing")
  isIcannTld: boolean;                  // True if suffix is in official ICANN PSL
  domainMatched?: boolean | undefined;  // True if candidate domain matches company domain
  classification: EmailCandidateClassification; // 'exact' | 'recovered' | 'role_based' | 'third_party' | 'quarantined' | 'invalid'
  repaired: boolean;                    // True if heuristic transformation was applied
  repairRule?: string | null | undefined; // Auditable rule identifier(s)
  quarantineReason?: string | null | undefined; // Human-readable explanation if quarantined
  isRoleAccount: boolean;               // True if functional mailbox (info, sales, etc.)
}
```

---

## 7. Deterministic Test Corpus Results

The test suite in [email-sanitizer.test.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/schema/src/utils/email-sanitizer.test.ts) evaluates 42 test cases across 14 categories. All 42 tests pass deterministically:

| Category | Test Case Description | Input String | Expected Status | Expected Classification | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A: Direct Valid** | Simple standard address | `john@example.com` | `valid` | `exact` | **PASS** |
| **A: Direct Valid** | Dot-separated personal | `john.smith@example.com` | `valid` | `exact` | **PASS** |
| **A: Direct Valid** | Hyphen-separated personal | `john-smith@example.com` | `valid` | `exact` | **PASS** |
| **A: Direct Valid** | Standard role account | `sales@example.com` | `valid` | `role_based` | **PASS** |
| **B: Modern gTLD** | `.plumbing` (no `.pl` collision) | `contact@city.plumbing` | `valid` | `role_based` | **PASS** |
| **B: Modern gTLD** | `.catering` (no `.ca` collision) | `info@green.catering` | `valid` | `role_based` | **PASS** |
| **B: Modern gTLD** | `.company` (no `.co` collision) | `hello@acme.company` | `valid` | `role_based` | **PASS** |
| **B: Modern gTLD** | `.dental` (no `.de` collision) | `team@metro.dental` | `valid` | `role_based` | **PASS** |
| **B: Modern gTLD** | `.fitness` (no `.fi` collision) | `contact@zone.fitness` | `valid` | `role_based` | **PASS** |
| **B: Modern gTLD** | `.menu` (no `.me` collision) | `reservations@bistro.menu`| `valid` | `exact` | **PASS** |
| **C: Compound Suffix**| Germany ccTLD (`.de`) | `hans@firm.de` | `valid` | `exact` | **PASS** |
| **C: Compound Suffix**| UK compound (`.co.uk`) | `support@domain.co.uk` | `valid` | `role_based` | **PASS** |
| **C: Compound Suffix**| Australia compound (`.com.au`)| `accounts@company.com.au` | `valid` | `exact` | **PASS** |
| **C: Compound Suffix**| India compound (`.co.in`) | `info@biz.co.in` | `valid` | `role_based` | **PASS** |
| **D: Subdomains** | Regional enterprise routing | `sales@eu.example.com` | `valid` | `role_based` | **PASS** |
| **D: Subdomains** | Departmental subdomain | `jobs@careers.example.com` | `valid` | `role_based` | **PASS** |
| **E: Reduplicative** | Brand "tomtom" preserved | `tomtom@example.com` | `valid` | `exact` | **PASS** |
| **E: Reduplicative** | Brand "couscous" preserved | `couscous@kitchen.com` | `valid` | `exact` | **PASS** |
| **E: Reduplicative** | Mailbox "pawpaw" preserved | `pawpaw@pets.com` | `valid` | `exact` | **PASS** |
| **E: Reduplicative** | Mailbox "chacha" preserved | `chacha@dance.com` | `valid` | `exact` | **PASS** |
| **F: Wrappers** | Enclosing angle brackets | `<careers@example.com>` | `valid` | `role_based` | **PASS** |
| **F: Wrappers** | mailto URI with query params | `mailto:support@company.com?subject=Inquiry` | `valid` | `role_based` | **PASS** |
| **G: Leading Contam** | Prod Case 1: Host + role | `princetonaz.comcareerscareers@princetonaz.com` | `recovered` | `recovered` | **PASS** |
| **G: Leading Contam** | Host prefix before name | `example.comjohn.smith@example.com` | `recovered` | `recovered` | **PASS** |
| **H: Trailing Contam**| Prod Case 2: Link suffix | `bidsestimating@princetonaz.comserviceservice` | `recovered` | `recovered` | **PASS** |
| **H: Trailing Contam**| Trailing suffix on `.co.uk` | `firm@company.co.ukserviceservice` | `recovered` | `recovered` | **PASS** |
| **H: Trailing Contam**| Trailing suffix on `.com.au` | `admin@firm.com.auserviceservice` | `recovered` | `recovered` | **PASS** |
| **I: Both-Sided** | Host prefix + path suffix | `princetonaz.comcareers@princetonaz.comservices` | `recovered` | `recovered` | **PASS** |
| **J: Ambiguous Local**| Prod Case 3: Ambiguous local | `requestswarranty@princetonaz.comrfps` | `quarantine` | `quarantined` | **PASS** |
| **J: Ambiguous Local**| Prod Case 4: Nav + role | `informationinfo@princetonaz.comwarranty` | `quarantine` | `quarantined` | **PASS** |
| **K: Third-Party** | Agency credit on client site | `support@webdesignagency.com` | `valid` | `third_party` | **PASS** |
| **K: Third-Party** | Matched company domain | `contact@acmeplumbing.com` | `valid` | `role_based` | **PASS** |
| **L: Placeholder** | Prod Case 5: Filler GoDaddy | `filler@godaddy.combookingsmy` | `quarantine` | `quarantined` | **PASS** |
| **L: Placeholder** | Reserved RFC 2606 filler | `test@example.com` | `quarantine` | `quarantined` | **PASS** |
| **L: Placeholder** | Dan.com parking template | `sample@dan.com` | `quarantine` | `quarantined` | **PASS** |
| **M: International** | German umlaut preserved | `müller@logistics.de` | `valid` | `exact` | **PASS** |
| **M: International** | Spanish accent preserved | `josé@empresa.es` | `valid` | `exact` | **PASS** |
| **N: Malformed** | Missing local-part | `@example.com` | `invalid` | `invalid` | **PASS** |
| **N: Malformed** | Missing domain | `hello@` | `invalid` | `invalid` | **PASS** |
| **N: Malformed** | Missing '@' symbol | `plainaddress.com` | `invalid` | `invalid` | **PASS** |
| **N: Malformed** | Multiple '@' symbols | `first@domain.comsecond@domain.com` | `quarantine` | `quarantined` | **PASS** |
| **N: Malformed** | Bogus unrecognized TLD | `contact@firm.xyznotarealtld123` | `invalid` | `invalid` | **PASS** |

---

## 8. Guarantees & Invariants

The remediated architecture formally guarantees the following invariants:

- **Invariant 1 (No Invented Addresses)**: Normalization and repair will never invent a new local part or guess between multiple words. If multiple interpretations exist, the candidate is flagged as `quarantined`.
- **Invariant 2 (TLD Non-Interference)**: No delegated IANA TLD is rejected on the basis of string prefix collision with another TLD.
- **Invariant 3 (Reduplicative Safety)**: Valid single-token local parts (e.g. `tomtom`, `couscous`) are never collapsed or truncated.
- **Invariant 4 (International Character Preservation)**: Normalization preserves Unicode letters (`\p{L}`) and numbers (`\p{N}`). Valid international addresses will not have characters silently dropped.
- **Invariant 5 (Send Gate Protection)**: `validateEmailStrict()` rejects any address that required heuristic repair, is quarantined, or belongs to a parking lander/filler address.
- **Invariant 6 (Auditability)**: Whenever `repaired === true`, `repairRule` is populated with a non-null rule identifier.
- **Invariant 7 (Idempotency)**: For any non-invalid candidate, `evaluateEmailCandidate(candidate.normalized).normalized === candidate.normalized`.
- **Invariant 8 (Attribution Isolation)**: Syntactic validity is decoupled from company affiliation. Discovered vendor credits are tagged `third_party` rather than silently assigned as company personnel.

---

## 9. Production Compatibility & Migration Considerations

- **Full Backward Compatibility**:
  - `sanitizeAndValidateEmail(raw)` continues to return `{ status: 'valid' | 'recovered' | 'quarantine' | 'invalid', email, original, reason }`. Existing consumers (`crawler.ts`, `migrate-quarantine-corrupted-emails.ts`) continue to operate without breaking.
  - The return object now additionally attaches `candidate: EmailCandidate` for rich inspection.
  - `validateEmailStrict(email)` remains a boolean function used by `email.service.ts`, but now enforces stricter protections against parking landers and placeholder mailboxes.
- **Future Migration Requirements**:
  - In Phase 3 / Phase 4, when the `Contact` entity schema in MongoDB and SQLite is extended with `emailMeta`, the full `EmailCandidate` can be stored directly on each contact document.
  - No existing database records were mutated during this phase.

---

## 10. Known Scope Limitations

The following engineering boundaries remain strictly defined:

- **Syntactic Validity vs. Deliverability**:
  - This candidate correctness layer proves **syntactic compliance**, **public suffix delegation**, and **conservative boundary recovery**.
  - It **DOES NOT** prove mailbox existence, MX record presence, or inbox deliverability.
  - An address like `nonexistent.user.12345@gmail.com` is syntactically valid and has a valid ICANN domain, but is not guaranteed to exist on Google's mail servers. Deliverability verification remains the responsibility of future DNS/MX probing and SMTP verification layers.
- **Crawler Integration**:
  - The crawler currently routes candidates through `sanitizeAndValidateEmail`. The full recursive DOM tree traversal, JSON-LD extraction, and `third_party` suppression in `crawler.ts` will be addressed in subsequent crawler remediation phases.
