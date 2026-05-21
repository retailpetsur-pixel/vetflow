"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function Home() {
  const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const router = useRouter();
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-16 sm:p-6 dark:bg-slate-950">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-5 sm:p-8 dark:bg-slate-900">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">VetFlow</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            gestión clínica veterinaria simple y rápida
          </p>
        </div>

<form
  className="space-y-4"
 onSubmit={(e) => {
  e.preventDefault();

  if (email === "admin@petsur.cl" && password === "1234") {
router.push("/dashboard");
  } else {
    alert("Credenciales incorrectas ❌");
  }
}}
>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Correo
            </label>
<input
  type="email"
  placeholder="nombre@petsur.cl"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
/>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Contraseña
            </label>
<input
  type="password"
  placeholder="••••••••"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
/>
          </div>

          <button
            type="submit"
            className="min-h-12 w-full rounded-xl bg-slate-900 text-white py-3 font-semibold transition hover:bg-slate-800 dark:bg-white dark:text-slate-900"
          >
            Ingresar
          </button>
        </form>
      </div>
    </main>
  );
}
