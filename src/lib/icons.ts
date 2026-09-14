// アイコンは Lucide の実データを使う（自作の似せSVGをやめた）。
// 小役カウンタだけはアプリと同じ自作チェリー（lib/widgets/cherry_icon.dart の移植）。
import chartColumn from 'lucide-static/icons/chart-column.svg?raw';
import chartLine from 'lucide-static/icons/chart-line.svg?raw';
import fileText from 'lucide-static/icons/file-text.svg?raw';
import history from 'lucide-static/icons/history.svg?raw';
import notebookPen from 'lucide-static/icons/notebook-pen.svg?raw';
import store from 'lucide-static/icons/store.svg?raw';
import timer from 'lucide-static/icons/timer.svg?raw';
import search from 'lucide-static/icons/search.svg?raw';
import scale from 'lucide-static/icons/scale.svg?raw';
import chevronRight from 'lucide-static/icons/chevron-right.svg?raw';
import chevronDown from 'lucide-static/icons/chevron-down.svg?raw';
import chevronLeft from 'lucide-static/icons/chevron-left.svg?raw';
import externalLink from 'lucide-static/icons/external-link.svg?raw';

/// アプリの CherryIcon と同じ座標（lib/widgets/cherry_icon.dart・2026-09-06 第5版）
// アプリ側は 24px の枠に 1.0〜24.3 の絵柄を描くので、Lucide（2〜22に収まる）と
// 並べると一回り大きく見える。viewBox を 27.8 に広げて余白を作り、絵柄20.1px・線2.0px と
// Lucide（20px・2px）を揃える。線幅もその比率（2 × 27.8/24 ≒ 2.3）に上げてある。
// 左の実だけ太いのはアプリと同じ理由（円は同じ線幅でも細く見えるので 0.4 足す）。
// width/height を必ず持たせる。Astro のスコープCSSは set:html で挿した要素に効かない。
const cherry = `<svg width="24" height="24" viewBox="-1.25 -1.9 27.8 27.8" fill="none"
  stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
  <path d="M13.6 3.9C11.3 3.7 8.8 3.9 6.9 4.7"/>
  <path d="M13.1 3.9C14.7 3.4 16.3 2.8 17.5 1.9"/>
  <path d="M12.6 15.1C13 13.8 13.9 12.8 15.1 12c2.7-1.6 6.2-.6 7.7 2.1s.6 6.2-2.1 7.7-6.2.6-7.7-2.1"/>
  <path d="M13.6 5.3c-.2-1.5-.6-2-1.8-3.2-2-1.3-5.1-1.4-6.3 0-1.1 1.3-1.8 2.4-4 2.7h-.3c-.2.2-.2.5 0 .7 1.2.9 2.4 1.6 3.8 2.3 3.1 1.4 7 0 8.6-2.7"/>
  <path d="M13.4 4.8c1.6 2.6 3.5 6.3 3.6 8.3"/>
  <path d="M8.3 13.7c1.4-1.6 2-3.9 2.5-6.1"/>
  <circle cx="7.1" cy="17.3" r="5.7" stroke-width="2.8"/>
</svg>`;

export const icons: Record<string, string> = {
  chartColumn, chartLine, fileText, history, notebookPen, store, timer, search, cherry,
  chevronRight, chevronDown, chevronLeft, externalLink, scale,
};

/** リンクの末尾に置く小さなアイコン。
 *  アプリと同じ使い分け：サイト内の遷移は chevronRight、外部サイトを開くものは externalLink。
 *  Astro のスコープCSSは set:html で挿した中身に効かないので、大きさはSVGの属性へ焼き込む。
 *  色は stroke="currentColor" なので親の文字色を継がせる。 */
export const inlineIcon = (name: 'chevronRight' | 'chevronDown' | 'chevronLeft' | 'externalLink', size = 15) =>
  icons[name].replace(/width="\d+"/, `width="${size}"`).replace(/height="\d+"/, `height="${size}"`);
