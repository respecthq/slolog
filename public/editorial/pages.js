const searchInput = document.querySelector('#machine-search');
const machineCards = [...document.querySelectorAll('.catalog-item')];
const pager = document.querySelector('#pager');
const PER_PAGE = 12;
let page = Math.max(1, parseInt(new URLSearchParams(location.search).get('page'), 10) || 1);
// 検索で絞った結果を 12 件ずつに分ける。JS が動かないときは全件がそのまま並ぶ
function render({ scroll = false } = {}) {
  if (!machineCards.length) return;
  const query = (searchInput?.value ?? '').normalize('NFKC').trim().toLowerCase();
  const hits = machineCards.filter(card => card.dataset.search.includes(query));
  const pages = Math.max(1, Math.ceil(hits.length / PER_PAGE));
  page = Math.min(page, pages);
  machineCards.forEach(card => { card.hidden = true; });
  hits.slice((page - 1) * PER_PAGE, page * PER_PAGE).forEach(card => { card.hidden = false; });
  document.querySelector('#result-count').innerHTML = `<b>${hits.length}</b> 機種`;
  document.querySelector('#no-results').hidden = hits.length !== 0;
  pager.hidden = pages <= 1;
  pager.innerHTML = pages <= 1 ? '' : [
    `<button type="button" data-page="${page - 1}" aria-label="前のページ" ${page === 1 ? 'disabled' : ''}>‹</button>`,
    ...Array.from({ length: pages }, (_, i) => i + 1).map(n =>
      `<button type="button" data-page="${n}" ${n === page ? 'aria-current="page"' : ''}>${n}</button>`),
    `<button type="button" data-page="${page + 1}" aria-label="次のページ" ${page === pages ? 'disabled' : ''}>›</button>`,
  ].join('');
  const u = new URL(location.href);
  if (page > 1) u.searchParams.set('page', page); else u.searchParams.delete('page');
  history.replaceState(null, '', u);
  if (scroll) document.querySelector('.catalog-heading')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
pager?.addEventListener('click', e => {
  const b = e.target.closest('button[data-page]');
  if (!b || b.disabled) return;
  page = Number(b.dataset.page); render({ scroll: true });
});
searchInput?.addEventListener('input', () => { page = 1; render(); });
document.querySelector('#clear-search')?.addEventListener('click', () => { searchInput.value = ''; page = 1; render(); searchInput.focus(); });
render();
const copyButton = document.querySelector('#copy-spec');
copyButton?.addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try {
    await navigator.clipboard.writeText(document.querySelector('#machine-spec').textContent);
    status.textContent = 'コピーしました。アプリの「機種を取り込む」に貼り付けてください。';
  } catch {
    status.textContent = '自動コピーが使えません。下の欄から手動でコピーできます。';
    document.querySelector('#copy-fallback').hidden = false;
    const field = document.querySelector('#manual-spec');
    field.focus(); field.select();
  }
});

// 「スロログに登録」：iPhone だけ出す（PC・Android ではアプリを開けないのでコピーの手順だけ見せる）。
// 自動で App Store へは移らない（「“スロログ”で開きますか？」が出ている間もページは見えているので、
// 自動で移すと「開く」を押す前に App Store へ飛んでしまう）。少し待っても画面が残っていたら、App Store へのリンクを出すだけにする
const openBtn = document.querySelector('#open-in-app');
if (openBtn) {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) {
    document.querySelector('.deeplink-block').hidden = false;
    document.querySelectorAll('.deeplink-only').forEach((el) => { el.hidden = false; });
    document.querySelector('#copy-spec')?.classList.remove('primary');
    const storeHint = document.querySelector('#deeplink-store');
    openBtn.addEventListener('click', () => {
      setTimeout(() => { if (!document.hidden && storeHint) storeHint.hidden = false; }, 2500);
    });
  }
}
