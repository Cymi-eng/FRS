
import { useState } from "react";
import {
  Church,
  LockKeyhole,
  UserRound,
  Mail,
  Phone,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import api from "../services/api";

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });

  const [registerForm, setRegisterForm] = useState({
    username: "",
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    password: "",
    confirm_password: "",
  });

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

  const handleLoginChange = (event) => {
    setLoginForm({
      ...loginForm,
      [event.target.name]: event.target.value,
    });
  };

  const handleRegisterChange = (event) => {
    setRegisterForm({
      ...registerForm,
      [event.target.name]: event.target.value,
    });
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.post("/auth/login/", loginForm);

      localStorage.setItem("access_token", response.data.access);
      localStorage.setItem("refresh_token", response.data.refresh);

      const userResponse = await api.get("/accounts/me/");

      onLogin(userResponse.data);
    } catch (err) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");

      setError(
        err.response?.data?.detail ||
          "Login failed. Check your username and password, or contact the administrator."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegistration = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (registerForm.password !== registerForm.confirm_password) {
      setError("Your passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      await api.post("/accounts/register/", registerForm);

      setSuccess(
        "Your account request has been submitted successfully. An administrator must approve your account before you can log in."
      );

      setRegisterForm({
        username: "",
        first_name: "",
        last_name: "",
        email: "",
        phone_number: "",
        password: "",
        confirm_password: "",
      });

    } catch (err) {
      const data = err.response?.data;

      const message =
        data?.detail ||
        Object.entries(data || {})
          .map(([field, messages]) => {
            const value = Array.isArray(messages)
              ? messages.join(" ")
              : messages;

            return `${field.replaceAll("_", " ")}: ${value}`;
          })
          .join(" ") ||
        "Registration failed. Please check your details and try again.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setSuccess("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl lg:grid-cols-2">

        <div className="hidden flex-col justify-between bg-indigo-950 p-10 text-white lg:flex">
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <Church size={30} />
            </div>

            <h1 className="mt-8 text-3xl font-bold leading-tight">
              Moi University
              <br />
              Main Altar
            </h1>

            <p className="mt-4 max-w-sm text-sm leading-7 text-indigo-200">
              A central platform for managing departmental activities,
              submitting reports and strengthening accountability across
              the fellowship.
            </p>
          </div>

          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 text-indigo-300" size={21} />
              <div>
                <p className="text-sm font-semibold">Secure access</p>
                <p className="mt-1 text-xs text-indigo-200">
                  Every user has an individual account and assigned role.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-1 text-indigo-300" size={21} />
              <div>
                <p className="text-sm font-semibold">Account approval</p>
                <p className="mt-1 text-xs text-indigo-200">
                  Department Leader registrations are verified by Admin.
                </p>
              </div>
            </div>

            <p className="border-t border-white/10 pt-5 text-xs text-indigo-300">
              Moi University Main Altar Reporting System
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">

            <div className="mb-8 text-center lg:text-left">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 lg:hidden">
                <Church size={28} />
              </div>

              <h2 className="mt-4 text-2xl font-bold text-slate-900">
                {mode === "login" ? "Welcome back" : "Leader registration"}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {mode === "login"
                  ? "Sign in to access your reporting workspace."
                  : "Create your individual Department Leader account."}
              </p>
            </div>

            <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  mode === "login"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Sign in
              </button>

              <button
                type="button"
                onClick={() => switchMode("register")}
                className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  mode === "register"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Register
              </button>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 size={19} />
                  Registration submitted
                </div>
                <p className="mt-2 leading-6">{success}</p>
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="mt-3 font-semibold text-emerald-800 underline"
                >
                  Return to login
                </button>
              </div>
            )}

            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Username
                  </label>
                  <div className="relative">
                    <UserRound
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      required
                      name="username"
                      value={loginForm.username}
                      onChange={handleLoginChange}
                      placeholder="Enter your username"
                      autoComplete="username"
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <LockKeyhole
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      required
                      type="password"
                      name="password"
                      value={loginForm.password}
                      onChange={handleLoginChange}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
            )}

            {mode === "register" && (
              <form onSubmit={handleRegistration} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      First name *
                    </label>
                    <input
                      required
                      name="first_name"
                      value={registerForm.first_name}
                      onChange={handleRegisterChange}
                      placeholder="First name"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Last name *
                    </label>
                    <input
                      required
                      name="last_name"
                      value={registerForm.last_name}
                      onChange={handleRegisterChange}
                      placeholder="Last name"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Username *
                  </label>
                  <input
                    required
                    name="username"
                    value={registerForm.username}
                    onChange={handleRegisterChange}
                    placeholder="Choose a username"
                    autoComplete="username"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Email address *
                  </label>
                  <div className="relative">
                    <Mail
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      required
                      type="email"
                      name="email"
                      value={registerForm.email}
                      onChange={handleRegisterChange}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Phone number
                  </label>
                  <div className="relative">
                    <Phone
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      name="phone_number"
                      value={registerForm.phone_number}
                      onChange={handleRegisterChange}
                      placeholder="Phone number"
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Password *
                  </label>
                  <input
                    required
                    type="password"
                    name="password"
                    value={registerForm.password}
                    onChange={handleRegisterChange}
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Confirm password *
                  </label>
                  <input
                    required
                    type="password"
                    name="confirm_password"
                    value={registerForm.confirm_password}
                    onChange={handleRegisterChange}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    className={inputClass}
                  />
                </div>

                <div className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                  Your account will remain inactive until an administrator
                  reviews and approves your registration.
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit registration
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
            )}

            <p className="mt-8 text-center text-xs leading-5 text-slate-400">
              Authorized users only. Department Leader accounts require
              administrator approval.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
