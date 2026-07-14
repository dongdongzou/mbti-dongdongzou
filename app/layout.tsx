import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InnerCompass 16｜看见你的行为偏好",
  description: "从生活与关系场景，看见你的行为偏好。原创、非官方、仅保存在本机的人格偏好探索工具。",
  openGraph: {
    title: "InnerCompass 16",
    description: "从生活与关系场景，看见你的行为偏好",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
