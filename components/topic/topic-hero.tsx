export function TopicHero({
  title,
  description,
  locale
}: {
  title: string;
  description: string;
  locale: "en" | "zh";
}) {
  return (
    <header className="topic-hero page-hero">
      <p className="eyebrow">{locale === "zh" ? "专题页" : "Topic page"}</p>
      <h1 className="page-title">{title}</h1>
      <p className="page-copy">{description}</p>
    </header>
  );
}
