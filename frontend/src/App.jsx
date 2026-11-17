
import { useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Building2,
  Users,
  Bell,
  Settings,
  Search,
  Menu,
  X,
  Plus,
  ArrowUpRight,
  Clock3,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  ChevronDown,
  Church,
  LogOut,
  Activity,
  TrendingUp,
} from "lucide-react";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Activities", icon: ClipboardList },
  { label: "Reports", icon: FileText },
  { label: "Departments", icon: Building2, admin: true },
  { label: "Users", icon: Users, admin: true },
  { label: "Notifications", icon: Bell },
];

const stats = [
  {
    label: "Total Activities",
    value: "128",
    change: "+12 this month",
    icon: Activity,
    color: "blue",
  },
  {
    label: "Reports Submitted",
    value: "18",
    change: "This reporting period",
    icon: FileText,
    color: "violet",
  },
  {
    label: "Awaiting Review",
    value: "05",
    change: "Needs secretary attention",
    icon: Clock3,
    color: "amber",
  },
  {
    label: "Approved Reports",
    value: "13",
    change: "Successfully reviewed",
    icon: CheckCircle2,
    color: "emerald",
  },
];

const recentActivities = [
  {
    title: "Sunday Worship Service",
    department: "Worship Department",
    date: "17 Nov 2026",
    type: "Worship",
    status: "Recorded",
  },
  {
    title: "Campus Evangelism",
    department: "Evangelism Department",
    date: "16 Nov 2026",
    type: "Evangelism",
    status: "Recorded",
  },
  {
    title: "Departmental Fellowship",
    department: "Discipleship Department",
    date: "15 Nov 2026",
    type: "Fellowship",
    status: "Recorded",
  },
  {
    title: "New Students Outreach",
    department: "Outreach Department",
    date: "14 Nov 2026",
    type: "Outreach",
    status: "Recorded",
  },
];

const reports = [
  {
    department: "Worship Department",
    period: "Weekly Report · 9–15 Nov",
    submitted: "16 Nov 2026",
    status: "Approved",
  },
  {
    department: "Evangelism Department",
    period: "Weekly Report · 9–15 Nov",
    submitted: "16 Nov 2026",
    status: "Under Review",
  },
  {
    department: "Discipleship Department",
    period: "Weekly Report · 9–15 Nov",
    submitted: "15 Nov 2026",
    status: "Changes Requested",
  },
  {
    department: "Outreach Department",
    period: "Weekly Report · 9–15 Nov",
    submitted: "15 Nov 2026",
    status: "Submitted",
  },
];

function StatusBadge({ status }) {
  const styles = {
    Approved: "bg-emerald-50 text-emerald-700",
    "Under Review": "bg-blue-50 text-blue-700",
    Submitted: "bg-violet-50 text-violet-700",
    "Changes Requested": "bg-amber-50 text-amber-700",
    Recorded: "bg-slate-100 text-slate-600",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status] || styles.Recorded}`}>
      {status}
    </span>
  );
}

function Sidebar({ active, setActive, open, setOpen }) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-slate-100 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-700 text-white">
              <Church size={21} />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900">
                MAIN ALTAR
              </h1>
              <p className="text-xs text-slate-500">Reporting System</p>
            </div>
          </div>
          <button className="lg:hidden" onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Workspace
          </p>

          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    setActive(item.label);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                    active === item.label
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon size={19} />
                  {item.label}
                  {item.label === "Notifications" && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-100 px-1 text-[10px] font-bold text-rose-700">
                      3
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto border-t border-slate-100 p-4">
          <button
            onClick={() => setActive("Settings")}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
              active === "Settings" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Settings size={19} />
            Settings
          </button>

          <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
              IA
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">Ian Admin</p>
              <p className="text-xs text-slate-500">Administrator</p>
            </div>
            <LogOut size={17} className="text-slate-400" />
          </div>
        </div>
      </aside>
    </>
  );
}

function Overview() {
  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-sm text-slate-500">Tuesday, 17 November 2026</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome back, Ian
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Here's what's happening across your departments.
          </p>
        </div>

        <button className="flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-800">
          <Plus size={18} />
          Record Activity
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const colors = {
            blue: "bg-blue-50 text-blue-700",
            violet: "bg-violet-50 text-violet-700",
            amber: "bg-amber-50 text-amber-700",
            emerald: "bg-emerald-50 text-emerald-700",
          };

          return (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <div className={`rounded-xl p-2.5 ${colors[stat.color]}`}>
                  <Icon size={19} />
                </div>
              </div>
              <h3 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
                {stat.value}
              </h3>
              <p className="mt-2 text-xs text-slate-500">{stat.change}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Recent Activities</h3>
              <p className="mt-1 text-xs text-slate-500">Latest recorded department activities</p>
            </div>
            <button className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
              View all
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400">
                  <th className="pb-3 font-medium">Activity</th>
                  <th className="pb-3 font-medium">Department</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentActivities.map((activity) => (
                  <tr key={activity.title} className="border-b border-slate-50 last:border-0">
                    <td className="py-4 pr-3">
                      <p className="text-sm font-semibold text-slate-800">{activity.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{activity.type}</p>
                    </td>
                    <td className="py-4 pr-3 text-sm text-slate-600">{activity.department}</td>
                    <td className="py-4 pr-3 text-sm text-slate-500">{activity.date}</td>
                    <td className="py-4"><StatusBadge status={activity.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-5">
            <h3 className="font-bold text-slate-900">Reporting Overview</h3>
            <p className="mt-1 text-xs text-slate-500">Current reporting period</p>
          </div>

          <div className="rounded-xl bg-indigo-50 p-4">
            <div className="flex items-center gap-2 text-indigo-700">
              <CalendarDays size={17} />
              <span className="text-xs font-semibold">November 2026</span>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">18 / 24</p>
            <p className="mt-1 text-xs text-slate-500">Reports submitted</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-indigo-100">
              <div className="h-full w-3/4 rounded-full bg-indigo-700" />
            </div>
            <p className="mt-2 text-right text-xs font-semibold text-indigo-700">75% completion</p>
          </div>

          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CheckCircle2 size={17} className="text-emerald-600" />
                Approved
              </div>
              <span className="text-sm font-bold text-slate-900">13</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock3 size={17} className="text-blue-600" />
                Under review
              </div>
              <span className="text-sm font-bold text-slate-900">5</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <AlertCircle size={17} className="text-amber-600" />
                Outstanding
              </div>
              <span className="text-sm font-bold text-slate-900">6</span>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Recent Report Submissions</h3>
            <p className="mt-1 text-xs text-slate-500">Latest reports from your departments</p>
          </div>
          <button className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
            All reports
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-400">
                <th className="pb-3 font-medium">Department</th>
                <th className="pb-3 font-medium">Reporting period</th>
                <th className="pb-3 font-medium">Submitted</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.department} className="border-b border-slate-50 last:border-0">
                  <td className="py-4 text-sm font-semibold text-slate-800">{report.department}</td>
                  <td className="py-4 text-sm text-slate-600">{report.period}</td>
                  <td className="py-4 text-sm text-slate-500">{report.submitted}</td>
                  <td className="py-4"><StatusBadge status={report.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PlaceholderPage({ title }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="mb-4 rounded-2xl bg-indigo-50 p-4 text-indigo-700">
        <FileText size={28} />
      </div>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        This workspace is being prepared. We'll connect it to the reporting API in the next development steps.
      </p>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        active={active}
        setActive={setActive}
        open={sidebarOpen}
        setOpen={setSidebarOpen}
      />

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={22} />
            </button>
            <div>
              <p className="text-sm font-bold text-slate-900">{active}</p>
              <p className="hidden text-xs text-slate-500 sm:block">
                Moi University Main Altar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 md:flex">
              <Search size={16} className="text-slate-400" />
              <input
                placeholder="Search anything..."
                className="w-36 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <button className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100">
              <Bell size={20} />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                IA
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-slate-800">Ian Admin</p>
                <p className="text-xs text-slate-500">Administrator</p>
              </div>
              <ChevronDown size={15} className="hidden text-slate-400 sm:block" />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] p-4 sm:p-7">
          {active === "Overview" ? (
            <Overview />
          ) : (
            <PlaceholderPage title={active} />
          )}
        </main>

        <footer className="border-t border-slate-200 bg-white px-7 py-4 text-center text-xs text-slate-400">
          © 2026 Moi University Main Altar · Departmental Reporting System
        </footer>
      </div>
    </div>
  );
}
