
import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  CalendarDays,
  MapPin,
  Users,
  Paperclip,
  X,
  Loader2,
  Activity as ActivityIcon,
  Upload,
  RefreshCw,
} from "lucide-react";
import api from "../services/api";

const ACTIVITY_TYPES = [
  ["WORSHIP", "Worship"],
  ["EVANGELISM", "Evangelism"],
  ["OUTREACH", "Outreach"],
  ["FELLOWSHIP", "Fellowship"],
  ["SERVICE", "Service"],
  ["MEETING", "Meeting"],
  ["TRAINING", "Training"],
  ["OTHER", "Other"],
];

const emptyForm = {
  title: "",
  activity_type: "WORSHIP",
  activity_date: new Date().toISOString().slice(0, 10),
  location: "",
  description: "",
  attendance_count: "",
  outcomes: "",
  challenges: "",
  includes_financial_information: false,
  expenditure_amount: "",
  financial_notes: "",
};

function getItems(data) {
  if (Array.isArray(data)) return data;
  return data?.results || [];
}

export default function Activities({ user }) {
  const [activities, setActivities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const isAdmin = user?.role === "ADMIN" || user?.is_superuser;

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const requests = [api.get("/reports/activities/")];

      if (isAdmin) {
        requests.push(api.get("/departments/"));
      }

      const responses = await Promise.all(requests);

      setActivities(getItems(responses[0].data));

      if (isAdmin) {
        const activeDepartments = getItems(responses[1].data).filter(
          (department) => department.is_active
        );
        setDepartments(activeDepartments);
      }
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load activities. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        ...form,
        attendance_count: Number(form.attendance_count || 0),
        expenditure_amount: form.includes_financial_information
          ? Number(form.expenditure_amount || 0)
          : 0,
      };

      if (isAdmin) {
        if (!selectedDepartment) {
          setError("Please select a department.");
          setSaving(false);
          return;
        }

        payload.department = selectedDepartment;
      }

      const response = await api.post("/reports/activities/", payload);
      const activity = response.data;

      for (const file of selectedFiles) {
        const uploadData = new FormData();
        uploadData.append("activity", activity.id);
        uploadData.append("file", file);

        await api.post("/reports/attachments/", uploadData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      setSuccess("Activity recorded successfully.");
      setForm(emptyForm);
      setSelectedFiles([]);
      setSelectedDepartment("");
      setShowForm(false);

      await loadData();
    } catch (err) {
      const data = err.response?.data;
      const message =
        typeof data === "string"
          ? data
          : data?.detail ||
            Object.entries(data || {})
              .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
              .join(" | ") ||
            "Unable to save activity. Check your information and try again.";

      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const filteredActivities = activities.filter((activity) => {
    const searchText = [
      activity.title,
      activity.activity_type,
      activity.department_name,
      activity.location,
      activity.description,
    ]
      .join(" ")
      .toLowerCase();

    return searchText.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-slate-500">
            Moi University Main Altar
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Activities
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Record activities as they happen and keep your department's history.
          </p>
        </div>

        <button
          onClick={() => {
            setError("");
            setSuccess("");
            setShowForm(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800"
        >
          <Plus size={18} />
          Record Activity
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search activities..."
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={loadData}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-12">
          <Loader2 className="animate-spin text-blue-700" />
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <ActivityIcon className="mx-auto text-slate-400" size={36} />
          <h3 className="mt-4 font-semibold text-slate-800">
            No activities found
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Record your first activity or change your search.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredActivities.map((activity) => (
            <article
              key={activity.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {activity.activity_type?.replaceAll("_", " ")}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">
                    {activity.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {activity.department_name || "Department"}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                  Recorded
                </span>
              </div>

              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                {activity.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} />
                  {activity.activity_date}
                </span>

                {activity.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={14} />
                    {activity.location}
                  </span>
                )}

                <span className="inline-flex items-center gap-1.5">
                  <Users size={14} />
                  {activity.attendance_count || 0} attendees
                </span>

                {activity.attachments?.length > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Paperclip size={14} />
                    {activity.attachments.length} attachments
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4">
          <div className="my-6 w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Record New Activity
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Complete the activity details below.
                </p>
              </div>

              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-5 p-5">
              {isAdmin && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Department *
                  </label>
                  {/* <select
                    value={selectedDepartment}
                    onChange={(event) => setSelectedDepartment(event.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">Select department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select> */}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Activity title *
                  </label>
                  <input
                    name="title"
                    value={form.title}
                    onChange={updateField}
                    required
                    maxLength={200}
                    placeholder="e.g. Sunday Worship Service"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Activity type *
                  </label>
                  <select
                    name="activity_type"
                    value={form.activity_type}
                    onChange={updateField}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  >
                    {ACTIVITY_TYPES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Activity date *
                  </label>
                  <input
                    type="date"
                    name="activity_date"
                    value={form.activity_date}
                    onChange={updateField}
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Location
                  </label>
                  <input
                    name="location"
                    value={form.location}
                    onChange={updateField}
                    placeholder="Activity venue"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Attendance count
                  </label>
                  <input
                    type="number"
                    min="0"
                    name="attendance_count"
                    value={form.attendance_count}
                    onChange={updateField}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Activity description *
                  </label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={updateField}
                    required
                    rows={4}
                    placeholder="Describe what happened during the activity..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Outcomes and achievements
                  </label>
                  <textarea
                    name="outcomes"
                    value={form.outcomes}
                    onChange={updateField}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Challenges encountered
                  </label>
                  <textarea
                    name="challenges"
                    value={form.challenges}
                    onChange={updateField}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <label className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    name="includes_financial_information"
                    checked={form.includes_financial_information}
                    onChange={updateField}
                    className="h-4 w-4"
                  />
                  Include financial information
                </label>

                {form.includes_financial_information && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Expenditure amount (KES)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        name="expenditure_amount"
                        value={form.expenditure_amount}
                        onChange={updateField}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Financial notes
                      </label>
                      <textarea
                        name="financial_notes"
                        value={form.financial_notes}
                        onChange={updateField}
                        rows={2}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Photos and documents
                </label>
                <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-blue-500">
                  <Upload className="text-slate-400" size={25} />
                  <span className="mt-2 text-sm font-medium text-slate-700">
                    Choose files to upload
                  </span>
                  <span className="mt-1 text-xs text-slate-500">
                    JPG, PNG, WEBP, PDF or DOCX · Maximum 10 MB each
                  </span>
                  <input
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.webp,.pdf,.docx"
                    className="hidden"
                    onChange={(event) =>
                      setSelectedFiles(Array.from(event.target.files || []))
                    }
                  />
                </label>

                {selectedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"
                      >
                        <span className="truncate text-slate-700">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedFiles((files) =>
                              files.filter((_, i) => i !== index)
                            )
                          }
                          className="ml-3 text-red-600"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {saving ? "Saving activity..." : "Save Activity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
