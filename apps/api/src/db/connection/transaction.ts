import mongoose from "mongoose";

/**
 * Executes a callback within a MongoDB session transaction.
 * Automatically handles commit, rollback, and cleanup.
 */
export async function runInTransaction<T>(
  callback: (session: mongoose.ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
