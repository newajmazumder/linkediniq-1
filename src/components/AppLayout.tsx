import { Outlet, useLocation } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";

const AppLayout = () => {
  const location = useLocation();
  const isCreatePage = location.pathname === "/create";

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className={isCreatePage ? "h-full px-6 py-8" : "mx-auto max-w-4xl px-6 py-8"}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
