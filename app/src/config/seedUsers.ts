// Dev user-picker (mock auth). Mirrors backend seed profiles (BuildSpec §11).
export const SEED_USERS: { id: string; label: string; flag: string }[] = [
  { id: 'seed_male_01', label: 'Wei 魏 · 中文 · 男', flag: '🇨🇳' },
  { id: 'seed_female_01', label: 'María · Español · 女', flag: '🇲🇽' },
  { id: 'seed_female_02', label: 'Emily · English · 女', flag: '🇺🇸' },
  { id: 'seed_female_03', label: 'Layla · العربية · 女 (offline)', flag: '🇦🇪' },
];
