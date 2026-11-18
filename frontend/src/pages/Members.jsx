
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  Phone,
  GraduationCap,
  Building2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import api from "../services/api";

const EMPTY_FORM = {
  full_name: "",
  year_of_study: "",
  phone_number: "",
  departments: [],
};

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function getErrorMessage(error) {
  const data = error?.response?.data;

  if (!data) return "Something went wrong. Please try again.";

  if (typeof data === "string") return data;

  return Object.entries(data)
    .map(([key, value]) => {
      const message = Array.isArray(value) ? value.join(" ") : value;
      return `${key}: ${message}`;
    })
    .join(" ");
}

function normalizeRole(role) {
  return String(role || "").toUpperCase();
}

export default function MembersPage({ user }) {
  const role = normalizeRole(user?.role);
  const canManage = role === "ADMIN" || role === "DEPARTMENT_LEADER";

  const [members, setMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [membersResponse, departmentsResponse] = await Promise.all([
        api.get("/departments/members/"),
        api.get("/departments/"),
      ]);

      setMembers(getItems(membersResponse.data));
      setDepartments(getItems(departmentsResponse.data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return members.filter((member) => {
      const matchesSearch =
        !query ||
        member.full_name?.toLowerCase().includes(query) ||
        member.phone_number?.toLowerCase().includes(query) ||
        member.year_of_study?.toLowerCase().includes(query);

      const matchesDepartment =
        departmentFilter === "all" ||
        member.department_details?.some(
          (department) => String(department.id) === departmentFilter
        );

      return matchesSearch && matchesDepartment;
    });
  }, [members, search, departmentFilter]);

  const openCreateModal = () => {
    setEditingMember(null);
    setSuccess("");
    setError("");

    setForm({
      ...EMPTY_FORM,
      departments: departments.map((department) => department.id),
    });

    setModalOpen(true);
  };

  const openEditModal = (member) => {
    setEditingMember(member);
    setSuccess("");
    setError("");

    setForm({
      full_name: member.full_name || "",
      year_of_study: member.year_of_study || "",
      phone_number: member.phone_number || "",
      departments: (member.department_details || []).map(
        (department) => department.id
      ),
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingMember(null);
    setForm(EMPTY_FORM);
  };

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const toggleDepartment = (departmentId) => {
    setForm((current) => {
      const exists = current.departments.includes(departmentId);

      return {
        ...current,
        departments: exists
          ? current.departments.filter((id) => id !== departmentId)
          : [...current.departments, departmentId],
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    if (!form.full_name.trim()) {
      setError("Please enter the member's full name.");
      setSaving(false);
      return;
    }

    if (!form.year_of_study.trim()) {
      setError("Please enter the year of study.");
      setSaving(false);
      return;
    }

    if (!form.phone_number.trim()) {
      setError("Please enter the phone number.");
      setSaving(false);
      return;
    }

    if (form.departments.length === 0) {
      setError("Please select at least one department.");
      setSaving(false);
      return;
    }

    const payload = {
      full_name: form.full_name.trim(),
      year_of_study: form.year_of_study.trim(),
      phone_number: form.phone_number.trim(),
      departments: form.departments,
    };

    try {
      if (editingMember) {
        await api.patch(
          `/departments/members/${editingMember.id}/`,
          payload
        );
        setSuccess("Member details updated successfully.");
      } else {
        await api.post("/departments/members/", payload);
        setSuccess("Member registered successfully.");
      }

      setModalOpen(false);
      setEditingMember(null);
      setForm(EMPTY_FORM);

      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (member) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${member.full_name}?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await api.delete(`/departments/members/${member.id}/`);
      setSuccess("Member deleted successfully.");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const activeDepartmentCount = departments.length;

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-indigo-600">
            Membership management
          </p>

          <h2 className="text-2xl font-bold text-slate-900">
            {role === "DEPARTMENT_LEADER" ? "My Members" : "Church Members"}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Manage member names, year of study, phone numbers and department
            memberships.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          {canManage && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-800"
            >
              <UserPlus size={17} />
              Register Member
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Registered Members
            </p>
            <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-700">
              <Users size={19} />
            </div>
          </div>
          <h3 className="mt-5 text-3xl font-bold text-slate-900">
            {members.length}
          </h3>
          <p className="mt-2 text-xs text-slate-500">
            Members in your accessible register
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Departments
            </p>
            <div className="rounded-xl bg-violet-50 p-2.5 text-violet-700">
              <Building2 size={19} />
            </div>
          </div>
          <h3 className="mt-5 text-3xl font-bold text-slate-900">
            {activeDepartmentCount}
          </h3>
          <p className="mt-2 text-xs text-slate-500">
            Departments available to your account
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Search Results
            </p>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
              <Search size={19} />
            </div>
          </div>
          <h3 className="mt-5 text-3xl font-bold text-slate-900">
            {filteredMembers.length}
          </h3>
          <p className="mt-2 text-xs text-slate-500">
            Members matching your filters
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 md:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, phone or year of study..."
              className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400"
          >
            <option value="all">All accessible departments</option>
            {departments.map((department) => (
              <option key={department.id} value={String(department.id)}>
                {department.name}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-slate-50">
              <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-4">Member</th>
                <th className="px-5 py-4">Year of Study</th>
                <th className="px-5 py-4">Phone Number</th>
                <th className="px-5 py-4">Departments</th>
                {canManage && <th className="px-5 py-4">Actions</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredMembers.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700">
                        {member.full_name
                          ?.split(" ")
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")
                          .toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold text-slate-800">
                        {member.full_name}
                      </span>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <span className="flex items-center gap-2 text-sm text-slate-600">
                      <GraduationCap size={16} className="text-slate-400" />
                      {member.year_of_study}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <span className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone size={15} className="text-slate-400" />
                      {member.phone_number}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex max-w-xs flex-wrap gap-1.5">
                      {(member.department_details || []).map((department) => (
                        <span
                          key={department.id}
                          className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                        >
                          {department.name}
                        </span>
                      ))}
                    </div>
                  </td>

                  {canManage && (
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(member)}
                          title="Edit member"
                          className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          onClick={() => handleDelete(member)}
                          title="Delete member"
                          className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}

              {!loading && filteredMembers.length === 0 && (
                <tr>
                  <td
                    colSpan={canManage ? 5 : 4}
                    className="px-5 py-16 text-center"
                  >
                    <Users size={32} className="mx-auto text-slate-300" />
                    <p className="mt-3 font-semibold text-slate-700">
                      No members found
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {search
                        ? "Try changing your search or department filter."
                        : "Register your first department member to get started."}
                    </p>
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td
                    colSpan={canManage ? 5 : 4}
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    Loading members...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <div className="my-auto w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingMember ? "Edit Member" : "Register New Member"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Enter the member's basic information.
                </p>
              </div>

              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Full Name
                </label>
                <input
                  required
                  value={form.full_name}
                  onChange={(event) =>
                    updateField("full_name", event.target.value)
                  }
                  placeholder="Enter member's full name"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Year of Study
                </label>
                <input
                  required
                  value={form.year_of_study}
                  onChange={(event) =>
                    updateField("year_of_study", event.target.value)
                  }
                  placeholder="e.g. Year 1, Year 2, Fourth Year"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Phone Number
                </label>
                <input
                  required
                  type="tel"
                  value={form.phone_number}
                  onChange={(event) =>
                    updateField("phone_number", event.target.value)
                  }
                  placeholder="e.g. 0712345678"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Department Membership
                </label>

                <p className="mb-3 text-xs text-slate-500">
                  A member can belong to more than one department.
                </p>

                {departments.length === 0 ? (
                  <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
                    No departments are assigned or available to your account.
                  </p>
                ) : (
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
                    {departments.map((department) => (
                      <label
                        key={department.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={form.departments.includes(department.id)}
                          onChange={() => toggleDepartment(department.id)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-700 focus:ring-indigo-600"
                        />
                        <span className="text-sm font-medium text-slate-700">
                          {department.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || departments.length === 0}
                  className="rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingMember
                      ? "Save Changes"
                      : "Register Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
