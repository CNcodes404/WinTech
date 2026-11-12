/**
 * Frontend-safe Supabase configuration. Only the project URL and the publishable (anon) key may
 * ever be exposed to the browser. A service-role / secret key here would be a critical leak.
 */
export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function readSupabaseEnv(env: Record<string, unknown> = import.meta.env): SupabaseEnv {
  const url = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : '';
  const anonKey = typeof env.VITE_SUPABASE_ANON_KEY === 'string' ? env.VITE_SUPABASE_ANON_KEY.trim() : '';

  if (!url || !anonKey) {
    throw new ConfigError(
      'Supabase is not configured. Copy .env.example to .env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }
  if (
    !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) &&
    !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)
  ) {
    throw new ConfigError('VITE_SUPABASE_URL must look like https://<project-ref>.supabase.co (no path).');
  }
  // Defence in depth: refuse to start with a secret key in the browser bundle.
  if (anonKey.startsWith('sb_secret_') || looksLikeServiceRoleJwt(anonKey)) {
    throw new ConfigError(
      'A secret/service-role key was provided to the browser. Use the publishable (anon) key.',
    );
  }
  return { url, anonKey };
}

function looksLikeServiceRoleJwt(key: string): boolean {
  const parts = key.split('.');
  if (parts.length !== 3 || !parts[1]) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string };
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}
