
import { useCallback, useEffect, useState } from "react";
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Edit3,
  Trash2,
  UserCheck,
  UserX,
  X,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import api from "../services/api";

const EMPTY_FORM = {
  username: "",
  first_name: "",
  last_name: "",
  email: "",
  phone_number: "",
  role: "DEPARTMENT_LEADER",
  password: "",
  is_active: true,
};

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function displayName(user) {
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
    user.username;
}

function roleLabel(role) {
  const labels = {
    ADMIN: "Administrator",
    SECRETARY: "Secretary",
    DEPARTMENT_LEADER: "Department Leader",
  };

  return labels[role] || role;
}

function StatusBadge({ active, approval }) {
  if (approval === "PENDING") {
    return (
      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
        Pending approval
      </span>
    );
  }

  if (approval === "REJECTED") {
    return (
      <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
        Rejected
      </span>
    );
  }

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/accounts/users/");
      setUsers(getItems(response.data));
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to load user accounts."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openCreateForm = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEditForm = (user) => {
    setEditingUser(user);
    setForm({
      username: user.username || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email || "",
      phone_number: user.phone_number || "",
      role: user.role || "DEPARTMENT_LEADER",
      password: "",
      is_active: Boolean(user.is_active),
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        username: form.username.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone_number: form.phone_number.trim(),
        role: form.role,
        is_active: form.is_active,
      };

      if (!editingUser) {
        if (!form.password) {
          setError("A password is required for a new account.");
          setProcessing(false);
          return;
        }

        payload.password = form.password;
      }

      if (editingUser) {
        await api.patch(
          `/accounts/users/${editingUser.id}/`,
          payload
        );
        setSuccess("User account updated successfully.");
      } else {
        await api.post("/accounts/users/", payload);
        setSuccess("User account created successfully.");
      }

      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      const data = err.response?.data;
      const message =
        data?.detail ||
        Object.entries(data || {})
          .map(([field, messages]) =>
            `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`
          )
          .join(" | ");

      setError(message || "Unable to save the user account.");
    } finally {
      setProcessing(false);
    }
  };

  const toggleStatus = async (user) => {
    const action = user.is_active ? "deactivate" : "activate";

    if (
      !window.confirm(
        `Are you sure you want to ${action} ${displayName(user)}?`
      )
    ) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      await api.post(`/accounts/users/${user.id}/${action}/`);

      setSuccess(
        `${displayName(user)} has been ${action}d successfully.`
      );

      await loadUsers();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          `Unable to ${action} this account.`
      );
    }
  };

  const deleteUser = async (user) => {
    if (
      !window.confirm(
        `Permanently delete ${displayName(user)}? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      await api.delete(`/accounts/users/${user.id}/`);

      setSuccess("User account deleted successfully.");
      await loadUsers();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to delete this account."
      );
    }
  };

  const filteredUsers = users.filter((user) => {
    const term = search.toLowerCase();

    const matchesSearch =
      displayName(user).toLowerCase().includes(term) ||
      (user.username || "").toLowerCase().includes(term) ||
      (user.email || "").toLowerCase().includes(term);

    const matchesRole =
      roleFilter === "ALL" || user.role === roleFilter;

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && user.is_active) ||
      (statusFilter === "INACTIVE" && !user.is_active) ||
      (statusFilter === "PENDING" &&
        user.approval_status === "PENDING");

    return matchesSearch && matchesRole && matchesStatus;
  });

  const activeCount = users.filter((user) => user.is_active).length;
  const pendingCount = users.filter(
    (user) => user.approval_status === "PENDING"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            Administration
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            User Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage accounts, access and system roles.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            onClick={openCreateForm}
            className="flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-800"
          >
            <Plus size={18} />
            Create User
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <Users className="text-indigo-600" size={22} />
          <p className="mt-4 text-sm text-slate-500">Total accounts</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {users.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <UserCheck className="text-emerald-600" size={22} />
          <p className="mt-4 text-sm text-slate-500">Active accounts</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {activeCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <ShieldCheck className="text-amber-600" size={22} />
          <p className="mt-4 text-sm text-slate-500">Pending approvals</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {pendingCount}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, username or email..."
              className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
          >
            <option value="ALL">All roles</option>
            <option value="ADMIN">Administrator</option>
            <option value="SECRETARY">Secretary</option>
            <option value="DEPARTMENT_LEADER">Department Leader</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="PENDING">Pending approval</option>
          </select>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-3 py-4 font-semibold">User</th>
                <th className="px-3 py-4 font-semibold">Contact</th>
                <th className="px-3 py-4 font-semibold">Role</th>
                <th className="px-3 py-4 font-semibold">Status</th>
                <th className="px-3 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-slate-50 hover:bg-slate-50/70"
                >
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 font-bold text-indigo-700">
                        {displayName(user)
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {displayName(user)}
                        </p>
                        <p className="text-xs text-slate-400">
                          @{user.username}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-4">
                    <p className="text-sm text-slate-700">
                      {user.email || "No email"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {user.phone_number || "No phone number"}
                    </p>
                  </td>

                  <td className="px-3 py-4 text-sm text-slate-600">
                    {roleLabel(user.role)}
                  </td>

                  <td className="px-3 py-4">
                    <StatusBadge
                      active={user.is_active}
                      approval={user.approval_status}
                    />
                  </td>

                  <td className="px-3 py-4">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEditForm(user)}
                        title="Edit user"
                        className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        <Edit3 size={17} />
                      </button>

                      <button
                        onClick={() => toggleStatus(user)}
                        title={user.is_active ? "Deactivate" : "Activate"}
                        className="rounded-lg p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
                      >
                        {user.is_active ? (
                          <UserX size={17} />
                        ) : (
                          <UserCheck size={17} />
                        )}
                      </button>

                      <button
                        onClick={() => deleteUser(user)}
                        title="Delete user"
                        className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && filteredUsers.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    className="py-12 text-center text-sm text-slate-400"
                  >
                    No matching user accounts found.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td
                    colSpan="5"
                    className="py-12 text-center text-sm text-slate-400"
                  >
                    Loading user accounts...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Showing {filteredUsers.length} of {users.length} accounts
        </p>
      </section>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingUser ? "Edit User Account" : "Create User Account"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enter the account details below.
                </p>
              </div>

              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  First name
                  <input
                    name="first_name"
                    value={form.first_name}
                    onChange={updateField}
                    required
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-indigo-500"
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Last name
                  <input
                    name="last_name"
                    value={form.last_name}
                    onChange={updateField}
                    required
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-indigo-500"
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Username
                  <input
                    name="username"
                    value={form.username}
                    onChange={updateField}
                    required
                    disabled={Boolean(editingUser)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-indigo-500 disabled:bg-slate-100"
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Email address
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={updateField}
                    required
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-indigo-500"
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  Phone number
                  <input
                    name="phone_number"
                    value={form.phone_number}
                    onChange={updateField}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-indigo-500"
                  />
                </label>

                <label className="text-sm font-medium text-slate-700">
                  System role
                  <select
                    name="role"
                    value={form.role}
                    onChange={updateField}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-indigo-500"
                  >
                    <option value="DEPARTMENT_LEADER">Department Leader</option>
                    <option value="SECRETARY">Secretary</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </label>

                {!editingUser && (
                  <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                    Initial password
                    <input
                      type="password"
                      name="password"
                      value={form.password}
                      onChange={updateField}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-indigo-500"
                    />
                  </label>
                )}
              </div>

              <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={updateField}
                  className="h-4 w-4 accent-indigo-700"
                />
                Account is active
              </label>

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={processing}
                  className="flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
                >
                  {processing && (
                    <RefreshCw size={16} className="animate-spin" />
                  )}
                  {editingUser ? "Save Changes" : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
