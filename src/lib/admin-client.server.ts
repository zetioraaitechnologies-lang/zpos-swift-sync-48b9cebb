// Server-only accessor for the privileged Supabase client.
// Turns the raw "missing SUPABASE_SERVICE_ROLE_KEY" crash into a clear,
// actionable message (self-hosted deploys such as Vercel must set it).

export async function getAdminClient() {
  if (!process.env['SUPABASE_SERVICE_ROLE_KEY'] || !process.env['SUPABASE_URL']) {
    throw new Error(
      "Admin features are unavailable on this deployment: the server is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Add both as environment variables in your hosting provider (Vercel → Settings → Environment Variables) and redeploy.",
    );
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
