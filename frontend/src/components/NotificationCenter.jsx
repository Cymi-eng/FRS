
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Clock3,
  FileCheck2,
  FileText,
  MessageSquare,
  RefreshCw,
  Trash2,
  X,
  AlertCircle,
  Inbox,
} from "lucide-react";
import api from "../services/api";

const NOTIFICATION_ICONS = {
  REPORT_SUBMITTED: FileText,
  REPORT_APPROVED: FileCheck2,
  CHANGES_REQUESTED: MessageSquare,
  REPORT_RESUBMITTED: RefreshCw,
  GENERAL: Bell,
};

function formatNotificationDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getNotificationItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.notifications)) return data.notifications;
  return [];
}

function NotificationIcon({ type }) {
  const Icon = NOTIFICATION_ICONS[type] || Bell;

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
      <Icon size={19} />
    </div>
  );
}

function NotificationItem({
  notification,
  onRead,
  onDelete,
  compact = false,
}) {
  return (
    <div
      className={`group flex gap-3 ${
        compact ? "p-3" : "p-4 sm:p-5"
      } ${
        notification.is_read ? "bg-white" : "bg-blue-50/60"
      }`}
    >
      <NotificationIcon type={notification.notification_type} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold text-slate-900">
              {notification.title}
            </p>

            <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-slate-600">
              {notification.message}
            </p>
          </div>

          {!notification.is_read && (
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" />
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock3 size={13} />
            {formatNotificationDate(notification.created_at)}
          </span>

          <div className="flex items-center gap-1">
            {!notification.is_read && (
              <button
                type="button"
                onClick={() => onRead(notification.id)}
                title="Mark as read"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-blue-700"
              >
                <Check size={16} />
              </button>
            )}

            <button
              type="button"
              onClick={() => onDelete(notification.id)}
              title="Delete notification"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationBell({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const [listResponse, countResponse] = await Promise.all([
        api.get("/notifications/"),
        api.get("/notifications/unread-count/"),
      ]);

      setNotifications(getNotificationItems(listResponse.data));
      setUnreadCount(Number(countResponse.data?.unread_count || 0));
    } catch (error) {
      console.error("Unable to load notifications:", error);
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    const interval = window.setInterval(loadNotifications, 30000);

    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  const recentNotifications = notifications.slice(0, 6);

  const markRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/mark-read/`);

      setNotifications((current) =>
        current.map((item) =>
          item.id === id ? { ...item, is_read: true } : item
        )
      );

      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (error) {
      console.error("Unable to mark notification as read:", error);
    }
  };

  const markAllRead = async () => {
    if (!unreadCount) return;

    setLoading(true);

    try {
      await api.post("/notifications/mark-all-read/");

      setNotifications((current) =>
        current.map((item) => ({ ...item, is_read: true }))
      );

      setUnreadCount(0);
    } catch (error) {
      console.error("Unable to mark all notifications as read:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}/delete/`);

      const deleted = notifications.find((item) => item.id === id);

      setNotifications((current) =>
        current.filter((item) => item.id !== id)
      );

      if (deleted && !deleted.is_read) {
        setUnreadCount((count) => Math.max(0, count - 1));
      }
    } catch (error) {
      console.error("Unable to delete notification:", error);
    }
  };

  const openHistory = () => {
    setOpen(false);
    onNavigate?.("Notifications");
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Open notifications"
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
      >
        <Bell size={19} />

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />

          <div className="absolute right-0 z-50 mt-3 w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Notifications
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {unreadCount} unread notifications
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={17} />
              </button>
            </div>

            {recentNotifications.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Inbox className="mx-auto text-slate-300" size={30} />
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  You're all caught up
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  New notifications will appear here.
                </p>
              </div>
            ) : (
              <div className="max-h-[390px] divide-y divide-slate-100 overflow-y-auto">
                {recentNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    compact
                    onRead={markRead}
                    onDelete={deleteNotification}
                  />
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-3">
              <button
                type="button"
                onClick={markAllRead}
                disabled={!unreadCount || loading}
                className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CheckCheck size={15} />
                Mark all read
              </button>

              <button
                type="button"
                onClick={openHistory}
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
              >
                View all
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/notifications/");
      setNotifications(getNotificationItems(response.data));
    } catch (err) {
      console.error("Unable to load notifications:", err);
      setError(
        err.response?.data?.detail ||
          "We couldn't load your notifications. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((item) => !item.is_read);
    }

    if (filter === "read") {
      return notifications.filter((item) => item.is_read);
    }

    return notifications;
  }, [notifications, filter]);

  const markRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/mark-read/`);

      setNotifications((current) =>
        current.map((item) =>
          item.id === id ? { ...item, is_read: true } : item
        )
      );
    } catch (err) {
      console.error("Unable to mark notification as read:", err);
      setError("Unable to update this notification.");
    }
  };

  const markAllRead = async () => {
    if (!unreadCount) return;

    try {
      await api.post("/notifications/mark-all-read/");

      setNotifications((current) =>
        current.map((item) => ({ ...item, is_read: true }))
      );
    } catch (err) {
      console.error("Unable to mark all notifications as read:", err);
      setError("Unable to mark all notifications as read.");
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}/delete/`);

      setNotifications((current) =>
        current.filter((item) => item.id !== id)
      );
    } catch (err) {
      console.error("Unable to delete notification:", err);
      setError("Unable to delete this notification.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
            Your updates
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Notifications
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Stay updated on reports, reviews and department activity.
          </p>
        </div>

        <button
          type="button"
          onClick={loadNotifications}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {notifications.length}
          </p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-blue-700">Unread</p>
          <p className="mt-2 text-2xl font-bold text-blue-800">
            {unreadCount}
          </p>
        </div>

        <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-1">
          <p className="text-xs font-medium text-slate-500">Read</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {notifications.length - unreadCount}
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="flex flex-wrap gap-2">
          {[
            ["all", "All"],
            ["unread", "Unread"],
            ["read", "Read"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                filter === value
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={markAllRead}
          disabled={!unreadCount}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CheckCheck size={16} />
          Mark all as read
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
            <RefreshCw size={18} className="animate-spin" />
            Loading notifications...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Inbox className="mx-auto text-slate-300" size={38} />
            <h3 className="mt-4 text-base font-bold text-slate-800">
              No notifications found
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {filter === "unread"
                ? "You have no unread notifications."
                : filter === "read"
                  ? "You have no read notifications yet."
                  : "Notifications will appear here when there are updates."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={markRead}
                onDelete={deleteNotification}
              />
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-slate-400">
        Notifications are private to your account.
      </p>
    </div>
  );
}
