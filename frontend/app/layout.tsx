import type { Metadata } from "next";
import { Unbounded, Manrope, IBM_Plex_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";
import { Providers } from "./providers";
import { toIntlLocale, type AppLocale } from "@/i18n/locales";

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "ThunderaFit",
  description: "Gestão de treinos para Personal Trainers e alunos",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // i18n: locale já resolvido em i18n/request.ts (cookie, com fallback PT) —
  // usado aqui só pro atributo `lang` do <html> (acessibilidade/SEO), o
  // NextIntlClientProvider já lê o mesmo valor internamente sozinho.
  const locale = (await getLocale()) as AppLocale;

  return (
    <html
      lang={toIntlLocale(locale)}
      className={`${unbounded.variable} ${manrope.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
