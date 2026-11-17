
import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Plus,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Eye,
  X,
  CalendarDays,
} from "lucide-react";
import api from "../services/api";

const emptyForm = {
  period_type: "WEEKLY",
  selected_date: new Date().toISOString().slice(0, 10),
  title: "",
  executive_summary: "",
  achievements: "",
  challenges: "",
  recommendations: "",
  plans_for_next_period: "",
  includes_financial_report: false,
  financial_summary: "",
  total_expenditure: "",
};

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function getErrorMessage(error) {
  const data = error.response?.data;

  if (!data) return error.message || "Something went wrong.";

  if (typeof data === "string") return data;
  if (data.detail) return data.detail;

  return Object.entries(data)
    .map(([key, value]) => {
      const message = Array.isArray(value)
        ? value.join(", ")
        : typeof value === "string"
          ? value
          : JSON.stringify(value);

      return `${key}: ${message}`;
    })
    .join(" | ");
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function getPeriodDates(type, selectedDate) {
  const date = new Date(`${selectedDate}T00:00:00`);

  if (type === "WEEKLY") {
    const day = date.getDay();
    const difference = day === 0 ? -6 : 1 - day;

    const monday = new Date(date);
    monday.setDate(date.getDate() + difference);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      start_date: monday.toISOString().slice(0, 10),
      end_date: sunday.toISOString().slice(0, 10),
    };
  }

  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return {
    start_date: first.toISOString().slice(0, 10),
    end_date: last.toISOString().slice(0, 10),
  };
}

function StatusBadge({ status }) {
  const styles = {
    DRAFT: "bg-slate-100 text-slate-700",
    SUBMITTED: "bg-violet-50 text-violet-700",
    UNDER_REVIEW: "bg-blue-50 text-blue-700",
    CHANGES_REQUESTED: "bg-amber-50 text-amber-700",
    APPROVED: "bg-emerald-50 text-emerald-700",
  };

  const labels = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    UNDER_REVIEW: "Under Review",
    CHANGES_REQUESTED: "Changes Requested",
    APPROVED: "Approved",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] || "bg-slate-100 text-slate-600"
      }`}
    >
      {labels[status] || status || "Unknown"}
    </span>
  );
}

function Field({ label, children, required = false }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function ReportDetails({ report, onClose }) {
  if (!report) return null;

  const sections = [
    ["Executive Summary", report.executive_summary],
    ["Achievements", report.achievements],
    ["Challenges", report.challenges],
    ["Recommendations", report.recommendations],
    ["Plans for Next Period", report.plans_for_next_period],
    ["Financial Summary", report.financial_summary],
    ["Secretary's Review Comment", report.review_comment],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white p-5">
          <div>
            <h3 className="font-bold text-slate-900">
              Report Details
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {report.department_name || "Department"} · {report.period_type}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <h4 className="text-lg font-bold text-slate-900">
              {report.title}
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              {formatDate(report.start_date)} – {formatDate(report.end_date)}
            </p>
            <div className="mt-3">
              <StatusBadge status={report.status} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Activities included</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {report.activities?.length ?? 0}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Total expenditure</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {report.total_expenditure ?? "—"}
              </p>
            </div>
          </div>

          {sections.map(([heading, content]) =>
            content ? (
              <section key={heading}>
                <h5 className="mb-2 text-sm font-bold text-slate-800">
                  {heading}
                </h5>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {content}
                </p>
              </section>
            ) : null
          )}

          {report.activities?.length > 0 && (
            <section>
              <h5 className="mb-2 text-sm font-bold text-slate-800">
                Included Activities
              </h5>

              <div className="space-y-2">
                {report.activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <p className="text-sm font-semibold text-slate-800">
                      {activity.title || `Activity #${activity.id}`}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {activity.activity_type} ·{" "}
                      {formatDate(activity.activity_date)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Reports({ user }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const isLeader = user?.role === "DEPARTMENT_LEADER";
  const isSecretary = user?.role === "SECRETARY";

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/reports/submissions/");
      setReports(getItems(response.data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const createReport = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const dates = getPeriodDates(
      form.period_type,
      form.selected_date
    );

    const payload = {
      period_type: form.period_type,
      ...dates,
      title:
        form.title.trim() ||
        `${form.period_type === "WEEKLY" ? "Weekly" : "Monthly"} Department Report`,
      executive_summary: form.executive_summary,
      achievements: form.achievements,
      challenges: form.challenges,
      recommendations: form.recommendations,
      plans_for_next_period: form.plans_for_next_period,
      includes_financial_report: form.includes_financial_report,
      financial_summary: form.includes_financial_report
        ? form.financial_summary
        : "",
      total_expenditure: form.includes_financial_report
        ? form.total_expenditure || "0"
        : "0",
    };

    try {
      // The backend automatically groups activities within these dates
      // when activity_ids is omitted.
      await api.post("/reports/submissions/", payload);

      setSuccess(
        "Report draft created successfully. Review it below and submit it when ready."
      );

      setForm(emptyForm);
      setShowForm(false);
      await loadReports();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const performAction = async (report, action) => {
    setSaving(true);
    setError("");
    setSuccess("");

    let payload = {};

    if (action === "request_changes") {
      const comment = window.prompt(
        "Enter the corrections required from the department:"
      );

      if (!comment || !comment.trim()) {
        setSaving(false);
        return;
      }

      payload = { review_comment: comment.trim() };
    }

    try {
      await api.post(
        `/reports/submissions/${report.id}/${action}/`,
        payload
      );

      const messages = {
        submit: "Report submitted successfully.",
        start_review: "Report moved into review.",
        approve: "Report approved successfully.",
        request_changes: "Corrections requested successfully.",
      };

      setSuccess(messages[action] || "Action completed.");
      await loadReports();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const statusCounts = {
    total: reports.length,
    pending: reports.filter((report) =>
      ["SUBMITTED", "UNDER_REVIEW"].includes(report.status)
    ).length,
    approved: reports.filter(
      (report) => report.status === "APPROVED"
    ).length,
    corrections: reports.filter(
      (report) => report.status === "CHANGES_REQUESTED"
    ).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Reports Management
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Create, submit, review and track departmental reports.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadReports}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          {isLeader && (
            <button
              onClick={() => {
                setShowForm((value) => !value);
                setError("");
                setSuccess("");
              }}
              className="flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-800"
            >
              <Plus size={18} />
              Create Report
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total Reports</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {statusCounts.total}
          </p>
          <FileText className="mt-3 text-indigo-600" size={20} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Awaiting Review</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {statusCounts.pending}
          </p>
          <Clock3 className="mt-3 text-blue-600" size={20} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Approved</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {statusCounts.approved}
          </p>
          <CheckCircle2 className="mt-3 text-emerald-600" size={20} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Corrections Requested</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {statusCounts.corrections}
          </p>
          <AlertCircle className="mt-3 text-amber-600" size={20} />
        </div>
      </div>

      {showForm && isLeader && (
        <form
          onSubmit={createReport}
          className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Create Department Report
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Activities recorded within the selected period will be grouped into this report.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <X size={19} />
            </button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Reporting Period" required>
              <select
                name="period_type"
                value={form.period_type}
                onChange={updateField}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500"
              >
                <option value="WEEKLY">Weekly Report</option>
                <option value="MONTHLY">Monthly Report</option>
              </select>
            </Field>

            <Field
              label={
                form.period_type === "WEEKLY"
                  ? "Choose a date in the reporting week"
                  : "Choose a date in the reporting month"
              }
              required
            >
              <input
                type="date"
                name="selected_date"
                value={form.selected_date}
                onChange={updateField}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500"
              />
            </Field>

            <div className="sm:col-span-2 rounded-xl bg-indigo-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-800">
                <CalendarDays size={17} />
                Reporting dates
              </div>

              <p className="mt-2 text-sm text-indigo-700">
                {formatDate(
                  getPeriodDates(
                    form.period_type,
                    form.selected_date
                  ).start_date
                )}
                {" – "}
                {formatDate(
                  getPeriodDates(
                    form.period_type,
                    form.selected_date
                  ).end_date
                )}
              </p>
            </div>

            <div className="sm:col-span-2">
              <Field label="Report Title">
                <input
                  name="title"
                  value={form.title}
                  onChange={updateField}
                  placeholder="e.g. Weekly Evangelism Department Report"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Executive Summary" required>
                <textarea
                  name="executive_summary"
                  value={form.executive_summary}
                  onChange={updateField}
                  required
                  rows={4}
                  placeholder="Give a brief overview of the department's activities during this period..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                />
              </Field>
            </div>

            <Field label="Key Achievements">
              <textarea
                name="achievements"
                value={form.achievements}
                onChange={updateField}
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
              />
            </Field>

            <Field label="Challenges">
              <textarea
                name="challenges"
                value={form.challenges}
                onChange={updateField}
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
              />
            </Field>

            <Field label="Recommendations">
              <textarea
                name="recommendations"
                value={form.recommendations}
                onChange={updateField}
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
              />
            </Field>

            <Field label="Plans for Next Period">
              <textarea
                name="plans_for_next_period"
                value={form.plans_for_next_period}
                onChange={updateField}
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
              />
            </Field>

            <div className="sm:col-span-2 rounded-xl border border-slate-200 p-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="includes_financial_report"
                  checked={form.includes_financial_report}
                  onChange={updateField}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                <span className="text-sm font-semibold text-slate-800">
                  Include financial information
                </span>
              </label>

              {form.includes_financial_report && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Total Expenditure">
                    <input
                      type="number"
                      name="total_expenditure"
                      min="0"
                      step="0.01"
                      value={form.total_expenditure}
                      onChange={updateField}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                    />
                  </Field>

                  <Field label="Financial Summary">
                    <textarea
                      name="financial_summary"
                      value={form.financial_summary}
                      onChange={updateField}
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw size={17} className="animate-spin" />
              ) : (
                <Plus size={17} />
              )}
              Save Report Draft
            </button>
          </div>
        </form>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h3 className="font-bold text-slate-900">
            Departmental Reports
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            View reports and manage the reporting workflow.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
            <RefreshCw size={17} className="animate-spin" />
            Loading reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center">
            <FileText
              size={35}
              className="mx-auto text-slate-300"
            />
            <p className="mt-3 font-semibold text-slate-700">
              No reports found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Reports will appear here once created.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-slate-50">
                <tr className="text-xs text-slate-500">
                  <th className="px-5 py-4 font-semibold">Report</th>
                  <th className="px-5 py-4 font-semibold">Department</th>
                  <th className="px-5 py-4 font-semibold">Period</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">Actions</th>
                </tr>
              </thead>

              <tbody>
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    className="border-t border-slate-100"
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-slate-800">
                        {report.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Created by {report.created_by_name || "—"}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {report.department_name || "—"}
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-slate-700">
                        {report.period_type}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(report.start_date)} –{" "}
                        {formatDate(report.end_date)}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={report.status} />
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setSelectedReport(report)}
                          title="View report"
                          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                        >
                          <Eye size={16} />
                        </button>

                        {isLeader &&
                          ["DRAFT", "CHANGES_REQUESTED"].includes(
                            report.status
                          ) && (
                            <button
                              onClick={() =>
                                performAction(report, "submit")
                              }
                              disabled={saving}
                              className="flex items-center gap-1 rounded-lg bg-indigo-700 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
                            >
                              <Send size={14} />
                              Submit
                            </button>
                          )}

                        {isSecretary &&
                          report.status === "SUBMITTED" && (
                            <button
                              onClick={() =>
                                performAction(report, "start_review")
                              }
                              disabled={saving}
                              className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                            >
                              Start Review
                            </button>
                          )}

                        {isSecretary &&
                          report.status === "UNDER_REVIEW" && (
                            <>
                              <button
                                onClick={() =>
                                  performAction(report, "request_changes")
                                }
                                disabled={saving}
                                className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-50"
                              >
                                Request Changes
                              </button>

                              <button
                                onClick={() =>
                                  performAction(report, "approve")
                                }
                                disabled={saving}
                                className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                              >
                                Approve
                              </button>
                            </>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ReportDetails
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
      />
    </div>
  );
}
