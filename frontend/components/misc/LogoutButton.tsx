// frontend/components/LogoutButton.tsx
"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function LogoutButton({ variant = "icon" }: { variant?: "icon" | "full" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await authClient.signOut();
      router.push("/login");
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  if (variant === "full") {
    return (
      <button
        onClick={handleLogout}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-danger-soft hover:text-destructive transition-all active:scale-[.98] disabled:opacity-50"
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-destructive/30 border-t-destructive" />
        ) : (
          <LogOut className="h-4 w-4" />
        )}
        Sign out
      </button>
    );
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-danger-soft hover:text-destructive transition-all active:scale-[.95] disabled:opacity-50"
      title="Sign out"
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-destructive/30 border-t-destructive" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
    </button>
  );
}