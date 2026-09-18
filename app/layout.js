import "./globals.css";

export const metadata = {
  title: "I-REIM — India River Encroachment Intelligence",
  description: "GIS intelligence platform for potential river-corridor encroachment.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}