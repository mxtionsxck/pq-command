type PqLogoProps = Readonly<{
  compact?: boolean;
}>;

export function PqLogo({ compact = false }: PqLogoProps) {
  return (
    <div className="inline-flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-[0.8rem] border border-[color:var(--pq-border-strong)] bg-[linear-gradient(180deg,rgba(215,192,140,0.22),rgba(159,126,63,0.15))] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
        <span className="text-sm font-bold tracking-[0.08em] text-[color:var(--pq-color-ivory-100)]">
          PQ
        </span>
      </div>
      <div className="leading-tight">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.25em] text-[color:var(--pq-accent-strong)]">
          PQ Real Estate
        </p>
        {!compact ? (
          <p className="text-sm font-semibold tracking-[0.05em] text-[color:var(--pq-color-ivory-100)]">
            COMMAND
          </p>
        ) : null}
      </div>
    </div>
  );
}