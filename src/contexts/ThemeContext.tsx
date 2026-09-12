
import React, { useEffect, useState } from 'react';
import { ThemeContext, type Theme, type ThemeContextType } from '@/contexts/ThemeContextBase';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme;
    return saved || 'system';
  });

  // 初值必须按保存的设置解析。此前无论存的是什么都先给 'dark'，再由 effect
  // 纠正，浅色用户每次打开都会先闪一下深色。
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme') as Theme;
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const updateActualTheme = () => {
      if (theme === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setActualTheme(systemPrefersDark ? 'dark' : 'light');
      } else {
        setActualTheme(theme as 'light' | 'dark');
      }
    };

    updateActualTheme();
    localStorage.setItem('theme', theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', updateActualTheme);
      return () => mediaQuery.removeEventListener('change', updateActualTheme);
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;

    // 翻转前掐掉全站过渡，否则整页每个元素都会跑一遍 150ms 渐变，切换看起来
    // 像是没有立刻响应；而背景图不在过渡属性里会瞬间跳变，两者还不同步。
    root.classList.add('theme-switching');
    root.classList.toggle('dark', actualTheme === 'dark');

    // 连等两帧：第一帧让新样式完成布局与绘制，第二帧再恢复过渡，
    // 避免恢复得太早又把这次变更卷进动画。
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => root.classList.remove('theme-switching'));
    });

    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      root.classList.remove('theme-switching');
    };
  }, [actualTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, actualTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
