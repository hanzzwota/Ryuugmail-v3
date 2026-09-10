import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { NeoButton, NeoCard, NeoInput, NeoLabel } from "@/components/neo";
import { useAuth } from "@/hooks/useAuth";
import { resolveLoginEmail } from "@/lib/auth.functions";

type AuthSearch = { mode?: "login" | "register" };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    mode: search["mode"] === "register" ? "register" : "login",
  }),
  head: () => ({
    meta: [
      { title: "Masuk atau Daftar — S3L RYU88 GMAIL" },
      {
        name: "description",
        content: "Masuk ke dashboard S3L RYU88 GMAIL untuk stor akun, cek saldo, dan tarik dana.",
      },
      { property: "og:title", content: "Masuk atau Daftar — S3L RYU88 GMAIL" },
      {
        property: "og:description",
        content: "Akses dashboard setoran, saldo, dan penarikan S3L RYU88 GMAIL.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [isRegister, setIsRegister] = useState(mode === "register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState<{ message: string; notRegistered?: boolean } | null>(
    null,
  );

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  const goToRegister = () => {
    setAuthError(null);
    setIsRegister(true);
    if (email) {
      if (email.includes("@")) {
        if (!username) setUsername(email.split("@")[0] || "");
      } else {
        if (!username) setUsername(email);
        setEmail(`${email}@gmail.com`);
      }
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setAuthError(null);
    try {
      if (isRegister) {
        if (!email.includes("@")) {
          throw new Error("Format email tidak valid (harus mengandung @).");
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { username: username || email.split("@")[0], whatsapp },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Pendaftaran berhasil. Selamat datang!");
          navigate({ to: "/dashboard" });
        } else {
          toast.success("Pendaftaran berhasil. Silakan masuk.");
          setIsRegister(false);
        }
      } else {
        const found = await resolveLoginEmail({ data: { identifier: email } });
        if (!found.found) {
          setAuthError({
            message: "Username atau Gmail ini belum terdaftar.",
            notRegistered: true,
          });
          return;
        }
        if (found.suspended) {
          setAuthError({ message: "Akun kamu sedang dibekukan. Hubungi admin." });
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: found.email,
          password,
        });
        if (error) {
          if ("code" in error && error.code === "email_not_confirmed") {
            setAuthError({ message: "Email belum dikonfirmasi. Cek kotak masuk email kamu." });
            return;
          }
          if ("code" in error && error.code === "invalid_credentials") {
            setAuthError({ message: "Password salah untuk akun ini." });
            return;
          }
          throw error;
        }
        toast.success("Selamat datang kembali!");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setAuthError({ message: msg });
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="neo-heading mb-5 block text-center text-xl">
          S3L RYU88 GMAIL
        </Link>
        <NeoCard className="border-[4px] p-6 shadow-neo-lg">
          <h1 className="neo-heading text-2xl">{isRegister ? "Daftar Akun" : "Masuk"}</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {isRegister
              ? "Buat akun untuk mulai menyetor."
              : "Masuk untuk melanjutkan ke dashboard."}
          </p>

          {authError ? (
            <div className="mt-4 rounded-md border-[3px] border-ink bg-destructive/10 p-3 text-destructive shadow-neo-sm">
              <p className="text-xs font-bold uppercase leading-snug">{authError.message}</p>
              {authError.notRegistered ? (
                <div className="mt-2 text-xs font-bold text-foreground">
                  Belum punya akun?{" "}
                  <button
                    type="button"
                    onClick={goToRegister}
                    className="font-black underline text-primary hover:opacity-80"
                  >
                    Daftar Sekarang
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <form onSubmit={submit} className="mt-5 space-y-3">
            {isRegister ? (
              <>
                <div>
                  <NeoLabel>Nama Pengguna</NeoLabel>
                  <NeoInput
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username kamu"
                    required
                  />
                </div>
                <div>
                  <NeoLabel>Nomor WhatsApp</NeoLabel>
                  <NeoInput
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
              </>
            ) : null}
            <div>
              <NeoLabel>{isRegister ? "Email" : "Username / Gmail"}</NeoLabel>
              <NeoInput
                type={isRegister ? "email" : "text"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isRegister ? "contoh@gmail.com" : "Username atau Gmail"}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <NeoLabel>Password</NeoLabel>
              <NeoInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                minLength={8}
                required
              />
            </div>
            <NeoButton type="submit" size="lg" className="w-full" disabled={busy || !ready}>
              {busy || !ready ? "Memproses..." : isRegister ? "Daftar Sekarang" : "Masuk"}
            </NeoButton>
          </form>

          <button
            type="button"
            onClick={() => {
              setAuthError(null);
              setIsRegister((v) => !v);
            }}
            className="mt-4 w-full text-center text-sm font-bold underline"
          >
            {isRegister ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar"}
          </button>
        </NeoCard>

        <p className="mt-4 text-center text-xs font-bold uppercase text-muted-foreground">
          Setorkan Gmail Mu Sekarang Juga
        </p>
      </div>
    </div>
  );
}
