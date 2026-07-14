import type { Metadata, Viewport } from "next";
import { Inter, Poppins, Manrope } from "next/font/google";
import "./globals.css";
import ErrorLogger from "@/components/ErrorLogger";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0F172A",
  viewportFit: "cover", // draw edge-to-edge when installed on notched phones
};

export const metadata: Metadata = {
  title: "SkyVoice — AI Voice Operations Platform | Skyvion Tech",
  description:
    "Enterprise-grade AI voice assistant for real-time voice-to-voice interaction, autonomous scheduling, intelligent customer support, and AI-powered operations. Built by Skyvion Tech.",
  keywords: [
    "AI voice assistant",
    "enterprise AI",
    "voice operations",
    "Skyvion Tech",
    "SkyVoice",
    "real-time AI",
    "appointment scheduling",
    "customer support AI",
  ],
  authors: [{ name: "Skyvion Tech" }],
  // PWA / Add-to-Home-Screen
  applicationName: "SkyVoice",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SkyVoice",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${poppins.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[var(--font-inter)]">
        <ErrorLogger />
        {children}
      </body>
    </html>
  );
}
