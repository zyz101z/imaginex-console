import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.imaginex.games"),
  title: "ImagineX — Play Amazing Web Games",
  description:
    "ImagineX is a free web gaming console. Play Tennis World, Bloot, Froggo Adventure, Divided States and more — right in your browser, no downloads.",
  openGraph: {
    type: "website",
    url: "https://www.imaginex.games",
    siteName: "ImagineX",
    title: "ImagineX — Play Amazing Web Games",
    description:
      "A free web gaming console. Play Tennis World, Bloot, Froggo Adventure, Divided States and more — right in your browser.",
    images: [
      { url: "/og-image.png", width: 1200, height: 630, alt: "ImagineX — web gaming console" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ImagineX — Play Amazing Web Games",
    description:
      "A free web gaming console. Play Tennis World, Bloot, Froggo, Divided States and more — in your browser.",
    images: ["/og-image.png"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-screen overflow-hidden flex flex-col">
        {children}
      </body>
    </html>
  );
}
