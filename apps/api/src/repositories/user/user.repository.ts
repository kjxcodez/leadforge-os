import { BaseRepository } from '../base/base.repository.js';
import { UserModel, type UserDocument } from '../../db/models/user.model.js';

export class UserRepository extends BaseRepository<UserDocument> {
  constructor() {
    super(UserModel);
  }

  public async findByEmail(email: string): Promise<UserDocument | null> {
    return this.findOne({ email });
  }
}
