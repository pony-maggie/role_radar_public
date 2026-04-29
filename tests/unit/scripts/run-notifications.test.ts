import { describe, expect, it, vi } from "vitest";

const send = vi.fn().mockResolvedValue({ messageId: "smtp-123" });
const listPendingDispatches = vi.fn().mockResolvedValue([
  {
    id: "dispatch-1",
    email: "analyst@example.com",
    kind: "WEEKLY_DIGEST",
    payload: {
      kind: "weekly_digest",
      email: "analyst@example.com",
      windowStart: "2026-04-06T00:00:00.000Z",
      windowEnd: "2026-04-13T00:00:00.000Z",
      roles: []
    }
  }
]);
const markDispatchSent = vi.fn().mockResolvedValue(undefined);
const markDispatchFailed = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/email/mailer", () => ({
  createMailer: () => ({ send })
}));

vi.mock("@/lib/repositories/notifications", () => ({
  listPendingDispatches,
  markDispatchSent,
  markDispatchFailed,
  queueDueNotifications: vi.fn().mockResolvedValue(0)
}));

describe("run-notifications", () => {
  it("marks successful sends as smtp deliveries", async () => {
    const { processPendingDispatches } = await import("@/scripts/run-notifications");

    await processPendingDispatches({
      limit: 20
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(markDispatchSent).toHaveBeenCalledWith({
      dispatchId: "dispatch-1",
      deliveryMode: "smtp",
      previewPath: null
    });
  });
});
