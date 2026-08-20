import type { Metadata } from "next";
import { Montserrat, Playfair_Display } from "next/font/google";
import "./globals.css";

const display = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const sans = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SPA Express Cambucás",
  description:
    "Beleza, cuidado e bem-estar. Agende seu momento no SPA Express Cambucás.",

  icons: {
    icon: "/logo-spa.png",
    shortcut: "/logo-spa.png",
    apple: "/logo-spa.png",
  },

  other: {
    "codex-preview": "development",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${display.variable} ${sans.variable}`}>
        {children}
      </body>
    </html>
  );
}