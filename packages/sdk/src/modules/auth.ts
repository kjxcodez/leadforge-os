import { HttpClient } from '../http/client';
import type { LoginDto, RegisterDto, AuthResponse } from '@leadforge/schema';

export class AuthModule {
  constructor(private client: HttpClient) {}

  public async login(dto: LoginDto): Promise<AuthResponse> {
    return this.client.post<AuthResponse>('/auth/login', dto);
  }

  public async register(dto: RegisterDto): Promise<AuthResponse> {
    return this.client.post<AuthResponse>('/auth/signup', dto);
  }

  public async logout(): Promise<void> {
    return this.client.post<void>('/auth/logout');
  }

  public async session(): Promise<any> {
    return this.client.get<any>('/auth/session');
  }
}
