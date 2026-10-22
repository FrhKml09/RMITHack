import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "SafeCounsel — for Peer Counselling Buddies",
  description: "Counselling notes nobody can read or open up alone. Built on TideCloak.",
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
