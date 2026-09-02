# Phase 1 Forensic Document 14 — Delivery Ledger Reality & Undefined Query Audit

**Document Type:** Forensic Ledger & Query Defect Analysis  
**Audited Against:** `deliveriesRouter` (`apps/api`), `EmailDeliveriesModule` (`packages/sdk`), `email-deliveries:list` (`apps/desktop`)  
**Date:** September 2026  
**Status:** Authoritative Baseline  

---

## 1. Delivery Ledger Lifecycle & State Machine

The delivery ledger tracks every email dispatch through an atomic state machine in MongoDB (`email_deliveries` collection):

```
       ┌────────────────────────────────────────────────────────┐
       │ 1. Atomic Reservation (reserveDelivery)               │
       │    Status: 'PENDING'                                   │
       │    idempotencyKey: unique hash                         │
       └─────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
                     Provider Dispatch (Gmail)
                                 │
            ┌────────────────────┴────────────────────┐
            ▼                                         ▼
┌───────────────────────────┐             ┌───────────────────────────┐
│ 2a. Successful Send       │             │ 2b. Definite Failure      │
│     Status: 'SENT'        │             │     Status: 'FAILED'      │
│     providerMessageId: id │             │     error: details        │
│     sentAt: Date          │             │     releaseSendSlot()     │
└───────────────────────────┘             └─────────────┬─────────────┘
                                                        │ (if network timeout)
                                                        ▼
                                          ┌───────────────────────────┐
                                          │ 2c. Ambiguous Timeout     │
                                          │     Status: 'AMBIGUOUS'   │
                                          │     Manual / Reconcile    │
                                          └───────────────────────────┘
```

---

## 2. Root-Cause Analysis of the `undefined` Query Parameter Bug

### Observation:
API server logs repeatedly displayed queries of the form:
```
GET /api/v1/email-deliveries?campaignId=undefined&sequenceId=undefined&status=undefined&page=1&limit=100
```

### Forensic Code Chain:

1. **Desktop IPC Call:**
   In [`apps/desktop/src/main/ipc/outreach.ts:287-293`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/outreach.ts#L287-L293):
   ```typescript
   const res = await sdk.emailDeliveries.list({
     campaignId: payload?.campaignId, // undefined when not filtering by campaign
     sequenceId: payload?.sequenceId, // undefined
     status: payload?.status,         // undefined
     page: payload?.page || 1,
     limit: payload?.limit || 100
   });
   ```

2. **SDK URL Parameter Serialization:**
   In [`packages/sdk/src/modules/email-deliveries.ts:22`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/packages/sdk/src/modules/email-deliveries.ts#L22):
   ```typescript
   const queryParams = params ? '?' + new URLSearchParams(params as any).toString() : '';
   ```
   `URLSearchParams` converts JavaScript `undefined` values into the string literal `"undefined"`, resulting in the query string:
   `?campaignId=undefined&sequenceId=undefined&status=undefined&page=1&limit=100`

3. **API Query Filter Construction:**
   In [`apps/api/src/routes/deliveries.ts:21-28`](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/api/src/routes/deliveries.ts#L21-L28):
   ```typescript
   const campaignId = c.req.query('campaignId'); // Evaluates to string "undefined" (truthy!)
   const sequenceId = c.req.query('sequenceId'); // Evaluates to string "undefined" (truthy!)
   const status = c.req.query('status');         // Evaluates to string "undefined" (truthy!)

   const filter: any = {};
   if (campaignId) filter.campaignId = campaignId; // Sets filter.campaignId = "undefined"
   if (sequenceId) filter.sequenceId = sequenceId; // Sets filter.sequenceId = "undefined"
   if (status) filter.status = status;             // Sets filter.status = "undefined"
   ```

4. **MongoDB Execution & Result:**
   MongoDB executes:
   ```javascript
   db.email_deliveries.find({
     workspaceId: "...",
     campaignId: "undefined",
     sequenceId: "undefined",
     status: "undefined"
   })
   ```
   Because no delivery document has `campaignId === "undefined"`, MongoDB returns `[]` (0 records).

---

## 3. Impact & Conclusion

- **Ledger Correctness:** The delivery records are **successfully written and finalized in MongoDB**.
- **UI Visibility Defect:** The UI is unable to display them because `emailDeliveries.list()` passes `"undefined"` strings, hiding all actual sends from the user interface.
