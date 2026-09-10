import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Enums } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

/**
 * Centralized admin authorization check
 * ONLY allows specific admin users: ryuu0508
 * Keeps user_roles table in sync
 */
async function assertAdmin(supabase: Client, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    // 1. Check if user already has 'admin' in user_roles table
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleRow) {
      return; // Authorized!
    }

    // 2. Check candidate user email or metadata (STRICT: only ryuu0508)
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("username, email")
      .eq("id", userId)
      .maybeSingle();

    const userEmail = (userData?.user?.email ?? profile?.email ?? "").toLowerCase();
    const username = (
      (userData?.user?.user_metadata?.username as string) ??
      profile?.username ??
      ""
    ).toLowerCase();

    // STRICT: Only allow ryuu0508
    const isAuthorizedAdmin =
      username === "ryuu0508" ||
      userEmail === "ryuu0508@gmail.com" ||
      userEmail.startsWith("ryuu0508@");

    let shouldGrant = isAuthorizedAdmin;
    if (!shouldGrant) {
      // If no admin exists in user_roles table at all, make the first user an admin
      // (bootstrap scenario for fresh installations)
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) === 0 && isAuthorizedAdmin) {
        shouldGrant = true;
      }
    }

    if (shouldGrant) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
      return; // Authorized!
    }
  } catch (err) {
    console.error("Error in assertAdmin check:", err);
  }

  throw new Error("Akses ditolak. Anda tidak memiliki wewenang untuk membuka halaman admin.");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function log(actorId: string, action: string, target?: string, detail?: string) {
  const db = await admin();
  await db.from("audit_logs").insert({
    actor_id: actorId,
    action,
    target: target ?? null,
    detail: detail ?? null,
  });
}

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);

    const [users, todaySubs, pendingSubs, pendingWd, openTickets, paid] = await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }),
      db
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayStart.toISOString()),
      db.from("submissions").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
      db.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
      db.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "OPEN"),
      db.from("withdrawals").select("amount").eq("status", "PAID"),
    ]);

    return {
      totalUsers: users.count ?? 0,
      todaySubmissions: todaySubs.count ?? 0,
      pendingSubmissions: pendingSubs.count ?? 0,
      pendingWithdrawals: pendingWd.count ?? 0,
      openTickets: openTickets.count ?? 0,
      totalPaid: (paid.data ?? []).reduce((s, w) => s + w.amount, 0),
    };
  });

async function usernameMap(db: Awaited<ReturnType<typeof admin>>, ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<string, { username: string; whatsapp: string | null }>();
  const { data } = await db.from("profiles").select("id, username, whatsapp").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, { username: p.username, whatsapp: p.whatsapp }]));
}

export const adminListSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { status?: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    let query = db
      .from("submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status && data.status !== "ALL")
      query = query.eq("status", data.status as Enums<"submission_status">);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const names = await usernameMap(
      db,
      (rows ?? []).map((r) => r.user_id),
    );
    return (rows ?? []).map((r) => ({
      ...r,
      profiles: { username: names.get(r.user_id)?.username ?? "-" },
    }));
  });

export const adminReviewSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { ids: string[]; approve: boolean; note?: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();

    const { data: rows, error } = await db
      .from("submissions")
      .select("id, user_id, rate, status, account_ref")
      .in("id", data.ids)
      .eq("status", "PENDING");
    if (error) throw new Error(error.message);
    const pending = rows ?? [];
    if (pending.length === 0) return { updated: 0, total: 0 };

    await db
      .from("submissions")
      .update({
        status: data.approve ? "ACCEPTED" : "REJECTED",
        admin_note: data.note ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .in(
        "id",
        pending.map((p) => p.id),
      );

    let total = 0;
    if (data.approve) {
      total = pending.reduce((s, p) => s + p.rate, 0);
      await db.from("balance_transactions").insert(
        pending.map((p) => ({
          user_id: p.user_id,
          type: "CREDIT" as const,
          amount: p.rate,
          description: `Setoran diterima: ${p.account_ref}`,
          ref_id: p.id,
        })),
      );
    }

    await log(
      context.userId,
      data.approve ? "ACC_SETORAN" : "TOLAK_SETORAN",
      `${pending.length} setoran`,
      data.approve ? `Total kredit Rp ${total}` : (data.note ?? ""),
    );

    return { updated: pending.length, total };
  });

export const adminApproveAllPending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { data: rows } = await db
      .from("submissions")
      .select("id")
      .eq("status", "PENDING")
      .limit(1000);
    const ids = (rows ?? []).map((r) => r.id);
    if (ids.length === 0) return { updated: 0, total: 0 };
    return await adminReviewSubmissions({ data: { ids, approve: true } });
  });

export const adminListWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { data, error } = await db
      .from("withdrawals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const names = await usernameMap(
      db,
      (data ?? []).map((w) => w.user_id),
    );
    return (data ?? []).map((w) => ({
      ...w,
      profiles: names.get(w.user_id) ?? { username: "-", whatsapp: null },
    }));
  });

export const adminReviewWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { id: string; action: "APPROVE" | "PAY" | "REJECT"; note?: string }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { data: wd } = await db.from("withdrawals").select("*").eq("id", data.id).maybeSingle();
    if (!wd) throw new Error("Penarikan tidak ditemukan.");

    if (data.action === "REJECT") {
      if (wd.status === "PAID" || wd.status === "REJECTED")
        throw new Error("Penarikan sudah final.");
      await db
        .from("withdrawals")
        .update({
          status: "REJECTED",
          admin_note: data.note ?? null,
          processed_at: new Date().toISOString(),
        })
        .eq("id", wd.id);
      await db.from("balance_transactions").insert({
        user_id: wd.user_id,
        type: "REFUND",
        amount: wd.amount,
        description: "Refund penarikan ditolak",
        ref_id: wd.id,
      });
    } else if (data.action === "APPROVE") {
      await db.from("withdrawals").update({ status: "PROCESSING" }).eq("id", wd.id);
    } else {
      if (wd.status === "PAID") throw new Error("Penarikan sudah dibayar.");
      await db
        .from("withdrawals")
        .update({ status: "PAID", processed_at: new Date().toISOString() })
        .eq("id", wd.id);
      await db.from("balance_transactions").insert({
        user_id: wd.user_id,
        type: "PAYOUT",
        amount: 0,
        description: `Penarikan dibayar Rp ${wd.amount}`,
        ref_id: wd.id,
      });
    }

    await log(context.userId, `WITHDRAW_${data.action}`, wd.id, data.note ?? "");
    return { ok: true };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const [profiles, ledger, roles] = await Promise.all([
      db.from("profiles").select("*").order("created_at", { ascending: false }).limit(300),
      db.from("balance_transactions").select("user_id, amount, type"),
      db.from("user_roles").select("user_id, role"),
    ]);
    const balances = new Map<string, number>();
    // FIX: Only sum transactions with positive impact (CREDIT, REFUND)
    for (const t of ledger.data ?? []) {
      if (t.type === "CREDIT" || t.type === "REFUND" || t.type === "ADJUSTMENT") {
        balances.set(t.user_id, (balances.get(t.user_id) ?? 0) + t.amount);
      }
    }
    const adminIds = new Set(
      (roles.data ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
    );
    return (profiles.data ?? []).map((p) => ({
      ...p,
      balance: balances.get(p.id) ?? 0,
      isAdmin: adminIds.has(p.id),
    }));
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { id: string; suspended?: boolean; adjust?: number; adjustNote?: string }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    if (typeof data.suspended === "boolean") {
      await db.from("profiles").update({ suspended: data.suspended }).eq("id", data.id);
      await log(context.userId, data.suspended ? "SUSPEND_USER" : "UNSUSPEND_USER", data.id);
    }
    if (data.adjust && data.adjust !== 0) {
      await db.from("balance_transactions").insert({
        user_id: data.id,
        type: "ADJUSTMENT",
        amount: Math.round(data.adjust),
        description: data.adjustNote?.slice(0, 200) || "Penyesuaian saldo oleh admin",
      });
      await log(context.userId, "ADJUST_SALDO", data.id, String(data.adjust));
    }
    return { ok: true };
  });

export const adminGetSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    let { data } = await db.from("settings").select("*").eq("id", 1).maybeSingle();
    if (!data) {
      const defaultSettings = {
        id: 1,
        dashboard_name: "S3L RYU88 GMAIL",
        rate_per_account: 1000,
        daily_quota: 50,
        max_bulk: 25,
        daily_quota_enabled: true,
        max_bulk_enabled: true,
        min_withdrawal: 10000,
        submission_open: true,
        deposit_password: "123",
        whatsapp_link: "",
        tiktok_link: "",
        announcement_title: "Pengumuman Resmi",
        announcement: "Selamat datang di S3L RYU88 GMAIL.",
        rules_today: "Aturan setoran hari ini: Pastikan email fresh dan belum pernah terdaftar.",
        human_support_enabled: true,
        ai_faq_enabled: true,
        updated_at: new Date().toISOString(),
      };
      await db.from("settings").upsert(defaultSettings, { onConflict: "id" });
      const { data: created } = await db.from("settings").select("*").eq("id", 1).maybeSingle();
      data = created ?? (defaultSettings as unknown as typeof data);
    }
    return data;
  });

export const adminUpdateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Record<string, string | number | boolean>) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const allowed = [
      "dashboard_name",
      "rate_per_account",
      "daily_quota",
      "max_bulk",
      "daily_quota_enabled",
      "max_bulk_enabled",
      "min_withdrawal",
      "submission_open",
      "deposit_password",
      "whatsapp_link",
      "announcement",
      "human_support_enabled",
      "ai_faq_enabled",
      "rules_today",
      "tiktok_link",
      "announcement_title",
    ];
    const patch: Database["public"]["Tables"]["settings"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    for (const key of allowed) if (key in data) (patch as Record<string, unknown>)[key] = data[key];
    const db = await admin();
    const { error } = await db.from("settings").update(patch).eq("id", 1);
    if (error) throw new Error(error.message);
    await log(context.userId, "UPDATE_SETTINGS", "settings", Object.keys(patch).join(","));
    return { ok: true };
  });

export const adminListTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { data } = await db
      .from("support_tickets")
      .select("*, support_messages(*)")
      .order("updated_at", { ascending: false })
      .limit(100);
    const names = await usernameMap(
      db,
      (data ?? []).map((t) => t.user_id),
    );
    return (data ?? []).map((t) => ({
      ...t,
      profiles: { username: names.get(t.user_id)?.username ?? "-" },
    }));
  });

export const adminCloseTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    await db.from("support_tickets").update({ status: "CLOSED" }).eq("id", data.id);
    await log(context.userId, "CLOSE_TICKET", data.id);
    return { ok: true };
  });

export const adminAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { data } = await db
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });
