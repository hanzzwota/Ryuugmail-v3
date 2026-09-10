import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useBootstrap } from "@/components/AppShell";
import {
  NeoCard,
  NeoButton,
  NeoInput,
  NeoTextarea,
  NeoLabel,
  NeoBadge,
  NeoSelect,
  SectionTitle,
  EmptyState,
  formatRp,
} from "@/components/neo";
import {
  adminOverview,
  adminListSubmissions,
  adminReviewSubmissions,
  adminApproveAllPending,
  adminListWithdrawals,
  adminReviewWithdrawal,
  adminListUsers,
  adminUpdateUser,
  adminGetSettings,
  adminUpdateSettings,
  adminListTickets,
  adminCloseTicket,
  adminAuditLogs,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — S3L RYU88 GMAIL" },
      {
        name: "description",
        content: "Panel administrasi setoran, penarikan, pengguna, dan pengaturan.",
      },
      { property: "og:title", content: "Admin — S3L RYU88 GMAIL" },
      {
        property: "og:description",
        content: "Kelola setoran, penarikan, pengguna, tiket, dan pengaturan.",
      },
    ],
  }),
  component: AdminPage,
});

const TABS = [
  { id: "setoran", label: "Setoran" },
  { id: "penarikan", label: "Penarikan" },
  { id: "pengguna", label: "Pengguna" },
  { id: "pengaturan", label: "Pengaturan" },
  { id: "tiket", label: "Tiket" },
  { id: "log", label: "Log" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function fmtDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

function AdminPage() {
  const { data: boot, isLoading: bootLoading } = useBootstrap();
  const [tab, setTab] = useState<TabId>("setoran");
  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => adminOverview(),
    enabled: Boolean(boot?.isAdmin),
  });

  if (bootLoading || boot === undefined) {
    return (
      <NeoCard className="p-6 text-center">
        <p className="animate-pulse font-display text-sm font-bold uppercase">
          Memuat data admin...
        </p>
      </NeoCard>
    );
  }

  if (!boot?.isAdmin) {
    return (
      <div className="space-y-4">
        <SectionTitle title="Akses Ditolak" subtitle="Panel ini khusus akun dengan peran Admin." />
        <NeoCard className="space-y-3">
          <p className="text-sm font-bold uppercase text-destructive">
            Akses ditolak. Anda tidak memiliki wewenang untuk membuka halaman admin.
          </p>
          <a href="/dashboard">
            <NeoButton size="sm">Kembali ke Dashboard</NeoButton>
          </a>
        </NeoCard>
      </div>
    );
  }

  if (overview.isError) {
    return (
      <div className="space-y-4">
        <SectionTitle
          title="Gagal Memuat Admin"
          subtitle="Terjadi kesalahan saat mengambil ringkasan admin."
        />
        <NeoCard className="space-y-3">
          <p className="text-sm font-bold text-destructive">
            {(overview.error as Error)?.message || "Gagal memuat data ringkasan admin."}
          </p>
          <NeoButton size="sm" onClick={() => overview.refetch()}>
            Coba Lagi
          </NeoButton>
        </NeoCard>
      </div>
    );
  }

  const o = overview.data;

  return (
    <div className="space-y-5">
      <SectionTitle title="Admin" subtitle="Kelola setoran, penarikan, pengguna, dan sistem." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Pengguna" value={o?.totalUsers ?? 0} />
        <Stat label="Setoran Hari Ini" value={o?.todaySubmissions ?? 0} />
        <Stat label="Setoran Pending" value={o?.pendingSubmissions ?? 0} />
        <Stat label="Tarik Pending" value={o?.pendingWithdrawals ?? 0} />
        <Stat label="Tiket Terbuka" value={o?.openTickets ?? 0} />
        <Stat label="Total Dibayar" value={formatRp(o?.totalPaid ?? 0)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`neo-press rounded-md border-[3px] border-ink px-3 py-1.5 font-display text-xs font-bold uppercase shadow-neo-sm ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-card"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "setoran" ? <SubmissionsTab /> : null}
      {tab === "penarikan" ? <WithdrawalsTab /> : null}
      {tab === "pengguna" ? <UsersTab /> : null}
      {tab === "pengaturan" ? <SettingsTab /> : null}
      {tab === "tiket" ? <TicketsTab /> : null}
      {tab === "log" ? <LogsTab /> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <NeoCard className="p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="neo-heading mt-1 text-xl">{value}</p>
    </NeoCard>
  );
}

/* ---------------- Setoran ---------------- */

function SubmissionsTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("PENDING");
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const list = useQuery({
    queryKey: ["admin", "submissions", status],
    queryFn: () => adminListSubmissions({ data: { status } }),
  });

  const done = (msg: string) => {
    toast.success(msg);
    setSelected([]);
    setNote("");
    qc.invalidateQueries({ queryKey: ["admin"] });
  };

  const review = useMutation({
    mutationFn: (vars: { ids: string[]; approve: boolean; note?: string }) =>
      adminReviewSubmissions({ data: vars }),
    onSuccess: (res) => done(`${res.updated} setoran diproses.`),
    onError: (e: Error) => toast.error(e.message),
  });

  const approveAll = useMutation({
    mutationFn: () => adminApproveAllPending(),
    onSuccess: (res) => done(`${res.updated} setoran disetujui.`),
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = list.data ?? [];
  const allIds = rows.map((r) => r.id);

  return (
    <NeoCard>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-44">
          <NeoLabel>Status</NeoLabel>
          <NeoSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="PENDING">Pending</option>
            <option value="ACCEPTED">Diterima</option>
            <option value="REJECTED">Ditolak</option>
            <option value="ALL">Semua</option>
          </NeoSelect>
        </div>
        <NeoButton
          size="sm"
          tone="neutral"
          onClick={() => setSelected(selected.length === allIds.length ? [] : allIds)}
        >
          {selected.length === allIds.length && allIds.length > 0 ? "Batal Pilih" : "Pilih Semua"}
        </NeoButton>
        <NeoButton size="sm" onClick={() => approveAll.mutate()} disabled={approveAll.isPending}>
          ACC Semua Pending
        </NeoButton>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <NeoInput
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan admin (opsional, untuk penolakan)"
        />
        <div className="flex gap-2">
          <NeoButton
            size="sm"
            disabled={selected.length === 0 || review.isPending}
            onClick={() => review.mutate({ ids: selected, approve: true })}
          >
            ACC ({selected.length})
          </NeoButton>
          <NeoButton
            size="sm"
            tone="danger"
            disabled={selected.length === 0 || review.isPending}
            onClick={() => review.mutate({ ids: selected, approve: false, note })}
          >
            Tolak
          </NeoButton>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {rows.length === 0 ? <EmptyState text="Tidak ada setoran." /> : null}
        {rows.map((r) => {
          const username = (r as unknown as { profiles: { username: string } }).profiles?.username;
          const checked = selected.includes(r.id);
          return (
            <label
              key={r.id}
              className="flex cursor-pointer flex-wrap items-center gap-3 rounded-md border-[3px] border-ink bg-card px-3 py-2 shadow-neo-sm"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  setSelected((prev) =>
                    prev.includes(r.id) ? prev.filter((i) => i !== r.id) : [...prev, r.id],
                  )
                }
                className="size-4"
              />
              <span className="min-w-0 flex-1 break-all font-mono text-sm">{r.account_ref}</span>
              <NeoBadge tone="info">{username}</NeoBadge>
              <NeoBadge
                tone={
                  r.status === "ACCEPTED"
                    ? "primary"
                    : r.status === "PENDING"
                      ? "warning"
                      : "danger"
                }
              >
                {r.status}
              </NeoBadge>
              <span className="text-[11px] font-bold uppercase text-muted-foreground">
                {fmtDate(r.created_at)}
              </span>
            </label>
          );
        })}
      </div>
    </NeoCard>
  );
}

/* ---------------- Penarikan ---------------- */

function WithdrawalsTab() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin", "withdrawals"],
    queryFn: () => adminListWithdrawals(),
  });
  const act = useMutation({
    mutationFn: (vars: { id: string; action: "APPROVE" | "PAY" | "REJECT"; note?: string }) =>
      adminReviewWithdrawal({ data: vars }),
    onSuccess: () => {
      toast.success("Penarikan diperbarui.");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = list.data ?? [];

  return (
    <div className="space-y-3">
      {rows.length === 0 ? <EmptyState text="Belum ada permintaan penarikan." /> : null}
      {rows.map((w) => {
        const p = (w as unknown as { profiles: { username: string; whatsapp: string | null } })
          .profiles;
        return (
          <NeoCard key={w.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="neo-heading text-lg">{formatRp(w.amount)}</p>
                <p className="text-xs font-bold uppercase text-muted-foreground">
                  {p?.username} • {w.method} • {w.account_number} a/n {w.account_name}
                </p>
                <p className="text-[11px] font-bold uppercase text-muted-foreground">
                  WA: {p?.whatsapp ?? "-"} • {fmtDate(w.created_at)}
                </p>
              </div>
              <NeoBadge
                tone={
                  w.status === "PAID" ? "primary" : w.status === "REJECTED" ? "danger" : "warning"
                }
              >
                {w.status}
              </NeoBadge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <NeoButton
                size="sm"
                tone="neutral"
                disabled={act.isPending}
                onClick={() => act.mutate({ id: w.id, action: "APPROVE" })}
              >
                Proses
              </NeoButton>
              <NeoButton
                size="sm"
                disabled={act.isPending}
                onClick={() => act.mutate({ id: w.id, action: "PAY" })}
              >
                Tandai Dibayar
              </NeoButton>
              <NeoButton
                size="sm"
                tone="danger"
                disabled={act.isPending}
                onClick={() => {
                  const note = window.prompt("Alasan penolakan?") ?? "";
                  act.mutate({ id: w.id, action: "REJECT", note });
                }}
              >
                Tolak & Refund
              </NeoButton>
            </div>
          </NeoCard>
        );
      })}
    </div>
  );
}

/* ---------------- Pengguna ---------------- */

function UsersTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const list = useQuery({ queryKey: ["admin", "users"], queryFn: () => adminListUsers() });
  const update = useMutation({
    mutationFn: (vars: { id: string; suspended?: boolean; adjust?: number; adjustNote?: string }) =>
      adminUpdateUser({ data: vars }),
    onSuccess: () => {
      toast.success("Pengguna diperbarui.");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (list.data ?? []).filter((u) =>
    q ? `${u.username} ${u.email ?? ""}`.toLowerCase().includes(q.toLowerCase()) : true,
  );

  return (
    <div className="space-y-3">
      <NeoInput
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari username / email"
      />
      {rows.length === 0 ? <EmptyState text="Tidak ada pengguna." /> : null}
      {rows.map((u) => (
        <NeoCard key={u.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="neo-heading text-base">{u.username}</p>
              <p className="text-xs font-bold uppercase text-muted-foreground">
                {u.email} • WA {u.whatsapp ?? "-"}
              </p>
              <p className="text-xs font-bold uppercase text-muted-foreground">
                {u.payment_method ?? "-"} {u.payment_account ?? ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {u.isAdmin ? <NeoBadge tone="info">Admin</NeoBadge> : null}
              <NeoBadge tone={u.suspended ? "danger" : "primary"}>
                {u.suspended ? "Dibekukan" : "Aktif"}
              </NeoBadge>
              <NeoBadge>Saldo {formatRp(u.balance)}</NeoBadge>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <NeoButton
              size="sm"
              tone={u.suspended ? "neutral" : "danger"}
              disabled={update.isPending}
              onClick={() => update.mutate({ id: u.id, suspended: !u.suspended })}
            >
              {u.suspended ? "Aktifkan" : "Bekukan"}
            </NeoButton>
            <NeoButton
              size="sm"
              tone="neutral"
              disabled={update.isPending}
              onClick={() => {
                const raw = window.prompt("Penyesuaian saldo (boleh minus), contoh 5000:");
                if (!raw) return;
                const value = Number(raw);
                if (!Number.isFinite(value) || value === 0) {
                  toast.error("Nilai tidak valid.");
                  return;
                }
                const adjustNote = window.prompt("Catatan penyesuaian:") ?? "";
                update.mutate({ id: u.id, adjust: value, adjustNote });
              }}
            >
              Sesuaikan Saldo
            </NeoButton>
          </div>
        </NeoCard>
      ))}
    </div>
  );
}

/* ---------------- Pengaturan ---------------- */

function SettingsTab() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["admin", "settings"], queryFn: () => adminGetSettings() });
  const [form, setForm] = useState<Record<string, string | number | boolean> | null>(null);
  const value = form ?? (settings.data as Record<string, string | number | boolean> | null);

  const save = useMutation({
    mutationFn: (patch: Record<string, string | number | boolean>) =>
      adminUpdateSettings({ data: patch }),
    onSuccess: () => {
      toast.success("Pengaturan disimpan.");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (settings.isLoading) {
    return (
      <NeoCard className="p-6 text-center">
        <p className="animate-pulse font-display text-sm font-bold uppercase">
          Memuat pengaturan...
        </p>
      </NeoCard>
    );
  }

  if (settings.isError) {
    return (
      <NeoCard className="space-y-3">
        <p className="text-sm font-bold text-destructive">
          Gagal memuat pengaturan: {(settings.error as Error)?.message || "Terjadi kesalahan."}
        </p>
        <NeoButton size="sm" onClick={() => settings.refetch()}>
          Coba Lagi
        </NeoButton>
      </NeoCard>
    );
  }

  if (!value) {
    return (
      <NeoCard className="space-y-3">
        <p className="text-sm font-bold">Data pengaturan belum tersedia.</p>
        <NeoButton size="sm" onClick={() => settings.refetch()}>
          Muat Ulang
        </NeoButton>
      </NeoCard>
    );
  }

  const set = (key: string, v: string | number | boolean) =>
    setForm({ ...(value as Record<string, string | number | boolean>), [key]: v });

  const text = (key: string) => String(value[key] ?? "");
  const num = (key: string) => Number(value[key] ?? 0);

  return (
    <NeoCard>
      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({
            dashboard_name: text("dashboard_name"),
            rate_per_account: num("rate_per_account"),
            daily_quota: num("daily_quota"),
            max_bulk: num("max_bulk"),
            daily_quota_enabled: Boolean(value["daily_quota_enabled"]),
            max_bulk_enabled: Boolean(value["max_bulk_enabled"]),

            min_withdrawal: num("min_withdrawal"),
            submission_open: Boolean(value["submission_open"]),
            deposit_password: text("deposit_password"),
            whatsapp_link: text("whatsapp_link"),
            tiktok_link: text("tiktok_link"),
            announcement_title: text("announcement_title"),
            announcement: text("announcement"),
            rules_today: text("rules_today"),
            human_support_enabled: Boolean(value["human_support_enabled"]),
            ai_faq_enabled: Boolean(value["ai_faq_enabled"]),
          });
        }}
      >
        <div>
          <NeoLabel>Nama Dashboard</NeoLabel>
          <NeoInput
            value={text("dashboard_name")}
            onChange={(e) => set("dashboard_name", e.target.value)}
          />
        </div>
        <div>
          <NeoLabel>Rate per Akun (Rp)</NeoLabel>
          <NeoInput
            type="number"
            value={num("rate_per_account")}
            onChange={(e) => set("rate_per_account", Number(e.target.value))}
          />
        </div>
        <div>
          <NeoLabel>Batas Setor Hari Ini</NeoLabel>
          <NeoSelect
            value={value["daily_quota_enabled"] ? "1" : "0"}
            onChange={(e) => set("daily_quota_enabled", e.target.value === "1")}
          >
            <option value="1">Aktif</option>
            <option value="0">Nonaktif (tanpa batas)</option>
          </NeoSelect>
        </div>
        <div>
          <NeoLabel>Kuota Harian</NeoLabel>
          <NeoInput
            type="number"
            value={num("daily_quota")}
            onChange={(e) => set("daily_quota", Number(e.target.value))}
          />
        </div>
        <div>
          <NeoLabel>Batas Maksimal Setor Sekali Kirim</NeoLabel>
          <NeoSelect
            value={value["max_bulk_enabled"] ? "1" : "0"}
            onChange={(e) => set("max_bulk_enabled", e.target.value === "1")}
          >
            <option value="1">Aktif</option>
            <option value="0">Nonaktif (tanpa batas)</option>
          </NeoSelect>
        </div>
        <div>
          <NeoLabel>Maks Baris per Setoran</NeoLabel>
          <NeoInput
            type="number"
            value={num("max_bulk")}
            onChange={(e) => set("max_bulk", Number(e.target.value))}
          />
        </div>

        <div>
          <NeoLabel>Minimal Penarikan (Rp)</NeoLabel>
          <NeoInput
            type="number"
            value={num("min_withdrawal")}
            onChange={(e) => set("min_withdrawal", Number(e.target.value))}
          />
        </div>
        <div>
          <NeoLabel>Password Setoran Hari Ini</NeoLabel>
          <NeoInput
            value={text("deposit_password")}
            onChange={(e) => set("deposit_password", e.target.value)}
          />
        </div>
        <div>
          <NeoLabel>Link Channel WhatsApp</NeoLabel>
          <NeoInput
            value={text("whatsapp_link")}
            onChange={(e) => set("whatsapp_link", e.target.value)}
          />
        </div>
        <div>
          <NeoLabel>Link TikTok Resmi</NeoLabel>
          <NeoInput
            value={text("tiktok_link")}
            onChange={(e) => set("tiktok_link", e.target.value)}
          />
        </div>
        <div>
          <NeoLabel>Judul Pengumuman</NeoLabel>
          <NeoInput
            value={text("announcement_title")}
            onChange={(e) => set("announcement_title", e.target.value)}
          />
        </div>
        <div>
          <NeoLabel>Status Setoran</NeoLabel>
          <NeoSelect
            value={value["submission_open"] ? "1" : "0"}
            onChange={(e) => set("submission_open", e.target.value === "1")}
          >
            <option value="1">Buka</option>
            <option value="0">Tutup</option>
          </NeoSelect>
        </div>
        <div className="md:col-span-2">
          <NeoLabel>Isi Pengumuman</NeoLabel>
          <NeoTextarea
            rows={3}
            value={text("announcement")}
            onChange={(e) => set("announcement", e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <NeoLabel>Rules Hari Ini</NeoLabel>
          <NeoTextarea
            rows={5}
            value={text("rules_today")}
            onChange={(e) => set("rules_today", e.target.value)}
          />
        </div>
        <div>
          <NeoLabel>Support Manusia</NeoLabel>
          <NeoSelect
            value={value["human_support_enabled"] ? "1" : "0"}
            onChange={(e) => set("human_support_enabled", e.target.value === "1")}
          >
            <option value="1">Aktif</option>
            <option value="0">Nonaktif</option>
          </NeoSelect>
        </div>
        <div>
          <NeoLabel>FAQ AI</NeoLabel>
          <NeoSelect
            value={value["ai_faq_enabled"] ? "1" : "0"}
            onChange={(e) => set("ai_faq_enabled", e.target.value === "1")}
          >
            <option value="1">Aktif</option>
            <option value="0">Nonaktif</option>
          </NeoSelect>
        </div>
        <div className="md:col-span-2">
          <NeoButton type="submit" size="lg" disabled={save.isPending}>
            {save.isPending ? "Menyimpan..." : "Simpan Pengaturan"}
          </NeoButton>
        </div>
      </form>
    </NeoCard>
  );
}

/* ---------------- Tiket ---------------- */

type TicketRow = {
  id: string;
  subject: string;
  category: string;
  status: string;
  created_at: string;
  profiles?: { username: string };
  support_messages?: { id: string; body: string; is_admin: boolean; created_at: string }[];
};

function TicketsTab() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin", "tickets"], queryFn: () => adminListTickets() });
  const close = useMutation({
    mutationFn: (id: string) => adminCloseTicket({ data: { id } }),
    onSuccess: () => {
      toast.success("Tiket ditutup.");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (list.data ?? []) as unknown as TicketRow[];

  return (
    <div className="space-y-3">
      {rows.length === 0 ? <EmptyState text="Belum ada tiket." /> : null}
      {rows.map((t) => (
        <NeoCard key={t.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="neo-heading text-base">{t.subject}</p>
              <p className="text-xs font-bold uppercase text-muted-foreground">
                {t.profiles?.username} • {t.category} • {fmtDate(t.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <NeoBadge tone={t.status === "OPEN" ? "warning" : "primary"}>{t.status}</NeoBadge>
              {t.status !== "CLOSED" ? (
                <NeoButton size="sm" tone="danger" onClick={() => close.mutate(t.id)}>
                  Tutup
                </NeoButton>
              ) : null}
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {(t.support_messages ?? []).map((m) => (
              <div
                key={m.id}
                className="rounded-md border-[3px] border-ink bg-muted px-3 py-2 text-sm font-medium"
              >
                <span className="mr-2 text-[10px] font-bold uppercase text-muted-foreground">
                  {m.is_admin ? "Admin" : "User"}
                </span>
                {m.body}
              </div>
            ))}
          </div>
        </NeoCard>
      ))}
    </div>
  );
}

/* ---------------- Log ---------------- */

function LogsTab() {
  const list = useQuery({ queryKey: ["admin", "logs"], queryFn: () => adminAuditLogs() });
  const rows = list.data ?? [];
  return (
    <NeoCard>
      {rows.length === 0 ? <EmptyState text="Belum ada log." /> : null}
      <div className="space-y-2">
        {rows.map((l) => (
          <div
            key={l.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border-[3px] border-ink bg-card px-3 py-2 text-sm font-semibold shadow-neo-sm"
          >
            <span>
              <NeoBadge tone="info">{l.action}</NeoBadge>{" "}
              <span className="break-all">{l.target ?? ""}</span>
            </span>
            <span className="text-[11px] font-bold uppercase text-muted-foreground">
              {l.detail ?? ""} • {fmtDate(l.created_at)}
            </span>
          </div>
        ))}
      </div>
    </NeoCard>
  );
}
