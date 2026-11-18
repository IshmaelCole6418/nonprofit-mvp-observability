import test from "node:test";
import assert from "node:assert/strict";
import { buildCampaignReport, checkoutRequest } from "./receipt_service.ts";

test("a valid checkout queues one receipt and one volunteer reminder", () => {
  const input = checkoutRequest.parse({
    donorId: "donor-17",
    donorEmail: "donor@example.org",
    amountCents: 2500,
    campaign: "winter pantry",
    volunteerId: "volunteer-4",
    reminderAt: "2026-11-01T09:00:00.000Z"
  });
  assert.deepEqual(buildCampaignReport(input), {
    campaign: "winter pantry",
    receipt: { donorId: "donor-17", amountCents: 2500, status: "queued" },
    volunteerReminder: { volunteerId: "volunteer-4", at: "2026-11-01T09:00:00.000Z" },
    report: { donations: 1, amountCents: 2500 }
  });
});
