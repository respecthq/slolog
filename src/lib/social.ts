// SNSリンク。url が空のものはフッターに出さない（アカウントができたらここに入れるだけ）
export type Social = { key: 'x' | 'instagram' | 'youtube' | 'tiktok'; label: string; url: string };
export const SOCIALS: Social[] = [
  { key: 'x', label: 'X', url: '' },
  { key: 'instagram', label: 'Instagram', url: '' },
  { key: 'youtube', label: 'YouTube', url: '' },
  { key: 'tiktok', label: 'TikTok', url: '' },
];
// 各社の公式ブランド素材（白ロゴ）。public/editorial/assets/social/ に置く
export const SOCIAL_ICONS: Record<Social['key'], string> = {
  x: 'social/x.png',
  instagram: 'social/instagram.png',
  youtube: 'social/youtube.png',
  tiktok: 'social/tiktok.png',
};
