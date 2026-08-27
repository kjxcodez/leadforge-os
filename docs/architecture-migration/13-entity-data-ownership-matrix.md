# LeadForge OS — Entity & Data Ownership Matrix

## 1. Definitive Entity Matrix

This matrix establishes the current owner vs target authoritative owner for every single business and operational entity discovered during the repository forensic audit.

| Entity | Current Owner | Target Owner | SQLite Cache? | Worker Access | API Access | ID Source Standard | Migration Required |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **User** | Mixed | **MongoDB** | Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Workspace** | Mixed | **MongoDB** | Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Company** | SQLite (Local First) | **MongoDB** | Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Contact** | SQLite (Local First) | **MongoDB** | Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Campaign** | SQLite (Local First) | **MongoDB** | Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Outreach Event** | SQLite (Local First) | **MongoDB** | Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Email Account** | Mixed | **MongoDB** | Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Template** | Mixed | **MongoDB** | Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Sequence** | SQLite (Local First) | **MongoDB** | Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Sequence Execution**| SQLite (Local First)| **MongoDB** | Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Sequence Log** | SQLite (Local First) | **MongoDB** | No (API fetch) | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Job (Queue)** | SQLite Only | **MongoDB (New Collection)**| No | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **System Log** | SQLite Only | **MongoDB (New Collection)**| No | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Automation Lock** | SQLite Only | **MongoDB (New Collection)**| No | Yes (SDK) | Yes | Mongo `_id` | No (Transient) |
| **Company Intelligence**| SQLite Only | **MongoDB (New Collection)**| Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Website Intelligence**| SQLite Only | **MongoDB (New Collection)**| Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Contact Intelligence**| SQLite Only | **MongoDB (New Collection)**| Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Opportunity Score**| SQLite Only | **MongoDB (New Collection)**| Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Audit Log** | SQLite Only | **MongoDB (New Collection)**| No | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Workspace Memory** | SQLite Only | **MongoDB (New Collection)**| Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Discovery Run** | Mixed | **MongoDB** | Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Company Discovery Run**| Mixed | **MongoDB** | Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Audience** | Mixed | **MongoDB** | Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Page Crawl** | SQLite Only | **MongoDB (New Collection)**| No | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Intelligence Source**| SQLite Only | **MongoDB (New Collection)**| Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Intelligence Evidence**| SQLite Only| **MongoDB (New Collection)**| Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Intelligence Claim**| SQLite Only | **MongoDB (New Collection)**| Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Intelligence Inference**|SQLite Only| **MongoDB (New Collection)**| Yes | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Email Delivery Ledger**|SQLite Only | **MongoDB (New Collection)**| No | Yes (SDK) | Yes | Mongo `_id` | Yes |
| **Beta Applicant** | MongoDB | **MongoDB** | No | No | Yes | Mongo `_id` | No |
| **OAuth Transaction** | MongoDB | **MongoDB** | No | No | Yes | Mongo `_id` | No |
| **User Test Recipient**| MongoDB | **MongoDB** | No | No | Yes | Mongo `_id` | No |
