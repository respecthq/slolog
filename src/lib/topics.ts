// ホームの TOPICS（2026-10-30〜）。機種ページへの入口。上から順に並べる。
// 画像はメーカー提供の素材を加工せずにレイアウトしたバナー（大都＝Dコレ：素材ガイドどおり・LP だけ／北電子＝権利表記つき・改変なし）。
// 「新台・注目機種」としてメーカーの機種の紹介に使う（スロログの宣伝には使わない。2026-10-30 ユーザー判断）。
// 権利表記は画像の中に入っている。サミー・SANKYO・パイオニアなど画像の許諾がないメーカーの機種は載せない。
// text は機種ページに載っている事実だけ（公式の出典があるもの）。導入日は機種 md の released から自動で出す。
export type Topic = {slug: string; image: string; title: string; text: string};

export const topics: Topic[] = [
  {slug: 'bancho-banduke', image: 'images/topics/bancho-banduke.png', title: '押忍！番長番付', text: '設定別のスペック・天井・PVを掲載'},
  {slug: 'vivy', image: 'images/topics/vivy.png', title: 'スロット Vivy', text: '機械割・天井・リール配列を掲載'},
  {slug: 'myjuggler6', image: 'images/topics/myjuggler6.png', title: 'マイジャグラーVI', text: '設定別のボーナス確率・リール配列。専用カウンターに対応'},
  // ライザのアトリエは北電子の監修（約3営業日）が済んでから足す（先方の条件。2026-10-30 時点で監修待ち）
  // {slug: 'ryza-atelier', image: 'images/topics/ryza-atelier.png', title: 'ライザのアトリエ', text: '常闇の女王と秘密の隠れ家。導入時期とPVを掲載'},
];
