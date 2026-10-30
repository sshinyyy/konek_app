export type RequestDisplayStatus = "PENDING" | "IN_REVIEW" | "APPROVED" | "ISSUED" | "REJECTED";

export const requestStatusLabels: Record<RequestDisplayStatus, string> = {
  PENDING: "Awaiting review",
  IN_REVIEW: "In review",
  APPROVED: "Approved",
  ISSUED: "Issued",
  REJECTED: "Declined",
};

export function getResidentRequestNextStep(status: RequestDisplayStatus, hasRemarks: boolean): string {
  switch (status) {
    case "PENDING":
      return "Your request is waiting for staff review.";
    case "IN_REVIEW":
      return "Staff is reviewing your request.";
    case "APPROVED":
      return "Your document is being prepared.";
    case "ISSUED":
      return "Your document is ready to download.";
    case "REJECTED":
      return hasRemarks
        ? "Review the staff note below for next steps."
        : "Contact the barangay office for next steps.";
  }
}
