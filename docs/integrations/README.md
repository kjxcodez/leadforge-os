# Third-Party Integrations & Adapters

This document details how LeadForge OS integrates with third-party APIs, web scraping engines, and email protocols.

---

## 🗺️ Google Maps Scraper (`scraper:maps`)

- **Technology**: [Playwright](https://playwright.dev/) (Chromium) headless browser.
- **Workflow**:
  1. Spawns Playwright and navigates to Google Maps.
  2. Submits search queries (e.g. "SaaS companies in Austin").
  3. Scrolls the search listings sidebar progressively to trigger infinite scroll load.
  4. Parses business elements: name, website, rating, physical address, and phone number.
  5. Follows website links to resolve redirects and get canonical domains.
  6. Inserts discovered companies into SQLite and triggers website crawls.

---

## 🕷️ Website Crawler (`crawler:website`)

- **Technology**: [Cheerio](https://cheerio.js.org/) parser and standard Fetch.
- **Workflow**:
  1. Runs BFS (Breadth-First Search) crawler up to a max depth of 3 levels per domain.
  2. Resolves and obeys `robots.txt` rules using `robots-parser`.
  3. Scrapes HTML trees for `mailto:` contacts, phone strings, and social links (LinkedIn, Twitter).
  4. **Noise Filtering**: Ignores tracking pixels and hex-obfuscated spam email strings.
  5. Title-cases names and normalizes phone numbers using standard regex formats.

---

## 💼 LinkedIn Voyager Enricher (`enrich:linkedin`)

- **Technology**: Direct API calls using active session cookies.
- **Workflow**:
  1. Reads session cookies (`li_at`) from encrypted secret storage.
  2. Simulates headers to validate active login and retrieves CSRF tokens.
  3. Queries LinkedIn's internal Voyager API to locate executive profiles (CEOs, Founders, Owners, VPs).
  4. **Search Engine Fallback**: If the session cookie is invalid or expired, the enricher queries DuckDuckGo searches to find LinkedIn profile URLs as a fallback.

---

## ✉️ SMTP & IMAP Outreach

### SMTP Nodemailer (`outreach:campaign`)
- **Technology**: [Nodemailer](https://nodemailer.com/).
- **Workflow**:
  - Decrypts workspace SMTP settings.
  - Generates email text from sequence templates, replacing contact tags (e.g. `{{contact.firstName}}`).
  - Dispatches emails using configured rate limits to preserve sending IP reputation.

### IMAP Polling (`outreach:imap-poll`)
- **Technology**: [ImapFlow](https://imapflow.org/).
- **Workflow**:
  - Connects to IMAP servers using decrypted credentials.
  - Queries incoming emails from the inbox.
  - Correlates incoming emails with sent outreach logs using `In-Reply-To` and `References` headers.
  - If a reply matches, updates contact status to `REPLIED` and pauses outreach sequence steps for that lead.
