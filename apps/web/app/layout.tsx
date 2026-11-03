import type { Metadata } from "next";
import "@fontsource/bricolage-grotesque/500.css";
import "@fontsource/bricolage-grotesque/700.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aggregator",
  description: "The latest posts from the feeds you follow, in one place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}