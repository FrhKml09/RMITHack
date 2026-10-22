import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "PCB — Peer Counselling Buddies",
  description: "A student can open up to a peer, knowing no admin, IT person or app can read their story alone.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
