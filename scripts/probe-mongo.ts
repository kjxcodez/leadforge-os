import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/leadforge-os';

async function probe() {
  console.log(`Probing MongoDB at: ${uri.replace(/\/\/.*@/, '//***:***@')}`);
  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    console.log(`✅ Connected successfully! Database: ${conn.connection.db?.databaseName}`);
    const collections = await conn.connection.db?.listCollections().toArray();
    console.log('Existing collections in MongoDB:', collections?.map(c => c.name));
    await mongoose.disconnect();
    return { ok: true, collections: collections?.map(c => c.name) };
  } catch (err: any) {
    console.error('❌ Connection failed:', err.message);
    return { ok: false, error: err.message };
  }
}

probe();
