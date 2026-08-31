import { MongoClient, type Db } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { LEADFORGE_COLLECTIONS, TARGET_REFERENCES } from './migrate-mongo-objectids.js';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/leadforge-os';

export async function verifyMongoStringIds(customDb?: Db): Promise<{ success: boolean; results: Record<string, any> }> {
  let client: MongoClient | null = null;
  let db: Db;

  if (customDb) {
    db = customDb;
  } else {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db();
  }

  console.log(`\n===============================================================`);
  console.log(`LEADFORGE OS — MONGODB STRING ID VERIFICATION SUITE`);
  console.log(`Database: ${db.databaseName}`);
  console.log(`===============================================================\n`);

  const existingCollections = (await db.listCollections().toArray()).map(c => c.name);
  const targetCollections = LEADFORGE_COLLECTIONS.filter(c => existingCollections.includes(c));

  let totalFailures = 0;
  const results: Record<string, any> = {};

  console.log('--- COLLECTION-BY-COLLECTION _id AUDIT ---\n');

  for (const collName of targetCollections) {
    const coll = db.collection(collName);
    const total = await coll.countDocuments();
    const stringIds = await coll.countDocuments({ _id: { $type: 'string' } });
    const objectIds = await coll.countDocuments({ _id: { $type: 'objectId' } });
    const otherIds = total - (stringIds + objectIds);

    const isPass = objectIds === 0 && otherIds === 0;
    if (!isPass) totalFailures++;

    results[collName] = {
      total,
      stringIds,
      objectIds,
      otherIds,
      status: isPass ? 'PASS' : 'FAIL'
    };

    console.log(`${collName}`);
    console.log(`  total:     ${total}`);
    console.log(`  stringIds: ${stringIds}`);
    console.log(`  objectIds: ${objectIds}`);
    if (otherIds > 0) console.log(`  otherIds:  ${otherIds}`);
    console.log(`  status:    ${isPass ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  console.log('--- RELATIONSHIP & FOREIGN-KEY REFERENCE AUDIT ---\n');
  let refFailures = 0;

  for (const [targetName, refDefs] of Object.entries(TARGET_REFERENCES)) {
    for (const refDef of refDefs) {
      if (!existingCollections.includes(refDef.collection)) continue;

      const coll = db.collection(refDef.collection);
      const totalRefs = await coll.countDocuments({ [refDef.field]: { $exists: true, $ne: null } });
      const objectIdRefs = await coll.countDocuments({ [refDef.field]: { $type: 'objectId' } });

      const isPass = objectIdRefs === 0;
      if (!isPass) {
        refFailures++;
        totalFailures++;
      }

      console.log(`Reference [${refDef.collection}.${refDef.field}] -> [${targetName}]:`);
      console.log(`  total configured: ${totalRefs}`);
      console.log(`  objectId refs:    ${objectIdRefs}`);
      console.log(`  status:           ${isPass ? '✅ PASS' : '❌ FAIL'}`);
    }
  }

  console.log(`\n===============================================================`);
  console.log(`VERIFICATION RESULT: ${totalFailures === 0 ? 'ALL CHECKS PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Total Invariant Failures: ${totalFailures}`);
  console.log(`===============================================================\n`);

  if (client) {
    await client.close();
  }

  return { success: totalFailures === 0, results };
}

import { fileURLToPath } from 'url';

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  verifyMongoStringIds()
    .then(({ success }) => {
      if (!success) process.exit(1);
    })
    .catch(err => {
      console.error('Fatal Verification Error:', err);
      process.exit(1);
    });
}
