import { describe, expect, it } from "vitest";
import { canAccessSupportingDocument } from "@/lib/upload-access";

describe("supporting document ownership", () => {
  it("allows the owner and authorized staff, but not another resident", () => {
    expect(canAccessSupportingDocument("resident-1", "resident-1", "RESIDENT")).toBe(true);
    expect(canAccessSupportingDocument("resident-2", "resident-1", "RESIDENT")).toBe(false);
    expect(canAccessSupportingDocument("staff-1", "resident-1", "STAFF")).toBe(true);
    expect(canAccessSupportingDocument("admin-1", "resident-1", "ADMIN")).toBe(true);
  });
});
