export const colors = {
  bg: '#0f1020',
  surface: '#1b1d33',
  surface2: '#262a47',
  primary: '#7c5cff',
  primaryDim: '#5a45b0',
  accent: '#ff5c8a',
  text: '#f3f4fb',
  textDim: '#a6a9c8',
  online: '#34d399',
  danger: '#ef4444',
  warn: '#f59e0b',
  border: '#2e3252',
};

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 };
export const space = (n: number) => n * 4;

// 狼人杀调色板（移植自 wolfcha globals.css）：羊皮纸白天 / 血色暗夜 + 角色色。
export const wolf = {
  dayMain: '#f5f0e6',
  dayFrom: '#fdfbf7',
  dayTo: '#e6ded1',
  dark: '#1a1614',
  darkSecondary: '#2c241b',
  nightTo: '#0d0a08',
  blood: '#8a1c1c',
  bloodLight: '#b93636',
  gold: '#c5a059',
  goldDim: '#8c7335',
  parchmentText: '#3a2f25', // 白天底上的深色文字
  panelDark: 'rgba(0,0,0,0.28)',
  border: 'rgba(255,255,255,0.12)',
  role: {
    WOLF: '#8a1c1c',
    SEER: '#4a90e2',
    WITCH: '#9b59b6',
    HUNTER: '#d35400',
    VILLAGER: '#8a7866',
  } as Record<string, string>,
};
