// SNSリンク。url が空のものはフッターに出さない（アカウントができたらここに入れるだけ）
export type Social = { key: 'x' | 'instagram' | 'youtube' | 'tiktok'; label: string; url: string };
export const SOCIALS: Social[] = [
  { key: 'x', label: 'X', url: '' },
  { key: 'instagram', label: 'Instagram', url: '' },
  { key: 'youtube', label: 'YouTube', url: '' },
  { key: 'tiktok', label: 'TikTok', url: '' },
];
export const SOCIAL_ICONS: Record<Social['key'], string> = {
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l16 16M20 4L4 20"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 4c.5 2.6 2.4 4.3 5 4.5"/></svg>',
};
