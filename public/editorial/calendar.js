// 新台カレンダー（Astra の calendar-v1 を LP 用に調整。データは calendar.astro がビルド時に埋め込む）
(() => {
  'use strict';
  const data = window.CALENDAR_DATA;
  const BASE = window.CALENDAR_BASE || '/';
  const icon = name => `${BASE}editorial/calendar/${name}.svg`;
  const root = document.querySelector('.cal2');
  const $ = selector => document.querySelector(selector);
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const months = [...new Set(data.map(m => m.released.slice(0, 7)))].sort();
  const english = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  const weekdays = ['日','月','火','水','木','金','土'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase('ja').replace(/\s+/g, ' ').trim();
  const validMonth = value => /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 1900 && Number(value.slice(0, 4)) <= 2100;
  const fromHash = () => validMonth(location.hash.slice(2)) && location.hash.startsWith('#m') ? location.hash.slice(2) : currentMonth;
  let month = fromHash();
  // 新台はほぼ月曜に入るので、カレンダー表はマスがほとんど空になる。最初はリストで開く
  let view = 'list';
  let selectedDate = '';
  const machineLink = m => `${BASE}machines/${encodeURIComponent(m.id)}/`;

  function navigate(value) {
    if (!validMonth(value)) return;
    $('#search').value = '';
    $('#maker').value = '';
    month = value;
    selectedDate = '';
    if (location.hash !== `#m${month}`) history.pushState(null, '', `#m${month}`);
    render();
  }

  function monthLinks(values) {
    let year = '';
    return values.map(value => {
      const [y, m] = value.split('-');
      const heading = y !== year ? `<p class="nav-year">${y}</p>` : '';
      year = y;
      const count = data.filter(item => item.released.startsWith(value)).length;
      return `${heading}<button type="button" class="month-link" data-month="${value}" ${value === month ? 'aria-current="date"' : ''} aria-label="${y}年${Number(m)}月、${count}機種"><span><span class="mobile-year">${y}</span><strong>${m}<span class="month-suffix">月</span></strong></span><span class="count">${count} 機種</span></button>`;
    }).join('');
  }

  function revealSelectedMonth() {
    const nav = $('#month-nav');
    const active = nav.querySelector('[aria-current]');
    if (active && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft += active.getBoundingClientRect().left - nav.getBoundingClientRect().left - 8;
    }
  }

  function renderNav() {
    const upcoming = months.filter(m => m >= currentMonth);
    if (!upcoming.includes(month) && month >= currentMonth) upcoming.push(month);
    $('#month-nav').innerHTML = monthLinks(upcoming.sort());
    revealSelectedMonth();
    $('#archive-nav').innerHTML = monthLinks(months.filter(m => m < currentMonth).reverse());
    if (month < currentMonth) $('#archive').open = true;
    const monthIndex = value => Number(value.slice(0,4)) * 12 + Number(value.slice(5));
    $('#related-months').innerHTML = months.filter(m => m !== month)
      .sort((a,b) => Math.abs(monthIndex(a) - monthIndex(month)) - Math.abs(monthIndex(b) - monthIndex(month)))
      .slice(0,3).sort().map(value => `<button type="button" class="related" data-month="${value}" aria-label="${value.replace('-', '年')}月を見る"><span><small>${value.slice(0,4)}</small><strong>${value.slice(5)}<span>月</span></strong></span><span class="related-right">${data.filter(m => m.released.startsWith(value)).length} 機種<img src="${BASE}editorial/assets/chevron-right.svg" alt=""></span></button>`).join('');
  }

  function renderCalendar(items) {
    const [year, number] = month.split('-').map(Number);
    const offset = (new Date(year, number - 1, 1).getDay() + 6) % 7;
    const dayCount = new Date(year, number, 0).getDate();
    const cells = Math.ceil((offset + dayCount) / 7) * 7;
    $('#calendar').setAttribute('aria-label', `${year}年${number}月の導入日カレンダー`);
    $('#calendar').innerHTML = Array.from({length: cells}, (_, i) => {
      const date = new Date(year, number - 1, i - offset + 1);
      const day = date.getDate();
      const inside = date.getMonth() === number - 1;
      const key = `${month}-${String(day).padStart(2, '0')}`;
      const releases = inside ? items.filter(m => m.released === key) : [];
      const isToday = inside && month === currentMonth && day === today.getDate();
      const classes = `day${inside ? '' : ' is-outside'}${releases.length ? ' is-release' : ''}${isToday ? ' is-today' : ''}${selectedDate === key && inside ? ' is-selected' : ''}`;
      const content = `<span>${String(day).padStart(2,'0')}</span>${releases.length ? `<span class="day-count">${releases.length}機種</span><span class="day-event">${esc(releases[0].name)}</span>` : ''}`;
      return releases.length ? `<button type="button" class="${classes}" data-date="${key}" aria-pressed="${selectedDate === key}" aria-label="${number}月${day}日 ${releases.length}機種の導入予定を見る">${content}</button>` : `<div class="${classes}"${inside ? '' : ' aria-hidden="true"'}>${content}</div>`;
    }).join('');
  }

  function renderReleases(items, searching) {
    const groups = new Map();
    items.forEach(m => { if (!groups.has(m.released)) groups.set(m.released, []); groups.get(m.released).push(m); });
    const sorted = [...groups.entries()].sort(([a],[b]) => (a.length === 7 ? `${a}-99` : a).localeCompare(b.length === 7 ? `${b}-99` : b));
    $('#releases').innerHTML = sorted.map(([date, machines]) => {
      const unknown = date.length === 7;
      const monthLabel = `${searching ? `${date.slice(0,4)} / ` : ''}${Number(date.slice(5,7))}月`;
      const stamp = unknown ? '<strong>日付<br>未定</strong>' : `<strong>${date.slice(8)}</strong><small>${weekdays[new Date(`${date}T12:00:00`).getDay()]}曜日</small>`;
      return `<div class="release-group" id="date-${date}"><div class="date-stamp${unknown ? ' undated' : ''}"><span class="month-label">${monthLabel}</span>${stamp}</div><div>${machines.map(m => `<a class="machine" href="${machineLink(m)}"><div class="machine-body"><div class="machine-meta"><span>${esc(m.maker)}</span>${[m.gen,m.machineType].filter(Boolean).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div><h3>${esc(m.name)}</h3>${m.payout ? `<p class="machine-stats">出玉率 ${esc(m.payout)}${m.specNote ? `<span class="spec-note">${esc(m.specNote)}</span>` : ''}</p>` : ''}</div><span class="machine-arrow"><img src="${BASE}editorial/assets/chevron-right.svg" alt="機種詳細へ"></span></a>`).join('')}</div></div>`;
    }).join('');
  }

  function render() {
    const query = normalize($('#search').value);
    const maker = $('#maker').value;
    const searching = Boolean(query);
    const items = data.filter(m => (searching || m.released.startsWith(month)) && (!maker || m.maker === maker) && (!query || query.split(' ').every(part => normalize(`${m.name} ${m.maker}`).includes(part))));
    const dates = new Set(items.filter(m => m.released.length === 10).map(m => m.released));
    root.classList.toggle('search-mode', searching);
    $('#clear-search').hidden = !query;
    $('#month-year').textContent = searching ? 'SEARCH RESULTS / 全導入月' : month.slice(0,4);
    $('#month-number').textContent = searching ? '検索結果' : month.slice(5);
    $('#month-english').textContent = english[Number(month.slice(5)) - 1];
    $('#result-label').innerHTML = searching ? `<strong>${items.length}</strong> 機種が見つかりました` : `導入予定 <strong>${items.length}</strong> 機種`;
    $('#lineup-count').textContent = `${items.length} MACHINES`;
    $('#release-title').textContent = searching ? '検索結果のラインナップ' : `${Number(month.slice(5))}月の導入ラインナップ`;
    $('#calendar-wrap').hidden = searching || view === 'list';
    $('#empty').hidden = items.length > 0;
    $('#empty-description').textContent = query || maker ? '検索条件を変えて、もう一度お試しください。' : 'この月の導入情報はまだ掲載されていません。';
    $('#reset-filters').hidden = !query && !maker;
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
    if (!dates.has(selectedDate)) selectedDate = '';
    renderNav();
    renderCalendar(items);
    renderReleases(items, searching);
  }

  [...new Set(data.map(m => m.maker))].filter(Boolean).sort((a,b) => a.localeCompare(b, 'ja')).forEach(maker => {
    const option = document.createElement('option'); option.value = maker; option.textContent = maker; $('#maker').append(option);
  });
  document.addEventListener('click', event => {
    const monthButton = event.target.closest('[data-month]');
    if (monthButton) navigate(monthButton.dataset.month);
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) { view = viewButton.dataset.view; render(); }
    const dayButton = event.target.closest('[data-date]');
    if (dayButton) {
      selectedDate = dayButton.dataset.date;
      // Keep the pressed button mounted so keyboard focus is not lost.
      document.querySelectorAll('[data-date]').forEach(button => { const active = button.dataset.date === selectedDate; button.classList.toggle('is-selected', active); button.setAttribute('aria-pressed', String(active)); });
      const target = document.getElementById(`date-${selectedDate}`);
      target?.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block:'nearest'});
    }
  });
  $('#search').addEventListener('input', render);
  $('#maker').addEventListener('change', render);
  const clear = () => { $('#search').value = ''; $('#maker').value = ''; render(); $('#search').focus(); };
  $('#clear-search').addEventListener('click', clear);
  $('#reset-filters').addEventListener('click', clear);
  $('#today').addEventListener('click', () => navigate(currentMonth));
  function step(amount) {
    const [year, number] = month.split('-').map(Number);
    const date = new Date(year, number - 1 + amount, 1);
    navigate(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`);
  }
  $('#prev').addEventListener('click', () => step(-1));
  $('#next').addEventListener('click', () => step(1));
  window.addEventListener('hashchange', () => { month = fromHash(); selectedDate = ''; $('#search').value = ''; $('#maker').value = ''; render(); });
  matchMedia('(max-width: 640px)').addEventListener('change', revealSelectedMonth);
  render();
})();
