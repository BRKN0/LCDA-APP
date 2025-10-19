export const environment = {
  production: true,
  supabaseUrl: (window as any).__env?.SUPABASE_URL ?? "",
  supabaseKey: (window as any).__env?.SUPABASE_KEY ?? ""
};
