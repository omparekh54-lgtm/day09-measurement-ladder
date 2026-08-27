import './globals.css';

export const metadata = {
  title: 'Measurement Ladder',
  description: 'Marketing measurement that refuses to claim more than your data supports.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
