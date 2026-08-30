import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { AuthHeader } from "@/components/AuthHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Figma Screen Navigator",
  description:
    "Internal portal to search and inspect approved Figma screens, responsive views, states, and component behaviors.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-brandbg text-primary">
        <AuthHeader />
        {children}
      </body>
    </html>
  );
}
