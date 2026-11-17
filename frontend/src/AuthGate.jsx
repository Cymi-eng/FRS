import { useEffect, useState } from "react";
import api from "./services/api";
import App from "./App";
import Login from "./pages/Login";

export default function AuthGate() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem("access_token");

      if (!token) {
        setChecking(false);
        return;
      }

      try {
        const response = await api.get("/accounts/me/");
        setUser(response.data);
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setUser(null);
      } finally {
        setChecking(false);
      }
    };

    verifySession();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-medium text-slate-500">
          Loading your workspace...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return <App user={user} onLogout={handleLogout} />;
}