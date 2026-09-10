type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#856c12]">{eyebrow}</p>
        ) : null}
        <h2 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-[#111110] md:text-[2.35rem]">
          {title}
        </h2>
      </div>
      {description ? (
        <p className="max-w-xl text-sm leading-7 text-[var(--muted)] md:text-right">{description}</p>
      ) : null}
    </div>
  );
}
