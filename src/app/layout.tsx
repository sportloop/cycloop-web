import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Cycloop",
  icons: { icon: "favicon.svg" },
  manifest: "/site.webmanifest",
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
