import {ClerkProvider} from "@clerk/nextjs";
import CelebrationLayer from "@/components/Celebration";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "ArchIt Find — Real Estate 3D Map",
  description:
    "Find homes on a living 3D map of Chandigarh — buy, rent, explore neighborhoods in three dimensions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="h-full">
        <ClerkProvider>
          {children}
          <CelebrationLayer />
        </ClerkProvider>
      </body>
    </html>
  );
}