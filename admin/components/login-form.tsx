"use client";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", { email: form.get("email"), password: form.get("password"), redirect: false, redirectTo: "/admin" });
    if (result?.error) { setBusy(false); setError("邮箱或密码不正确"); return; }
    window.location.assign("/admin");
  }
  return <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm"><h1 className="mb-6 text-2xl font-semibold">登录后台</h1><label className="mb-4 block text-sm">邮箱<input className="mt-1 w-full rounded border p-2" type="email" name="email" autoComplete="username" required /></label><label className="mb-6 block text-sm">密码<input className="mt-1 w-full rounded border p-2" type="password" name="password" autoComplete="current-password" required /></label>{error && <p className="mb-3 text-sm text-red-700">{error}</p>}<button disabled={busy} className="w-full rounded bg-blue-700 p-2 text-white disabled:opacity-50">{busy ? "登录中…" : "登录"}</button></form>;
}
