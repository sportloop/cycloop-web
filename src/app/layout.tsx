import type { Metadata, Viewport } from "next";
import { Rubik, Nunito } from "next/font/google";
import Providers from "./Providers";
import "./global.css";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-rubik",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-nunito",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://cycloop.app"),
  title: {
    default: "Cycloop — Structured Indoor Cycling",
    template: "%s | Cycloop",
  },
  description:
    "Build structured workouts, connect your smart trainer via Bluetooth, and ride with real-time power targets — all from your browser.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Cycloop — Structured Indoor Cycling",
    description:
      "Build structured workouts, connect your smart trainer via Bluetooth, and ride with real-time power targets — all from your browser.",
    siteName: "Cycloop",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Cycloop — Structured Indoor Cycling",
    description:
      "Build structured workouts, connect your smart trainer via Bluetooth, and ride with real-time power targets — all from your browser.",
  },
  applicationName: "Cycloop",
  appleWebApp: {
    capable: true,
    title: "Cycloop",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`bg-black text-white dark ${rubik.variable} ${nunito.variable}`}
    >
      <body>
        <Providers>
          <main className="min-h-screen bg-black selection:text-black selection:bg-white">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
