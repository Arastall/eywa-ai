import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Eywa AI - Hotel Revenue Intelligence",
  description: "The neural network connecting your hotel to infinite possibilities",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} text-white antialiased`}>
        <div className="particles" />
        <div className="neural-lines" />
        {children}
      </body>
    </html>
  );
}
