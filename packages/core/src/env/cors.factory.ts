export interface CorsConfig {
  origin: string | string[] | ((origin: string) => boolean);
  credentials?: boolean;
  allowMethods?: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
  maxAge?: number;
}

export function createCorsConfig(originEnv: string): CorsConfig {
  if (originEnv === '*') {
    return { origin: '*' };
  }
  if (originEnv.includes(',')) {
    const origins = originEnv.split(',').map((o) => o.trim());
    return {
      origin: origins,
      credentials: true
    };
  }
  return {
    origin: originEnv,
    credentials: true
  };
}
