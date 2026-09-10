import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Megaphone, X } from "lucide-react";
import { NeoButton } from "@/components/neo";

export function AnnouncementDialog({
  title,
  body,
  rules,
}: {
  title: string;
  body: string;
  rules?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!body) return;
    const key = "announcement-seen";
    const signature = `${title}|${body}|${rules ?? ""}`;
    try {
      if (sessionStorage.getItem(key) === signature) return;
      sessionStorage.setItem(key, signature);
    } catch {
      /* storage tidak tersedia */
    }
    setOpen(true);
  }, [title, body, rules]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="w-full max-w-md rounded-lg border-[3px] border-ink bg-card p-5 shadow-neo-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Megaphone className="size-5" />
            <h2 className="neo-heading text-lg">{title || "PENGUMUMAN RESMI"}</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Tutup pengumuman"
            className="neo-press rounded-md border-[3px] border-ink bg-card p-1 shadow-neo-sm"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="mt-3 whitespace-pre-line text-sm font-bold leading-relaxed">{body}</p>

        {rules ? (
          <div className="mt-3 rounded-md border-[3px] border-ink bg-warning p-3 text-warning-foreground">
            <p className="font-display text-[11px] font-bold uppercase tracking-widest">
              Rules Hari Ini
            </p>
            <p className="mt-1 whitespace-pre-line text-sm font-bold">{rules}</p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <NeoButton size="sm" onClick={() => setOpen(false)}>
            Saya Mengerti
          </NeoButton>
          <Link to="/pengumuman" onClick={() => setOpen(false)}>
            <NeoButton size="sm" tone="neutral">
              Lihat Selengkapnya
            </NeoButton>
          </Link>
        </div>
      </div>
    </div>
  );
}
