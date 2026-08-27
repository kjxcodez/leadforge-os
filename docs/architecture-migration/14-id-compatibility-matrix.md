# LeadForge OS — ID Compatibility Matrix

## 1. Executive Summary
This matrix documents the identity types, generation sources, and current mapping rules for every entity in LeadForge OS.

In the target architecture:
`MongoDB _id === API Entity ID === SQLite Cache ID`.

---

## 2. Definitive ID Compatibility Matrix

| Entity Name | Mongo `_id` Format | SQLite ID Format | Same Today? | Current Mapping Mechanism | Target Standard ID | Migration Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **User** | Hex 24 / String | String (UUID) | Partial | `LocalCRMRepository` maps `_id` ↔ `id` | Mongo `_id` string | LOW |
| **Workspace** | Hex 24 / String | String (UUID) | Partial | `LocalCRMRepository` maps `_id` ↔ `id` | Mongo `_id` string | LOW |
| **Company** | Hex 24 / String | String (UUID) | NO | SQLite generates UUID; Mongo generates ObjectId | Mongo `_id` string | MEDIUM |
| **Contact** | Hex 24 / String | String (UUID) | NO | SQLite generates UUID; Mongo generates ObjectId | Mongo `_id` string | MEDIUM |
| **Campaign** | Hex 24 / String | String (UUID) | NO | SQLite generates UUID; Mongo generates ObjectId | Mongo `_id` string | MEDIUM |
| **Outreach / Activity**| Hex 24 / String | String (UUID) | NO | SQLite generates UUID; Mongo generates ObjectId | Mongo `_id` string | LOW |
| **Email Account** | Hex 24 / String | String (UUID) | Partial | `LocalCRMRepository` maps `_id` ↔ `id` | Mongo `_id` string | LOW |
| **Email Template** | Hex 24 / String | String (UUID) | Partial | `LocalCRMRepository` maps `_id` ↔ `id` | Mongo `_id` string | LOW |
| **Sequence** | Hex 24 / String | String (UUID) | NO | SQLite generates UUID; Mongo generates ObjectId | Mongo `_id` string | MEDIUM |
| **Sequence Execution**| Hex 24 / String | String (UUID) | NO | SQLite generates UUID; Mongo generates ObjectId | Mongo `_id` string | HIGH (Foreign key linkages to jobs) |
| **Sequence Log** | Hex 24 / String | String (UUID) | NO | SQLite generates UUID; Mongo generates ObjectId | Mongo `_id` string | LOW |
| **Job (Queue)** | **N/A (Missing)** | String (UUID) | N/A | Exists only in SQLite | Mongo `_id` string | HIGH (Checkpoint linkages) |
| **System Log** | **N/A (Missing)** | String (UUID) | N/A | Exists only in SQLite | Mongo `_id` string | LOW |
| **Company Intelligence**| **N/A (Missing)**| String (UUID/FK) | N/A | Exists only in SQLite | Mongo `_id` string | LOW |
| **Website Intelligence**| **N/A (Missing)**| String (UUID/FK) | N/A | Exists only in SQLite | Mongo `_id` string | LOW |
| **Contact Intelligence**| **N/A (Missing)**| String (UUID/FK) | N/A | Exists only in SQLite | Mongo `_id` string | LOW |
| **Opportunity Score** | **N/A (Missing)** | String (UUID/FK) | N/A | Exists only in SQLite | Mongo `_id` string | LOW |
| **Audit Log** | **N/A (Missing)** | String (UUID) | N/A | Exists only in SQLite | Mongo `_id` string | LOW |
| **Workspace Memory** | **N/A (Missing)** | String (UUID) | N/A | Exists only in SQLite | Mongo `_id` string | LOW |
| **Discovery Run** | Hex 24 / String | String (UUID) | Partial | `LocalCRMRepository` maps `_id` ↔ `id` | Mongo `_id` string | LOW |
| **Company Discovery Run**| Hex 24 / String | String (UUID) | Partial | `LocalCRMRepository` maps `_id` ↔ `id` | Mongo `_id` string | MEDIUM |
| **Audience** | Hex 24 / String | String (UUID) | Partial | `LocalCRMRepository` maps `_id` ↔ `id` | Mongo `_id` string | LOW |
| **Page Crawl** | **N/A (Missing)** | String (UUID) | N/A | Exists only in SQLite | Mongo `_id` string | LOW |
| **Intelligence Source**| **N/A (Missing)** | String (UUID) | N/A | Exists only in SQLite | Mongo `_id` string | LOW |
| **Intelligence Evidence**|**N/A (Missing)** | String (UUID) | N/A | Exists only in SQLite | Mongo `_id` string | LOW |
| **Intelligence Claim** | **N/A (Missing)** | String (UUID) | N/A | Exists only in SQLite | Mongo `_id` string | LOW |
| **Intelligence Inference**|**N/A (Missing)** | String (UUID) | N/A | Exists only in SQLite | Mongo `_id` string | LOW |
| **Email Delivery** | **N/A (Missing)** | String (UUID) | N/A | Exists only in SQLite | Mongo `_id` string | MEDIUM (Idempotency keys) |

---

## 3. High Risk Identifiers & Mitigation Rules
1. **Sequence Executions & Parent Jobs:** `sequence_executions.parentJobId` points to `jobs.id`. When migrating to MongoDB, existing job UUIDs MUST be preserved as `_id` in MongoDB so `parentJobId` references do not break.
2. **Email Delivery Idempotency:** `email_deliveries.idempotencyKey` MUST be preserved as a unique Mongo index to prevent duplicate email dispatches.
