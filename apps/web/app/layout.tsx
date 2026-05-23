import type { Metadata } from "next"
import { JetBrains_Mono, Geist } from "next/font/google"
import "./globals.css"
import { Providers } from "@/app/components/providers"
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
})

export const metadata: Metadata = {
  title: "PDF Chatbot",
  description: "Chat with your PDF documents",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="font-mono bg-dark text-green-accent antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
