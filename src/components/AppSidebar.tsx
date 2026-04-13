import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  PenLine,
  FileText,
  LogOut,
  Zap,
  UserCircle,
  Target,
  Settings,
  BookOpen,
  Rocket,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/context", icon: BookOpen, label: "Business Context" },
  { to: "/audience", icon: UserCircle, label: "Audience" },
  { to: "/campaign/new", icon: Rocket, label: "Campaign Builder" },
  { to: "/strategy", icon: Target, label: "Strategy" },
  { to: "/posts", icon: FileText, label: "Posts" },
];

const bottomItems = [
  { to: "/settings", icon: Settings, label: "Settings" },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const AppSidebar = ({ collapsed, onToggle }: AppSidebarProps) => {
  const { signOut } = useAuth();
  const location = useLocation();

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200",
        collapsed ? "w-[52px]" : "w-56"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-4">
        <div className={cn("flex items-center gap-2.5 overflow-hidden", collapsed && "justify-center w-full")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-base font-semibold text-foreground whitespace-nowrap">LinkedinIQ</span>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={onToggle}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Create Button – ChatGPT style */}
      <div className="px-3 pb-2">
        <NavLink
          to="/create"
          className={cn(
            "flex items-center gap-2.5 rounded-lg border border-border/50 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent",
            location.pathname === "/create"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground",
            collapsed && "justify-center px-0"
          )}
        >
          <PenLine className="h-4 w-4 shrink-0" />
          {!collapsed && <span>New post</span>}
        </NavLink>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-0"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && label}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-border px-2 py-2 space-y-0.5">
        {collapsed && (
          <button
            onClick={onToggle}
            title="Expand sidebar"
            className="flex w-full items-center justify-center rounded-md py-2 text-muted-foreground hover:bg-sidebar-accent transition-colors"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}
        {bottomItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-0"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && label}
            </NavLink>
          );
        })}
        <button
          onClick={signOut}
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
