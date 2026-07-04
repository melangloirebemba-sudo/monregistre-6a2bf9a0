import { createServerFn } from "@tanstack/react-start";

export const debugAdminEnv = createServerFn({ method: "GET" }).handler(async () => {
  const has = (k: string) => {
    const v = process.env[k];
    return { present: !!v, length: v?.length ?? 0, prefix: v?.slice(0, 12) ?? "" };
  };
  return {
    SUPABASE_URL: has("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: has("SUPABASE_SERVICE_ROLE_KEY"),
    SUPABASE_SECRET_KEYS: has("SUPABASE_SECRET_KEYS"),
    SUPABASE_PUBLISHABLE_KEY: has("SUPABASE_PUBLISHABLE_KEY"),
    SUPABASE_ANON_KEY: has("SUPABASE_ANON_KEY"),
  };
});
