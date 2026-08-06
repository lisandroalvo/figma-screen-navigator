"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Method = "password" | "magic";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<Method>("magic");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const normalized = email.trim().toLowerCase();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    if (!normalized || !normalized.includes("@")) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    try {
      const supabase = createClient();

      if (method === "password") {
        if (!password) {
          setStatus("error");
          setMessage("Please enter your password.");
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: normalized,
          password,
        });

        if (error) {
          setStatus("error");
          setMessage(error.message);
        } else {
          setStatus("success");
          setMessage("Signed in.");
          router.push("/");
        }
      } else {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (!appUrl) {
          throw new Error("NEXT_PUBLIC_APP_URL is not configured.");
        }
        const emailRedirectTo = `${appUrl.replace(/\/$/, "")}/login/callback`;

        const { error } = await supabase.auth.signInWithOtp({
          email: normalized,
          options: {
            shouldCreateUser: true,
            emailRedirectTo,
          },
        });

        if (error) {
          setStatus("error");
          setMessage(error.message);
        } else {
          setStatus("success");
          setMessage("Check your email for the magic link.");
        }
      }
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error
          ? err.message
          : "Could not reach Supabase. Check your connection.",
      );
      console.error("Login error:", err);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex rounded border border-zinc-200 p-1">
        <button
          type="button"
          onClick={() => setMethod("password")}
          className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${
            method === "password"
              ? "bg-zinc-900 text-white"
              : "bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMethod("magic")}
          className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${
            method === "magic"
              ? "bg-zinc-900 text-white"
              : "bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          Magic link
        </button>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-zinc-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="you@example.com"
        />
      </div>

      {method === "password" && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-zinc-700" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={method === "password"}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm pr-20"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1.5 text-xs text-zinc-500 hover:text-zinc-800"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {status === "loading"
          ? method === "password"
            ? "Signing in..."
            : "Sending..."
          : method === "password"
            ? "Sign in with password"
            : "Sign in with email"}
      </button>

      {message && (
        <p
          className={`text-sm ${
            status === "error" ? "text-red-600" : "text-green-600"
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
