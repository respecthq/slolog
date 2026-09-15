// 公式SNS。スロログは回胴キナナのアカウントで発信する（LPの「powered by 回胴キナナ」と同じ線）。
// url が空のものはフッターに出さない。計測パラメータ（?_t= / ?s= / ?stkn= など）は必ず外して入れる
export type Social = { key: 'x' | 'instagram' | 'youtube' | 'tiktok'; label: string; url: string };
export const SOCIALS: Social[] = [
  { key: 'x', label: '回胴キナナ公式X', url: 'https://x.com/kinana_kaido' },
  { key: 'instagram', label: '回胴キナナ公式Instagram', url: 'https://www.instagram.com/kinana_kaido/' },
  { key: 'youtube', label: '回胴キナナ公式YouTube', url: 'https://www.youtube.com/@KinanaKaido' },
  { key: 'tiktok', label: '回胴キナナ公式TikTok', url: 'https://www.tiktok.com/@kinana_kaido' },
];
// 各社の公式ブランド素材（白ロゴ）。public/editorial/assets/social/ に置く
export const SOCIAL_ICONS: Record<Social['key'], string> = {
  x: 'social/x.png',
  instagram: 'social/instagram.png',
  youtube: 'social/youtube.png',
  tiktok: 'social/tiktok.png',
};
