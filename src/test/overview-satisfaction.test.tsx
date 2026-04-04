import { describe, expect, it } from "vitest";
import { getOverviewSatisfactionSummary } from "@/pages/dashboard/Overview";
import type { StoredOrderFeedbackRecord } from "@/lib/order-feedback";

const buildRecord = (
  orderId: string,
  restaurantId: string,
  rating: number,
  createdAt: string
): StoredOrderFeedbackRecord => ({
  order_id: orderId,
  restaurant_id: restaurantId,
  rating,
  reasons: [],
  comment: null,
  created_at: createdAt,
});

describe("overview satisfaction summary", () => {
  it("hides the summary below the minimum threshold", () => {
    const summary = getOverviewSatisfactionSummary({
      feedbackRecords: [
        buildRecord("ord-1", "rest-1", 5, "2026-04-03T10:00:00.000Z"),
        buildRecord("ord-2", "rest-1", 4, "2026-04-03T11:00:00.000Z"),
        buildRecord("ord-3", "rest-1", 4, "2026-04-03T12:00:00.000Z"),
        buildRecord("ord-4", "rest-1", 5, "2026-04-03T13:00:00.000Z"),
      ],
      restaurantId: "rest-1",
      periodStart: new Date("2026-04-03T00:00:00.000Z"),
      minRatings: 5,
    });

    expect(summary).toBeNull();
  });

  it("summarizes average rating, promoter share, and count once the threshold is met", () => {
    const summary = getOverviewSatisfactionSummary({
      feedbackRecords: [
        buildRecord("ord-1", "rest-1", 5, "2026-04-03T10:00:00.000Z"),
        buildRecord("ord-2", "rest-1", 4, "2026-04-03T11:00:00.000Z"),
        buildRecord("ord-3", "rest-1", 3, "2026-04-03T12:00:00.000Z"),
        buildRecord("ord-4", "rest-1", 5, "2026-04-03T13:00:00.000Z"),
        buildRecord("ord-5", "rest-1", 4, "2026-04-03T14:00:00.000Z"),
      ],
      restaurantId: "rest-1",
      periodStart: new Date("2026-04-03T00:00:00.000Z"),
      minRatings: 5,
    });

    expect(summary).toEqual({
      count: 5,
      averageRating: 4.2,
      promoterShare: 80,
    });
  });

  it("ignores feedback from other restaurants and older periods", () => {
    const summary = getOverviewSatisfactionSummary({
      feedbackRecords: [
        buildRecord("ord-1", "rest-2", 5, "2026-04-03T10:00:00.000Z"),
        buildRecord("ord-2", "rest-1", 5, "2026-04-02T10:00:00.000Z"),
        buildRecord("ord-3", "rest-1", 4, "2026-04-03T11:00:00.000Z"),
        buildRecord("ord-4", "rest-1", 4, "2026-04-03T12:00:00.000Z"),
        buildRecord("ord-5", "rest-1", 5, "2026-04-03T13:00:00.000Z"),
        buildRecord("ord-6", "rest-1", 5, "2026-04-03T14:00:00.000Z"),
        buildRecord("ord-7", "rest-1", 4, "2026-04-03T15:00:00.000Z"),
      ],
      restaurantId: "rest-1",
      periodStart: new Date("2026-04-03T00:00:00.000Z"),
      minRatings: 5,
    });

    expect(summary).toEqual({
      count: 5,
      averageRating: 4.4,
      promoterShare: 100,
    });
  });
});
