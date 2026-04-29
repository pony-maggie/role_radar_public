type TopicFaqItem = {
  question: string;
  answer: string;
};

export function TopicFaq({
  locale,
  items
}: {
  locale: "en" | "zh";
  items: TopicFaqItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="feature-section section-stack topic-faq-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">{locale === "zh" ? "常见问题" : "FAQ"}</h2>
          <span className="section-note">
            {locale === "zh"
              ? "这些是专题定义里附带的补充问题，用来说明这个专题页的排序和边界。"
              : "These topic-definition FAQ items explain how this topic page is assembled and bounded."}
          </span>
        </div>
      </div>
      <div className="topic-faq-list">
        {items.map((item) => (
          <article key={`${item.question}__${item.answer}`} className="topic-faq-card">
            <h3 className="topic-faq-question">{item.question}</h3>
            <p className="topic-faq-answer">{item.answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
