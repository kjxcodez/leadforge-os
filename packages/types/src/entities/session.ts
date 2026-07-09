export interface SessionData {
  ip?: string;
  userAgent?: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  data: SessionData;
  createdAt: Date;
  updatedAt: Date;
}
