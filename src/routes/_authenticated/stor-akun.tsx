import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, BookLock, Key, Send, Copy, Trash2, Sparkles } from "lucide-react";
import {
  NeoCard,
  NeoButton,
  NeoTextarea,
  NeoLabel,
  NeoBadge,
  SectionTitle,
  formatRp,
} from "@/components/neo";
import { useBootstrap } from "@/components/AppShell";
import { submitAccounts, type SubmitResult } from "@/lib/submissions.functions";

export const Route = createFileRoute("/_authenticated/stor-akun")({
  head: () => ({
    meta: [
      { title: "Stor Akun — S3L RYU88 GMAIL" },
      { name: "description", content: "Kirim setoran Gmail massal untuk direview admin." },
      { property: "og:title", content: "Stor Akun — S3L RYU88 GMAIL" },
      { property: "og:description", content: "Kirim setoran Gmail untuk direview admin." },
    ],
  }),
  component: StorAkunPage,
});

function StorAkunPage() {
  const { data: boot } = useBootstrap();
  const qc = useQueryClient();
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);

  const mutation = useMutation({
    mutationFn: (vars: { raw: string }) => submitAccounts({ data: vars }),
    onSuccess: (res) => {
      setResult(res);
      setRaw("");
      toast.success(res.message);
      qc.invalidateQueries();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const parsedLines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const open = boot?.settings.submission_open ?? false;
  const depositPassword = boot?.settings.deposit_password || "sgsg1122";

  const copyToClipboard = (text: string, msg: string) => {
    if (!text) {
      toast.error("Tidak ada data untuk disalin.");
      return;
    }
    navigator.clipboard.writeText(text);
    toast.success(msg);
  };

  const removeLine = (index: number) => {
    const updated = parsedLines.filter((_, i) => i !== index);
    setRaw(updated.join("\n"));
  };

  return (
    <div className="space-y-4">
      {!open ? (
        <div className="flex items-start gap-3 rounded-md border-[3px] border-ink bg-warning px-3 py-2 text-warning-foreground shadow-neo">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-display text-sm font-bold uppercase">⚠️ Setoran sedang ditutup</p>
            <p className="text-xs font-semibold opacity-80">
              {boot?.settings.announcement ||
                "Open Senin - Sabtu 07:00-15:30. More info di saluran."}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border-[3px] border-ink bg-accent px-3 py-2 text-accent-foreground shadow-neo">
        <div className="flex items-start gap-3">
          <BookLock className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-display text-sm font-bold uppercase">
              🔮 Cek Rules dulu sebelum stor
            </p>
            <p className="text-xs font-semibold opacity-80">
              Wajib dibaca agar Gmail tidak ditolak.
            </p>
          </div>
        </div>
        <Link to="/rules">
          <NeoButton size="sm">Buka Rules</NeoButton>
        </Link>
      </div>

      {/* Password Wajib Highlight Box */}
      <div className="rounded-md border-[3px] border-ink bg-amber-200 p-4 shadow-neo">
        <div className="flex items-center gap-2 font-display text-sm font-black uppercase text-ink">
          <Key className="size-5 shrink-0 text-amber-700" />
          🔑 Password wajib untuk Gmail yang disetor:
        </div>
        <div className="mt-2 inline-block rounded border-[2px] border-ink bg-card px-3 py-1 font-mono text-xl font-black text-ink shadow-neo-sm">
          {depositPassword}
        </div>
        <p className="mt-2 text-xs font-bold text-ink">
          Pastikan setiap Gmail menggunakan password di atas. Gmail dengan password berbeda akan
          ditolak.
        </p>
      </div>

      <SectionTitle
        title="Setor Daftar Gmail"
        subtitle="Tempel daftar, satu Gmail per baris. Duplikat otomatis dihapus. Hanya Gmail berakhiran @gmail.com yang dapat disetor."
      />

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <NeoCard className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <NeoBadge tone={open ? "primary" : "danger"}>
              {open ? "Setoran Buka" : "Setoran Tutup"}
            </NeoBadge>
            {boot?.settings.daily_quota_enabled === false ? (
              <NeoBadge tone="info">Kuota harian: tanpa batas</NeoBadge>
            ) : (
              <NeoBadge tone="info">Sisa kuota: {boot?.quota.remaining ?? 0}</NeoBadge>
            )}
            {boot?.settings.max_bulk_enabled === false ? null : (
              <NeoBadge>Maks {boot?.settings.max_bulk ?? 25} baris</NeoBadge>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate({ raw });
            }}
            className="space-y-4"
          >
            <div>
              <NeoLabel>Daftar Gmail</NeoLabel>
              <NeoTextarea
                rows={10}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={"khbmrangga06@gmail.com\ncontoh2@gmail.com"}
                required
              />
              <p className="mt-1 text-xs font-bold uppercase text-muted-foreground">
                {parsedLines.length} baris terdeteksi
              </p>
            </div>

            {/* Generated List View */}
            {parsedLines.length > 0 ? (
              <div className="space-y-3 rounded-md border-[3px] border-ink bg-muted p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-display text-xs font-bold uppercase">
                    <Sparkles className="size-4 text-primary" />
                    Generated Gmail
                  </div>
                  <NeoBadge tone="info">
                    Total: {parsedLines.length} · Belum distor: {parsedLines.length}
                  </NeoBadge>
                </div>

                <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                  {parsedLines.map((line, idx) => (
                    <div
                      key={`${line}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded border-[2px] border-ink bg-card px-3 py-1.5 shadow-neo-sm"
                    >
                      <span className="min-w-0 flex-1 truncate font-mono text-xs font-bold">
                        {line}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <NeoBadge tone="warning">Belum Distor</NeoBadge>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(line, "Email disalin!")}
                          className="neo-press rounded p-1 hover:bg-muted"
                          title="Salin Email"
                        >
                          <Copy className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="neo-press rounded p-1 text-destructive hover:bg-destructive/10"
                          title="Hapus"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <NeoButton
                    type="button"
                    size="sm"
                    tone="neutral"
                    onClick={() =>
                      copyToClipboard(parsedLines.join("\n"), "Semua Gmail disalin ke clipboard!")
                    }
                  >
                    <Copy className="size-3" /> Salin Semua Gmail
                  </NeoButton>
                  <NeoButton
                    type="button"
                    size="sm"
                    tone="neutral"
                    onClick={() =>
                      copyToClipboard(parsedLines.join("\n"), "Gmail disalin ke clipboard!")
                    }
                  >
                    <Copy className="size-3" /> Salin Gmail Belum Distor
                  </NeoButton>
                </div>
              </div>
            ) : null}

            <NeoButton
              type="submit"
              size="lg"
              className="w-full"
              disabled={!open || mutation.isPending || parsedLines.length === 0}
            >
              <Send className="size-4" />
              {mutation.isPending ? "Mengirim..." : "Stor Sekarang"}
            </NeoButton>
          </form>
        </NeoCard>

        <div className="space-y-4">
          <NeoCard className="bg-foreground text-background">
            <p className="font-display text-xs font-bold uppercase tracking-widest opacity-70">
              Rate per akun disetujui
            </p>
            <p className="neo-heading mt-1 text-3xl text-primary">
              {formatRp(boot?.settings.rate_per_account ?? 0)}
            </p>
          </NeoCard>

          <NeoCard>
            <h2 className="neo-heading text-base">Rules Hari Ini</h2>
            <p className="mt-2 whitespace-pre-line text-sm font-medium text-muted-foreground">
              {boot?.settings.rules_today ||
                "Batas maksimal 25 baris per kirim. Pastikan format email benar."}
            </p>
          </NeoCard>

          <NeoCard>
            <h2 className="neo-heading text-base">Aturan Format</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-medium text-muted-foreground">
              <li>Satu email Gmail per baris, tanpa tambahan password / teks lain</li>
              <li>Duplikat otomatis ditolak sistem</li>
              <li>Pastikan Gmail menggunakan password wajib yang ditentukan di atas</li>
            </ul>
          </NeoCard>

          {result ? (
            <NeoCard>
              <h2 className="neo-heading text-base">Hasil Setoran Terakhir</h2>
              <p className="mt-1 text-sm font-semibold">{result.message}</p>
              {result.duplicates.length ? (
                <p className="mt-2 break-words text-xs font-medium text-muted-foreground">
                  Duplikat: {result.duplicates.join(", ")}
                </p>
              ) : null}
              {result.invalid.length ? (
                <p className="mt-2 break-words text-xs font-medium text-muted-foreground">
                  Format salah: {result.invalid.join(" / ")}
                </p>
              ) : null}
            </NeoCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
