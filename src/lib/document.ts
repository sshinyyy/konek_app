import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { encrypt } from "@/lib/crypto";
import { ApiError } from "@/lib/api";
import type { DocumentType } from "@prisma/client";
import { downloadObject } from "@/lib/storage";

const labels: Record<DocumentType, string> = {
  BARANGAY_CLEARANCE: "BARANGAY CLEARANCE",
  CERTIFICATE_OF_RESIDENCY: "CERTIFICATE OF RESIDENCY",
  BARANGAY_ID: "BARANGAY IDENTIFICATION",
};

function wrapText(text: string, font: Awaited<ReturnType<PDFDocument["embedFont"]>>, size: number, maxWidth: number) {
  const lines: string[] = [];
  let current = "";
  for (const word of text.trim().split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function embedCertificateImage(
  pdf: PDFDocument,
  objectKey: string,
  label: "seal" | "signature",
) {
  const bytes = await downloadObject(objectKey);
  try {
    return await pdf.embedPng(bytes);
  } catch {
    throw new ApiError(
      409,
      `The saved official ${label} is not a valid PNG. Upload a valid PNG image and save certificate settings again.`,
    );
  }
}

export async function renderCertificate(input: {
  type: DocumentType;
  referenceNo: string;
  recipientName: string;
  address: string;
  purpose: string;
  issuedAt: Date;
  validUntil: Date;
  verifyUrl: string;
  barangayName: string;
  municipality: string;
  province: string;
  captainName: string;
  sealObjectKey: string | null;
  signatureObjectKey: string | null;
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const qr = await QRCode.toDataURL(input.verifyUrl, { errorCorrectionLevel: "H", margin: 1, width: 220 });
  const qrImage = await pdf.embedPng(qr);
  const seal = input.sealObjectKey
    ? await embedCertificateImage(pdf, input.sealObjectKey, "seal")
    : null;
  const signature = input.signatureObjectKey
    ? await embedCertificateImage(pdf, input.signatureObjectKey, "signature")
    : null;

  page.drawRectangle({
    x: 28, y: 28, width: 556, height: 736,
    borderColor: rgb(0.13, 0.31, 0.25), borderWidth: 2,
  });
  page.drawText("REPUBLIC OF THE PHILIPPINES", {
    x: 166, y: 720, size: 11, font: regular, color: rgb(0.3, 0.35, 0.32),
  });
  page.drawText("OFFICE OF THE PUNONG BARANGAY", {
    x: 135, y: 700, size: 13, font: bold, color: rgb(0.12, 0.25, 0.2),
  });
  page.drawText(`${input.barangayName.toUpperCase()}  ·  ${input.municipality.toUpperCase()}, ${input.province.toUpperCase()}`, {
    x: 135, y: 680, size: 8, font: regular, color: rgb(0.3, 0.35, 0.32),
  });
  if (seal) page.drawImage(seal, { x: 72, y: 674, width: 46, height: 46 });
  page.drawLine({ start: { x: 72, y: 658 }, end: { x: 540, y: 658 }, thickness: 1, color: rgb(0.13, 0.31, 0.25) });
  page.drawText(labels[input.type], {
    x: 70, y: 612, size: 19, font: bold, color: rgb(0.12, 0.25, 0.2),
  });
  page.drawText(`REFERENCE NO.  ${input.referenceNo}`, {
    x: 70, y: 586, size: 10, font: bold, color: rgb(0.35, 0.39, 0.37),
  });
  page.drawText("TO WHOM IT MAY CONCERN:", { x: 70, y: 526, size: 12, font: bold });
  const lines = wrapText(
    `This is to certify that ${input.recipientName} is a resident of ${input.address}. This certification is issued upon request for ${input.purpose}.`,
    regular,
    12,
    470,
  );
  const textTop = 510;
  lines.forEach((line, index) =>
    page.drawText(line, { x: 70, y: textTop - index * 18, size: 12, font: regular }),
  );
  const issueLineY = textTop - lines.length * 18 - 8;
  page.drawText(
    `Issued on ${input.issuedAt.toLocaleDateString("en-PH")} · Valid until ${input.validUntil.toLocaleDateString("en-PH")}`,
    { x: 70, y: issueLineY, size: 10, font: regular },
  );
  page.drawImage(qrImage, { x: 70, y: 112, width: 108, height: 108 });
  page.drawText("Scan to verify this document", { x: 66, y: 98, size: 8, font: regular });
  page.drawText("PUNONG BARANGAY", { x: 380, y: 148, size: 9, font: bold });
  page.drawLine({ start: { x: 352, y: 162 }, end: { x: 520, y: 162 }, thickness: 0.8 });
  if (signature) page.drawImage(signature, { x: 376, y: 192, width: 120, height: 48 });
  for (const [index, line] of wrapText(input.captainName.toUpperCase(), bold, 8, 168).slice(0, 2).entries()) {
    page.drawText(line, { x: 380, y: 176 - index * 9, size: 8, font: bold });
  }
  page.drawText(input.referenceNo, { x: 70, y: 55, size: 8, font: regular, color: rgb(0.35, 0.39, 0.37) });

  return { bytes: await pdf.save(), recipientNameEncrypted: encrypt(input.recipientName) };
}
