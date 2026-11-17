
import { useCallback, useEffect, useState } from "react";
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
  Clock3,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  Church,
  LogOut,
  Activity,
  RefreshCw,
} from "lucide-react";

import api from "./services/api";
import ActivitiesPage from "./pages/Activities";
import ReportsPage from "./pages/Reports";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Activities", icon: ClipboardList },
  { label: "Reports", icon: FileText },
  { label: "Departments", icon: Building2, admin: true },
  { label: "Users", icon: Users, admin: true },
  { label: "Notifications", icon: Bell },
];

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function displayName(user) {
  const fullName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim();
  return fullName || user?.username || "User";
}

function roleName(role) {
  const roles = {
    ADMIN: "Administrator",
    SECRETARY: "Church Secretary",
    DEPARTMENT_LEADER: "Department Leader",
  };

  return roles[role] || role || "Member";
}

function initials(user) {
  return displayName(user)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function StatusBadge({ status }) {
  const styles = {
    APPROVED: "bg-emerald-50 text-emerald-700",
    UNDER_REVIEW: "bg-blue-50 text-blue-700",
    SUBMITTED: "bg-violet-50 text-violet-700",
    CHANGES_REQUESTED: "bg-amber-50 text-amber-700",
    DRAFT: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] || "bg-slate-100 text-slate-600"
      }`}
    >
      {String(status || "Recorded").replaceAll("_", " ")}
    </span>
  );
}

function Sidebar({ active, setActive, open, setOpen, user, onLogout }) {
  const visibleNavigation = navigation.filter(
    (item) => !item.admin || user?.role === "ADMIN" || user?.is_superuser
  );

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
              <h1 className="text-sm font-bold text-slate-900">MAIN ALTAR</h1>
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
            {visibleNavigation.map((item) => {
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
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto border-t border-slate-100 p-4">
          <button
            onClick={() => setActive("Settings")}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
              active === "Settings"
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Settings size={19} />
            Settings
          </button>

          <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
              {initials(user)}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">
                {displayName(user)}
              </p>
              <p className="text-xs text-slate-500">
                {roleName(user?.role)}
              </p>
            </div>

            <button
              onClick={onLogout}
              title="Sign out"
              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function StatCard({ label, value, description, icon: Icon, color }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`rounded-xl p-2.5 ${colors[color]}`}>
          <Icon size={19} />
        </div>
      </div>
      <h3 className="mt-5 text-3xl font-bold text-slate-900">{value}</h3>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function Overview({
  user,
  activities,
  reports,
  departments,
  loading,
  error,
  onRefresh,
  onNavigate,
}) {
  const approved = reports.filter((item) => item.status === "APPROVED").length;

  const awaitingReview = reports.filter((item) =>
    ["SUBMITTED", "UNDER_REVIEW"].includes(item.status)
  ).length;

  const outstanding = reports.filter((item) =>
    ["DRAFT", "CHANGES_REQUESTED"].includes(item.status)
  ).length;

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-sm text-slate-500">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <h2 className="text-2xl font-bold text-slate-900">
            Welcome back, {displayName(user).split(" ")[0]}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Here's what's happening across your departments.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            onClick={() => onNavigate("Activities")}
            className="flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-800"
          >
            <Plus size={18} />
            Record Activity
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Activities"
          value={activities.length}
          description="Recorded activities"
          icon={Activity}
          color="blue"
        />
        <StatCard
          label="Reports Submitted"
          value={reports.length}
          description="Reports in the system"
          icon={FileText}
          color="violet"
        />
        <StatCard
          label="Awaiting Review"
          value={awaitingReview}
          description="Submitted or under review"
          icon={Clock3}
          color="amber"
        />
        <StatCard
          label="Approved Reports"
          value={approved}
          description="Successfully reviewed"
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Recent Activities</h3>
              <p className="mt-1 text-xs text-slate-500">
                Latest recorded department activities
              </p>
            </div>
            <button
              onClick={() => onNavigate("Activities")}
              className="text-sm font-semibold text-indigo-700"
            >
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
                {activities.slice(0, 5).map((activity) => (
                  <tr key={activity.id} className="border-b border-slate-50">
                    <td className="py-4 pr-3">
                      <p className="text-sm font-semibold text-slate-800">
                        {activity.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {activity.activity_type}
                      </p>
                    </td>
                    <td className="py-4 pr-3 text-sm text-slate-600">
                      {activity.department_name || "—"}
                    </td>
                    <td className="py-4 pr-3 text-sm text-slate-500">
                      {formatDate(activity.activity_date)}
                    </td>
                    <td className="py-4">
                      <StatusBadge status="RECORDED" />
                    </td>
                  </tr>
                ))}
                {!loading && activities.length === 0 && (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-sm text-slate-400">
                      No activities have been recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-bold text-slate-900">Reporting Overview</h3>
          <p className="mt-1 text-xs text-slate-500">
            Reports currently in the system
          </p>

          <div className="mt-5 rounded-xl bg-indigo-50 p-4">
            <div className="flex items-center gap-2 text-indigo-700">
              <CalendarDays size={17} />
              <span className="text-xs font-semibold">Report submissions</span>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">
              {reports.length}
            </p>
          </div>

          <div className="mt-5 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Approved</span>
              <strong>{approved}</strong>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Awaiting review</span>
              <strong>{awaitingReview}</strong>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Draft / corrections</span>
              <strong>{outstanding}</strong>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Departments</span>
              <strong>{departments.length}</strong>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">
              Recent Report Submissions
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Latest reports from your departments
            </p>
          </div>
          <button
            onClick={() => onNavigate("Reports")}
            className="text-sm font-semibold text-indigo-700"
          >
            All reports
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-400">
                <th className="pb-3 font-medium">Department</th>
                <th className="pb-3 font-medium">Reporting Period</th>
                <th className="pb-3 font-medium">Submitted</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.slice(0, 5).map((report) => (
                <tr key={report.id} className="border-b border-slate-50">
                  <td className="py-4 text-sm font-semibold text-slate-800">
                    {report.department_name || "—"}
                  </td>
                  <td className="py-4 text-sm text-slate-600">
                    {report.period_type} · {formatDate(report.start_date)} –{" "}
                    {formatDate(report.end_date)}
                  </td>
                  <td className="py-4 text-sm text-slate-500">
                    {formatDate(report.submitted_at)}
                  </td>
                  <td className="py-4">
                    <StatusBadge status={report.status} />
                  </td>
                </tr>
              ))}
              {!loading && reports.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-sm text-slate-400">
                    No reports have been submitted yet.
                  </td>
                </tr>
              )}
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
        This workspace is next in the frontend development sequence.
      </p>
    </div>
  );
}

export default function App({ user, onLogout }) {
  const [active, setActive] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activities, setActivities] = useState([]);
  const [reports, setReports] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      api.get("/reports/activities/"),
      api.get("/reports/submissions/"),
      api.get("/departments/"),
    ]);

    const failures = [];

    if (results[0].status === "fulfilled") {
      setActivities(getItems(results[0].value.data));
    } else {
      failures.push("activities");
    }

    if (results[1].status === "fulfilled") {
      setReports(getItems(results[1].value.data));
    } else {
      failures.push("reports");
    }

    if (results[2].status === "fulfilled") {
      setDepartments(getItems(results[2].value.data));
    } else {
      failures.push("departments");
    }

    if (failures.length) {
      setError(`Some dashboard data could not be loaded: ${failures.join(", ")}.`);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleNavigate = (page) => {
    setActive(page);
    setSidebarOpen(false);

    if (page === "Overview") {
      loadDashboard();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        active={active}
        setActive={handleNavigate}
        open={sidebarOpen}
        setOpen={setSidebarOpen}
        user={user}
        onLogout={onLogout}
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

            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                {initials(user)}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-slate-800">
                  {displayName(user)}
                </p>
                <p className="text-xs text-slate-500">
                  {roleName(user?.role)}
                </p>
              </div>
              <button
                onClick={onLogout}
                title="Sign out"
                className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] p-4 sm:p-7">
          {active === "Overview" ? (
            <Overview
              user={user}
              activities={activities}
              reports={reports}
              departments={departments}
              loading={loading}
              error={error}
              onRefresh={loadDashboard}
              onNavigate={handleNavigate}
            />
          ) : active === "Activities" ? (
            <ActivitiesPage user={user} />
          ) : active === "Reports" ? (
            <ReportsPage user={user} />
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
