import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Mi Ciudad - Sistema de gestión empresarial",
    template: "%s | Mi Ciudad - Sistema de gestión empresarial",
  },
  description:
    "Sistema de gestión empresarial para la embotelladora de agua Mi Ciudad.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
