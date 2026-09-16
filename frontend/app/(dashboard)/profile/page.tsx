// app/(dashboard)/profile/page.tsx - remove duplicate useEffect and fix imports

"use client";

import { useState, useEffect } from "react";
import {
    UserRound, Mail, Shield, Bell, Settings2, CircleHelp,
    ChevronRight, BadgeCheck, ScanLine, Sparkles, ShieldCheck,
    LogOut, Camera, Edit2, Check, X, Server, Activity, Wifi, WifiOff,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { checkDatabaseStatus } from "@/lib/db";

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
    const [email, setEmail] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [systemStatus, setSystemStatus] = useState<SystemStatus>({
        backend: false,
        database: false,
        ocr: false,
        rules: false,
    });
    const [healthLoading, setHealthLoading] = useState(true);

    // app/(dashboard)/profile/page.tsx
    const checkDbStatus = async () => {
        try {
            const res = await fetch("/api/health/db");
            const data = await res.json();
            setSystemStatus(prev => ({ ...prev, database: data.connected }));
        } catch {
            setSystemStatus(prev => ({ ...prev, database: false }));
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
                setEmail(data?.user?.email || "");
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
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-800 border-t-transparent" />
            </div>
        );
    }

    const statusItems = [
        { key: "backend", icon: Server, label: "Backend API", status: systemStatus.backend },
        { key: "database", icon: Activity, label: "Database", status: systemStatus.database },
        { key: "ocr", icon: ScanLine, label: "OCR Engine", status: systemStatus.ocr },
        { key: "rules", icon: ShieldCheck, label: "Rule Engine", status: systemStatus.rules },
    ];

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-semibold tracking-[-.03em] text-slate-900">Profile</h2>
                    <p className="mt-1 text-sm text-slate-500">Manage your account settings and preferences</p>
                </div>
                <Button variant="outline" onClick={handleLogout} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200">
                    <LogOut className="h-4 w-4 mr-2" /> Sign Out
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                {/* Left Column */}
                <div className="space-y-6">
                    <Card className="border-slate-200/80">
                        <CardContent className="p-6">
                            <div className="flex items-start gap-6">
                                <div className="relative">
                                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-4 ring-white shadow-sm">
                                        <UserRound className="h-10 w-10" />
                                    </div>
                                    <button className="absolute -bottom-1 -right-1 rounded-full bg-slate-800 p-1.5 text-white shadow-sm hover:bg-slate-700 transition-colors">
                                        <Camera className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        {editing ? (
                                            <div className="flex-1 flex items-center gap-3 min-w-[200px]">
                                                <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs h-9 text-sm" placeholder="Full name" />
                                                <Button size="sm" onClick={handleUpdateProfile} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 h-9 w-9 p-0">
                                                    {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Check className="h-4 w-4" />}
                                                </Button>
                                                <Button size="sm" variant="outline" className="h-9 w-9 p-0" onClick={() => { setEditing(false); setName(user?.name || ""); }}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <h3 className="text-xl font-semibold text-slate-900">{user?.name || "Inspector"}</h3>
                                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
                                                    <BadgeCheck className="h-3 w-3 mr-1" /> Verified
                                                </Badge>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600" onClick={() => setEditing(true)}>
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                    <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-slate-500">
                                        <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" />{user?.email}</span>
                                        <span className="hidden sm:inline text-slate-300">|</span>
                                        <span className="flex items-center gap-1.5"><Shield className="h-4 w-4" />Inspector · LM-DL-8812</span>
                                    </div>
                                    {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200/80">
                        <CardContent className="p-0">
                            <div className="border-b border-slate-100 p-5">
                                <h3 className="text-sm font-semibold text-slate-900">Preferences</h3>
                                <p className="text-xs text-slate-500">Manage your app preferences</p>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {[
                                    { icon: Bell, label: "Notifications", value: "Inspection reminders" },
                                    { icon: Settings2, label: "Language", value: "English (India)" },
                                    { icon: CircleHelp, label: "Help & Feedback", value: "Product guidance" },
                                ].map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <button key={item.label} className="flex w-full items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors group">
                                            <Icon className="h-4 w-4 text-slate-400" />
                                            <div className="flex-1 text-left">
                                                <p className="text-sm font-medium text-slate-900">{item.label}</p>
                                                <p className="text-xs text-slate-500">{item.value}</p>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                                        </button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - System Status */}
                <Card className="border-slate-200/80 h-fit">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">System Status</h3>
                                <p className="text-xs text-slate-500">{healthLoading ? "Checking..." : "All systems operational"}</p>
                            </div>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600" onClick={() => { checkBackendStatus(); checkDbStatus(); }} disabled={healthLoading}>
                                <span className="h-3.5 w-3.5">
                                    {healthLoading ? <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" /> : <Activity className="h-3.5 w-3.5" />}
                                </span>
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {statusItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = item.status;
                                return (
                                    <div key={item.key} className={`flex items-center justify-between rounded-lg p-3 transition-colors ${isActive ? "bg-slate-50" : "bg-rose-50/50"}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`rounded-lg p-2 ${isActive ? "bg-white text-slate-700" : "bg-rose-100 text-rose-600"}`}>
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-900">{item.label}</p>
                                                <p className={`text-xs ${isActive ? "text-slate-500" : "text-rose-600"}`}>{isActive ? "Connected" : "Unavailable"}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isActive ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-rose-600" />}
                                            <span className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-rose-500"}`} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>Last checked</span>
                                <span>{new Date().toLocaleTimeString()}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex gap-3">
                <Button variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" /> Sign Out
                </Button>
                <Button variant="ghost" className="text-slate-500" onClick={() => router.back()}>Back to Dashboard</Button>
            </div>
        </div>
    );
}