"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Method = "password" | "magic";

type SubmitStatus = "idle" | "loading" | "success" | "error";

const RATE_LIMIT_KEYWORDS = [
  "over_email_send_rate_limit",
  "email rate limit exceeded",
];

const RETRY_SECONDS = 30;

function isRateLimitError(message: string | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return RATE_LIMIT_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function friendlyError(
  method: Method,
  raw: string | null,
): { title: string; body: string } {
  if (isRateLimitError(raw)) {
    return {
      title: "Too many sign-in emails were requested.",
      body: "Use Password sign-in or try again later.",
    };
  }

  if (method === "password") {
    return {
      title: "Sign in failed.",
      body: "Check your email and password and try again.",
    };
  }

  return {
    title: "Could not send the magic link.",
    body: raw ? "Please try again in a moment." : "Please try again later.",
  };
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<Method>("password");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [message, setMessage] = useState<{ title: string; body: string } | null>(null);
  const [countdown, setCountdown] = useState(0);
  const submitted = useRef(false);

  const normalized = email.trim().toLowerCase();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitted.current) return;

    setStatus("loading");
    setMessage(null);
    submitted.current = true;

    if (!normalized || !normalized.includes("@")) {
      setStatus("error");
      setMessage(friendlyError(method, null));
      submitted.current = false;
      return;
    }

    try {
      const supabase = createClient();

      if (method === "password") {
        if (!password) {
          setStatus("error");
          setMessage(friendlyError(method, null));
          submitted.current = false;
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: normalized,
          password,
        });

        if (error) {
          setStatus("error");
          setMessage(friendlyError(method, error.message));
        } else {
          setStatus("success");
          setMessage({ title: "Signed in.", body: "" });
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
          setMessage(friendlyError(method, error.message));
        } else {
          setStatus("success");
          setMessage({
            title: "Check your email for the magic link.",
            body: `You can request another in ${RETRY_SECONDS} seconds.`,
          });
          setCountdown(RETRY_SECONDS);
        }
      }
    } catch (err) {
      setStatus("error");
      const raw = err instanceof Error ? err.message : "unknown";
      setMessage(friendlyError(method, raw));
      console.error("Login error:", err);
    } finally {
      submitted.current = false;
    }
  }

  const isLoading = status === "loading";

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
        disabled={isLoading || (method === "magic" && countdown > 0)}
        className="w-full rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {isLoading
          ? method === "password"
            ? "Signing in..."
            : "Sending..."
          : method === "password"
            ? "Sign in with password"
            : countdown > 0
              ? `Resend in ${countdown}s`
              : "Send magic link"}
      </button>

      {message && (
        <div
          className={`space-y-1 rounded p-3 text-sm ${
            status === "error"
              ? "border border-red-200 bg-red-50 text-red-700"
              : "border border-green-200 bg-green-50 text-green-700"
          }`}
        >
          <p className="font-medium">{message.title}</p>
          {message.body && <p>{message.body}</p>}
        </div>
      )}
    </form>
  );
}
