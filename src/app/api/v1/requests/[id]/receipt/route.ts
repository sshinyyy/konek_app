import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { ApiError, errorResponse } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { withRlsContext } from "@/lib/rls";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError(401, "Authentication required.");
    const { id } = await context.params;
    const requestRecord = await withRlsContext(session, (tx) =>
      tx.documentRequest.findFirst({
        where: { id, residentId: session.userId },
        select: { referenceNo: true, type: true, status: true, purpose: true, submittedAt: true },
      }),
    );
    if (!requestRecord) throw new ApiError(404, "Request receipt not found.");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    page.drawText("BARANGAY SAN ISIDRO", { x: 64, y: 720, size: 18, font: bold, color: rgb(0.12, 0.25, 0.2) });
    page.drawText("DOCUMENT REQUEST RECEIPT", { x: 64, y: 684, size: 14, font: bold });
    page.drawLine({ start: { x: 64, y: 665 }, end: { x: 548, y: 665 }, thickness: 1 });
    [
      `Reference number: ${requestRecord.referenceNo}`,
      `Document: ${requestRecord.type.replaceAll("_", " ")}`,
      `Status: ${requestRecord.status.replaceAll("_", " ")}`,
      `Purpose: ${requestRecord.purpose}`,
      `Submitted: ${requestRecord.submittedAt.toLocaleString("en-PH")}`,
    ].forEach((line, index) => page.drawText(line, { x: 64, y: 626 - index * 30, size: 11, font }));
    page.drawText("Keep this receipt for your records. Track your request in the resident portal.", {
      x: 64, y: 428, size: 10, font, color: rgb(0.35, 0.39, 0.37),
    });
    const bytes = await pdf.save();
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${requestRecord.referenceNo}-receipt.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
