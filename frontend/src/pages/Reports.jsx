
import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileText,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Users,
  Wallet,
  X,
  ChevronRight,
} from "lucide-react";
import api from "../services/api";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const STATUS_LABELS = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  CHANGES_REQUESTED: "Corrections requested",
  APPROVED: "Approved",
};

const STATUS_STYLES = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-700",
  SUBMITTED: "border-violet-200 bg-violet-50 text-violet-700",
  UNDER_REVIEW: "border-blue-200 bg-blue-50 text-blue-700",
  CHANGES_REQUESTED: "border-amber-200 bg-amber-50 text-amber-800",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const MAX_PAGES = 50;

const inputClass =
  "block w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 sm:text-sm";

const textareaClass = `${inputClass} min-h-[125px] resize-y leading-6`;

const initialForm = {
  period_type: "WEEKLY",
  selected_date: "",
  title: "",
  executive_summary: "",
  achievements: "",
  challenges: "",
  recommendations: "",
  plans_for_next_period: "",
  general_remarks: "",
  includes_financial_report: false,
  financial_summary: "",
  total_expenditure: "0",
};

const PERIOD_OPTIONS = [
  {
    value: "DAILY",
    title: "Daily",
    description: "One day's activities",
    icon: CalendarDays,
  },
  {
    value: "WEEKLY",
    title: "Weekly",
    description: "Monday to Sunday",
    icon: CalendarRange,
  },
  {
    value: "MONTHLY",
    title: "Monthly",
    description: "Full calendar month",
    icon: BarChart3,
  },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function localDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

async function errorMessage(error) {
  let data = error?.response?.data;

  if (typeof Blob !== "undefined" && data instanceof Blob) {
    try {
      const body = await data.text();

      try {
        data = JSON.parse(body);
      } catch {
        data = body;
      }
    } catch {
      data = null;
    }
  }

  if (!data) return error?.message || "Something went wrong.";
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;

  return (
    Object.entries(data)
      .map(([key, value]) => {
        const message = Array.isArray(value)
          ? value.join(", ")
          : typeof value === "string"
            ? value
            : JSON.stringify(value);

        return `${key}: ${message}`;
      })
      .join(" | ") || "Something went wrong."
  );
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(value) {
  const amount = Number(value || 0);

  return `KES ${(
    Number.isFinite(amount) ? amount : 0
  ).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getPeriodDates(type, selectedDate) {
  const date = new Date(`${selectedDate}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return {
      start_date: selectedDate,
      end_date: selectedDate,
    };
  }

  const toDate = (value) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  if (type === "DAILY") {
    const selected = toDate(date);
    return { start_date: selected, end_date: selected };
  }

  if (type === "WEEKLY") {
    const day = date.getDay();
    const difference = day === 0 ? -6 : 1 - day;

    const monday = new Date(date);
    monday.setDate(date.getDate() + difference);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      start_date: toDate(monday),
      end_date: toDate(sunday),
    };
  }

  return {
    start_date: toDate(new Date(date.getFullYear(), date.getMonth(), 1)),
    end_date: toDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  };
}

function resolveExpenditure(data, calculated) {
  if (data?.includes_financial_report) {
    return data.total_expenditure ?? calculated ?? 0;
  }

  return calculated ?? 0;
}

function getReportContent(report) {
  const snapshot = report?.compiled_snapshot;

  if (
    snapshot?.report &&
    ["SUBMITTED", "UNDER_REVIEW", "APPROVED"].includes(report.status)
  ) {
    return {
      data: snapshot.report,
      department: snapshot.department || {},
      activities: snapshot.activities || [],
      activityCount:
        snapshot.activity_count ?? snapshot.activities?.length ?? 0,
      attendance: snapshot.total_attendance ?? 0,
      expenditure: snapshot.calculated_activity_expenditure ?? 0,
      preparedBy: snapshot.prepared_by,
    };
  }

  return {
    data: report,
    department: {
      name: report.department_name,
      code: report.department_code,
    },
    activities: Array.isArray(report.activities) ? report.activities : [],
    activityCount: report.activities?.length || 0,
    attendance: report.total_attendance || 0,
    expenditure: report.calculated_activity_expenditure ?? 0,
    preparedBy: report.created_by_name,
  };
}

function buildFilename(report, format) {
  const slug = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const parts = [
    slug(report.department_name) || "department",
    slug(report.period_type),
    String(report.start_date || "").slice(0, 10),
    `report-${report.id}`,
  ].filter(Boolean);

  return `${parts.join("-")}.${format === "pdf" ? "pdf" : "docx"}`;
}

/* -------------------------------------------------------------------------- */
/* Modal hook                                                                 */
/* -------------------------------------------------------------------------- */

function useModal(open, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (event) => {
      if (event.key === "Escape") closeRef.current?.();
    };

    document.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);
}

/* -------------------------------------------------------------------------- */
/* Reusable components                                                        */
/* -------------------------------------------------------------------------- */

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-3 py-1.5 text-[11px] font-bold leading-none ${
        STATUS_STYLES[status] || "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      <span className="mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {STATUS_LABELS[status] || status || "Unknown"}
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  color = "indigo",
}) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-700",
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-200 hover:shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 sm:text-sm">
            {label}
          </p>
          <p className="mt-3 break-words text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {value}
          </p>
          {detail && (
            <p className="mt-1 text-[11px] leading-5 text-slate-500 sm:text-xs">
              {detail}
            </p>
          )}
        </div>

        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors[color]}`}
        >
          <Icon size={19} strokeWidth={2} />
        </span>
      </div>
    </div>
  );
}

function Field({ label, children, hint, required = false }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-bold text-slate-700"
      >
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </label>

      {cloneElement(children, {
        id,
        "aria-describedby": hintId,
      })}

      {hint && (
        <p
          id={hintId}
          className="mt-1.5 text-xs leading-5 text-slate-500"
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function SectionHeading({ number, title, description, icon: Icon }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
        <Icon size={19} />
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-indigo-700">
          Section {number}
        </p>
        <h3 className="mt-1 font-heading text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
          {title}
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
          {description}
        </p>
      </div>
    </div>
  );
}

function Notice({ type = "error", children, onClose }) {
  const success = type === "success";
  const Icon = success ? CheckCircle2 : AlertCircle;

  return (
    <div
      role={success ? "status" : "alert"}
      className={`flex min-w-0 items-start gap-3 rounded-2xl border p-4 text-sm ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-rose-200 bg-rose-50 text-rose-800"
      }`}
    >
      <Icon size={19} className="mt-0.5 shrink-0" />

      <div className="min-w-0 flex-1 break-words leading-6">
        {children}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-black/5"
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function EmptyState({ title, description, icon: Icon = FileText, action }) {
  return (
    <div className="px-5 py-12 text-center sm:px-8 sm:py-16">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon size={26} />
      </div>

      <h3 className="mt-4 font-heading text-base font-extrabold text-slate-900">
        {title}
      </h3>

      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {description}
      </p>

      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function ActivityCard({ activity }) {
  const attachments = activity.attachments || [];

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-200 sm:p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 className="break-words text-sm font-extrabold text-slate-900 sm:text-base">
            {activity.title || `Activity #${activity.id}`}
          </h4>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span>
              {activity.activity_type_display ||
                activity.activity_type ||
                "Activity"}
            </span>
            <span className="text-slate-300">•</span>
            <span>{formatDate(activity.activity_date)}</span>
          </div>
        </div>

        <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">
          <Users size={14} />
          {Number(activity.attendance_count || 0).toLocaleString()} people
        </span>
      </div>

      {activity.location && (
        <p className="mt-3 break-words text-sm text-slate-600">
          <span className="font-bold text-slate-700">Location:</span>{" "}
          {activity.location}
        </p>
      )}

      {activity.description && (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
          {activity.description}
        </p>
      )}

      {activity.outcomes && (
        <div className="mt-4 rounded-xl border-l-2 border-emerald-400 bg-emerald-50/60 p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
            Outcomes
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
            {activity.outcomes}
          </p>
        </div>
      )}

      {activity.challenges && (
        <div className="mt-3 rounded-xl border-l-2 border-amber-400 bg-amber-50/60 p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
            Challenges
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
            {activity.challenges}
          </p>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {attachments.map((attachment, index) => (
            <span
              key={attachment.id || index}
              className="inline-flex max-w-full items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600"
            >
              <FileText size={13} className="shrink-0" />
              <span className="break-all">
                {attachment.file_name ||
                  attachment.caption ||
                  "Attachment"}
              </span>
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function PeriodOption({ selected, title, description, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex min-h-[88px] min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition-all sm:p-4 ${
        selected
          ? "border-indigo-500 bg-indigo-50 shadow-sm ring-2 ring-indigo-500/10"
          : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          selected
            ? "bg-indigo-600 text-white"
            : "bg-slate-100 text-slate-600"
        }`}
      >
        <Icon size={19} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-slate-900">
          {title}
        </span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {description}
        </span>
      </span>

      <span
        className={`h-4 w-4 shrink-0 rounded-full border ${
          selected
            ? "border-[5px] border-indigo-600 bg-white"
            : "border-slate-300"
        }`}
      />
    </button>
  );
}

function LoadingState({ label = "Loading..." }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-sm text-slate-500">
      <RefreshCw size={23} className="animate-spin text-indigo-600" />
      <span>{label}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Report details dialog                                                      */
/* -------------------------------------------------------------------------- */

function ReportDetails({ report, onClose }) {
  useModal(Boolean(report), onClose);

  if (!report) return null;

  const content = getReportContent(report);
  const data = content.data;

  const sections = [
    ["Executive summary", data.executive_summary],
    ["Key achievements", data.achievements],
    ["Challenges", data.challenges],
    ["Recommendations", data.recommendations],
    ["Plans for next period", data.plans_for_next_period],
    ["General remarks", data.general_remarks],
    ["Financial summary", data.financial_summary],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-details-title"
        className="flex max-h-[96dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-slate-50 shadow-2xl sm:max-h-[92vh] sm:rounded-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <FileCheck2 size={20} />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
                Moi University Main Altar
              </p>
              <h2
                id="report-details-title"
                className="mt-0.5 font-heading text-base font-extrabold text-slate-900 sm:text-lg"
              >
                Departmental report
              </h2>
              <p className="truncate text-xs text-slate-500">
                {content.department.name ||
                  report.department_name ||
                  "Department"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100"
            aria-label="Close report"
          >
            <X size={19} />
          </button>
        </header>

        <div className="overflow-y-auto p-3 sm:p-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="break-words font-heading text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                  {data.title || report.title}
                </h3>

                <p className="mt-2 text-xs leading-5 text-slate-500 sm:text-sm">
                  {data.period_type || report.period_type} report
                  <span className="mx-2 text-slate-300">•</span>
                  {formatDate(data.start_date || report.start_date)} –{" "}
                  {formatDate(data.end_date || report.end_date)}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Prepared by: {content.preparedBy || "—"}
                </p>
              </div>

              <StatusBadge status={report.status} />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
              <MetricCard
                icon={ClipboardList}
                label="Activities"
                value={content.activityCount}
              />
              <MetricCard
                icon={Users}
                label="Attendance"
                value={Number(content.attendance).toLocaleString()}
                color="blue"
              />
              <MetricCard
                icon={Wallet}
                label="Expenditure"
                value={formatMoney(
                  resolveExpenditure(data, content.expenditure)
                )}
                detail={
                  data.includes_financial_report
                    ? "Reported by department"
                    : "Calculated from activities"
                }
                color="emerald"
              />
            </div>

            <div className="mt-7 space-y-6">
              {sections.map(([heading, value]) =>
                value ? (
                  <section key={heading}>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      {heading}
                    </h4>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
                      {value}
                    </p>
                  </section>
                ) : null
              )}

              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-extrabold text-slate-900">
                    Compiled activities
                  </h4>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {content.activities.length} recorded
                  </span>
                </div>

                {content.activities.length > 0 ? (
                  <div className="space-y-3">
                    {content.activities.map((activity, index) => (
                      <ActivityCard
                        key={activity.id || index}
                        activity={activity}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                    No activity details are available in this report.
                  </p>
                )}
              </section>

              {report.review_comment && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <h4 className="text-sm font-extrabold text-amber-900">
                    Secretary's review comment
                  </h4>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-amber-800">
                    {report.review_comment}
                  </p>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Report card                                                                */
/* -------------------------------------------------------------------------- */

function ReportCard({
  report,
  isLeader,
  isSecretary,
  saving,
  downloading,
  onView,
  onEdit,
  onAction,
  onDownload,
}) {
  const canEdit =
    isLeader && ["DRAFT", "CHANGES_REQUESTED"].includes(report.status);

  const canSubmit =
    isLeader && ["DRAFT", "CHANGES_REQUESTED"].includes(report.status);

  const canReview = isSecretary && report.status === "SUBMITTED";
  const canDecide = isSecretary && report.status === "UNDER_REVIEW";

  const canExport = ["SUBMITTED", "UNDER_REVIEW", "APPROVED"].includes(
    report.status
  );

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-indigo-200 hover:shadow-sm sm:p-5">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <FileText size={20} />
            </div>

            <div className="min-w-0">
              <h3 className="break-words font-heading text-sm font-extrabold text-slate-900 sm:text-base">
                {report.title || "Departmental report"}
              </h3>

              <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                {report.department_name || "Department"}
                <span className="mx-2 text-slate-300">•</span>
                {report.period_type || "Report"}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <StatusBadge status={report.status} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
          <div className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
            <CalendarDays size={15} className="shrink-0 text-slate-400" />
            <span className="break-words">
              {formatDate(report.start_date)} – {formatDate(report.end_date)}
            </span>
          </div>

          <div className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
            <Users size={15} className="shrink-0 text-slate-400" />
            <span className="break-words">
              Prepared by {report.created_by_name || "—"}
            </span>
          </div>
        </div>

        {report.status === "CHANGES_REQUESTED" &&
          report.review_comment && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-extrabold text-amber-900">
                Correction requested
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-amber-800">
                {report.review_comment}
              </p>
            </div>
          )}

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onView}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:flex-none"
          >
            <Eye size={15} />
            View
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50 sm:flex-none"
            >
              <Pencil size={14} />
              Edit
            </button>
          )}

          {canSubmit && (
            <button
              type="button"
              onClick={() => onAction(report, "submit")}
              disabled={saving}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-800 disabled:opacity-50 sm:flex-none"
            >
              <Send size={14} />
              Submit
            </button>
          )}

          {canReview && (
            <button
              type="button"
              onClick={() => onAction(report, "start_review")}
              disabled={saving}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-800 disabled:opacity-50 sm:flex-none"
            >
              <Eye size={14} />
              Start review
            </button>
          )}

          {canDecide && (
            <>
              <button
                type="button"
                onClick={() => onAction(report, "request_changes")}
                disabled={saving}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-100 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-200 disabled:opacity-50 sm:flex-none"
              >
                <MessageSquare size={14} />
                Corrections
              </button>

              <button
                type="button"
                onClick={() => onAction(report, "approve")}
                disabled={saving}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50 sm:flex-none"
              >
                <CheckCircle2 size={14} />
                Approve
              </button>
            </>
          )}

          {canExport && (
            <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
              <button
                type="button"
                onClick={() => onDownload(report, "pdf")}
                disabled={downloading === `${report.id}-pdf`}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:flex-none"
              >
                <Download size={14} />
                {downloading === `${report.id}-pdf` ? "Preparing..." : "PDF"}
              </button>

              <button
                type="button"
                onClick={() => onDownload(report, "word")}
                disabled={downloading === `${report.id}-word`}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:flex-none"
              >
                <Download size={14} />
                {downloading === `${report.id}-word` ? "Preparing..." : "Word"}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Reports page                                                          */
/* -------------------------------------------------------------------------- */

export default function Reports({ user }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);

  const [form, setForm] = useState({
    ...initialForm,
    selected_date: localDate(),
  });

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [summaryNonce, setSummaryNonce] = useState(0);
  const summaryRequestRef = useRef(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [reviewDialog, setReviewDialog] = useState(null);
  const [reviewComment, setReviewComment] = useState("");

  const noticeRef = useRef(null);

  const isLeader = user?.role === "DEPARTMENT_LEADER";
  const isSecretary = user?.role === "SECRETARY";

  const periodDates = useMemo(
    () => getPeriodDates(form.period_type, form.selected_date),
    [form.period_type, form.selected_date]
  );

  useModal(Boolean(reviewDialog), () => setReviewDialog(null));

  /* ---------------------------------------------------------------------- */
  /* Notifications                                                          */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if ((error || success) && noticeRef.current) {
      noticeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [error, success]);

  /* ---------------------------------------------------------------------- */
  /* Load reports                                                           */
  /* ---------------------------------------------------------------------- */

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      let page = 1;
      let all = [];

      while (page <= MAX_PAGES) {
        const response = await api.get("/reports/submissions/", {
          params: { page },
        });

        all = all.concat(getItems(response.data));

        if (!response.data?.next) break;
        page += 1;
      }

      setReports(all);
    } catch (err) {
      setError(await errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  /* ---------------------------------------------------------------------- */
  /* Load activity summary                                                  */
  /* ---------------------------------------------------------------------- */

  const loadSummary = useCallback(async () => {
    if (!showForm || !isLeader || !form.selected_date) return;

    const requestId = ++summaryRequestRef.current;

    setSummaryLoading(true);
    setSummaryError("");

    try {
      const response = await api.get("/reports/activity-summary/", {
        params: {
          period_type: form.period_type,
          date: form.selected_date,
        },
      });

      if (requestId !== summaryRequestRef.current) return;

      setSummary(response.data);
    } catch (err) {
      if (requestId !== summaryRequestRef.current) return;

      setSummary(null);
      setSummaryError(await errorMessage(err));
    } finally {
      if (requestId === summaryRequestRef.current) {
        setSummaryLoading(false);
      }
    }
  }, [
    showForm,
    isLeader,
    form.period_type,
    form.selected_date,
    summaryNonce,
  ]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  /* ---------------------------------------------------------------------- */
  /* Form helpers                                                           */
  /* ---------------------------------------------------------------------- */

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const setPeriodType = (periodType) => {
    setForm((previous) => ({
      ...previous,
      period_type: periodType,
    }));
  };

  const openCreateForm = () => {
    setEditingReport(null);
    setForm({
      ...initialForm,
      selected_date: localDate(),
    });
    setSummary(null);
    setSummaryError("");
    setSummaryNonce((value) => value + 1);
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const openEditForm = (report) => {
    setEditingReport(report);

    setForm({
      period_type: report.period_type || "WEEKLY",
      selected_date: String(report.start_date || localDate()).slice(0, 10),
      title: report.title || "",
      executive_summary: report.executive_summary || "",
      achievements: report.achievements || "",
      challenges: report.challenges || "",
      recommendations: report.recommendations || "",
      plans_for_next_period: report.plans_for_next_period || "",
      general_remarks: report.general_remarks || "",
      includes_financial_report: Boolean(
        report.includes_financial_report
      ),
      financial_summary: report.financial_summary || "",
      total_expenditure: report.total_expenditure || "0",
    });

    setSummary(null);
    setSummaryError("");
    setSummaryNonce((value) => value + 1);
    setShowForm(true);
    setSelectedReport(null);
    setError("");
    setSuccess("");
  };

  const closeForm = () => {
    summaryRequestRef.current += 1;

    setShowForm(false);
    setEditingReport(null);
    setSummary(null);
    setSummaryError("");
    setSummaryLoading(false);
  };

  /* ---------------------------------------------------------------------- */
  /* Save report                                                            */
  /* ---------------------------------------------------------------------- */

  const saveReport = async (event) => {
    event.preventDefault();

    if (!editingReport) {
      if (!summary || summaryError) {
        setError(
          "The activity summary has not loaded. Please refresh the activities before saving."
        );
        return;
      }

      if (!summary.activity_count) {
        setError(
          "There are no recorded activities in this reporting period. Record activities first."
        );
        return;
      }
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      period_type: form.period_type,
      ...periodDates,
      title:
        form.title.trim() ||
        `${form.period_type.charAt(0)}${form.period_type
          .slice(1)
          .toLowerCase()} Department Report`,
      executive_summary: form.executive_summary,
      achievements: form.achievements,
      challenges: form.challenges,
      recommendations: form.recommendations,
      plans_for_next_period: form.plans_for_next_period,
      general_remarks: form.general_remarks,
      includes_financial_report: form.includes_financial_report,
      financial_summary: form.includes_financial_report
        ? form.financial_summary
        : "",
      total_expenditure: form.includes_financial_report
        ? form.total_expenditure || "0"
        : "0",
    };

    try {
      if (editingReport) {
        await api.patch(
          `/reports/submissions/${editingReport.id}/`,
          payload
        );
        setSuccess("Report draft updated successfully.");
      } else {
        await api.post("/reports/submissions/", payload);
        setSuccess("Report draft created successfully.");
      }

      closeForm();
      await loadReports();
    } catch (err) {
      setError(await errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Workflow actions                                                       */
  /* ---------------------------------------------------------------------- */

  const performAction = async (report, action, comment = "") => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload =
        action === "request_changes" || action === "approve"
          ? { comment }
          : {};

      await api.post(
        `/reports/submissions/${report.id}/${action}/`,
        payload
      );

      const messages = {
        submit:
          "Report submitted successfully. The Secretary can now review it.",
        start_review: "Report moved into review.",
        approve: "Report approved successfully.",
        request_changes: "Corrections requested successfully.",
      };

      setSuccess(messages[action] || "Action completed successfully.");
      setReviewDialog(null);
      setReviewComment("");

      await loadReports();
    } catch (err) {
      setError(await errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReportAction = (report, action) => {
    if (action === "request_changes" || action === "approve") {
      setReviewDialog({ report, action });
      setReviewComment("");
      return;
    }

    performAction(report, action);
  };

  /* ---------------------------------------------------------------------- */
  /* Export                                                                 */
  /* ---------------------------------------------------------------------- */

  const downloadExport = async (report, format) => {
    const key = `${report.id}-${format}`;

    setDownloading(key);
    setError("");

    try {
      const response = await api.get(
        `/reports/submissions/${report.id}/export/${format}/`,
        { responseType: "blob" }
      );

      const mimeType =
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = buildFilename(report, format);

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(await errorMessage(err));
    } finally {
      setDownloading(null);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Dashboard data                                                         */
  /* ---------------------------------------------------------------------- */

  const statusCounts = {
    total: reports.length,
    pending: reports.filter((report) =>
      ["SUBMITTED", "UNDER_REVIEW"].includes(report.status)
    ).length,
    approved: reports.filter((report) => report.status === "APPROVED")
      .length,
    corrections: reports.filter(
      (report) => report.status === "CHANGES_REQUESTED"
    ).length,
  };

  const filteredReports = reports.filter((report) => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) return true;

    return [
      report.title,
      report.department_name,
      report.period_type,
      report.status,
      STATUS_LABELS[report.status],
      report.created_by_name,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const saveDisabled =
    saving ||
    (!editingReport &&
      (summaryLoading || !summary || !summary.activity_count));

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 pb-8 sm:space-y-7">
      {/* Page header */}

      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="absolute right-0 top-0 hidden h-full w-1/3 bg-gradient-to-l from-indigo-50/80 to-transparent sm:block" />

        <div className="relative flex flex-col gap-5 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between lg:p-7">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo-700">
              <FileCheck2 size={13} />
              Moi University Main Altar
            </div>

            <h1 className="font-heading text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
              Reports management
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Prepare departmental reports, review submissions and monitor
              reporting progress from one place.
            </p>
          </div>

          <div className="relative flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <button
              type="button"
              onClick={loadReports}
              disabled={loading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>

            {isLeader && (
              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-800 hover:shadow-md"
              >
                <Plus size={17} />
                Create report
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Notifications */}

      {(error || success) && (
        <div ref={noticeRef} className="scroll-mt-4 space-y-3">
          {error && <Notice onClose={() => setError("")}>{error}</Notice>}

          {success && (
            <Notice type="success" onClose={() => setSuccess("")}>
              {success}
            </Notice>
          )}
        </div>
      )}

      {/* Overview */}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-base font-extrabold text-slate-900 sm:text-lg">
              Reporting overview
            </h2>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              A quick summary of report progress.
            </p>
          </div>

          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <BarChart3 size={18} />
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            icon={FileText}
            label="Total reports"
            value={statusCounts.total}
            detail="All reporting periods"
          />

          <MetricCard
            icon={Clock3}
            label="Awaiting review"
            value={statusCounts.pending}
            detail="Submitted or being reviewed"
            color="blue"
          />

          <MetricCard
            icon={FileCheck2}
            label="Approved"
            value={statusCounts.approved}
            detail="Successfully approved"
            color="emerald"
          />

          <MetricCard
            icon={AlertCircle}
            label="Corrections"
            value={statusCounts.corrections}
            detail="Requires attention"
            color="amber"
          />
        </div>
      </section>

      {/* Create / edit report */}

      {showForm && isLeader && (
        <form
          onSubmit={saveReport}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 sm:p-6">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                <FileText size={21} />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-indigo-700">
                  {editingReport ? "Update report" : "New submission"}
                </p>

                <h2 className="mt-1 font-heading text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                  {editingReport
                    ? "Edit department report"
                    : "Create department report"}
                </h2>

                <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500 sm:text-sm">
                  Complete the sections below. Your report is saved as a draft
                  before submission.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeForm}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100"
              aria-label="Close report form"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-7 p-4 sm:p-6 lg:p-7">
            {/* Section 1: Reporting period */}

            <section className="space-y-5">
              <SectionHeading
                number="01"
                title="Reporting period"
                description="Choose the reporting period you are preparing."
                icon={CalendarRange}
              />

              <div
                role="radiogroup"
                aria-label="Reporting period type"
                className="grid grid-cols-1 gap-3 sm:grid-cols-3"
              >
                {PERIOD_OPTIONS.map((option) => (
                  <PeriodOption
                    key={option.value}
                    selected={form.period_type === option.value}
                    title={option.title}
                    description={option.description}
                    icon={option.icon}
                    onClick={() => setPeriodType(option.value)}
                  />
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label={
                    form.period_type === "DAILY"
                      ? "Reporting date"
                      : form.period_type === "WEEKLY"
                        ? "Choose a date in the reporting week"
                        : "Choose a date in the reporting month"
                  }
                  required
                  hint="The system calculates the full reporting period from this date."
                >
                  <input
                    type="date"
                    name="selected_date"
                    value={form.selected_date}
                    onChange={updateField}
                    required
                    className={inputClass}
                  />
                </Field>

                <Field
                  label="Report title"
                  hint="Give this report a clear and descriptive name."
                >
                  <input
                    name="title"
                    value={form.title}
                    onChange={updateField}
                    placeholder="e.g. Weekly Worship Department Report"
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 sm:p-5">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-indigo-800">
                  <CalendarDays size={16} />
                  Reporting coverage
                </div>

                <p className="mt-2 break-words font-heading text-lg font-extrabold text-indigo-900 sm:text-xl">
                  {formatDate(periodDates.start_date)} –{" "}
                  {formatDate(periodDates.end_date)}
                </p>

                <p className="mt-1 text-xs leading-5 text-indigo-700">
                  Activities recorded within these dates will be included
                  automatically.
                </p>
              </div>
            </section>

            <div className="border-t border-slate-100" />

            {/* Section 2: Activities */}

            <section className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <SectionHeading
                  number="02"
                  title="Recorded activities"
                  description="Activities are compiled automatically from your department's activity records."
                  icon={ClipboardList}
                />

                <button
                  type="button"
                  onClick={() => setSummaryNonce((value) => value + 1)}
                  disabled={summaryLoading}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw
                    size={14}
                    className={summaryLoading ? "animate-spin" : ""}
                  />
                  Refresh activities
                </button>
              </div>

              {summaryError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
                >
                  {summaryError}
                </div>
              )}

              {editingReport &&
                !summaryLoading &&
                summary &&
                !summary.activity_count && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                    No activities are currently recorded for this period. You
                    can still update this draft, but check the reporting
                    period before submitting.
                  </div>
                )}

              {summaryLoading ? (
                <div className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                  <RefreshCw
                    size={22}
                    className="animate-spin text-indigo-600"
                  />
                  Loading activities for this reporting period...
                </div>
              ) : summary ? (
                <>
                  <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
                    <MetricCard
                      icon={ClipboardList}
                      label="Activities recorded"
                      value={summary.activity_count ?? 0}
                    />

                    <MetricCard
                      icon={Users}
                      label="Total attendance"
                      value={Number(
                        summary.total_attendance || 0
                      ).toLocaleString()}
                      color="blue"
                    />

                    <MetricCard
                      icon={Wallet}
                      label="Activity expenditure"
                      value={formatMoney(summary.total_expenditure)}
                      color="emerald"
                    />
                  </div>

                  {summary.activities?.length > 0 ? (
                    <div className="space-y-3">
                      {summary.activities.map((activity, index) => (
                        <ActivityCard
                          key={activity.id || index}
                          activity={activity}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No activities found"
                      description="There are no recorded activities for this period. Record your department's activities first, then return here."
                      icon={ClipboardList}
                    />
                  )}
                </>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  {summaryError
                    ? "Activities could not be loaded. Use Refresh activities to try again."
                    : "Select a reporting period to load its activities."}
                </div>
              )}
            </section>

            <div className="border-t border-slate-100" />

            {/* Section 3: Assessment */}

            <section className="space-y-5">
              <SectionHeading
                number="03"
                title="Department leader's assessment"
                description="Explain the work carried out, its results, challenges and future plans."
                icon={MessageSquare}
              />

              <Field
                label="Executive summary"
                required
                hint="Give a brief overview of what the department did and its overall impact."
              >
                <textarea
                  name="executive_summary"
                  value={form.executive_summary}
                  onChange={updateField}
                  required
                  rows={4}
                  placeholder="Summarise the department's activities, progress and overall impact..."
                  className={textareaClass}
                />
              </Field>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Field
                  label="Key achievements"
                  hint="What did the department accomplish?"
                >
                  <textarea
                    name="achievements"
                    value={form.achievements}
                    onChange={updateField}
                    rows={4}
                    placeholder="Describe the department's achievements..."
                    className={textareaClass}
                  />
                </Field>

                <Field
                  label="Challenges encountered"
                  hint="What difficulties affected the department's work?"
                >
                  <textarea
                    name="challenges"
                    value={form.challenges}
                    onChange={updateField}
                    rows={4}
                    placeholder="Describe the challenges encountered..."
                    className={textareaClass}
                  />
                </Field>

                <Field
                  label="Recommendations"
                  hint="What improvements or support are needed?"
                >
                  <textarea
                    name="recommendations"
                    value={form.recommendations}
                    onChange={updateField}
                    rows={4}
                    placeholder="Provide recommendations..."
                    className={textareaClass}
                  />
                </Field>

                <Field
                  label="Plans for next period"
                  hint="What does the department intend to do next?"
                >
                  <textarea
                    name="plans_for_next_period"
                    value={form.plans_for_next_period}
                    onChange={updateField}
                    rows={4}
                    placeholder="Outline upcoming activities and priorities..."
                    className={textareaClass}
                  />
                </Field>
              </div>

              <Field
                label="General remarks"
                hint="Include any other information relevant to this report."
              >
                <textarea
                  name="general_remarks"
                  value={form.general_remarks}
                  onChange={updateField}
                  rows={3}
                  placeholder="Additional comments or observations..."
                  className={textareaClass}
                />
              </Field>
            </section>

            <div className="border-t border-slate-100" />

            {/* Section 4: Financial information */}

            <section className="space-y-4">
              <SectionHeading
                number="04"
                title="Financial information"
                description="Include financial details where they are relevant to this report."
                icon={Wallet}
              />

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-200 hover:bg-slate-50">
                <input
                  type="checkbox"
                  name="includes_financial_report"
                  checked={form.includes_financial_report}
                  onChange={updateField}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />

                <span className="min-w-0">
                  <span className="block text-sm font-extrabold text-slate-800">
                    Include financial information
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Select this if the report should include departmental
                    expenditure and a financial explanation.
                  </span>
                </span>
              </label>

              {form.includes_financial_report && (
                <div className="grid grid-cols-1 gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 md:grid-cols-2">
                  <Field
                    label="Total expenditure (KES)"
                    hint="Enter the total amount spent during this period."
                  >
                    <input
                      type="number"
                      name="total_expenditure"
                      min="0"
                      step="0.01"
                      value={form.total_expenditure}
                      onChange={updateField}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </Field>

                  <Field
                    label="Financial summary"
                    hint="Explain the expenditure and other relevant financial details."
                  >
                    <textarea
                      name="financial_summary"
                      value={form.financial_summary}
                      onChange={updateField}
                      rows={3}
                      placeholder="Provide a brief financial explanation..."
                      className={textareaClass}
                    />
                  </Field>
                </div>
              )}
            </section>

            {/* Form footer */}

            <div className="flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <p>
                  Your report is saved as a draft. You can review it before
                  submitting.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
                <button
                  type="button"
                  onClick={closeForm}
                  className="min-h-11 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saveDisabled}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
                >
                  {saving ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <FileText size={16} />
                  )}
                  {editingReport ? "Update draft" : "Save draft"}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Reports list */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-lg font-extrabold text-slate-900">
                Departmental reports
              </h2>

              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600">
                {reports.length}
              </span>
            </div>

            <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
              View reports, monitor progress and take the appropriate actions.
            </p>
          </div>

          <div className="relative w-full lg:max-w-xs">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search reports..."
              aria-label="Search reports"
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading departmental reports..." />
        ) : filteredReports.length === 0 ? (
          <EmptyState
            title={searchTerm ? "No matching reports" : "No reports yet"}
            description={
              searchTerm
                ? "Try another search term."
                : isLeader
                  ? "Once you create and save a departmental report, it will appear here."
                  : "Departmental reports will appear here when they are available."
            }
            action={
              isLeader && !searchTerm && !showForm ? (
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-800"
                >
                  <Plus size={16} />
                  Create your first report
                </button>
              ) : null
            }
          />
        ) : (
          <div className="space-y-3 p-3 sm:p-5">
            {filteredReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                isLeader={isLeader}
                isSecretary={isSecretary}
                saving={saving}
                downloading={downloading}
                onView={() => setSelectedReport(report)}
                onEdit={() => openEditForm(report)}
                onAction={handleReportAction}
                onDownload={downloadExport}
              />
            ))}
          </div>
        )}
      </section>

      {/* Secretary review dialog */}

      {reviewDialog && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setReviewDialog(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-dialog-title"
            className="w-full max-w-lg rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    reviewDialog.action === "approve"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {reviewDialog.action === "approve" ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <MessageSquare size={20} />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
                    Report review
                  </p>

                  <h3
                    id="review-dialog-title"
                    className="mt-1 font-heading text-lg font-extrabold text-slate-900"
                  >
                    {reviewDialog.action === "approve"
                      ? "Approve this report?"
                      : "Request corrections"}
                  </h3>

                  <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                    {reviewDialog.report.title || "Departmental report"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setReviewDialog(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {reviewDialog.action === "request_changes" ? (
              <div className="mt-5">
                <Field
                  label="Correction instructions"
                  required
                  hint="Clearly explain what the department must correct before resubmission."
                >
                  <textarea
                    value={reviewComment}
                    onChange={(event) =>
                      setReviewComment(event.target.value)
                    }
                    rows={5}
                    placeholder="Explain the corrections required..."
                    className={textareaClass}
                  />
                </Field>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-sm leading-6 text-emerald-800">
                  You are about to approve this departmental report. It will
                  be marked as approved.
                </p>

                <textarea
                  value={reviewComment}
                  onChange={(event) =>
                    setReviewComment(event.target.value)
                  }
                  rows={3}
                  aria-label="Optional approval comment"
                  placeholder="Optional approval comment..."
                  className={`${textareaClass} mt-3 border-emerald-200 bg-white`}
                />
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <button
                type="button"
                onClick={() => setReviewDialog(null)}
                className="min-h-11 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  if (
                    reviewDialog.action === "request_changes" &&
                    !reviewComment.trim()
                  ) {
                    return;
                  }

                  performAction(
                    reviewDialog.report,
                    reviewDialog.action,
                    reviewComment.trim()
                  );
                }}
                disabled={
                  saving ||
                  (reviewDialog.action === "request_changes" &&
                    !reviewComment.trim())
                }
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition disabled:opacity-50 ${
                  reviewDialog.action === "approve"
                    ? "bg-emerald-700 hover:bg-emerald-800"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {saving && (
                  <RefreshCw size={15} className="animate-spin" />
                )}

                {reviewDialog.action === "approve"
                  ? "Confirm approval"
                  : "Send corrections"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report details */}

      <ReportDetails
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
      />
    </main>
  );
}
