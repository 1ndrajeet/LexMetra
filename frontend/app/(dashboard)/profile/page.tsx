// app/(dashboard)/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
  UserRound,
  Mail,
  Shield,
  Bell,
  Settings2,
  CircleHelp,
  ChevronRight,
  BadgeCheck,
  ScanLine,
  ShieldCheck,
  LogOut,
  Camera,
  Edit2,
  Check,
  X,
  Server,
  Activity,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

interface SystemStatus {
  backend: boolean;
  database: boolean;
  ocr: boolean;
  rules: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    backend: false,
    database: false,
    ocr: false,
    rules: false,
  });
  const [healthLoading, setHealthLoading] = useState(true);

  const checkDbStatus = async () => {
    try {
      const res = await fetch("/api/health/db");
      const data = await res.json();
      setSystemStatus((prev) => ({ ...prev, database: data.connected }));
    } catch {
      setSystemStatus((prev) => ({ ...prev, database: false }));
    }
  };

  const checkBackendStatus = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/v1/health");
      const data = await res.json();
      setSystemStatus({
        backend: data.status === "ok",
        database: data.database === "connected",
        ocr: data.ocr === "ready",
        rules: data.rules === "loaded",
      });
    } catch {
      setSystemStatus({
        backend: false,
        database: false,
        ocr: false,
        rules: false,
      });
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data, error } = await authClient.getSession();
        if (error) throw error;
        setUser(data?.user);
        setName(data?.user?.name || "");
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
    checkBackendStatus();
    checkDbStatus();
  }, []);

  const handleUpdateProfile = async () => {
    setSaving(true);
    setError("");
    try {
      const { error } = await authClient.updateUser({ name });
      if (error) throw error;
      setUser({ ...user, name });
      setEditing(false);
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl items-center justify-center px-4 py-20 sm:px-6 lg:px-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    );
  }

  const statusItems = [
    { key: "backend", icon: Server, label: "Backend API", status: systemStatus.backend },
    { key: "database", icon: Activity, label: "Database", status: systemStatus.database },
    { key: "ocr", icon: ScanLine, label: "OCR engine", status: systemStatus.ocr },
    { key: "rules", icon: ShieldCheck, label: "Rule engine", status: systemStatus.rules },
  ];

  const prefs = [
    { icon: Bell, label: "Notifications", value: "Inspection reminders" },
    { icon: Settings2, label: "Language", value: "English (India)" },
    { icon: CircleHelp, label: "Help & feedback", value: "Product guidance" },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="pt-6 pb-6 sm:pt-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Account
        </p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground sm:text-[1.9rem]">
              Profile
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your account and preferences.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={handleLogout}
            className="w-full shrink-0 text-destructive hover:text-destructive sm:w-auto"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      {/* ── Identity ───────────────────────────────────── */}
      <section className="border-y border-border">
        <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:gap-5">
          <div className="relative shrink-0">
            <div className="flex h-16 w-16 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
              <UserRound className="h-7 w-7" />
            </div>
            <button
              type="button"
              aria-label="Change avatar"
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
            >
              <Camera className="h-3 w-3" />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9 max-w-xs text-sm"
                    placeholder="Full name"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleUpdateProfile}
                    disabled={saving}
                    className="h-9 w-9 p-0"
                    aria-label="Save name"
                  >
                    {saving ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-9 w-9 p-0"
                    aria-label="Cancel"
                    onClick={() => {
                      setEditing(false);
                      setName(user?.name || "");
                      setError("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
                    {user?.name || "Inspector"}
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded border border-success/20 bg-success-soft px-1.5 py-0.5 text-[10px] font-medium text-success">
                    <BadgeCheck className="h-3 w-3" />
                    Verified
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    aria-label="Edit name"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {user?.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Inspector · LM-DL-8812
              </span>
            </div>

            {error && (
              <p className="mt-2 text-xs text-destructive">{error}</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Two-column body ────────────────────────────── */}
      <div className="grid gap-8 py-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Preferences */}
        <section>
          <div className="mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Preferences
            </p>
            <h3 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-foreground">
              App settings
            </h3>
          </div>

          <ul className="border-t border-border">
            {prefs.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <button
                    type="button"
                    className="group flex w-full items-center gap-3 border-b border-border py-3 text-left transition-colors hover:bg-muted/30"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.label}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.value}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* System status */}
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Diagnostics
              </p>
              <h3 className="mt-1 text-[1.05rem] font-semibold tracking-tight text-foreground">
                System status
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                checkBackendStatus();
                checkDbStatus();
              }}
              disabled={healthLoading}
              aria-label="Refresh system status"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              {healthLoading ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Activity className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <ul className="border-t border-border">
            {statusItems.map((item) => {
              const Icon = item.icon;
              const ok = item.status;
              return (
                <li
                  key={item.key}
                  className="flex items-center gap-3 border-b border-border py-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.label}
                    </p>
                    <p
                      className={`mt-0.5 text-xs ${
                        ok ? "text-muted-foreground" : "text-destructive"
                      }`}
                    >
                      {ok ? "Operational" : "Unavailable"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                      ok
                        ? "border-success/20 bg-success-soft text-success"
                        : "border-destructive/20 bg-danger-soft text-destructive"
                    }`}
                  >
                    {ok ? (
                      <Wifi className="h-3 w-3" />
                    ) : (
                      <WifiOff className="h-3 w-3" />
                    )}
                    {ok ? "Up" : "Down"}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="mt-3 text-[11px] text-muted-foreground">
            Status is refreshed on page load and on manual refresh.
          </p>
        </section>
      </div>
    </div>
  );
}