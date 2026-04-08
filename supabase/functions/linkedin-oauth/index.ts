import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { action, code, redirect_uri } = await req.json();

    const clientId = Deno.env.get("LINKEDIN_CLIENT_ID");
    const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      throw new Error("LinkedIn API credentials not configured");
    }

    if (action === "get_auth_url") {
      // Generate LinkedIn OAuth authorization URL
      const scopes = ["openid", "profile", "email", "w_member_social"];
      const state = crypto.randomUUID();
      const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect_uri)}&state=${state}&scope=${encodeURIComponent(scopes.join(" "))}`;

      return new Response(JSON.stringify({ auth_url: authUrl, state }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "exchange_code") {
      // Exchange authorization code for access token
      const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`Token exchange failed: ${errText}`);
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;
      const expiresIn = tokenData.expires_in;

      // Fetch LinkedIn profile using userinfo endpoint
      const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      let displayName = "LinkedIn User";
      let profileUrl: string | null = null;
      let linkedinUserId: string | null = null;

      if (profileRes.ok) {
        const profile = await profileRes.json();
        displayName = profile.name || `${profile.given_name || ""} ${profile.family_name || ""}`.trim() || displayName;
        linkedinUserId = profile.sub || null;
      }

      // Calculate token expiry
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      // Use service role to store tokens securely
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceKey);

      const { error: upsertError } = await adminClient
        .from("linkedin_accounts")
        .upsert({
          user_id: user.id,
          access_token: accessToken,
          refresh_token: tokenData.refresh_token || null,
          token_expires_at: tokenExpiresAt,
          connection_status: "connected",
          display_name: displayName,
          linkedin_user_id: linkedinUserId,
          profile_url: profileUrl,
          last_synced_at: null,
        }, { onConflict: "user_id" });

      if (upsertError) throw upsertError;

      return new Response(JSON.stringify({ success: true, display_name: displayName }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
