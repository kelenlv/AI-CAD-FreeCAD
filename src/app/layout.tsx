import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'FastenerModel AI | 标准紧固件智能建模系统',
    template: '%s | FastenerModel AI',
  },
  description:
    '基于MinerU与大语言模型的标准紧固件智能建模系统，实现"标准文档到三维模型及属性数据"的一键式自动化转换。',
  keywords: [
    '航天',
    '标准紧固件',
    '三维建模',
    'MinerU',
    'AI建模',
    '国标解析',
    '螺栓',
    '螺母',
    '垫圈',
    '参数化建模',
  ],
  authors: [{ name: 'FastenerModel AI Team' }],
  generator: 'FastenerModel AI',
  openGraph: {
    title: 'FastenerModel AI | 标准紧固件智能建模系统',
    description: '航天标准紧固件智能建模系统 - 从标准文档到三维模型及属性数据的一键式自动化转换',
    locale: 'zh_CN',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}