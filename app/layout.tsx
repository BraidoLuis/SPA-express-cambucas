import type { Metadata } from "next";
import { CookieBanner } from "./components/shared/cookie-banner";
import { Montserrat, Playfair_Display } from "next/font/google";
import "./globals.css";

const siteUrl = "https://www.spaexpresscambucas.com.br";

const title =
  "SPA Express Cambucás | Massagem e Estética em Guapimirim";

const description =
  "Massagens, estética e cuidados de bem-estar em Guapimirim. Conheça os serviços do SPA Express Cambucás e agende seu horário online.";

const daySpaJsonLd = {
  "@context": "https://schema.org",
  "@type": "DaySpa",
  "@id": `${siteUrl}/#day-spa`,

  name: "SPA Express Cambucás",
  description,
  url: siteUrl,

  logo: `${siteUrl}/logo-spa.png`,
  image: `${siteUrl}/logo-spa.png`,

  telephone: "+5521971621509",

  address: {
    "@type": "PostalAddress",
    streetAddress: "Av. Dedo de Deus, 1200 - Centro",
    addressLocality: "Guapimirim",
    addressRegion: "RJ",
    postalCode: "25940-000",
    addressCountry: "BR",
  },

  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: [
      "https://schema.org/Monday",
      "https://schema.org/Tuesday",
      "https://schema.org/Wednesday",
      "https://schema.org/Thursday",
      "https://schema.org/Friday",
      "https://schema.org/Saturday",
    ],
    opens: "08:00",
    closes: "20:00",
  },

  sameAs: [
    "https://www.facebook.com/p/Spa-Express-cambucas-100063744964224/",
    "https://www.instagram.com/estetica.spa.express/",
  ],

  areaServed: {
    "@type": "City",
    name: "Guapimirim",
  },

  currenciesAccepted: "BRL",
};

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
  metadataBase: new URL(siteUrl),

  title: {
    default: title,
    template: "%s | SPA Express Cambucás",
  },

  description,
  applicationName: "SPA Express Cambucás",

  icons: {
    icon: [
      {
        url: "/favicon.png",
        type: "image/png",
        sizes: "500x500",
      },
    ],
    shortcut: "/favicon.png",
    apple: [
      {
        url: "/favicon.png",
        type: "image/png",
        sizes: "500x500",
      },
    ],
  },

  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: siteUrl,
    siteName: "SPA Express Cambucás",
    title,
    description,
    images: [
      {
        url: "/logo-spa.png",
        alt: "SPA Express Cambucás",
      },
    ],
  },

  twitter: {
    card: "summary",
    title,
    description,
    images: ["/logo-spa.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(daySpaJsonLd).replace(/</g, "\\u003c"),
          }}
        />

        {children}
        <CookieBanner />
      </body>
    </html>
  );
}