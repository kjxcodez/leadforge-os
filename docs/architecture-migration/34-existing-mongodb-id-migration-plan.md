# LeadForge OS — Existing MongoDB ID Migration Plan

## 1. Executive Summary & Forensic Finding

The forensic audit revealed that existing MongoDB collections currently contain a **heterogeneous mixture of identifier types**:

```text
┌──────────────────────────────┬───────────────────────────────────┬──────────────────────────────────────────┐
│ Collection Category          │ Current Mongo `_id` Type          │ Root Cause in Code                       │
├──────────────────────────────┼───────────────────────────────────┼──────────────────────────────────────────┤
│ `workspaces`, `users`,       │ BSON String                       │ Schema explicitly set `_id: String` with  │
│ `sequences`, `audiences`     │ (24-char hex string)              │ `default: () => new ObjectId().toString()`│
├──────────────────────────────┼───────────────────────────────────┼──────────────────────────────────────────┤
│ `companies`, `contacts`,     │ Mixed:                            │ Schema did NOT define `_id`. If created  │
│ `campaigns`, `outreaches`,   │ • BSON ObjectId (type 7) OR       │ by server -> ObjectId; if synced from    │
│ `emailtemplates`             │ • BSON String UUID (type 2)       │ desktop -> UUID string.                  │
└──────────────────────────────┴───────────────────────────────────┴──────────────────────────────────────────┘
```

### The Architectural Invariant:
Under the locked decision:
> **MongoDB `_id` MUST be String ONLY across ALL collections.**
> Heterogeneous BSON types (ObjectId vs String) are strictly prohibited.

---

## 2. Evaluation of ID Migration Strategies

```text
┌─────────────────────────────────┬────────────────────────────────────────────────────────────┐
│ Strategy Evaluated              │ Verdict & Rationale                                        │
├─────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **Option 1: Preserve & Phase**  │ **REJECTED:** Violates the invariant. Leaves dual types in │
│ (Support both types in API)     │ database, requiring permanent type-checking overhead and   │
│                                 │ complicated Mongoose query casting.                        │
├─────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **Option 2: Generate New UUIDs**│ **REJECTED:** Catastrophic risk. Breaks any existing       │
│ (Replace ObjectId with UUID v4) │ foreign keys, bookmark links, and cached desktop references│
│                                 │ referencing the old ObjectId.                              │
├─────────────────────────────────┼────────────────────────────────────────────────────────────┤
│ **Option 3: Recreate Documents**│ **APPROVED & RECOMMENDED:**                                │
│ **with Exact Hex String `_id`** │ Recreates documents with `_id = oid.toString()`.           │
│                                 │ Guarantees 100% string consistency while preserving the    │
│                                 │ exact identifier value so zero foreign keys break.         │
└─────────────────────────────────┴────────────────────────────────────────────────────────────┘
```

---

## 3. The Recreate-Document Migration Algorithm

Because MongoDB does not permit mutating a document's `_id` field in-place, documents holding BSON `ObjectId` are converted using transactional clone-and-swap:

```text
For each collection with BSON ObjectId documents:
  1. Find documents where typeof _id == 'objectId':
     `find({ _id: { $type: "objectId" } })`

  2. In an atomic transaction / batch:
     a. Extract hex string: `const stringId = doc._id.toHexString();`
     b. Create clone payload: `const clone = { ...doc.toObject(), _id: stringId };`
     c. Insert clone into collection.
     d. Update any child collections referencing the old ObjectId:
        - `contacts.updateMany({ companyId: doc._id }, { $set: { companyId: stringId } })`
        - `outreaches.updateMany({ contactId: doc._id }, { $set: { contactId: stringId } })`
        - `sequenceexecutions.updateMany({ contactId: doc._id }, { $set: { contactId: stringId } })`
     e. Delete original document: `deleteOne({ _id: doc._id })`

  3. Verification:
     Assert `countDocuments({ _id: { $type: "objectId" } }) === 0`.
```

---

## 4. Collection-by-Collection Migration Schedule

The migration is executed in strict reverse dependency order to ensure child foreign keys are consistently converted:

```text
Phase 2.5 Execution Order:
  1. `emailtemplates` (No foreign dependencies)
  2. `campaigns`
  3. `outreaches`
  4. `contacts` (Foreign keys point to companies)
  5. `companies` (Parent entity)
```

---

## 5. Mongoose Schema Lockout

Once all collections are verified to contain 0 ObjectId documents, the Mongoose models in `apps/api/src/db/models/` enforce string-only validation:

```typescript
const companySchema = new Schema<CompanyDocument>(
  {
    _id: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => typeof v === 'string' && v.trim().length > 0,
        message: '_id must be a non-empty string'
      }
    },
    // ...
  },
  {
    _id: false // Strictly disables Mongoose auto-ObjectId generation
  }
);
```

---

## 6. Migration CLI Tooling

* **Script Path:** `scripts/migrate-mongo-objectids-to-strings.ts`
* **Execution:**
  ```bash
  # Check for ObjectId presence across all collections
  npx tsx scripts/migrate-mongo-objectids-to-strings.ts --audit

  # Execute conversion with transaction guard
  npx tsx scripts/migrate-mongo-objectids-to-strings.ts --execute
  ```
