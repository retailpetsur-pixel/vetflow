"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function Home() {
  const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const router = useRouter();
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="mb-8 text-center">
gestión clínica veterinaria simple y rápida
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
  className="w-full rounded-xl border border-slate-300 px-4 py-3"
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
  className="w-full rounded-xl border border-slate-300 px-4 py-3"
/>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-slate-900 text-white py-3 font-semibold"
          >
            Ingresar
          </button>
        </form>
      </div>
    </main>
  );
}