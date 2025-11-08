import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SubFinder Pro - Bug Bounty Subdomain Tool',
  description: 'Advanced subdomain enumeration tool for bug bounty hunters',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
