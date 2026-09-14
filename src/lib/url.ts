// GitHub Pages はサブパス（/slolog/）配信なので、内部リンクに base を付ける。
// Astro が自動で直すのは資産のURLだけで、href は自分で直す必要がある。
// 独自ドメインに移して base を '/' に戻しても、この関数のままで動く。
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

export const url = (path: string) => `${BASE}/${path.replace(/^\/+/, '')}`;
