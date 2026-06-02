import './globals.css';
import AppProviders from '../components/AppProviders';

export const metadata = {
  title: 'Chatvora - Modern Real-Time Messenger',
  description: 'Chatvora - Modern Real-Time Messenger',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
      { url: '/icons/icon-192x192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icons/icon-512x512.png', type: 'image/png', sizes: '512x512' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Chatvora',
    startupImage: '/icons/icon-512x512.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#0b0e14',
    'msapplication-TileImage': '/icons/icon-192x192.png',
  },
  applicationName: 'Chatvora',
  generator: 'Chatvora',
  referrer: 'origin-when-cross-origin',
  keywords: ['chat', 'messaging', 'real-time', 'chatvora'],
  authors: [{ name: 'Chatvora' }],
  formatDetection: {
    telephone: true,
    email: true,
    address: false,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0b0e14',
  colorScheme: 'dark',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Chatvora" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
        <link rel="mask-icon" href="/icons/icon.svg" color="#0b0e14" />
        <meta name="msapplication-TileColor" content="#0b0e14" />
        <meta name="msapplication-TileImage" content="/icons/icon-192x192.png" />
        <meta name="theme-color" content="#0b0e14" />
        <meta name="application-name" content="Chatvora" />
      </head>
      <body>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
