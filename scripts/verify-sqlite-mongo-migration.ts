import Database from 'better-sqlite3';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { MIGRATION_TABLE_ORDER } from './migration-manifest.js';
import { inspectSQLiteDatabase } from './sqlite-discovery.js';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/leadforge-os';

export interface MigrationVerificationReport {
  workspaceId: string;
  sqlitePath: string;
  totalTablesChecked: number;
  totalRowsChecked: number;
  matchedRows: number;
  missingInMongo: number;
  dataMismatches: number;
  foreignKeyViolations: number;
  objectIdViolations: number;
  tableReports: Record<string, {
    sqliteCount: number;
    mongoCount: number;
    matched: number;
    missing: number;
    mismatches: number;
    status: 'PASS' | 'FAIL';
  }>;
  overallStatus: 'PASS' | 'FAIL';
}

export async function verifySQLiteMongoMigration(
  dbPath: string,
  targetWorkspaceId?: string
): Promise<MigrationVerificationReport> {
  const resolvedPath = path.resolve(dbPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`SQLite database not found at: ${resolvedPath}`);
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
  const mongoDb = mongoose.connection.db!;

  const dbInfo = inspectSQLiteDatabase(resolvedPath);
  const wsId = targetWorkspaceId || dbInfo.workspaceId;

  console.log(`\n===============================================================`);
  console.log(`LEADFORGE OS — SQLITE TO MONGODB VERIFICATION`);
  console.log(`  Workspace:   ${wsId}`);
  console.log(`  Source DB:   ${resolvedPath}`);
  console.log(`===============================================================\n`);

  const sqlite = new Database(resolvedPath, { readonly: true });
  const existingSqliteTables = new Set(
    sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name)
  );

  let totalRowsChecked = 0;
  let matchedRows = 0;
  let missingInMongo = 0;
  let dataMismatches = 0;
  let foreignKeyViolations = 0;
  let objectIdViolations = 0;
  const tableReports: MigrationVerificationReport['tableReports'] = {};

  for (const config of MIGRATION_TABLE_ORDER) {
    if (!existingSqliteTables.has(config.sqliteTable)) {
      continue;
    }

    const mongoCol = mongoDb.collection(config.mongoCollection);
    const mongoCount = await mongoCol.countDocuments({
      [config.mongoCollection === 'workspaces' ? '_id' : 'workspaceId']: wsId
    });

    const rows = sqlite.prepare(`SELECT * FROM "${config.sqliteTable}"`).all() as Array<Record<string, any>>;
    const sqliteCount = rows.length;

    let tableMatched = 0;
    let tableMissing = 0;
    let tableMismatches = 0;

    for (const row of rows) {
      totalRowsChecked++;
      const id = String(row[config.idField] || row.id);

      const mongoDoc = await mongoCol.findOne({ _id: id });
      if (!mongoDoc) {
        tableMissing++;
        missingInMongo++;
        continue;
      }

      // Check _id type is strictly string
      if (typeof mongoDoc._id !== 'string') {
        objectIdViolations++;
      }

      // Check workspaceId scoping
      if (config.mongoCollection !== 'workspaces') {
        if (mongoDoc.workspaceId !== wsId && mongoDoc.workspaceId !== row.workspaceId) {
          dataMismatches++;
          tableMismatches++;
          continue;
        }
      }

      // Check foreign key consistency
      for (const fk of config.foreignKeys) {
        const rowFkVal = row[fk.field];
        const docFkVal = mongoDoc[fk.field];

        if (rowFkVal && !fk.isArray) {
          if (String(rowFkVal) !== String(docFkVal) && docFkVal !== null) {
            foreignKeyViolations++;
            tableMismatches++;
          }
        }
      }

      tableMatched++;
      matchedRows++;
    }

    const tableStatus = tableMissing === 0 && tableMismatches === 0 ? 'PASS' : (tableMissing > 0 && tableMatched > 0 ? 'FAIL' : (sqliteCount === 0 ? 'PASS' : 'FAIL'));
    tableReports[config.sqliteTable] = {
      sqliteCount,
      mongoCount,
      matched: tableMatched,
      missing: tableMissing,
      mismatches: tableMismatches,
      status: tableStatus
    };

    console.log(`  • ${config.sqliteTable.padEnd(24)} | SQLite: ${String(sqliteCount).padStart(3)} | Mongo: ${String(mongoCount).padStart(3)} | Matched: ${String(tableMatched).padStart(3)} | Missing: ${tableMissing} | [${tableStatus}]`);
  }

  sqlite.close();

  const overallStatus = missingInMongo === 0 && dataMismatches === 0 && foreignKeyViolations === 0 && objectIdViolations === 0 ? 'PASS' : 'FAIL';

  console.log(`\n---------------------------------------------------------------`);
  console.log(`Verification Result: ${overallStatus === 'PASS' ? '✅ ALL CHECKS PASSED' : '❌ INTEGRITY ISSUES DETECTED'}`);
  console.log(`  Total Rows Checked:     ${totalRowsChecked}`);
  console.log(`  Exact Matched:          ${matchedRows}`);
  console.log(`  Missing in Mongo:       ${missingInMongo}`);
  console.log(`  Data Mismatches:        ${dataMismatches}`);
  console.log(`  Foreign Key Violations: ${foreignKeyViolations}`);
  console.log(`  ObjectId Violations:    ${objectIdViolations}`);
  console.log(`===============================================================\n`);

  return {
    workspaceId: wsId,
    sqlitePath: resolvedPath,
    totalTablesChecked: Object.keys(tableReports).length,
    totalRowsChecked,
    matchedRows,
    missingInMongo,
    dataMismatches,
    foreignKeyViolations,
    objectIdViolations,
    tableReports,
    overallStatus
  };
}

async function main() {
  const dbPath = process.argv[2];
  if (!dbPath) {
    console.error('Usage: tsx scripts/verify-sqlite-mongo-migration.ts <path-to-sqlite-db> [workspaceId]');
    process.exit(1);
  }

  const wsId = process.argv[3];
  try {
    const report = await verifySQLiteMongoMigration(dbPath, wsId);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(report.overallStatus === 'PASS' ? 0 : 1);
  } catch (err: any) {
    console.error('Verification error:', err);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
