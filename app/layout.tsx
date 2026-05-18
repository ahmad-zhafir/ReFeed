import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "ReFeed",
  description: "Connect local food generators with farmers in real-time to reduce food waste",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..900,0..100,0..1&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--rf-moss)',
              color: 'var(--rf-bone)',
              borderRadius: '14px',
              padding: '14px 18px',
              fontFamily: "'Fraunces', serif",
              fontSize: '15px',
              letterSpacing: '-0.01em',
              boxShadow: '0 20px 50px -10px rgba(0,0,0,0.55)',
              border: '1px solid rgba(241,234,216,0.12)',
            },
            success: {
              iconTheme: { primary: 'var(--rf-sap)', secondary: 'var(--rf-forest)' },
              style: { borderLeft: '3px solid var(--rf-sap)' },
            },
            error: {
              iconTheme: { primary: 'var(--rf-rust)', secondary: 'var(--rf-bone)' },
              style: { borderLeft: '3px solid var(--rf-rust)' },
            },
          }}
        />
      </body>
    </html>
  );
}

