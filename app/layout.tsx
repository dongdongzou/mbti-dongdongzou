import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dongdongzou.github.io/mbti-dongdongzou/"),
  title: "InnerCompass 16｜看见你的行为偏好",
  description: "从 DONGDONGZOU 场景对比题库 v2.1 的 640 道原创题中完成 80、100 或 120 题，每题在两种具体反应中直觉选择，看见 32 项行为特质。",
  openGraph: {
    title: "InnerCompass 16",
    description: "场景对比题库 v2.1｜两种具体反应 · 12 秒直觉作答 · 32 项行为特质",
    images: [{ url: "og.png", width: 1731, height: 909, alt: "InnerCompass 16 场景对比问卷与动态深度报告" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "InnerCompass 16",
    description: "场景对比题库 v2.1｜两种具体反应 · 12 秒直觉作答 · 32 项行为特质",
    images: ["og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
