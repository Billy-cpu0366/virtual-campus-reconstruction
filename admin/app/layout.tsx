import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "校园运营平台", description: "校园配置与内容运营后台" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
