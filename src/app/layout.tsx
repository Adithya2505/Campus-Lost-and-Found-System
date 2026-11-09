import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Campus Lost & Found",
  description: "Find it. Collect it. Get back to campus life.",
};
export const dynamic = "force-dynamic";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="footer">
          Campus Lost &amp; Found{" "}
          <span>Items are held at the campus security desk.</span>
        </footer>
      </body>
    </html>
  );
}
