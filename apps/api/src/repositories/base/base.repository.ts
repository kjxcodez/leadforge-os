import { type Model, type Document, type ClientSession } from "mongoose";
import { NotFoundError, ConflictError, ValidationError, DatabaseError } from "../../errors/index.js";

type FilterQuery<T> = any;


export class BaseRepository<T extends Document> {
  constructor(
    protected model: Model<T>,
    protected workspaceId?: string
  ) {}

  /**
   * Translates mongoose exceptions to domain errors.
   */
  protected handleError(error: any): never {
    if (error.name === "ValidationError") {
      throw new ValidationError(error.message, error.errors);
    }
    if (error.code === 11000) {
      throw new ConflictError("A record with this unique constraint already exists.", error.keyValue);
    }
    if (error.name === "CastError") {
      throw new NotFoundError(`Resource not found.`);
    }
    throw new DatabaseError(error.message || "Database operation failed", error);
  }

  /**
   * Helper to merge workspace filter into queries.
   */
  protected applyScope(filter: FilterQuery<T> = {}): FilterQuery<T> {
    if (this.workspaceId) {
      return { ...filter, workspaceId: this.workspaceId } as FilterQuery<T>;
    }
    return filter;
  }

  public async findById(id: string, session?: ClientSession): Promise<T> {
    try {
      const filter = this.applyScope({ _id: id } as any);
      const doc = await this.model.findOne(filter).session(session || null);
      if (!doc) {
        throw new NotFoundError(`Resource with id ${id} not found.`);
      }
      return doc;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      this.handleError(error);
    }
  }

  public async findOne(filter: FilterQuery<T>, session?: ClientSession): Promise<T | null> {
    try {
      const scopedFilter = this.applyScope(filter);
      return await this.model.findOne(scopedFilter).session(session || null);
    } catch (error) {
      this.handleError(error);
    }
  }

  public async findMany(
    filter: FilterQuery<T> = {},
    options: { sort?: any; limit?: number; skip?: number } = {},
    session?: ClientSession
  ): Promise<T[]> {
    try {
      const scopedFilter = this.applyScope(filter);
      let query = this.model.find(scopedFilter).session(session || null);
      if (options.sort) query = query.sort(options.sort);
      if (options.skip) query = query.skip(options.skip);
      if (options.limit) query = query.limit(options.limit);
      return await query;
    } catch (error) {
      this.handleError(error);
    }
  }

  public async create(data: Partial<T> | any, session?: ClientSession): Promise<T> {
    try {
      const payload = this.workspaceId ? { ...data, workspaceId: this.workspaceId } : data;
      const doc = new this.model(payload);
      
      const saveOptions = session ? { session } : {};
      await doc.save(saveOptions);
      return doc;
    } catch (error) {
      this.handleError(error);
    }
  }

  public async update(id: string, updateData: Partial<T> | any, session?: ClientSession): Promise<T> {
    try {
      const filter = this.applyScope({ _id: id } as any);
      const options: any = { new: true, runValidators: true };
      if (session) {
        options.session = session;
      }
      
      const doc = (await this.model.findOneAndUpdate(
        filter,
        { $set: updateData },
        options
      )) as unknown as T | null;

      if (!doc) {
        throw new NotFoundError(`Resource with id ${id} not found.`);
      }
      return doc;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      this.handleError(error);
    }
  }

  public async delete(id: string, session?: ClientSession): Promise<boolean> {
    try {
      const filter = this.applyScope({ _id: id } as any);
      const doc = await this.model.findOne(filter).session(session || null);
      if (!doc) {
        throw new NotFoundError(`Resource with id ${id} not found.`);
      }

      if (typeof (doc as any).softDelete === "function") {
        await (doc as any).softDelete();
        return true;
      }

      const result = await this.model.deleteOne({ _id: id } as any).session(session || null);
      return result.deletedCount > 0;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      this.handleError(error);
    }
  }

  public async paginate(
    filter: FilterQuery<T> = {},
    page = 1,
    limit = 20,
    sort: any = { createdAt: -1 }
  ): Promise<{ data: T[]; total: number }> {
    try {
      const scopedFilter = this.applyScope(filter);
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.model.find(scopedFilter).sort(sort).skip(skip).limit(limit),
        this.model.countDocuments(scopedFilter),
      ]);

      return { data, total };
    } catch (error) {
      this.handleError(error);
    }
  }

  public async exists(filter: FilterQuery<T>): Promise<boolean> {
    try {
      const scopedFilter = this.applyScope(filter);
      const count = await this.model.countDocuments(scopedFilter);
      return count > 0;
    } catch (error) {
      this.handleError(error);
    }
  }

  public async count(filter: FilterQuery<T> = {}): Promise<number> {
    try {
      const scopedFilter = this.applyScope(filter);
      return await this.model.countDocuments(scopedFilter);
    } catch (error) {
      this.handleError(error);
    }
  }
}
