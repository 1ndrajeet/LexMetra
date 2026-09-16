// app/login/page.tsx
"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (isLogin) {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        setError(error.message || "Invalid credentials");
        setLoading(false);
      } else {
        router.push("/home");
      }
    } else {
      const { error } = await authClient.signUp.email({ email, password, name });
      if (error) {
        setError(error.message || "Registration failed");
        setLoading(false);
      } else {
        router.push("/home");
      }
    }
  };

  
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left Side - Brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
              <ScanLine className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-[-.03em]">LEXMETRA</p>
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-white/50">
                Legal Metrology Platform
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-bold tracking-[-.05em] leading-tight">
            Legal Metrology
            <br />
            <span className="text-white/70">Compliance Platform</span>
          </h1>
          <p className="mt-4 text-lg text-white/60">
            AI-assisted packaged commodity inspection for Legal Metrology officers.
          </p>
          <div className="mt-8 flex items-center gap-3 text-sm text-white/50">
            <ShieldCheck className="h-5 w-5" />
            <span>Government-grade compliance screening</span>
          </div>
        </div>

        <div className="relative z-10 text-sm text-white/30">
          © 2026 Department of Consumer Affairs
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <Card className="w-full max-w-xl border-0 shadow-none bg-transparent">
          <CardContent className="px-8 py-4">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold tracking-[-.04em] text-slate-900">
                {isLogin ? "Welcome back" : "Create account"}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {isLogin
                  ? "Sign in to access your inspection dashboard"
                  : "Register to start conducting inspections"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-slate-700">
                    Full Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Omkar Kulkarni"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 h-11 rounded-xl border-slate-200 bg-white focus:border-slate-400 focus:ring-slate-400/20"
                      required={!isLogin}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="inspector@dept.gov.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 rounded-xl border-slate-200 bg-white focus:border-slate-400 focus:ring-slate-400/20"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-12 h-11 rounded-xl border-slate-200 bg-white focus:border-slate-400 focus:ring-slate-400/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-600 text-sm border border-rose-200">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    {isLogin ? "Sign In" : "Create Account"}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                }}
                className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
              </button>
            </div>

            <div className="mt-8 p-4 rounded-xl bg-slate-100 border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                Demo Credentials
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Email: <span className="font-mono text-xs bg-white px-2 py-0.5 rounded border border-slate-200">admin@demo.gov</span>
                <br />
                Password: <span className="font-mono text-xs bg-white px-2 py-0.5 rounded border border-slate-200">password123</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}