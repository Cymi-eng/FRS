
import { useCallback, useEffect, useMemo, useState } from "react";
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
  ShieldCheck,
  UserRound,
  TrendingUp,
} from "lucide-react";

import api from "./services/api";
import ActivitiesPage from "./pages/Activities";
import ReportsPage from "./pages/Reports";

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

function normalizeRole(role) {
  return String(role || "").toUpperCase();
}

function roleName(role) {
  const roles = {
    ADMIN: "System Administrator",
    SECRETARY: "Church Secretary",
    DEPARTMENT_LEADER: "Department Leader",
  };

  return roles[normalizeRole(role)] || role || "Member";
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
        <div className={`rounded-xl p-2.5 ${colors[color] || colors.blue}`}>
          <Icon size={19} />
        </div>
      </div>
      <h3 className="mt-5 text-3xl font-bold text-slate-900">{value}</h3>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function Sidebar({ active, setActive, open, setOpen, user, onLogout }) {
  const role = normalizeRole(user?.role);

  const navigation = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Activities", icon: ClipboardList },
    { label: "Reports", icon: FileText },
    ...(role === "ADMIN"
      ? [
          { label: "Departments", icon: Building2 },
          { label: "Users", icon: Users },
        ]
      : []),
    { label: "Notifications", icon: Bell },
  ];

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
            {role === "ADMIN"
              ? "Administration"
              : role === "SECRETARY"
                ? "Review Workspace"
                : "Department Workspace"}
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
              <p className="text-xs text-slate-500">{roleName(user?.role)}</p>
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

function PageHeading({ eyebrow, title, description, children }) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-indigo-600">
          {eyebrow}
        </p>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

function ActionButton({ icon: Icon, children, onClick, secondary = false }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
        secondary
          ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          : "bg-indigo-700 text-white hover:bg-indigo-800"
      }`}
    >
      <Icon size={17} />
      {children}
    </button>
  );
}

function RecentActivities({ activities, loading, onNavigate }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900">Recent Activities</h3>
          <p className="mt-1 text-xs text-slate-500">
            Latest recorded church activities
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
            {activities.slice(0, 6).map((activity) => (
              <tr key={activity.id} className="border-b border-slate-50">
                <td className="py-4 pr-3">
                  <p className="text-sm font-semibold text-slate-800">
                    {activity.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {String(activity.activity_type || "").replaceAll("_", " ")}
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
  );
}

function RecentReports({ reports, loading, onNavigate }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900">Recent Report Submissions</h3>
          <p className="mt-1 text-xs text-slate-500">
            Reporting activity and submission status
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
              <th className="pb-3 font-medium">Period</th>
              <th className="pb-3 font-medium">Submitted</th>
              <th className="pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {reports.slice(0, 6).map((report) => (
              <tr key={report.id} className="border-b border-slate-50">
                <td className="py-4 text-sm font-semibold text-slate-800">
                  {report.department_name || "Your department"}
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
                  No reports found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AdminDashboard({
  user,
  activities,
  reports,
  departments,
  users,
  loading,
  error,
  onRefresh,
  onNavigate,
}) {
  const approved = reports.filter((r) => r.status === "APPROVED").length;
  const awaiting = reports.filter((r) =>
    ["SUBMITTED", "UNDER_REVIEW"].includes(r.status)
  ).length;

  return (
    <div className="space-y-7">
      <PageHeading
        eyebrow="Administration workspace"
        title={`Welcome, ${displayName(user).split(" ")[0]}`}
        description="Manage the Main Altar reporting system and monitor departmental reporting."
      >
        <ActionButton icon={RefreshCw} secondary onClick={onRefresh}>
          Refresh
        </ActionButton>
        <ActionButton icon={Users} onClick={() => onNavigate("Users")}>
          Manage Users
        </ActionButton>
      </PageHeading>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Departments"
          value={departments.length}
          description="Registered departments"
          icon={Building2}
          color="blue"
        />
        <StatCard
          label="User Accounts"
          value={users.length}
          description="System users"
          icon={Users}
          color="violet"
        />
        <StatCard
          label="Recorded Activities"
          value={activities.length}
          description="Across all departments"
          icon={Activity}
          color="amber"
        />
        <StatCard
          label="Reports"
          value={reports.length}
          description={`${approved} approved · ${awaiting} awaiting review`}
          icon={FileText}
          color="emerald"
        />
      </div>

      <section className="rounded-2xl border border-indigo-100 bg-indigo-900 p-6 text-white">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-indigo-200">
              <ShieldCheck size={18} />
              <span className="text-xs font-bold uppercase tracking-wider">
                System administration
              </span>
            </div>
            <h3 className="text-xl font-bold">Keep the reporting system organized</h3>
            <p className="mt-2 max-w-2xl text-sm text-indigo-100">
              Set up departments, manage user access and monitor reporting activity.
              Report approval remains the responsibility of the Secretary.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onNavigate("Departments")}
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-indigo-900 hover:bg-indigo-50"
            >
              Departments
            </button>
            <button
              onClick={() => onNavigate("Users")}
              className="rounded-xl border border-indigo-400 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-800"
            >
              User accounts
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <RecentActivities
          activities={activities}
          loading={loading}
          onNavigate={onNavigate}
        />
        <RecentReports
          reports={reports}
          loading={loading}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}

function SecretaryDashboard({
  user,
  activities,
  reports,
  loading,
  error,
  onRefresh,
  onNavigate,
}) {
  const submitted = reports.filter((r) => r.status === "SUBMITTED").length;
  const reviewing = reports.filter((r) => r.status === "UNDER_REVIEW").length;
  const corrections = reports.filter((r) => r.status === "CHANGES_REQUESTED").length;
  const approved = reports.filter((r) => r.status === "APPROVED").length;

  const reviewQueue = reports.filter((r) =>
    ["SUBMITTED", "UNDER_REVIEW"].includes(r.status)
  );

  return (
    <div className="space-y-7">
      <PageHeading
        eyebrow="Secretary workspace"
        title={`Good day, ${displayName(user).split(" ")[0]}`}
        description="Review departmental reports, request corrections and approve completed submissions."
      >
        <ActionButton icon={RefreshCw} secondary onClick={onRefresh}>
          Refresh
        </ActionButton>
        <ActionButton icon={FileText} onClick={() => onNavigate("Reports")}>
          Open report reviews
        </ActionButton>
      </PageHeading>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="New Submissions"
          value={submitted}
          description="Waiting for initial review"
          icon={FileText}
          color="violet"
        />
        <StatCard
          label="Under Review"
          value={reviewing}
          description="Currently being reviewed"
          icon={Clock3}
          color="blue"
        />
        <StatCard
          label="Corrections Requested"
          value={corrections}
          description="Returned to departments"
          icon={AlertCircle}
          color="amber"
        />
        <StatCard
          label="Approved Reports"
          value={approved}
          description="Reports approved"
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-bold text-slate-900">Reports requiring attention</h3>
            <p className="mt-1 text-xs text-slate-500">
              Start reviewing new submissions and continue reviews in progress.
            </p>
          </div>
          <button
            onClick={() => onNavigate("Reports")}
            className="rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800"
          >
            Go to review desk
          </button>
        </div>

        <div className="space-y-3">
          {reviewQueue.slice(0, 6).map((report) => (
            <div
              key={report.id}
              className="flex flex-col justify-between gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center"
            >
              <div>
                <p className="font-semibold text-slate-800">
                  {report.title || `${report.period_type} Report`}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {report.department_name || "Department"} ·{" "}
                  {formatDate(report.start_date)} – {formatDate(report.end_date)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={report.status} />
                <button
                  onClick={() => onNavigate("Reports")}
                  className="text-sm font-semibold text-indigo-700"
                >
                  Review
                </button>
              </div>
            </div>
          ))}

          {!loading && reviewQueue.length === 0 && (
            <div className="rounded-xl bg-slate-50 p-8 text-center">
              <CheckCircle2 className="mx-auto text-emerald-600" size={30} />
              <p className="mt-3 font-semibold text-slate-800">
                No reports awaiting review
              </p>
              <p className="mt-1 text-sm text-slate-500">
                New departmental submissions will appear here.
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <RecentReports
          reports={reports}
          loading={loading}
          onNavigate={onNavigate}
        />
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-bold text-slate-900">Review responsibilities</h3>
          <p className="mt-1 text-xs text-slate-500">
            Your role in the reporting process
          </p>
          <div className="mt-5 space-y-4">
            {[
              ["Review submissions", "Check submitted weekly and monthly reports."],
              ["Request corrections", "Return incomplete reports with a clear comment."],
              ["Approve reports", "Approve reports that meet reporting requirements."],
              ["Maintain history", "Keep track of reviewed and approved submissions."],
            ].map(([title, description]) => (
              <div key={title} className="flex gap-3">
                <div className="rounded-lg bg-indigo-50 p-2 text-indigo-700">
                  <CheckCircle2 size={17} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{title}</p>
                  <p className="mt-1 text-xs text-slate-500">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="hidden">{activities.length}</div>
    </div>
  );
}

function LeaderDashboard({
  user,
  activities,
  reports,
  loading,
  error,
  onRefresh,
  onNavigate,
}) {
  const approved = reports.filter((r) => r.status === "APPROVED").length;
  const drafts = reports.filter((r) => r.status === "DRAFT").length;
  const corrections = reports.filter((r) => r.status === "CHANGES_REQUESTED").length;
  const departmentName =
    activities[0]?.department_name ||
    reports[0]?.department_name ||
    "Your assigned department";

  return (
    <div className="space-y-7">
      <PageHeading
        eyebrow="Department workspace"
        title={`Welcome, ${displayName(user).split(" ")[0]}`}
        description={`Manage activities and reporting for ${departmentName}.`}
      >
        <ActionButton icon={RefreshCw} secondary onClick={onRefresh}>
          Refresh
        </ActionButton>
        <ActionButton icon={Plus} onClick={() => onNavigate("Activities")}>
          Record Activity
        </ActionButton>
      </PageHeading>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-indigo-100 bg-indigo-900 p-6 text-white">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-200">
              Your department
            </p>
            <h3 className="mt-2 text-2xl font-bold">{departmentName}</h3>
            <p className="mt-2 max-w-xl text-sm text-indigo-100">
              Record activities as they happen. The system groups them into
              weekly and monthly reporting periods for you to review and submit.
            </p>
          </div>
          <button
            onClick={() => onNavigate("Reports")}
            className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-indigo-900 hover:bg-indigo-50"
          >
            Prepare a report
          </button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="My Activities"
          value={activities.length}
          description="Activities recorded by your department"
          icon={Activity}
          color="blue"
        />
        <StatCard
          label="My Reports"
          value={reports.length}
          description="Weekly and monthly reports"
          icon={FileText}
          color="violet"
        />
        <StatCard
          label="Draft Reports"
          value={drafts}
          description="Reports not yet submitted"
          icon={Clock3}
          color="amber"
        />
        <StatCard
          label="Approved"
          value={approved}
          description={`${corrections} returned for corrections`}
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <button
          onClick={() => onNavigate("Activities")}
          className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-indigo-300 hover:shadow-sm"
        >
          <div className="mb-4 inline-flex rounded-xl bg-blue-50 p-3 text-blue-700">
            <Plus size={21} />
          </div>
          <h3 className="font-bold text-slate-900">Record an activity</h3>
          <p className="mt-1 text-sm text-slate-500">
            Capture an activity, attendance, outcomes and photos.
          </p>
        </button>

        <button
          onClick={() => onNavigate("Reports")}
          className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-indigo-300 hover:shadow-sm"
        >
          <div className="mb-4 inline-flex rounded-xl bg-violet-50 p-3 text-violet-700">
            <CalendarDays size={21} />
          </div>
          <h3 className="font-bold text-slate-900">Prepare a report</h3>
          <p className="mt-1 text-sm text-slate-500">
            Review activities grouped into weekly or monthly reports.
          </p>
        </button>

        <button
          onClick={() => onNavigate("Reports")}
          className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-indigo-300 hover:shadow-sm"
        >
          <div className="mb-4 inline-flex rounded-xl bg-amber-50 p-3 text-amber-700">
            <AlertCircle size={21} />
          </div>
          <h3 className="font-bold text-slate-900">Check corrections</h3>
          <p className="mt-1 text-sm text-slate-500">
            Review feedback from the Secretary and resubmit reports.
          </p>
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RecentActivities
          activities={activities}
          loading={loading}
          onNavigate={onNavigate}
        />
        <RecentReports
          reports={reports}
          loading={loading}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}

function PlaceholderPage({ title, description }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="mb-4 rounded-2xl bg-indigo-50 p-4 text-indigo-700">
        <FileText size={28} />
      </div>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        {description || "This section is not yet connected to its management module."}
      </p>
    </div>
  );
}

export default function App({ user, onLogout }) {
  const role = normalizeRole(user?.role);

  const [active, setActive] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activities, setActivities] = useState([]);
  const [reports, setReports] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    const requests = [
      api.get("/reports/activities/"),
      api.get("/reports/submissions/"),
    ];

    if (role === "ADMIN") {
      requests.push(api.get("/departments/"));
      requests.push(api.get("/accounts/users/"));
    }

    const results = await Promise.allSettled(requests);
    const failures = [];

    if (results[0]?.status === "fulfilled") {
      setActivities(getItems(results[0].value.data));
    } else {
      failures.push("activities");
    }

    if (results[1]?.status === "fulfilled") {
      setReports(getItems(results[1].value.data));
    } else {
      failures.push("reports");
    }

    if (role === "ADMIN") {
      if (results[2]?.status === "fulfilled") {
        setDepartments(getItems(results[2].value.data));
      } else {
        failures.push("departments");
      }

      if (results[3]?.status === "fulfilled") {
        setUsers(getItems(results[3].value.data));
      } else {
        failures.push("users");
      }
    }

    if (failures.length) {
      setError(
        `Some dashboard information could not be loaded: ${failures.join(", ")}.`
      );
    }

    setLoading(false);
  }, [role]);

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

  const pageDescription = useMemo(() => {
    const descriptions = {
      Departments: "Manage church departments and their assigned leaders.",
      Users: "Create and manage system accounts and role assignments.",
      Notifications: "View important reporting and system notifications.",
      Settings: "Manage your account settings.",
    };

    return descriptions[active] || "";
  }, [active]);

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
                <p className="text-xs text-slate-500">{roleName(user?.role)}</p>
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
          {active === "Overview" && role === "ADMIN" && (
            <AdminDashboard
              user={user}
              activities={activities}
              reports={reports}
              departments={departments}
              users={users}
              loading={loading}
              error={error}
              onRefresh={loadDashboard}
              onNavigate={handleNavigate}
            />
          )}

          {active === "Overview" && role === "SECRETARY" && (
            <SecretaryDashboard
              user={user}
              activities={activities}
              reports={reports}
              loading={loading}
              error={error}
              onRefresh={loadDashboard}
              onNavigate={handleNavigate}
            />
          )}

          {active === "Overview" && role === "DEPARTMENT_LEADER" && (
            <LeaderDashboard
              user={user}
              activities={activities}
              reports={reports}
              loading={loading}
              error={error}
              onRefresh={loadDashboard}
              onNavigate={handleNavigate}
            />
          )}

          {active === "Activities" && <ActivitiesPage user={user} />}
          {active === "Reports" && <ReportsPage user={user} />}

          {active !== "Overview" &&
            active !== "Activities" &&
            active !== "Reports" && (
              <PlaceholderPage title={active} description={pageDescription} />
            )}
        </main>

        <footer className="border-t border-slate-200 bg-white px-7 py-4 text-center text-xs text-slate-400">
          © 2026 Moi University Main Altar · Departmental Reporting System
        </footer>
      </div>
    </div>
  );
}
