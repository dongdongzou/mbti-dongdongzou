import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dongdongzou.github.io/mbti-dongdongzou/"),
  title: "InnerCompass 16｜看见你的行为偏好",
  description: "一次完成 80–120 道行为陈述题，用同意、一般、不同意看见你的行为偏好。",
  openGraph: {
    title: "InnerCompass 16",
    description: "一次完成，看见行为偏好",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "InnerCompass 16 行为偏好问卷" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "InnerCompass 16",
    description: "一次完成，看见行为偏好",
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
