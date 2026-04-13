import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";

const AppLayout = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const isFullWidth = ["/create", "/performance", "/campaign/new"].some(
    p => location.pathname === p || location.pathname.startsWith("/performance/") || location.pathname.startsWith("/campaign/")
  );

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
