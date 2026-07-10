import { UserRepository } from "../../repositories/user/user.repository.js";
import type { UserDocument } from "../../db/models/user.model.js";
import bcrypt from "bcryptjs";
import { ConflictError } from "../../errors/index.js";

export class AuthService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  public async getUserById(id: string): Promise<UserDocument> {
    return this.userRepository.findById(id);
  }

  public async getUserByEmail(email: string): Promise<UserDocument | null> {
    return this.userRepository.findByEmail(email);
  }

  public async registerUser(data: {
    email: string;
    password?: string;
    name: string;
    displayName?: string;
    role?: "admin" | "user" | "owner";
  }): Promise<UserDocument> {
    const existing = await this.userRepository.findByEmail(data.email);
    if (existing) {
      throw new ConflictError("A user with this email already exists.");
    }

    let passwordHash: string | null = null;
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(data.password, salt);
    }

    return this.userRepository.create({
      email: data.email,
      passwordHash,
      name: data.name,
      displayName: data.displayName || data.name,
      role: data.role || "user",
      status: "active",
      emailVerified: false,
    });
  }

  public async verifyCredentials(email: string, password?: string): Promise<UserDocument | null> {
    const user = await this.userRepository.findByEmail(email);
    if (!user || !user.passwordHash || !password) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    user.lastLoginAt = new Date();
    await user.save();
    return user;
  }
}
