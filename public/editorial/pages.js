const searchInput = document.querySelector('#machine-search');
const machineCards = [...document.querySelectorAll('.catalog-item')];
function updateSearch() {
  const query = searchInput.value.normalize('NFKC').trim().toLowerCase();
  let visible = 0;
  machineCards.forEach(card => { card.hidden = !card.dataset.search.includes(query); if (!card.hidden) visible++; });
  document.querySelector('#result-count').textContent = `${visible} 機種`;
  document.querySelector('#no-results').hidden = visible !== 0;
}
searchInput?.addEventListener('input', updateSearch);
document.querySelector('#clear-search')?.addEventListener('click', () => { searchInput.value = ''; updateSearch(); searchInput.focus(); });
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
