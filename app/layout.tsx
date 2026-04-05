import type { Metadata } from 'next';
import { Black_Ops_One, Special_Elite } from 'next/font/google';
import './globals.css';

const blackOpsOne = Black_Ops_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-black-ops',
});

const specialElite = Special_Elite({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-special-elite',
});

export const metadata: Metadata = {
  title: "Peck's Per Nine — Baseball Trivia",
  description: "Vintage baseball trivia — test your knowledge of the golden age of America's pastime",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${blackOpsOne.variable} ${specialElite.variable} bg-[#0a0a0f] text-white min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
