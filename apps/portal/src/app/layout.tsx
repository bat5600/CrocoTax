import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrocoTax Portal",
  description: "Real-time invoice compliance and delivery visibility.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
