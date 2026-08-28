type PageHeaderProps = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
}>;

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <header className="pq-section-rule space-y-5 border-b border-[color:var(--pq-border)] pb-8 sm:pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="pq-kicker">{eyebrow}</p>
        <div className="hidden h-px flex-1 bg-[linear-gradient(90deg,rgba(215,192,140,0.18),transparent)] sm:block" />
      </div>
      <div className="space-y-3">
        <h1 className="max-w-5xl text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        <p className="max-w-4xl text-base leading-7 pq-copy-muted sm:text-lg">
          {description}
        </p>
      </div>
    </header>
  );
}
