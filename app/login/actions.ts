"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/session";

export async function login(formData: FormData) {
  const userId = formData.get("userId");
  const sessionId = typeof userId === "string" ? await db.createSession(userId) : null;
  if (!sessionId) redirect("/login");

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  redirect("/dashboard");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
