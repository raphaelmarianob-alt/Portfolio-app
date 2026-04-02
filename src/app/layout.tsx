import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portfolio Manager",
  description: "Family Office - Gestão de Carteiras",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full flex bg-[#0a0a0f]">
        <Sidebar />
        <main className="flex-1 ml-[250px] p-8 overflow-auto min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
