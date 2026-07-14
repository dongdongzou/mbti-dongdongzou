import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dongdongzou.github.io/mbti-dongdongzou/"),
  title: "InnerCompass 16｜看见你的行为偏好",
  description: "从 640 道原创情境题中完成 80、100 或 120 题，用 8 秒直觉作答看见 32 项行为特质与动态深度报告。",
  openGraph: {
    title: "InnerCompass 16",
    description: "一次完成，看见行为逻辑｜640 道原创情境题 · 32 项行为特质",
    images: [{ url: "og.png", width: 1536, height: 1024, alt: "InnerCompass 16 行为偏好问卷与动态深度报告" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "InnerCompass 16",
    description: "一次完成，看见行为逻辑｜640 道原创情境题 · 32 项行为特质",
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
