
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  X,
  CheckCircle2,
  XCircle,
  RefreshCw,
  UserRound,
  AlertCircle,
  Power,
} from "lucide-react";
import api from "../services/api";

const emptyForm = {
  name: "",
  code: "",
  description: "",
  leader: "",
  is_active: true,
};

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function getErrorMessage(error) {
  const data = error.response?.data;

  if (!data) return "Something went wrong. Please try again.";

  if (typeof data === "string") return data;

  return Object.entries(data)
    .map(([key, value]) => {
      const message = Array.isArray(value) ? value.join(" ") : value;
      return `${key}: ${message}`;
    })
    .join(" ");
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Departments({ user }) {
  const isAdmin = user?.is_superuser || user?.role === "ADMIN";
  const isSecretary = user?.role === "SECRETARY";

  const [departments, setDepartments] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/departments/");
      setDepartments(getItems(response.data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLeaders = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const response = await api.get("/accounts/users/");
      const users = getItems(response.data);

      setLeaders(
        users.filter(
          (account) => account.role === "DEPARTMENT_LEADER"
        )
      );
    } catch (err) {
      setError(
        "Departments loaded, but department leaders could not be loaded. " +
          getErrorMessage(err)
      );
    }
  }, [isAdmin]);

  useEffect(() => {
    loadDepartments();
    loadLeaders();
  }, [loadDepartments, loadLeaders]);

  const filteredDepartments = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return departments;

    return departments.filter((department) =>
      [
        department.name,
        department.code,
        department.description,
        department.leader_name,
        department.leader_username,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [departments, search]);

  const activeCount = departments.filter(
    (department) => department.is_active
  ).length;

  const assignedCount = departments.filter(
    (department) => department.leader
  ).length;

  const openCreateForm = () => {
    setEditingDepartment(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEditForm = (department) => {
    setEditingDepartment(department);
    setForm({
      name: department.name || "",
      code: department.code || "",
      description: department.description || "",
      leader: department.leader ? String(department.leader) : "",
      is_active: department.is_active,
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingDepartment(null);
    setForm(emptyForm);
  };

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description.trim(),
      leader: form.leader ? Number(form.leader) : null,
      is_active: form.is_active,
    };

    try {
      if (editingDepartment) {
        await api.patch(
          `/departments/${editingDepartment.id}/`,
          payload
        );
        setSuccess("Department updated successfully.");
      } else {
        await api.post("/departments/", payload);
        setSuccess("Department created successfully.");
      }

      setShowForm(false);
      setEditingDepartment(null);
      setForm(emptyForm);
      await loadDepartments();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (department) => {
    const action = department.is_active ? "deactivate" : "activate";

    if (!window.confirm(`Are you sure you want to ${action} ${department.name}?`)) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await api.patch(`/departments/${department.id}/`, {
        is_active: !department.is_active,
      });

      setSuccess(`${department.name} ${action}d successfully.`);
      await loadDepartments();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDelete = async (department) => {
    const confirmed = window.confirm(
      `Permanently delete "${department.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await api.delete(`/departments/${department.id}/`);
      setSuccess("Department deleted successfully.");
      await loadDepartments();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Organization management
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Departments
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage departments and their assigned leadership.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadDepartments}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          {isAdmin && (
            <button
              onClick={openCreateForm}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <Plus size={17} />
              Add Department
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={18} />
          <span>{success}</span>
          <button
            onClick={() => setSuccess("")}
            className="ml-auto text-emerald-600 hover:text-emerald-800"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total departments"
          value={departments.length}
          icon={<Building2 size={21} />}
          color="indigo"
        />
        <StatCard
          label="Active departments"
          value={activeCount}
          icon={<CheckCircle2 size={21} />}
          color="emerald"
        />
        <StatCard
          label="Assigned leaders"
          value={assignedCount}
          icon={<Users size={21} />}
          color="amber"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              Department directory
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {filteredDepartments.length} department
              {filteredDepartments.length === 1 ? "" : "s"} displayed
            </p>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search departments..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-slate-500">
            <RefreshCw size={18} className="animate-spin" />
            Loading departments...
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
            <div className="rounded-2xl bg-slate-100 p-4 text-slate-400">
              <Building2 size={28} />
            </div>
            <h3 className="mt-4 font-semibold text-slate-800">
              No departments found
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {search
                ? "Try a different search term."
                : "Departments will appear here once they are created."}
            </p>
            {isAdmin && !search && (
              <button
                onClick={openCreateForm}
                className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Create your first department
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Department</th>
                  <th className="px-5 py-3 font-semibold">Leader</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Created</th>
                  {isAdmin && (
                    <th className="px-5 py-3 text-right font-semibold">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredDepartments.map((department) => (
                  <tr
                    key={department.id}
                    className="transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                          <Building2 size={19} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {department.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Code: {department.code}
                          </p>
                          {department.description && (
                            <p className="mt-1 max-w-xs truncate text-xs text-slate-400">
                              {department.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {department.leader_name ? (
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                            <UserRound size={15} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              {department.leader_name}
                            </p>
                            <p className="text-xs text-slate-400">
                              @{department.leader_username}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">
                          No leader assigned
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      {department.is_active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          Inactive
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-500">
                      {formatDate(department.created_at)}
                    </td>

                    {isAdmin && (
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEditForm(department)}
                            title="Edit department"
                            className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(department)}
                            title={
                              department.is_active
                                ? "Deactivate department"
                                : "Activate department"
                            }
                            className="rounded-lg p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-600"
                          >
                            <Power size={16} />
                          </button>

                          <button
                            onClick={() => handleDelete(department)}
                            title="Delete department"
                            className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isAdmin && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
          {isSecretary
            ? "You have read-only access to all departments."
            : "You can view the department assigned to your account. Contact an administrator if your department assignment needs to change."}
        </div>
      )}

      {showForm && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <div className="my-8 w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingDepartment ? "Edit department" : "Create department"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Configure department details and leadership.
                </p>
              </div>

              <button
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Department name *
                </label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  required
                  maxLength={150}
                  placeholder="e.g. Worship Department"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Department code *
                </label>
                <input
                  name="code"
                  value={form.code}
                  onChange={handleFormChange}
                  required
                  maxLength={30}
                  placeholder="e.g. WOR"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm uppercase outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  rows={3}
                  placeholder="Briefly describe the department..."
                  className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Assign department leader
                </label>
                <select
                  name="leader"
                  value={form.leader}
                  onChange={handleFormChange}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">No leader assigned</option>
                  {leaders.map((leader) => (
                    <option key={leader.id} value={leader.id}>
                      {leader.first_name || leader.last_name
                        ? `${leader.first_name || ""} ${leader.last_name || ""}`.trim()
                        : leader.username}{" "}
                      (@{leader.username})
                    </option>
                  ))}
                </select>

                {leaders.length === 0 && (
                  <p className="mt-1.5 text-xs text-amber-600">
                    No department leader accounts were found. Create a
                    Department Leader account under User Management first.
                  </p>
                )}
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={handleFormChange}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-800">
                    Active department
                  </span>
                  <span className="block text-xs text-slate-500">
                    Allow this department to operate in the system.
                  </span>
                </span>
              </label>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && <RefreshCw size={16} className="animate-spin" />}
                  {saving
                    ? "Saving..."
                    : editingDepartment
                      ? "Save changes"
                      : "Create department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`rounded-xl p-2.5 ${colors[color]}`}>{icon}</div>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}
