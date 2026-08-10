import type { Metadata } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import "./globals.css";
const display = Cormorant_Garamond({ variable: "--font-display", subsets: ["latin"], weight: ["400","500","600","700"] });
const sans = Montserrat({ variable: "--font-sans", subsets: ["latin"], weight: ["400","500","600","700"] });
export const metadata: Metadata = { title: "SPA Express Cambucás", description: "Beleza, cuidado e bem-estar. Agende seu momento no SPA Express Cambucás.", other:{"codex-preview":"development"} };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body className={`${display.variable} ${sans.variable}`}>{children}</body></html>}
