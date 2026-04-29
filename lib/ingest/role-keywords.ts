export const roleKeywords = {
  "customer-service-representative": [
    "customer support",
    "support agent",
    "help desk",
    "contact center",
    "call center",
    "ticket",
    "triage"
  ],
  "bookkeeping-clerk": [
    "bookkeeping",
    "bookkeeper",
    "reconciliation",
    "invoice",
    "ledger",
    "accounting",
    "accounts payable",
    "accounts receivable"
  ],
  "industrial-maintenance-technician": [
    "maintenance technician",
    "industrial maintenance",
    "equipment repair",
    "plant maintenance",
    "field service",
    "preventive maintenance",
    "machine servicing"
  ]
} as const;

export type SeededRoleKeywordSlug = keyof typeof roleKeywords;
