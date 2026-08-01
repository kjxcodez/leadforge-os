# Getting Support during LeadForge OS Beta

Thank you for participating in the LeadForge OS beta testing program! Since this is a closed beta, support is provided directly via GitHub and local tools.

---

## 1. Diagnostics & Verification

Before requesting support, please verify your local application state:

1. Open the **Operations Center** (navigate to `/operations` or `/diagnostics`).
2. Go to the **Diagnostics** tab.
3. Review the **Diagnostics Triggers** to check if SMTP connection, Internet access, DNS resolution, or SQLite database integrity checks are failing.
4. Review the **Error Console** tab for any background scheduler failures or worker timeouts.

---

## 2. Generating a Support Request

1. In the **Diagnostics** tab, click **Export Support Bundle ZIP**.
2. Save the ZIP file to your local machine.
3. Click **Report Bug** inside the Feedback panel.
4. A browser window will open to our GitHub Issues page with a pre-filled markdown template.
5. Drag and drop the exported ZIP file into the GitHub issue body and paste your clipboard content (the clipboard has your system specification details).

---

## 3. Security & Secrets Policy

> [!IMPORTANT]
> Never post your raw `config.json`, database files, or `.env` variables directly in public channels or forums.
> Use the **Export Support Bundle ZIP** action exclusively, as it automatically masks sensitive values like keys and passwords before zipping.
