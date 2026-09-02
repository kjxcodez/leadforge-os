import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/leadforge-os';

interface CollectionInventory {
  name: string;
  totalDocuments: number;
  stringIdCount: number;
  objectIdCount: number;
  otherIdCount: number;
  workspaceScoped: boolean;
  sampleObjectIdValues: string[];
  referenceFieldsFound: Record<string, { objectIdCount: number; stringCount: number; nullOrOtherCount: number }>;
  collisionsWithExistingStringIds: string[];
}

const KNOWN_REFERENCE_FIELDS = [
  'workspaceId',
  'companyId',
  'contactId',
  'campaignId',
  'sequenceId',
  'executionId',
  'jobId',
  'parentJobId',
  'discoveryRunId',
  'userId',
  'accountId',
  'emailAccountId',
  'entityId',
  'sourceId',
  'claimId',
  'evidenceId',
  'ownerId'
];

async function runInventory() {
  console.log('Connecting to MongoDB...');
  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;
  if (!db) {
    throw new Error('Database connection not established.');
  }

  const dbName = db.databaseName;
  console.log(`\n======================================================`);
  console.log(`LIVE DATABASE INVENTORY FOR: ${dbName}`);
  console.log(`======================================================\n`);

  const collections = await db.listCollections().toArray();
  const results: Record<string, CollectionInventory> = {};

  for (const collInfo of collections) {
    const name = collInfo.name;
    if (name.startsWith('system.')) continue;

    const coll = db.collection(name);
    const total = await coll.countDocuments();

    // 1. Check _id BSON types
    const stringIds = await coll.countDocuments({ _id: { $type: 'string' } });
    const objectIds = await coll.countDocuments({ _id: { $type: 'objectId' } });
    const otherIds = total - (stringIds + objectIds);

    // 2. Check workspace-scoped
    const hasWorkspaceId = (await coll.countDocuments({ workspaceId: { $exists: true } })) > 0;

    // 3. Sample ObjectId values
    const objectIdDocs = await coll.find({ _id: { $type: 'objectId' } }).limit(10).toArray();
    const sampleObjectIds = objectIdDocs.map(d => d._id.toHexString ? d._id.toHexString() : String(d._id));

    // 4. Check for collision between ObjectId string representations and existing String _id
    const collisions: string[] = [];
    if (objectIds > 0 && stringIds > 0) {
      const allObjDocs = await coll.find({ _id: { $type: 'objectId' } }, { projection: { _id: 1 } }).toArray();
      const stringHexCandidates = allObjDocs.map(d => d._id.toHexString());
      if (stringHexCandidates.length > 0) {
        const foundCollisions = await coll.find({ _id: { $in: stringHexCandidates } }).toArray();
        for (const colDoc of foundCollisions) {
          collisions.push(String(colDoc._id));
        }
      }
    }

    // 5. Inspect reference fields in this collection
    const refStats: Record<string, { objectIdCount: number; stringCount: number; nullOrOtherCount: number }> = {};

    for (const refField of KNOWN_REFERENCE_FIELDS) {
      const oidCount = await coll.countDocuments({ [refField]: { $type: 'objectId' } });
      const strCount = await coll.countDocuments({ [refField]: { $type: 'string' } });
      const existsCount = await coll.countDocuments({ [refField]: { $exists: true } });

      if (existsCount > 0) {
        refStats[refField] = {
          objectIdCount: oidCount,
          stringCount: strCount,
          nullOrOtherCount: existsCount - (oidCount + strCount)
        };
      }
    }

    results[name] = {
      name,
      totalDocuments: total,
      stringIdCount: stringIds,
      objectIdCount: objectIds,
      otherIdCount: otherIds,
      workspaceScoped: hasWorkspaceId,
      sampleObjectIdValues: sampleObjectIds,
      referenceFieldsFound: refStats,
      collisionsWithExistingStringIds: collisions
    };
  }

  // Print summary table
  console.log('COLLECTION INVENTORY SUMMARY:\n');
  console.table(
    Object.values(results).map(r => ({
      Collection: r.name,
      Total: r.totalDocuments,
      'String _ids': r.stringIdCount,
      'ObjectId _ids': r.objectIdCount,
      'Other _ids': r.otherIdCount,
      'Workspace Scoped': r.workspaceScoped,
      Collisions: r.collisionsWithExistingStringIds.length
    }))
  );

  console.log('\nREFERENCE FIELDS DETAIL:\n');
  for (const r of Object.values(results)) {
    const refKeys = Object.keys(r.referenceFieldsFound);
    if (refKeys.length > 0) {
      console.log(`Collection [${r.name}]:`);
      for (const k of refKeys) {
        const stat = r.referenceFieldsFound[k];
        console.log(`  - ${k}: ${stat.objectIdCount} ObjectIds, ${stat.stringCount} Strings, ${stat.nullOrOtherCount} Null/Other`);
      }
    }
  }

  const outputPath = path.resolve(process.cwd(), `live-mongo-inventory-${Date.now()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify({ database: dbName, timestamp: new Date().toISOString(), collections: results }, null, 2));
  console.log(`\nDetailed inventory report saved to: ${outputPath}`);

  await mongoose.disconnect();
}

runInventory().catch(err => {
  console.error('Inventory failed:', err);
  process.exit(1);
});
