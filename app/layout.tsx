import type { Metadata } from "next";
import "./globals.css";
import { DataProvider } from "@/components/DataProvider";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Naguib Selim — Sales Analytics",
  description: "Shopify sales analytics, synced automatically.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DataProvider>
          <AppShell>{children}</AppShell>
        </DataProvider>
      </body>
    </html>
  );
}
