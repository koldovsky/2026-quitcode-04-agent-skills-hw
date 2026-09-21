import Link from "next/link";
import { db } from "@/lib/db";
import { login } from "./actions";

export default async function LoginPage() {
  const users = await db.listUsers();

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">LeadDesk</h1>
          <p className="text-sm text-slate-500">Демо-вхід: оберіть користувача, пароль не потрібен.</p>
        </div>

        <form action={login} className="space-y-4">
          <label className="block text-sm font-medium">
            Користувач
            <select
              name="userId"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {user.workspaceSlug}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Увійти
          </button>
        </form>

        <Link href="/" className="block text-center text-sm text-slate-500 hover:text-slate-900">
          ← Форма заявки
        </Link>
      </div>
    </main>
  );
}
