import type { Metadata } from "next";
import { Kanit } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { getLang } from "@/lib/i18n";

const kanit = Kanit({
  variable: "--font-kanit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Marketing Operations Control — LGD",
  description: "Marketing operations control app for LGD 2026",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${kanit.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
