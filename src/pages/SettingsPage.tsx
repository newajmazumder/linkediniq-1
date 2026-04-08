import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Linkedin, RefreshCw, Unlink, CheckCircle, AlertCircle, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type LinkedInAccount = {
  id: string;
  display_name: string | null;
  profile_url: string | null;
  connection_status: string;
  last_synced_at: string | null;
};

const PUBLISHED_ORIGIN = "https://linkediniq.lovable.app";
const REDIRECT_URI = `${PUBLISHED_ORIGIN}/linkedin-callback`;

const SettingsPage = () => {
  const { user } = useAuth();
  const [account, setAccount] = useState<LinkedInAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchAccount = useCallback(async () => {
    const { data } = await supabase
      .from("linkedin_accounts")
      .select("id, display_name, profile_url, connection_status, last_synced_at")
      .maybeSingle();
    setAccount(data);
    setLoading(false);
  }, []);

  // Listen for OAuth callback from popup window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== PUBLISHED_ORIGIN) return;
      if (event.data?.type !== "LINKEDIN_OAUTH_CALLBACK") return;

      const { code, error } = event.data;
      if (error) {
        toast.error(`LinkedIn authorization failed: ${error}`);
        setConnecting(false);
        return;
      }
      if (code && user) {
        exchangeCode(code);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchAccount();
  }, [user, fetchAccount]);

  const exchangeCode = async (code: string) => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("linkedin-oauth", {
        body: { action: "exchange_code", code, redirect_uri: REDIRECT_URI },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`LinkedIn connected as ${data.display_name}`);
      await fetchAccount();
    } catch (err: any) {
      toast.error(err.message || "Failed to connect LinkedIn");
    } finally {
      setConnecting(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("linkedin-oauth", {
        body: {
          action: "get_auth_url",
          redirect_uri: REDIRECT_URI,
          app_origin: window.location.origin,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Open LinkedIn auth in a popup window
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(
        data.auth_url,
        "linkedin_oauth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to start LinkedIn OAuth");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!account) return;
    const { error } = await supabase.from("linkedin_accounts").delete().eq("id", account.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setAccount(null);
    toast.success("LinkedIn account disconnected");
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await supabase.from("sync_logs").insert({
        user_id: user!.id,
        sync_type: "linkedin_posts",
        status: "manual_required",
        posts_synced: 0,
      });
      toast.info("Auto-sync requires LinkedIn Marketing API approval. Use manual import in the Performance section to add posts.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const statusIcon = () => {
    switch (account?.connection_status) {
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "pending":
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusLabel = () => {
    switch (account?.connection_status) {
      case "connected": return "Connected";
      case "pending": return "Pending Setup";
      default: return "Not connected";
    }
  };

  if (loading) {
    return (
      <div className="content-fade-in space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage integrations and preferences</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 animate-pulse h-40" />
      </div>
    );
  }

  return (
    <div className="content-fade-in space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage integrations and preferences</p>
      </div>

      {/* LinkedIn Integration */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(210,100%,40%)]">
            <Linkedin className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground">LinkedIn Integration</h2>
            <p className="text-xs text-muted-foreground">Connect your LinkedIn account to sync published posts</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {statusIcon()}
            <span>{statusLabel()}</span>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {account ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Display Name</p>
                  <p className="text-sm font-medium text-foreground">{account.display_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last Synced</p>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <p className="text-sm text-foreground">
                      {account.last_synced_at
                        ? new Date(account.last_synced_at).toLocaleString()
                        : "Never"}
                    </p>
                  </div>
                </div>
              </div>

              {account.connection_status === "connected" && (
                <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3">
                  <p className="text-xs text-green-800">
                    <strong>LinkedIn account connected successfully.</strong> You can now sync posts or manually import them in the Performance section.
                  </p>
                </div>
              )}

              {account.connection_status === "pending" && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs text-amber-800">
                    <strong>Connection pending.</strong> Click "Connect LinkedIn" below to complete the OAuth authorization.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                {account.connection_status !== "connected" && (
                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(210,100%,40%)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[hsl(210,100%,35%)] transition-colors disabled:opacity-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {connecting ? "Connecting..." : "Connect LinkedIn"}
                  </button>
                )}
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                  Sync Now
                </button>
                <button
                  onClick={handleDisconnect}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  Disconnect
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <Linkedin className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Connect your LinkedIn account to start tracking post performance
              </p>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="inline-flex items-center gap-2 rounded-md bg-[hsl(210,100%,40%)] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(210,100%,35%)] transition-colors disabled:opacity-50"
              >
                <Linkedin className="h-4 w-4" />
                {connecting ? "Redirecting to LinkedIn..." : "Connect LinkedIn"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
