import "./globals.css";

export const metadata = {
  title: "NVIDIA NIM Chat",
  description: "GPT-like chat UI for NVIDIA NIM",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="dark min-h-screen">{children}</body>
    </html>
  );
}
