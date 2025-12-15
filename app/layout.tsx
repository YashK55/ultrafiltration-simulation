import "./globals.css";

export const metadata = {
  title: "Ultrafiltration Simulation",
  description: "Advanced Analytical Techniques – Ultrafiltration Model",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
