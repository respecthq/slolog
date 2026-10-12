const asset = name => new URL('./assets/' + name, import.meta.url).href;
const content = {
  record: { label: '実戦記録 / FREE', title: '打った結果も、\nその日の気づきも。', description: '投資と回収を入力すれば、収支を自動計算。写真、立ち回りタグ、メモも一緒に残せるから、数字だけでは見えない実戦の中身まで振り返れます。', list: ['機種・ホール・レートを選んで記録', '台ごとの収支が分からない日は、複数機種をまとめて記録', '写真とメモを、その日の実戦に添付'], word: 'RECORD', alt: '機種やホールを選び、投資・回収とメモを入力する実戦記録画面' },
  ev: { label: '期待値表 / PRO', title: '自分の表で、\n自分の基準を。', description: '信頼する期待値表を取り込んで、基準金額「マイボーダー」を設定。打ち始めゲーム数の期待値や、基準を満たす狙い目ゲーム数の目安を確認できます。', list: ['表を貼り付け、またはファイルから取り込み', '対応する表なら、ホールの交換率・貸メダルに合わせて換算', '実在機種の期待値表は、ご自身で用意', '架空のサンプル機種では、見本の表をProなしで体験'], word: 'THINK', alt: '取り込んだ期待値表から、期待値と狙い目ゲーム数の目安を確認する画面' },
  graph: { label: '収支グラフ・基本の集計 / FREE', title: '収支の流れを、\nひと目でつかむ。', description: '日々の収支はカレンダーで。積み重ねた結果はスランプグラフで。機種やホール、曜日、タグを切り口に、自分の実戦を見返せます。', list: ['グラフをなぞって、その日の結果を確認', '棒グラフから、年 → 月 → 日へ掘り下げ', '勝率・稼働時間・実戦時給もまとめて確認'], word: 'REVIEW', alt: '日ごとの収支と累積収支の流れを確認する収支グラフ画面' }
};
const tabs = [...document.querySelectorAll('[data-feature]')];
function selectFeature(tab) {
  const data = content[tab.dataset.feature];
  tabs.forEach(button => { const selected = button === tab; button.setAttribute('aria-selected', selected); button.tabIndex = selected ? 0 : -1; });
  document.querySelector('#feature-panel').setAttribute('aria-labelledby', tab.id);
  document.querySelector('#feature-label').textContent = data.label;
  document.querySelector('#feature-title').replaceChildren(...data.title.split('\n').flatMap((line, index) => index ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
  document.querySelector('#feature-description').textContent = data.description;
  document.querySelector('#feature-list').replaceChildren(...data.list.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
  document.querySelector('#screen-word').textContent = data.word;
  const image = document.querySelector('#feature-image');
  image.src = asset(`${tab.dataset.feature}.webp`); image.alt = data.alt;
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectFeature(tab));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectFeature(tabs[next]); tabs[next].focus();
  });
});
document.querySelectorAll('[data-billing]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-billing]').forEach(item => item.setAttribute('aria-pressed', item === button));
  const annual = button.dataset.billing === 'year';
  document.querySelector('#pro-price').textContent = annual ? '¥3,800' : '¥480';
  document.querySelector('#pro-period').textContent = annual ? '/ 年（税込）' : '/ 月（税込）';
}));
const menu = document.querySelector('.menu-button');
const nav = document.querySelector('#navigation');
function closeMenu() { menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'メニューを開く'); menu.querySelector('img').src = asset('menu.svg'); nav.classList.remove('is-open'); }
menu.addEventListener('click', () => {
  if (menu.getAttribute('aria-expanded') === 'true') return closeMenu();
  menu.setAttribute('aria-expanded', 'true'); menu.setAttribute('aria-label', 'メニューを閉じる'); menu.querySelector('img').src = asset('x.svg'); nav.classList.add('is-open');
});
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); } });
