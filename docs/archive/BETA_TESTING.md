# LeadForge OS - Closed Beta Testing Program

Welcome to the LeadForge OS Closed Beta! This document details the feedback process, bug triage categorization, and local telemetry rules to ensure the highest product quality.

---

## 1. Local-Only Telemetry Policy

LeadForge OS is built on a **Local-First Architecture**:

- **No Remote Telemetry Servers**: No crash logs, telemetry metrics, or system profiles are automatically uploaded to remote servers.
- **Support Bundles**: When you encounter an issue, we request you export a Support Bundle manually via the **Diagnostics Tab** in the Operations Center. This generates a ZIP file that you can attach to GitHub Issues.
- **Sensitive Data Masking**: All exported configurations are automatically scanned and sensitive parameters (`openrouter_key`, `smtpPassword`, `imapPassword`, and other credentials) are replaced with `[MASKED]` to guarantee your privacy.

---

## 2. Beta Issue Taxonomy

Every issue you report is categorized by the triage team under one of the following taxonomies:

- **Bug**: Unexpected behavior or software failures where the app does not work as specified.
- **Regression**: Previously working features that became broken after a newer release.
- **Performance**: UI lags, high memory RSS usage (> 800 MB), or excessive database query delays.
- **UX**: Poor navigation flows, confusing UI state transitions, or missing loading states.
- **Documentation**: Inaccurate steps in installation guides, API descriptions, or README files.
- **AI**: Failed prompt executions, invalid JSON structured outputs, or LLM provider errors.
- **Workflow**: Interruptions during sequence executions or runner state errors.
- **Scheduler**: Staleness, worker process concurrency limitations, or heartbeat timeouts.
- **Sync**: local-to-cloud sync errors, conflicts, or local database synchronization failures.
- **Security**: Credentials leakage, unmasked logs, or sandbox privilege violations.
- **Crash**: Process terminations, unhandled exception files, or renderer white-screens.

---

## 3. How to Submit Feedback

1. Go to the **Operations Center** inside the app.
2. Select the **Diagnostics** tab.
3. Choose **Report Bug** or **Suggest Feature**.
4. Fill in the description, and click **Submit Feedback**.
5. The application will automatically copy your system specifications to your clipboard and open the GitHub issues template page in your default browser.
6. Paste your clipboard contents and attach the generated support bundle ZIP.
