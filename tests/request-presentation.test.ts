import { describe, expect, it } from "vitest";
import { getResidentRequestNextStep, requestStatusLabels } from "@/lib/request-presentation";

describe("request presentation", () => {
  it("uses consistent, readable labels for request statuses", () => {
    expect(requestStatusLabels).toEqual({
      PENDING: "Awaiting review",
      IN_REVIEW: "In review",
      APPROVED: "Approved",
      ISSUED: "Issued",
      REJECTED: "Declined",
    });
  });

  it("shows residents the next step for each request status", () => {
    expect(getResidentRequestNextStep("PENDING", false)).toBe("Your request is waiting for staff review.");
    expect(getResidentRequestNextStep("IN_REVIEW", false)).toBe("Staff is reviewing your request.");
    expect(getResidentRequestNextStep("APPROVED", false)).toBe("Your document is being prepared.");
    expect(getResidentRequestNextStep("ISSUED", false)).toBe("Your document is ready to download.");
    expect(getResidentRequestNextStep("REJECTED", true)).toBe("Review the staff note below for next steps.");
    expect(getResidentRequestNextStep("REJECTED", false)).toBe("Contact the barangay office for next steps.");
  });
});
