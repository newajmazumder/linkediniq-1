import { useEffect } from "react";

/**
 * Minimal page that captures the LinkedIn OAuth callback code
 * and sends it back to the opener window (Settings page).
 * This page does NOT require authentication.
 */
const LinkedInCallbackPage = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (window.opener) {
      // Send the code back to the parent window
      window.opener.postMessage(
        { type: "LINKEDIN_OAUTH_CALLBACK", code, error },
        window.location.origin
      );
      // Close this popup after a short delay
      setTimeout(() => window.close(), 500);
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">Connecting LinkedIn...</p>
        <p className="text-xs text-muted-foreground">This window will close automatically.</p>
      </div>
    </div>
  );
};

export default LinkedInCallbackPage;
