"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Usuário ou senha inválidos");
      setLoading(false);
    } else {
      router.push("/base");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-[#12131a] rounded-2xl border border-[#1e2030] shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src="/logo.svg" alt="Nord Wealth" className="h-12" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-[#71717a] mb-1.5">Usuário</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#1a1b26] border border-[#2e3044] rounded-lg px-3 py-2.5 text-sm text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                placeholder="Seu usuário"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#71717a] mb-1.5">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#1a1b26] border border-[#2e3044] rounded-lg px-3 py-2.5 text-sm text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                placeholder="Sua senha"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full bg-emerald-500 text-black py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-400 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Entrando...
                </span>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          <p className="text-[10px] text-[#71717a] text-center mt-6">
            Acesso restrito. Contate o administrador para obter credenciais.
          </p>
        </div>
      </div>
    </div>
  );
}
