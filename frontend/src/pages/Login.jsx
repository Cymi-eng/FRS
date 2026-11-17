
import { useState } from "react";
import { Church, LockKeyhole, User, Eye, EyeOff, ArrowRight } from "lucide-react";
import api from "../services/api";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login/", {
        username,
        password,
      });

      localStorage.setItem("access_token", response.data.access);
      localStorage.setItem("refresh_token", response.data.refresh);

      const profileResponse = await api.get("/accounts/me/");

      onLogin(profileResponse.data);
    } catch (err) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");

      const data = err.response?.data;

      setError(
        data?.detail ||
        data?.non_field_errors?.[0] ||
        "Login failed. Check your username and password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-700 text-white shadow-lg">
            <Church size={32} />
          </div>

          <h1 className="mt-5 text-2xl font-bold text-slate-900">
            Moi University Main Altar
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Departmental Reporting System
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          <h2 className="text-xl font-bold text-slate-900">
            Welcome back
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Sign in to access your workspace.
          </p>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Username
              </label>

              <div className="flex items-center rounded-xl border border-slate-200 px-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
                <User size={18} className="text-slate-400" />

                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  required
                  className="w-full border-0 bg-transparent px-3 py-3 text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Password
              </label>

              <div className="flex items-center rounded-xl border border-slate-200 px-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
                <LockKeyhole size={18} className="text-slate-400" />

                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="w-full border-0 bg-transparent px-3 py-3 text-sm outline-none"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <p className="mt-7 text-center text-xs leading-5 text-slate-400">
            Access is provided by your system administrator.
            <br />
            Account registration is not available here.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          © 2026 Moi University Main Altar
        </p>
      </div>
    </div>
  );
}
