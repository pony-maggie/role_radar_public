export function StructuralReasons({
  locale,
  role
}: {
  locale: "en" | "zh";
  role: {
    repetitionScore: number;
    ruleClarityScore: number;
    transformationScore: number;
    workflowAutomationScore: number;
    riskReasons?: unknown;
  };
}) {
  const label = locale === "zh" ? "为什么是这个等级" : "Why this role is rated this way";
  const repetitionLabel = locale === "zh" ? "重复性" : "Repetition";
  const ruleClarityLabel = locale === "zh" ? "规则清晰度" : "Rule clarity";
  const transformationLabel = locale === "zh" ? "流程改造程度" : "Transformation work";
  const automationLabel = locale === "zh" ? "工作流自动化" : "Workflow automation";
  const reasons = Array.isArray(role.riskReasons)
    ? role.riskReasons.filter(
        (
          reason
        ): reason is {
          titleEn: string;
          titleZh?: string;
          detailEn: string;
          detailZh?: string;
        } =>
          typeof reason === "object" &&
          reason !== null &&
          "titleEn" in reason &&
          "detailEn" in reason &&
          typeof reason.titleEn === "string" &&
          typeof reason.detailEn === "string"
      )
    : [];

  return (
    <section className="reason-board section-stack">
      <div className="section-header">
        <h2 className="section-title">{label}</h2>
        <span className="section-note">{locale === "zh" ? "结构底座" : "Structural base"}</span>
      </div>
      <div className="reason-chip-grid">
        <div className="reason-item reason-chip">
          <span className="reason-label">{repetitionLabel}</span>
          <strong className="reason-score">{role.repetitionScore}</strong>
        </div>
        <div className="reason-item reason-chip">
          <span className="reason-label">{ruleClarityLabel}</span>
          <strong className="reason-score">{role.ruleClarityScore}</strong>
        </div>
        <div className="reason-item reason-chip">
          <span className="reason-label">{transformationLabel}</span>
          <strong className="reason-score">{role.transformationScore}</strong>
        </div>
        <div className="reason-item reason-chip">
          <span className="reason-label">{automationLabel}</span>
          <strong className="reason-score">{role.workflowAutomationScore}</strong>
        </div>
      </div>
      {reasons.length > 0 ? (
        <div className="reason-detail-stack">
          {reasons.map((reason) => (
            <div className="reason-item reason-detail-card" key={`${reason.titleEn}-${reason.detailEn}`}>
              <span className="reason-label">
                {locale === "zh" ? reason.titleZh ?? reason.titleEn : reason.titleEn}
              </span>
              <p className="timeline-why-copy">
                {locale === "zh" ? reason.detailZh ?? reason.detailEn : reason.detailEn}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
