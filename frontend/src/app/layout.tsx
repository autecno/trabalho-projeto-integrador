import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Autecno",
  description: "Plataforma de autoescola.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <head>
        <meta charSet="UTF-8" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
