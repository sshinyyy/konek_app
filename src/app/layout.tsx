import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Konek Barangay — Resident Services",
  description: "Secure online barangay document requests and QR verification.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
