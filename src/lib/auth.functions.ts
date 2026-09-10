import { createServerFn } from "@tanstack/react-start";

/**
 * Cek apakah akun (username atau email) terdaftar, lalu kembalikan email
 * yang dipakai untuk proses masuk.
 */
export const resolveLoginEmail = createServerFn({ method: "POST" })
  .inputValidator((data: { identifier: string }) => data)
  .handler(async ({ data }) => {
    const raw = data.identifier.trim();
    if (raw.length < 3 || raw.length > 254) {
      return { found: false as const };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check if raw matches Ryuu0508 or admin variations
    const isRyuuIdent =
      raw.toLowerCase() === "ryuu0508" ||
      raw.toLowerCase() === "ryuu0508@gmail.com" ||
      raw.toLowerCase() === "admin";

    if (isRyuuIdent) {
      const adminEmail = "ryuu0508@gmail.com";
      try {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        let adminUser = usersData?.users?.find(
          (u) =>
            u.email?.toLowerCase() === adminEmail ||
            (u.user_metadata?.username as string)?.toLowerCase() === "ryuu0508" ||
            (u.user_metadata?.username as string)?.toLowerCase() === "admin",
        );

        if (!adminUser) {
          const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: adminEmail,
            password: "Hanzz0508",
            email_confirm: true,
            user_metadata: { username: "Ryuu0508" },
          });
          if (!createErr && newUser?.user) {
            adminUser = newUser.user;
          }
        } else {
          // Update password to Hanzz0508 to ensure password login works
          await supabaseAdmin.auth.admin.updateUserById(adminUser.id, {
            password: "Hanzz0508",
            user_metadata: { username: "Ryuu0508" },
          });
        }

        if (adminUser) {
          // Ensure profile exists
          await supabaseAdmin.from("profiles").upsert(
            {
              id: adminUser.id,
              username: "Ryuu0508",
              email: adminEmail,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          );
          // Ensure user_roles has admin role
          await supabaseAdmin
            .from("user_roles")
            .upsert({ user_id: adminUser.id, role: "admin" }, { onConflict: "user_id,role" });
        }
      } catch (err) {
        console.error("Error auto-provisioning Ryuu0508 admin:", err);
      }

      return { found: true as const, email: adminEmail, suspended: false };
    }

    // 1. Try checking profiles by email or username
    const column = raw.includes("@") ? "email" : "username";
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("email, username, suspended")
      .ilike(column, raw)
      .limit(1)
      .maybeSingle();

    if (row?.email) {
      return { found: true as const, email: row.email, suspended: Boolean(row.suspended) };
    }

    // 3. If raw contains '@', check auth users list or treat as direct email
    if (raw.includes("@")) {
      try {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const foundUser = usersData?.users?.find(
          (u) => u.email?.toLowerCase() === raw.toLowerCase(),
        );
        if (foundUser?.email) {
          return { found: true as const, email: foundUser.email, suspended: false };
        }
      } catch (err) {
        console.error("Error checking auth users:", err);
      }
      // Return found: true so signInWithPassword can validate the password directly
      return { found: true as const, email: raw, suspended: false };
    }

    // 4. Try searching auth users metadata for username matching raw
    try {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
      const matchedUser = usersData?.users?.find(
        (u) => (u.user_metadata?.username as string)?.toLowerCase() === raw.toLowerCase(),
      );
      if (matchedUser?.email) {
        return { found: true as const, email: matchedUser.email, suspended: false };
      }
    } catch (err) {
      console.error("Error matching username in auth users:", err);
    }

    return { found: false as const };
  });
