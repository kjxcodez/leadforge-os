import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { EmailAccountModel } from '../apps/api/src/db/models/email-account.model';
import { EmailAccountRepository } from '../apps/api/src/repositories/email-account/email-account.repository';

async function run() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/leadforge-os';
  console.log(`Connecting to MongoDB: ${mongoUri}`);
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });

  const repo = new EmailAccountRepository();
  const testId = randomUUID();
  const testWorkspaceId = randomUUID();

  console.log('--- Creating Test Email Account ---');
  const account = await EmailAccountModel.create({
    _id: testId,
    workspaceId: testWorkspaceId,
    name: 'Reliability Gate Test Account',
    email: `gate-test-${Date.now()}@example.com`,
    provider: 'smtp',
    status: 'connected',
    dailySent: 0,
    hourlySent: 0,
    sendPolicy: {
      dailyLimit: 5,
      hourlyLimit: 2,
      minSendIntervalMs: 2000,
      maxConcurrent: 1
    },
    sendState: {
      dailySent: 0,
      hourlySent: 0,
      dailyResetAt: new Date(Date.now() + 86400000),
      hourlyResetAt: new Date(Date.now() + 3600000),
      lastSentAt: null,
      nextSendAt: null,
      rateLimitedUntil: null,
      sendLeaseExpiresAt: null
    }
  });

  const limits = {
    dailyLimit: 5,
    hourlyLimit: 2,
    minSendIntervalMs: 2000,
    maxConcurrent: 1 as const,
    sendLeaseDurationMs: 30000
  };

  try {
    // 1. Initial Reservation -> should succeed
    console.log('\n[Test 1] Initial Reservation');
    const slot1 = await repo.reserveSendSlot(testId, limits);
    if (!slot1.success) throw new Error(`Expected success, got ${JSON.stringify(slot1)}`);
    console.log('✅ Slot 1 granted successfully');

    // 2. Concurrency check -> second attempt while lease is held should fail
    console.log('\n[Test 2] Concurrency Lease Rejection (Invariant 1 & 7)');
    const slot2 = await repo.reserveSendSlot(testId, limits);
    if (slot2.success || slot2.reason !== 'MAILBOX_CONCURRENCY_BUSY') {
      throw new Error(`Expected MAILBOX_CONCURRENCY_BUSY, got ${JSON.stringify(slot2)}`);
    }
    console.log('✅ Correctly rejected with MAILBOX_CONCURRENCY_BUSY');

    // 3. Clear lease but minimum interval active -> should be rejected with MIN_INTERVAL_THROTTLED
    console.log('\n[Test 3] Minimum Send Interval Throttle (Invariant 2)');
    await repo.clearSendLease(testId);
    const slot3 = await repo.reserveSendSlot(testId, limits);
    if (slot3.success || slot3.reason !== 'MIN_INTERVAL_THROTTLED') {
      throw new Error(`Expected MIN_INTERVAL_THROTTLED, got ${JSON.stringify(slot3)}`);
    }
    console.log('✅ Correctly rejected with MIN_INTERVAL_THROTTLED');

    // 4. Hourly Limit Exhaustion (Invariant 3)
    console.log('\n[Test 4] Hourly Limit Enforcement (Invariant 3)');
    await EmailAccountModel.updateOne(
      { _id: testId },
      {
        $set: {
          'sendState.nextSendAt': new Date(Date.now() - 1000),
          'sendState.sendLeaseExpiresAt': null,
          'sendState.hourlySent': 2,
          'sendState.hourlyResetAt': new Date(Date.now() + 1800000)
        }
      }
    );
    const slot4 = await repo.reserveSendSlot(testId, limits);
    if (slot4.success || slot4.reason !== 'HOURLY_QUOTA_EXCEEDED') {
      throw new Error(`Expected HOURLY_QUOTA_EXCEEDED, got ${JSON.stringify(slot4)}`);
    }
    console.log('✅ Correctly rejected with HOURLY_QUOTA_EXCEEDED');

    // 5. Daily Limit Exhaustion (Invariant 4)
    console.log('\n[Test 5] Daily Limit Enforcement (Invariant 4)');
    await EmailAccountModel.updateOne(
      { _id: testId },
      {
        $set: {
          'sendState.nextSendAt': new Date(Date.now() - 1000),
          'sendState.sendLeaseExpiresAt': null,
          'sendState.hourlySent': 0,
          'sendState.dailySent': 5,
          'sendState.dailyResetAt': new Date(Date.now() + 36000000)
        }
      }
    );
    const slot5 = await repo.reserveSendSlot(testId, limits);
    if (slot5.success || slot5.reason !== 'DAILY_QUOTA_EXCEEDED') {
      throw new Error(`Expected DAILY_QUOTA_EXCEEDED, got ${JSON.stringify(slot5)}`);
    }
    console.log('✅ Correctly rejected with DAILY_QUOTA_EXCEEDED');

    // 6. Provider Cooldown (Invariant 5)
    console.log('\n[Test 6] Provider Cooldown (Invariant 5)');
    await repo.setProviderCooldown(testId, 60);
    const slot6 = await repo.reserveSendSlot(testId, limits);
    if (slot6.success || slot6.reason !== 'PROVIDER_RATE_LIMITED') {
      throw new Error(`Expected PROVIDER_RATE_LIMITED, got ${JSON.stringify(slot6)}`);
    }
    console.log('✅ Correctly rejected with PROVIDER_RATE_LIMITED');

    // 7. Provider Cooldown Expiry (Invariant 6)
    console.log('\n[Test 7] Provider Cooldown Expiry (Invariant 6)');
    await EmailAccountModel.updateOne(
      { _id: testId },
      {
        $set: {
          'sendState.rateLimitedUntil': new Date(Date.now() - 1000),
          'sendState.dailySent': 0,
          'sendState.hourlySent': 0,
          'sendState.nextSendAt': new Date(Date.now() - 1000),
          'sendState.sendLeaseExpiresAt': null
        }
      }
    );
    const slot7 = await repo.reserveSendSlot(testId, limits);
    if (!slot7.success) {
      throw new Error(`Expected slot granted after cooldown expired, got ${JSON.stringify(slot7)}`);
    }
    console.log('✅ Slot granted after provider cooldown expired');

    // 8. Expired Send Lease Recovery after Crash (Invariant 7 & 8)
    console.log('\n[Test 8] Send Lease Expiry Recovery (Invariant 7 & 8)');
    // Set expired lease in past
    await EmailAccountModel.updateOne(
      { _id: testId },
      {
        $set: {
          'sendState.sendLeaseExpiresAt': new Date(Date.now() - 5000),
          'sendState.nextSendAt': new Date(Date.now() - 1000),
          'sendState.hourlySent': 0,
          'sendState.dailySent': 0
        }
      }
    );
    const slot8 = await repo.reserveSendSlot(testId, limits);
    if (!slot8.success) {
      throw new Error(`Expected grant on expired lease, got ${JSON.stringify(slot8)}`);
    }
    console.log('✅ Slot granted despite stale lease (crashed worker lease safely overridden)');

    console.log('\n========================================');
    console.log(' ALL ATOMIC SEND GATE INVARIANTS PASSED!');
    console.log('========================================');
  } finally {
    await EmailAccountModel.deleteOne({ _id: testId });
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
