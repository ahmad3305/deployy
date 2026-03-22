import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Jaahhaazz',
  description: 'Frontend',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Favicon */}
        <link rel="icon" href="/logo/airport-location-icon-logo-set-vector_1223784-8073.ico" sizes="any" />
        {/* For PNG: <link rel="icon" type="image/png" href="/logo/your-image.png" /> */}
        {/* You can add more sizes/types for Apple/Android if needed */}
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}