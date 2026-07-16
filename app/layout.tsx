import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dongdongzou.github.io/mbti-dongdongzou/"),
  title: "InnerCompass 16｜看见你的行为偏好",
  description: "完成 DONGDONGZOU 场景对比问卷，获得包含十项生活特质、核心生活资源、消耗场景、生活使用说明与成长建议的动态分析报告。",
  openGraph: {
    title: "InnerCompass 16",
    description: "从真实选择到生活分析｜十项生活特质 · 核心资源 · 生活使用说明",
    images: [{ url: "og.png", width: 1731, height: 909, alt: "InnerCompass 16 生活分析报告" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "InnerCompass 16",
    description: "从真实选择到生活分析｜十项生活特质 · 核心资源 · 生活使用说明",
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
