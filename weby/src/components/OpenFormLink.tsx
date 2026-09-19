"use client";

/**
 * Tlačidlo „Zistiť cenu" mimo formulára (hero, spodná lišta) — otvorí
 * LeadForm cez jeho skrytý spúšťač a doscrolluje k nemu.
 */
export default function OpenFormLink({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <a
      className={className}
      href="#ocenenie"
      onClick={(e) => {
        const trigger = document.querySelector<HTMLButtonElement>("#ocenenie [data-open-form]");
        if (trigger) { e.preventDefault(); trigger.click(); }
      }}
    >
      {children}
    </a>
  );
}
