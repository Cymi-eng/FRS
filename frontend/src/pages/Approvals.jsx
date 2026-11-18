import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  Mail,
  Phone,
  User,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import api from "../services/api";

export default function Approvals() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPendingUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/accounts/users/pending-approvals/"
      );

      const data = response.data;
      setUsers(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Failed to load pending account approvals."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingUsers();
  }, [loadPendingUsers]);

  const handleApproval = async (userId, action) => {
    const isApproving = action === "approve";

    if (
      !isApproving &&
      !window.confirm(
        "Are you sure you want to reject this registration?"
      )
    ) {
      return;
    }

    try {
      setProcessing(userId);
      setError("");
      setSuccess("");

      await api.post(`/accounts/users/${userId}/${action}/`);

      setSuccess(
        isApproving
          ? "Department leader approved successfully."
          : "Registration rejected successfully."
      );

      await loadPendingUsers();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          `Failed to ${action} this account.`
      );
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Account Approvals
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and approve department leader registrations.
          </p>
        </div>

        <button
          onClick={loadPendingUsers}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-50 p-3">
            <Clock className="text-amber-600" size={22} />
          </div>

          <div>
            <p className="text-sm text-gray-500">
              Pending registrations
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {users.length}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <RefreshCw
            className="mx-auto animate-spin text-gray-400"
            size={28}
          />
          <p className="mt-3 text-sm text-gray-500">
            Loading registrations...
          </p>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <ShieldCheck
            className="mx-auto text-green-500"
            size={42}
          />
          <h3 className="mt-4 font-semibold text-gray-900">
            All caught up
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            There are no pending department leader registrations.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-blue-50 p-3">
                      <User className="text-blue-600" size={22} />
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {`${user.first_name || ""} ${
                          user.last_name || ""
                        }`.trim() || user.username}
                      </h3>
                      <p className="text-sm text-gray-500">
                        @{user.username}
                      </p>
                    </div>

                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      Pending
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 text-sm text-gray-600 sm:flex-row sm:gap-5">
                    {user.email && (
                      <span className="flex items-center gap-2">
                        <Mail size={15} />
                        {user.email}
                      </span>
                    )}

                    {user.phone_number && (
                      <span className="flex items-center gap-2">
                        <Phone size={15} />
                        {user.phone_number}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-400">
                    Requested role: Department Leader
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      handleApproval(user.id, "reject")
                    }
                    disabled={processing === user.id}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 sm:flex-none"
                  >
                    <XCircle size={17} />
                    Reject
                  </button>

                  <button
                    onClick={() =>
                      handleApproval(user.id, "approve")
                    }
                    disabled={processing === user.id}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 sm:flex-none"
                  >
                    {processing === user.id ? (
                      <RefreshCw
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      <CheckCircle2 size={17} />
                    )}
                    Approve
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}