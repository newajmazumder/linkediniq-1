import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const AppLayout = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const isFullWidth = ["/create", "/performance", "/campaign/new"].some(
    p => location.pathname === p || location.pathname.startsWith("/performance/") || location.pathname.startsWith("/campaign/")
  );

  if (isMobile) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex items-center gap-3 border-b border-border bg-sidebar px-3 py-2 shrink-0">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-56">
              <AppSidebar collapsed={false} onToggle={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="text-sm font-semibold text-foreground">LinkedinIQ</span>
        </div>
        <main className="flex-1 overflow-y-auto">
          <div className={isFullWidth ? "h-full" : "mx-auto max-w-4xl px-4 py-6"}>
            <Outlet />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main className="flex-1 overflow-y-auto">
        <div className={isFullWidth ? "h-full" : "mx-auto max-w-4xl px-6 py-8"}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
