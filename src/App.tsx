import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AuthPage from "@/pages/AuthPage";
import AppLayout from "@/components/AppLayout";
import DashboardPage from "@/pages/DashboardPage";
import CreatePage from "@/pages/CreatePage";
import DraftsPage from "@/pages/DraftsPage";
import CompetitorsPage from "@/pages/CompetitorsPage";
import CalendarPage from "@/pages/CalendarPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import AudiencePage from "@/pages/AudiencePage";
import StrategyPage from "@/pages/StrategyPage";
import PerformancePage from "@/pages/PerformancePage";
import PostDetailPage from "@/pages/PostDetailPage";
import SettingsPage from "@/pages/SettingsPage";
import BusinessContextPage from "@/pages/BusinessContextPage";
import LinkedInCallbackPage from "@/pages/LinkedInCallbackPage";
import CampaignBuilderPage from "@/pages/CampaignBuilderPage";
import CampaignPlanPage from "@/pages/CampaignPlanPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public route for LinkedIn OAuth callback - no auth required */}
      <Route path="/linkedin-callback" element={<LinkedInCallbackPage />} />
      
      {!user ? (
        <Route path="*" element={<AuthPage />} />
      ) : (
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/context" element={<BusinessContextPage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/drafts" element={<DraftsPage />} />
          <Route path="/competitors" element={<CompetitorsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/audience" element={<AudiencePage />} />
          <Route path="/strategy" element={<StrategyPage />} />
          <Route path="/performance" element={<PerformancePage />} />
          <Route path="/performance/:postId" element={<PostDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/campaign/new" element={<CampaignBuilderPage />} />
          <Route path="/campaign/:id" element={<CampaignPlanPage />} />
        </Route>
      )}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
