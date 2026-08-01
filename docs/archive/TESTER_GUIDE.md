# LeadForge OS - Beta Tester Guide

This guide covers the installation process for our unsigned beta builds, how to execute the application, and how to verify that everything works correctly.

---

## 1. Downloading the Build

Unsigned beta builds are distributed manually:

1. Go to the **GitHub Releases** page of `kjxcodez/leadforge-os`.
2. Locate the latest pre-release tagged build (e.g., `v0.1.0-beta.1`).
3. Download the installer executable matching your operating system (e.g., `leadforge-setup-0.1.0.exe` for Windows).

---

## 2. Installation & Security Prompts

Because our initial beta builds are **unsigned** (to reduce operational overhead and developer certificates costs), your operating system will display security warnings. Please follow these steps to proceed safely:

### Windows SmartScreen Bypass

1. Launch the downloaded `.exe` installer.
2. Windows Defender SmartScreen will display: **"Windows protected your PC"**.
3. Click on the **"More info"** text link.
4. Click the **"Run anyway"** button that appears.
5. Follow the installer instructions to complete the process.

### macOS Gatekeeper Bypass (When applicable)

1. Double-clicking the `.app` package will show: **"App cannot be opened because it is from an unidentified developer"**.
2. Open your system's **System Settings > Privacy & Security**.
3. Scroll down to the Security section and locate the message regarding the blocked app.
4. Click **"Open Anyway"** and input your administrator password.

---

## 3. First-Launch Checklist

To verify your installation works correctly:

1. **Onboarding**: Launch the app. You should see the onboarding splash screen.
2. **Workspace Creation**: Create a new local workspace.
3. **Database Check**: Go to Settings/Operations Center, click **Diagnostics**, and check that SQLite database and all migrations successfully initialized.
4. **Local Services check**: Ensure the **Scheduler Status** displays **Active** in the Cockpit header.
