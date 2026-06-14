import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  PieChart,
  Megaphone,
  BarChart3,
  Bot,
  GitBranch,
  UserCircle2,
  Zap,
  MessageCircle,
  AlertTriangle,
  ShieldAlert,
  ShoppingBag,
  Tag,
  Search,
} from "lucide-react";

const MAIN_NAV = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/customers", icon: Users, label: "Customers" },
  { to: "/segments", icon: PieChart, label: "Segments" },
  { to: "/campaigns", icon: Megaphone, label: "Campaigns" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/offers", icon: Tag, label: "Offers" },
  { to: "/journeys", icon: GitBranch, label: "Journey Builder" },
  { to: "/agent", icon: Bot, label: "AI Agent" },
];

const EXTRA_NAV = [
  { to: "/monitor", icon: AlertTriangle, label: "Campaign Monitor" },
  { to: "/ai-decisioning", icon: Zap, label: "AI Decisioning" },
  { to: "/personas", icon: UserCircle2, label: "RFM Personas" },
  { to: "/whatsapp", icon: MessageCircle, label: "Simulated Messaging" },
];

const ADMIN_NAV = [
  { to: "/admin", icon: ShieldAlert, label: "Admin Console" },
  { to: "/monitor", icon: AlertTriangle, label: "Campaign Monitor" },
];

export default function Layout({ children }) {
  const [portal, setPortal] = useState("company");
  const [searchVal, setSearchVal] = useState("");
  const navigate = useNavigate();

  const storefrontLink = [
    { href: import.meta.env.VITE_STOREFRONT_URL || "http://localhost:8088", icon: ShoppingBag, label: "Live Storefront", external: true }
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#020202] text-zinc-100 font-sans antialiased">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-[#020202] border-r border-[#18181b] flex-shrink-0 z-10">
        {/* Logo Container */}
        <div className="flex items-center gap-3 px-6 h-[76px] border-b border-[#18181b]">
          <div className="w-[34px] h-[34px] rounded-xl bg-gradient-to-tr from-blue-600 via-blue-500 to-indigo-500 flex items-center justify-center text-white font-extrabold text-[17px] shadow-sm shadow-blue-500/20">
            Z
          </div>
          <span className="font-bold text-[18px] text-zinc-100 tracking-tight">Zari CRM</span>
        </div>



        {/* Navigation Area */}
        <nav className="flex-1 py-3 px-4 space-y-1.5 overflow-y-auto">
          {portal === "company" ? (
            <>
              {MAIN_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-2xl text-[14px] font-semibold tracking-wide transition-all duration-300 ${isActive
                      ? "bg-blue-950/40 text-blue-400 shadow-sm border border-blue-900/30"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
                    }`
                  }
                >
                  <item.icon size={18} className="flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}

              <div className="border-t border-[#18181b] my-4 pt-4">
                <span className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">Advanced</span>
                {EXTRA_NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[13px] font-semibold tracking-wide transition-all duration-300 ${isActive
                        ? "bg-blue-950/40 text-blue-400 shadow-sm"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
                      }`
                    }
                  >
                    <item.icon size={16} className="flex-shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <span className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">Controls</span>
              {ADMIN_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-2xl text-[14px] font-semibold tracking-wide transition-all duration-300 ${isActive
                      ? "bg-cyan-950/40 text-cyan-400 border border-cyan-900/30"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
                    }`
                  }
                >
                  <item.icon size={18} className="flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          )}

          <div className="border-t border-[#18181b] my-4 pt-4">
            <span className="px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">Channels</span>
            {storefrontLink.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[13px] font-semibold tracking-wide transition-all duration-300 text-zinc-400 hover:text-white hover:bg-zinc-900/50"
              >
                <item.icon size={16} className="flex-shrink-0 text-blue-400" />
                <span>{item.label}</span>
              </a>
            ))}
          </div>
        </nav>

      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header Bar */}
        <header className="h-[76px] bg-[#020202] border-b border-[#18181b] px-8 flex items-center justify-between flex-shrink-0 z-10">
          {/* Search container */}
          <form onSubmit={(e) => { e.preventDefault(); if (searchVal.trim()) navigate(`/customers?search=${encodeURIComponent(searchVal.trim())}`); }} className="flex items-center gap-3 w-96">
            <Search size={19} className="text-zinc-500 flex-shrink-0" />
            <input
              type="text"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Search customers..."
              className="w-full bg-transparent border-none focus:outline-none text-[15px] text-zinc-200 placeholder-zinc-500 p-0"
              style={{ border: "none", boxShadow: "none" }}
            />
          </form>

          {/* Profile controls */}
          <div className="flex items-center gap-4">
            <button className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-[#18181b] hover:border-blue-500 transition-all duration-300 shadow-sm">
              <img
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&h=100&q=80"
                alt="User Profile"
                className="w-full h-full object-cover"
              />
            </button>
          </div>
        </header>

        {/* Main Content Scroll Container */}
        <main className="flex-1 overflow-y-auto min-w-0 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
