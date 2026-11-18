// Token Launch Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders three views — the ranked board, the live-token evidence, and the model's multiples — plus
// a detail view for every protocol with its factor breakdown and the exact farm plan board.json
// carries. No network: every byte it shows is in data.js. Filters can be preset with the URL query
// (?tab=board&cat=Dexs&chain=Ethereum&q=&wl=1) and a protocol opens at #/p/<slug>, so any view a
// reader sees can be linked and reproduced.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var PAGE = 50;

  var params = new URLSearchParams(location.search);
  var state = {
    tab: params.get('tab') || 'board',
    q: params.get('q') || '',
    category: params.get('cat') || 'all',
    chain: params.get('chain') || 'all',
    wl: params.get('wl') === '1',
    sort: 'implied',
    dir: -1,
    page: 0,
    detail: null,
  };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtX(n) {
    return n === null || n === undefined ? 'n/a' : n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '.0') + 'x';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  }
  function sourceLabel(row) {
    if (row.multiple_source === 'category') return 'category median, ' + row.peer_count + ' priced peers';
    if (row.multiple_source === 'group') return 'peer-group median, ' + row.peer_count + ' priced peers';
    return 'global median (no priced peers near this category)';
  }

  var bySlug = {};
  DATA.rows.forEach(function (r) { bySlug[r.slug] = r; });
  var categories = [];
  var chains = [];
  DATA.rows.forEach(function (r) {
    if (r.category && categories.indexOf(r.category) < 0) categories.push(r.category);
    r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  categories.sort();
  chains.sort();

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.wl && !r.watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      return true;
    });
  }
  function sorted(rows) {
    var key = state.sort, dir = state.dir;
    var val = {
      rank: function (r) { return r.rank; },
      name: function (r) { return r.name.toLowerCase(); },
      tvl: function (r) { return r.tvl_usd; },
      change: function (r) { return r.change_7d === null ? -Infinity : r.change_7d; },
      implied: function (r) { return r.implied_value_usd; },
      multiple: function (r) { return r.category_multiple; },
    }[key];
    return rows.slice().sort(function (a, b) {
      var va = val(a), vb = val(b);
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return a.slug < b.slug ? -1 : 1;
    });
  }

  function hero(compact) {
    var totalTvl = DATA.rows.reduce(function (s, r) { return s + r.tvl_usd; }, 0);
    var top = DATA.rows[0];
    var head = el('header', { class: 'hero' },
      el('h1', { text: 'Token Launch Radar' }),
      el('p', { class: 'sub', text: 'Every pre-token protocol in the DefiLlama snapshot of ' + DATA.as_of + ', ranked by what its token launch would be worth — and how to farm it before it happens.' })
    );
    if (compact) return head;
    head.appendChild(el('div', { class: 'stats' },
        stat(DATA.board_size, 'protocols ranked'),
        stat(DATA.watchlist_size, 'on the $' + Math.round(DATA.floor_usd / 1e6) + 'M watchlist'),
        stat(DATA.early_size, 'early rows below the floor'),
        stat(fmtUsd(totalTvl), 'TVL under watch'),
        stat(top ? fmtUsd(top.implied_value_usd) : 'n/a', 'top implied launch' + (top ? ' — ' + top.name : ''))
      )
    );
    return head;
  }
  function stat(n, l) {
    return el('div', { class: 'stat' }, el('div', { class: 'n', text: String(n) }), el('div', { class: 'l', text: l }));
  }

  function method() {
    var m = DATA.model;
    return el('section', { class: 'method' },
      el('h2', { text: 'How the radar prices a launch (model ' + DATA.model_version + ')' }),
      el('div', { class: 'formula', text: 'implied value  =  TVL  x  category multiple  x  momentum  x  maturity  x  breadth' }),
      el('ul', null,
        el('li', null, el('strong', { text: 'Category multiple — ' }), document.createTextNode('the median market-cap/TVL of the protocols in the same category that already have a token, computed from this snapshot (' + DATA.live_size + ' live peers shown on the Live tab; global median ' + fmtX(DATA.global_median_multiple) + '). Small samples are shrunk toward the global median (weight n/(n+' + m.shrink_k + ')); a category with fewer than ' + m.min_category_peers + ' priced peers falls back to its economic peer group, then to the global median.')),
        el('li', null, el('strong', { text: 'Momentum — ' }), document.createTextNode('7-day TVL change clamped to [' + m.growth_floor + '%, +' + m.growth_cap + '%] and weighted x' + m.growth_weight + ', so one wild week cannot make a launch.')),
        el('li', null, el('strong', { text: 'Maturity — ' }), document.createTextNode('x' + m.maturity_floor + ' for a brand-new listing rising to x1.0 at ' + m.maturity_days + ' days tracked: older protocols have survived more of the market.')),
        el('li', null, el('strong', { text: 'Breadth — ' }), document.createTextNode('+' + Math.round(m.breadth_per_chain * 100) + '% per extra chain beyond the first, up to ' + m.breadth_max_chains + ': more chains, more wallets that can farm it.'))
      ),
      el('p', { class: 'sub small', text: 'The board applies the watchlist\u2019s own screen at every TVL: no token recorded, and not a wrapped, staked or bridged product of another protocol, not an exchange and not a versioned pool. An implied value is this model\u2019s claim from the snapshot\u2019s figures, not a prediction that a token will launch.' })
    );
  }

  function tabs() {
    var wrap = el('div', { class: 'tabs', role: 'tablist' });
    [['board', 'The board'], ['live', 'Live-token evidence'], ['multiples', 'Category multiples']].forEach(function (t) {
      wrap.appendChild(el('button', {
        role: 'tab', 'aria-selected': state.tab === t[0] ? 'true' : 'false', text: t[1],
        onclick: function () { state.tab = t[0]; state.page = 0; state.detail = null; render(); },
      }));
    });
    return wrap;
  }

  function controls() {
    var catSel = el('select', { 'aria-label': 'Category', onchange: function (e) { state.category = e.target.value; state.page = 0; render(); } },
      el('option', { value: 'all', text: 'All categories' }));
    categories.forEach(function (c) { catSel.appendChild(el('option', { value: c, text: c })); });
    catSel.value = state.category;
    var chainSel = el('select', { 'aria-label': 'Chain', onchange: function (e) { state.chain = e.target.value; state.page = 0; render(); } },
      el('option', { value: 'all', text: 'All chains' }));
    chains.forEach(function (c) { chainSel.appendChild(el('option', { value: c, text: c })); });
    chainSel.value = state.chain;
    var wlBox = el('input', { type: 'checkbox', onchange: function (e) { state.wl = e.target.checked; state.page = 0; render(); } });
    wlBox.checked = state.wl;
    return el('div', { class: 'controls' },
      el('input', {
        type: 'search', placeholder: 'Search name or slug', value: state.q, 'aria-label': 'Search',
        oninput: function (e) { state.q = e.target.value; state.page = 0; renderTable(); },
      }),
      catSel, chainSel,
      el('label', null, wlBox, document.createTextNode('Watchlist only')),
      el('span', { class: 'count', id: 'rowcount' })
    );
  }

  var tableHost = null;
  function boardTable() {
    tableHost = el('div', { id: 'tablehost' });
    renderTableInto(tableHost);
    return tableHost;
  }
  function renderTable() { if (tableHost) renderTableInto(tableHost); }
  function renderTableInto(host) {
    while (host.firstChild) host.removeChild(host.firstChild);
    var rows = sorted(filtered());
    var count = document.getElementById('rowcount');
    if (count) count.textContent = rows.length + ' of ' + DATA.board_size + ' protocols';
    var pages = Math.max(1, Math.ceil(rows.length / PAGE));
    if (state.page >= pages) state.page = pages - 1;
    var pageRows = rows.slice(state.page * PAGE, state.page * PAGE + PAGE);
    var table = el('table', null,
      el('caption', { text: 'Pre-token protocols ranked by implied launch value. Select a row for its model breakdown and farm plan.' }),
      el('thead', null, el('tr', null,
        th('rank', '#'), th('name', 'Protocol', 'l'), th('tvl', 'TVL'), th('change', '7d TVL'),
        th('multiple', 'Multiple'), th('implied', 'Implied value'), el('th', { class: 'l hide-s', text: 'Chains' })
      )),
      el('tbody', null)
    );
    var tbody = table.querySelector('tbody');
    pageRows.forEach(function (r) {
      var name = el('td', { class: 'l' }, document.createTextNode(r.name),
        r.watchlist ? el('span', { class: 'badge', text: 'WATCHLIST' }) : el('span', { class: 'badge early', text: 'EARLY' }),
        el('div', { class: 'sub small', text: (r.category || 'Uncategorised') }));
      var tr = el('tr', { tabindex: '0', title: 'Open ' + r.name, onclick: function () { openDetail(r.slug); } },
        el('td', { text: String(r.rank) }), name,
        el('td', { text: fmtUsd(r.tvl_usd) }),
        el('td', { class: r.change_7d === null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { text: fmtX(r.category_multiple) }),
        el('td', { text: fmtUsd(r.implied_value_usd) }),
        el('td', { class: 'l hide-s sub', text: r.chains.slice(0, 3).join(', ') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') })
      );
      tbody.appendChild(tr);
    });
    host.appendChild(table);
    var pager = el('div', { class: 'pager' },
      el('button', { text: 'Previous', disabled: state.page === 0 ? 'disabled' : null, onclick: function () { state.page--; renderTable(); } }),
      el('span', { class: 'sub', text: 'Page ' + (state.page + 1) + ' of ' + pages }),
      el('button', { text: 'Next', disabled: state.page >= pages - 1 ? 'disabled' : null, onclick: function () { state.page++; renderTable(); } })
    );
    host.appendChild(pager);
  }
  function th(key, label, cls) {
    var arrow = state.sort === key ? (state.dir === -1 ? ' \u25bc' : ' \u25b2') : '';
    return el('th', {
      class: 'sortable ' + (cls || ''), text: label + arrow,
      onclick: function () {
        if (state.sort === key) state.dir = -state.dir;
        else { state.sort = key; state.dir = key === 'name' ? 1 : -1; }
        renderTable();
      },
    });
  }

  function liveTable() {
    var table = el('table', null,
      el('caption', { text: 'Protocols that already have a token: the market\u2019s own values. These are the priced peers the category multiples are computed from — they are evidence, never ranked.' }),
      el('thead', null, el('tr', null,
        el('th', { class: 'l', text: 'Protocol' }), el('th', { text: 'Market cap' }), el('th', { text: 'TVL' }),
        el('th', { text: 'Mcap / TVL' }), el('th', { text: '7d TVL' }))),
      el('tbody', null)
    );
    var tbody = table.querySelector('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'l' }, document.createTextNode(r.name), el('div', { class: 'sub small', text: r.category || 'Uncategorised' })),
        el('td', { text: fmtUsd(r.mcap_usd) }),
        el('td', { text: fmtUsd(r.tvl_usd) }),
        el('td', { text: fmtX(r.multiple) }),
        el('td', { class: r.change_7d === null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) })
      ));
    });
    return el('div', null, el('h2', { text: 'Live-token evidence' }), table);
  }

  function multiplesTable() {
    var stats = DATA.category_stats.filter(function (s) { return s.peers > 0; })
      .sort(function (a, b) { return (b.median_multiple || 0) - (a.median_multiple || 0); });
    var table = el('table', null,
      el('caption', { text: 'Median market-cap/TVL of priced peers per category, straight from the snapshot. On the board each median is shrunk toward the global median (' + fmtX(DATA.global_median_multiple) + ') by sample size before it prices a launch.' }),
      el('thead', null, el('tr', null,
        el('th', { class: 'l', text: 'Category' }), el('th', { class: 'l', text: 'Peer group' }),
        el('th', { text: 'Priced peers' }), el('th', { text: 'Median mcap/TVL' }))),
      el('tbody', null)
    );
    var tbody = table.querySelector('tbody');
    stats.forEach(function (s) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'l', text: s.category }),
        el('td', { class: 'l sub', text: s.group || '—' }),
        el('td', { text: String(s.peers) }),
        el('td', { text: fmtX(s.median_multiple) })
      ));
    });
    return el('div', null,
      el('h2', { text: 'Category multiples' }),
      el('p', { class: 'sub', text: 'Categories with no priced peers of their own — Risk Curators has one, Onchain Capital Allocator two — price off their peer group (allocation: curators, allocators and yield businesses together) or, failing that, the global median. Every row of the board names which evidence priced it.' }),
      table);
  }

  function openDetail(slug) {
    state.detail = slug;
    location.hash = '/p/' + slug;
    render();
  }
  function detailView(row) {
    var wrap = el('div', null);
    wrap.appendChild(el('p', null, el('a', {
      href: '#', text: '\u2190 Back to the board',
      onclick: function (e) { e.preventDefault(); state.detail = null; location.hash = ''; render(); },
    })));
    var head = el('div', { class: 'detail-head' },
      el('h2', { text: row.name }),
      row.watchlist ? el('span', { class: 'badge', text: 'WATCHLIST' }) : el('span', { class: 'badge early', text: 'EARLY — BELOW THE FLOOR' }),
      el('span', { class: 'sub', text: 'rank #' + row.rank + ' of ' + DATA.board_size })
    );
    wrap.appendChild(head);
    wrap.appendChild(el('p', null,
      document.createTextNode('Implied launch value '),
      el('span', { class: 'big mono', text: fmtUsd(row.implied_value_usd) }),
      document.createTextNode(' — what a token would be worth if ' + row.name + ' launched at the multiple its priced peers trade at, on the snapshot of ' + DATA.as_of + '.')
    ));
    var factors = el('table', { class: 'factors' }, el('tbody', null,
      frow('TVL (snapshot)', fmtUsd(row.tvl_usd)),
      frow('Category', (row.category || 'Uncategorised')),
      frow('Category multiple', fmtX(row.category_multiple) + ' — ' + sourceLabel(row)),
      frow('Momentum', fmtX(row.growth_multiplier) + ' (7d TVL ' + fmtPct(row.change_7d) + ')'),
      frow('Maturity', fmtX(row.maturity_multiplier) + ' (tracked ' + fmtAge(row.age_days) + (row.listed_at ? ', since ' + row.listed_at : '') + ')'),
      frow('Breadth', fmtX(row.breadth_multiplier) + ' (' + row.chains.length + ' chain' + (row.chains.length === 1 ? '' : 's') + ': ' + row.chains.join(', ') + ')'),
      frow('Implied value', fmtUsd(row.implied_value_usd))
    ));
    var plan = el('ol', { class: 'steps' });
    row.farm_steps.forEach(function (s) { plan.appendChild(el('li', { text: s })); });
    wrap.appendChild(el('div', { class: 'grid' },
      el('section', { class: 'card' }, el('h3', { text: 'The model\u2019s arithmetic' }), factors),
      el('section', { class: 'card' }, el('h3', { text: 'How to farm ' + row.name }), plan,
        el('p', { class: 'sub small', text: 'The same plan board.json carries for this protocol, word for word.' }))
    ));
    return wrap;
  }
  function frow(k, v) {
    return el('tr', null, el('td', { class: 'l sub', text: k }), el('td', { text: v }));
  }

  function footer() {
    return el('footer', null,
      el('p', { text: 'Data: ' + DATA.source + '. Board generated by main.ts (model ' + DATA.model_version + ') from the sealed snapshot; this page renders offline from data.js alone.' }),
      el('p', { text: 'An implied value is the model\u2019s claim about what a launch would be worth if the protocol\u2019s record stayed as it is. It is not a prediction that a token will launch, and it is not financial advice.' })
    );
  }

  function render() {
    while (app.firstChild) app.removeChild(app.firstChild);
    app.appendChild(hero(!!(state.detail && bySlug[state.detail])));
    if (state.detail && bySlug[state.detail]) {
      app.appendChild(detailView(bySlug[state.detail]));
    } else if (state.tab === 'live') {
      app.appendChild(tabs());
      app.appendChild(liveTable());
    } else if (state.tab === 'multiples') {
      app.appendChild(tabs());
      app.appendChild(multiplesTable());
    } else {
      app.appendChild(method());
      app.appendChild(tabs());
      app.appendChild(controls());
      app.appendChild(boardTable());
    }
    app.appendChild(footer());
    app.setAttribute('aria-busy', 'false');
  }

  function route() {
    var m = /^#\/p\/(.+)$/.exec(location.hash || '');
    state.detail = m ? decodeURIComponent(m[1]) : null;
    render();
  }
  window.addEventListener('hashchange', route);
  route();
})();
