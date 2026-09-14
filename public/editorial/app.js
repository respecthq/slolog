const asset = name => new URL('./assets/' + name, import.meta.url).href;
const content = {
  record: { label: '実戦記録 / FREE', title: '打ったら、\nさっと残そう。', description: '投資・回収・打ち始めG数・稼働時間をひとまとめ。写真や気づきも、その日の記録に。', list: ['収支は入力した投資・回収から自動計算', '機種・店舗・タグで整理', 'カレンダーで、日ごとの収支を確認'], word: 'RECORD', alt: '投資と回収を入力する実戦記録画面' },
  ev: { label: '期待値メモ / 1機種無料', title: '自分の基準で、\n狙い目を決める。', description: '信頼する期待値表を取り込んで、マイボーダーを設定。その基準を超える狙い目G数を逆引きできます。', list: ['表を貼り付け、またはファイルから取込', '2つ以上のレート列がある表なら換金率を換算', '実在機種の期待値表は同梱していません'], word: 'THINK', alt: '換金率とマイボーダーから狙い目G数を表示する期待値メモ画面' },
  graph: { label: '収支分析 / FREE', title: '数字の動きに、\n気づきがある。', description: '1日ごとの記録が、自分だけのグラフに。収支だけでなく、時給や稼働時間も振り返れます。', list: ['累積収支と日ごとの収支を確認', '機種・店舗・タグ・曜日別に分析', 'マイボーダー以上・未満の比較はProで'], word: 'REVIEW', alt: '日ごとの収支と累積収支が見えるグラフ画面' }
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
