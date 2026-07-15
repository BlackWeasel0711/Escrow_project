/* SafePay Escrow — zero-build vanilla SPA client for the escrow REST API. */
(() => {
  'use strict';

  const API = window.APP_CONFIG.API_BASE;
  const TOKEN_KEY = 'safepay.token';

  // ---------- tiny helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (cents, cur = 'KES') => `${cur} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const when = (d) => new Date(d).toLocaleString();

  // ---------- gradient SVG icon set ----------
  const ICONS = {
    shield: '<path fill="url(#gP)" stroke="#eadfff" stroke-opacity=".55" stroke-width=".4" d="M12 1.7l7.8 3.24c.48.2.8.68.8 1.2v5.06c0 5.28-3.53 9.72-8.6 11.03C6.93 20.92 3.4 16.48 3.4 11.2V6.14c0-.52.32-1 .8-1.2L12 1.7z"/><path fill="#fff" d="M10.5 16.4l-3.6-3.6 1.95-1.95 1.65 1.65 4.7-4.7 1.95 1.95-6.6 6.65z"/>',
    mail: '<rect x="2.5" y="4.5" width="19" height="15" rx="2.8" fill="url(#gB)"/><rect x="2.5" y="4.5" width="19" height="6" rx="2.8" fill="#fff" opacity=".14"/><path fill="#fff" opacity=".95" d="M4.4 7.1l6.98 5.1c.37.27.87.27 1.24 0l6.98-5.1c-.17-.12-.37-.1-.6-.1H5c-.23 0-.43-.02-.6.1z"/>',
    key: '<path fill="url(#gPk)" d="M15.5 2a6.5 6.5 0 00-6.28 8.2L2 17.42V22h4.6v-2.2h2.2v-2.2h2.2l1.02-1.02A6.5 6.5 0 1015.5 2zm1.8 5.2a1.6 1.6 0 11-3.2 0 1.6 1.6 0 013.2 0z"/><circle cx="15.6" cy="7" r="1.3" fill="#fff" opacity=".5"/>',
    lock: '<path fill="none" stroke="#c9f0e2" stroke-width="2.4" stroke-linecap="round" d="M7.6 11V7.1a4.4 4.4 0 018.8 0V11"/><rect x="4.1" y="10.4" width="15.8" height="11.4" rx="3" fill="url(#gG)"/><rect x="4.1" y="10.4" width="15.8" height="4.8" rx="3" fill="#fff" opacity=".22"/><circle cx="12" cy="15.4" r="2.1" fill="#06331e"/><path fill="#06331e" d="M11 15.2h2l-.55 3.7h-.9z"/>',
    scales: '<g fill="url(#gPk)"><circle cx="12" cy="3.9" r="1.9"/><rect x="11" y="4.4" width="2" height="14.8" rx="1"/><rect x="6.4" y="18.7" width="11.2" height="2.4" rx="1.2"/><rect x="3.8" y="7.1" width="16.4" height="1.9" rx=".95"/></g><path fill="url(#gPk)" opacity=".9" d="M4 8.4L1.1 14h5.8L4 8.4zm16 0L17.1 14h5.8L20 8.4z"/><path fill="#fff" opacity=".22" d="M11 4.4h2v14.8h-2z"/>',
    star: '<path fill="url(#gGold)" d="M12 2.4l2.98 6.04 6.66.97-4.82 4.7 1.14 6.63L12 17.66l-5.96 3.08 1.14-6.63L2.36 9.41l6.66-.97L12 2.4z"/><path fill="#fff" opacity=".3" d="M12 2.4l2.98 6.04 6.66.97-4.82 4.7L12 12z"/>',
    bell: '<path fill="url(#gP)" d="M12 2a6 6 0 00-6 6c0 3.6-1 5.35-1.83 6.28-.62.7-.12 1.82.83 1.82h14c.95 0 1.45-1.12.83-1.82C19 13.35 18 11.6 18 8a6 6 0 00-6-6z"/><path fill="#fff" opacity=".18" d="M12 2a6 6 0 00-6 6c0 1-.08 1.85-.22 2.6C9 8.6 15 8.6 18.2 10.6 18.08 9.85 18 9 18 8a6 6 0 00-6-6z"/><path fill="url(#gP)" d="M9.5 19.2a2.5 2.5 0 005 0h-5z"/>',
    inbox: '<path fill="url(#gB)" d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm-.7 11H8a1 1 0 011 1 3 3 0 006 0 1 1 0 011-1h3.7L16.4 6.35A1 1 0 0015.5 6h-7a1 1 0 00-.9.55L4.3 14z"/><rect x="3" y="3" width="18" height="7" rx="2" fill="#fff" opacity=".12"/>',
    user: '<circle cx="12" cy="7.6" r="4.5" fill="url(#gP)"/><circle cx="12" cy="7.6" r="4.5" fill="#fff" opacity=".14"/><path fill="url(#gP)" d="M3.2 20.6a8.8 8.8 0 0117.6 0 1 1 0 01-1 1.1H4.2a1 1 0 01-1-1.1z"/>',
    check: '<path fill="url(#gG)" d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.2 14.2l-4-4 1.5-1.5 2.5 2.5 5-5 1.5 1.5-6.5 6.5z"/>',
  };
  const icon = (name, size = 20) =>
    `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  // Shield logo with a light-shine sweep clipped to the shield shape.
  const brandLogo = () => `<span class="brand-logo">${icon('shield', 40)}<span class="shine"></span></span>`;

  // ---------- remembered emails (custom, theme-matched history) ----------
  const EMAILS_KEY = 'safepay.emails';
  const getEmails = () => { try { return JSON.parse(localStorage.getItem(EMAILS_KEY)) || []; } catch { return []; } };
  const rememberEmail = (email) => {
    email = (email || '').trim();
    if (!email) return;
    const list = [email, ...getEmails().filter((e) => e !== email)].slice(0, 6);
    localStorage.setItem(EMAILS_KEY, JSON.stringify(list));
  };

  let toastTimer;
  function toast(msg, kind = '') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast ${kind}`;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3800);
  }

  // ---------- auth/session ----------
  const session = {
    get token() { return localStorage.getItem(TOKEN_KEY); },
    set token(v) { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); },
    get claims() {
      const t = this.token;
      if (!t) return null;
      try {
        const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.exp && payload.exp * 1000 < Date.now()) { this.token = null; return null; }
        return payload; // { sub, role, exp }
      } catch { return null; }
    },
    get isAuthed() { return !!this.claims; },
    get isAdmin() { return this.claims?.role === 'ADMIN'; },
    get userId() { return this.claims?.sub; },
  };

  // ---------- API client ----------
  async function api(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (session.token) headers.Authorization = `Bearer ${session.token}`;
    let res;
    try {
      res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch {
      throw new Error('Server offline. Start it: open the backend folder and run "npm run dev:local", then use http://localhost:4000');
    }
    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch { data = { message: text }; } }
    if (!res.ok) {
      if (res.status === 401 && session.isAuthed) { session.token = null; renderNav(); }
      throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
    }
    return data;
  }

  // ---------- router ----------
  const routes = {};
  function route(name, fn) { routes[name] = fn; }
  function go(name, params) {
    location.hash = name + (params ? '?' + new URLSearchParams(params) : '');
  }
  async function render() {
    const [name, qs] = (location.hash.replace(/^#/, '') || 'dashboard').split('?');
    const params = Object.fromEntries(new URLSearchParams(qs || ''));
    const fn = routes[name] || routes.dashboard;

    // route guards
    const publicRoutes = ['login', 'register'];
    if (!session.isAuthed && !publicRoutes.includes(name)) return go('login');
    if (session.isAuthed && publicRoutes.includes(name)) return go('dashboard');

    // Immersive full-bleed layout for the auth screens.
    document.body.classList.toggle('auth-mode', name === 'login' || name === 'register');

    const view = $('#view');
    view.innerHTML = '<div class="spinner"></div>';
    renderNav(name);
    try {
      await fn(view, params);
    } catch (e) {
      view.innerHTML = '';
      view.appendChild(el(`<div class="card"><h2>Something went wrong</h2><p class="muted">${esc(e.message)}</p></div>`));
    }
  }

  function renderNav(active) {
    const nav = $('#nav');
    nav.innerHTML = '';
    if (!session.isAuthed) {
      nav.appendChild(navLink('login', 'Log in'));
      nav.appendChild(navLink('register', 'Sign up'));
      return;
    }
    nav.appendChild(navLink('dashboard', 'My Escrows', active));
    nav.appendChild(navLink('new', 'New Escrow', active));
    if (session.isAdmin) nav.appendChild(navLink('admin', 'Admin', active));
    nav.appendChild(buildBell());
    const out = el('<a>Log out</a>');
    out.onclick = () => { stopBellPolling(); session.token = null; renderNav(); go('login'); };
    nav.appendChild(out);
    startBellPolling();
  }
  function navLink(name, label, active) {
    const a = el(`<a class="${active === name ? 'active' : ''}">${label}</a>`);
    a.onclick = () => go(name);
    return a;
  }

  // ================= ROUTES =================

  route('login', authView('login'));
  route('register', authView('register'));

  function authView(mode) {
    const isLogin = mode === 'login';
    return (view) => {
      view.innerHTML = '';
      const wrap = el(`
        <div class="auth-shell">
          <aside class="auth-hero">
            <div class="auth-hero-glow"></div>
            <div class="auth-hero-content">
              <div class="auth-brand">${brandLogo()} SafePay <span>Escrow</span></div>
              <h2 class="auth-tagline">Karibu! Nunua na uuze bila wasiwasi.</h2>
              <p class="auth-lead"><strong>Pesa yako iko salama.</strong> We hold the buyer's money securely and only release it to the seller once delivery is confirmed — or an admin resolves a dispute.</p>
              <ul class="auth-features">
                <li><span class="af-ic">${icon('lock', 44)}</span><div><strong>Pesa salama in escrow</strong><em>Funds are locked the moment a deal starts.</em></div></li>
                <li><span class="af-ic">${icon('scales', 44)}</span><div><strong>Fair dispute resolution</strong><em>Open a case with evidence, an admin decides.</em></div></li>
                <li><span class="af-ic">${icon('star', 44)}</span><div><strong>Trusted reputations</strong><em>Ratings after every completed deal.</em></div></li>
              </ul>
              <div class="auth-pay">
                <span>Lipa na</span>
                <b class="pay-chip">M-Pesa</b><b class="pay-chip">PayPal</b><b class="pay-chip">Visa</b>
              </div>
            </div>
          </aside>
          <section class="auth-form">
            <div class="auth-form-inner">
              <h1>${isLogin ? 'Welcome back' : 'Create your account'}</h1>
              <p class="sub">${isLogin ? 'Log in to manage your escrow transactions.' : 'Sign up to buy and sell safely with escrow protection.'}</p>
              <form id="f" autocomplete="off">
                <label>Email</label>
                <div class="email-wrap">
                  <div class="field"><input name="email" type="email" required autocomplete="off" placeholder="you@example.com" /></div>
                  <div class="email-history" hidden></div>
                </div>
                <label>Password</label>
                <div class="field"><input name="password" type="password" required minlength="8" autocomplete="off" placeholder="At least 8 characters" /></div>
                <button type="submit" class="auth-submit">${isLogin ? 'Log in' : 'Create account'} <span class="arr">→</span></button>
              </form>
              <p class="auth-swap">
                ${isLogin ? "New to SafePay?" : 'Already have an account?'}
                <span class="link" id="swap">${isLogin ? 'Create an account' : 'Log in'}</span>
              </p>
              <p class="auth-trust">${icon('lock', 14)} 256-bit encrypted · Your credentials are never shared</p>
            </div>
          </section>
        </div>`);
      view.appendChild(wrap);
      $('#swap', wrap).onclick = () => go(isLogin ? 'register' : 'login');

      // Custom, theme-matched email history — shows addresses used on this app.
      const emailInput = $('input[name=email]', wrap);
      const histBox = $('.email-history', wrap);
      const showHist = () => {
        const q = emailInput.value.trim().toLowerCase();
        const emails = getEmails().filter((em) => !q || em.toLowerCase().includes(q));
        if (!emails.length) { histBox.hidden = true; return; }
        histBox.innerHTML = '';
        emails.forEach((em) => {
          const item = el(`<div class="eh-item">${icon('mail', 16)}<span>${esc(em)}</span></div>`);
          item.onmousedown = (ev) => { ev.preventDefault(); emailInput.value = em; histBox.hidden = true; };
          histBox.appendChild(item);
        });
        histBox.hidden = false;
      };
      emailInput.addEventListener('focus', showHist);
      emailInput.addEventListener('input', showHist);
      emailInput.addEventListener('blur', () => setTimeout(() => { histBox.hidden = true; }, 150));

      $('#f', wrap).onsubmit = async (e) => {
        e.preventDefault();
        const btn = $('button', e.target); btn.disabled = true;
        const fd = new FormData(e.target);
        try {
          const { token } = await api(`/auth/${mode}`, {
            method: 'POST',
            body: { email: fd.get('email'), password: fd.get('password') },
          });
          session.token = token;
          rememberEmail(fd.get('email'));
          toast(isLogin ? 'Logged in' : 'Account created', 'ok');
          renderNav();
          go('dashboard');
        } catch (err) {
          toast(err.message, 'err');
          btn.disabled = false;
        }
      };
    };
  }

  route('dashboard', async (view) => {
    const txs = await api('/transactions');
    view.innerHTML = '';
    view.appendChild(el(`<div class="row-between"><h1>My Escrows</h1></div>`));
    view.appendChild(el(`<p class="sub">Funds are held safely until the buyer confirms delivery or an admin resolves a dispute.</p>`));

    const card = el('<div class="card"></div>');
    if (!txs.length) {
      card.appendChild(el(`<div class="empty">
        <div>${icon('inbox', 46)}</div>
        <div style="margin-top:10px">No transactions yet.</div>
        <span class="link" id="mk">Create your first escrow →</span>
      </div>`));
      card.querySelector('#mk').onclick = () => go('new');
    } else {
      const table = el(`<table><thead><tr>
        <th>Description</th><th>Amount</th><th>Role</th><th>Method</th><th>Status</th><th>Created</th>
      </tr></thead><tbody></tbody></table>`);
      const tb = $('tbody', table);
      for (const t of txs) {
        const role = t.buyerId === session.userId ? 'Buyer' : 'Seller';
        const tr = el(`<tr class="clickable">
          <td>${esc(t.description)}</td>
          <td>${money(t.amountCents, t.currency)}</td>
          <td>${role}</td>
          <td>${t.method}</td>
          <td><span class="badge ${t.status}">${t.status}</span></td>
          <td class="muted">${when(t.createdAt)}</td>
        </tr>`);
        tr.onclick = () => go('tx', { id: t.id });
        tb.appendChild(tr);
      }
      card.appendChild(table);
    }
    view.appendChild(card);
  });

  route('new', async (view) => {
    view.innerHTML = '';
    view.appendChild(el('<h1>New Escrow</h1>'));
    view.appendChild(el('<p class="sub">As the buyer, you deposit funds now. They stay locked until you confirm you received the goods.</p>'));
    const card = el(`<div class="card">
      <form id="f">
        <label>Seller's email</label>
        <input name="sellerEmail" type="email" required placeholder="seller@example.com" />
        <label>What are you buying?</label>
        <textarea name="description" required minlength="3" maxlength="500" placeholder="e.g. iPhone 13, 128GB, sealed"></textarea>
        <label>Amount</label>
        <input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" />
        <label>Currency</label>
        <input name="currency" value="KES" maxlength="3" />
        <label>Payment method</label>
        <select name="method">
          <option value="MPESA">M-Pesa</option>
          <option value="PAYPAL">PayPal</option>
          <option value="VISA">Visa Card</option>
        </select>
        <div class="btn-row">
          <button type="submit">Deposit into escrow</button>
          <button type="button" class="ghost" id="cancel">Cancel</button>
        </div>
      </form>
    </div>`);
    view.appendChild(card);
    $('#cancel', card).onclick = () => go('dashboard');
    $('#f', card).onsubmit = async (e) => {
      e.preventDefault();
      const btn = $('button[type=submit]', e.target); btn.disabled = true;
      const fd = new FormData(e.target);
      try {
        const tx = await api('/transactions', {
          method: 'POST',
          body: {
            sellerEmail: fd.get('sellerEmail'),
            description: fd.get('description'),
            amountCents: Math.round(parseFloat(fd.get('amount')) * 100),
            method: fd.get('method'),
            currency: (fd.get('currency') || 'KES').toUpperCase(),
          },
        });
        toast('Funds deposited and held in escrow', 'ok');
        go('tx', { id: tx.id });
      } catch (err) {
        toast(err.message, 'err');
        btn.disabled = false;
      }
    };
  });

  route('tx', async (view, { id }) => {
    // A party fetches via the escrow route; an admin who isn't a party uses the admin route.
    let t;
    try {
      t = await api(`/transactions/${id}`);
    } catch (e) {
      if (session.isAdmin) t = await api(`/admin/transactions/${id}`);
      else throw e;
    }
    const isBuyer = t.buyerId === session.userId;
    view.innerHTML = '';

    view.appendChild(el(`<div class="row-between">
      <h1>${esc(t.description)}</h1>
      <span class="badge ${t.status}">${t.status}</span>
    </div>`));

    const rep = t.sellerReputation;
    const repText = rep && rep.count
      ? `<span class="stars">${'★'.repeat(Math.round(rep.average))}${'☆'.repeat(5 - Math.round(rep.average))}</span> ${rep.average} · ${rep.count} review${rep.count === 1 ? '' : 's'}`
      : 'No reviews yet';
    const info = el(`<div class="card">
      <div class="row-between"><div><div class="muted">Amount</div><div style="font-size:22px;font-weight:700">${money(t.amountCents, t.currency)}</div></div>
      <div><div class="muted">Payment</div><div>${t.method}</div></div>
      <div><div class="muted">Your role</div><div>${isBuyer ? 'Buyer' : 'Seller'}</div></div>
      <div><div class="muted">Seller reputation</div><div>${repText}</div></div>
      <div><div class="muted">Gateway ref</div><div class="mono">${esc(t.gatewayRef || '—')}</div></div></div>
    </div>`);
    view.appendChild(info);

    // Funds are locked in escrow while HELD, SHIPPED or DELIVERED.
    const heldStates = ['HELD', 'SHIPPED', 'DELIVERED'];
    const post = (path, okMsg, confirmMsg) => async () => {
      if (confirmMsg && !confirm(confirmMsg)) return;
      try { await api(`/transactions/${id}/${path}`, { method: 'POST' }); toast(okMsg, 'ok'); render(); }
      catch (e) { toast(e.message, 'err'); }
    };

    // Actions
    const actions = el('<div class="card"><h2>Actions</h2><div class="btn-row" id="acts"></div></div>');
    const acts = $('#acts', actions);
    if (heldStates.includes(t.status)) {
      if (!isBuyer && t.status === 'HELD') {
        const s = el('<button>Mark as shipped</button>');
        s.onclick = post('ship', 'Buyer notified — marked shipped');
        acts.appendChild(s);
      }
      if (!isBuyer && t.status === 'SHIPPED') {
        const dv = el('<button>Mark as delivered</button>');
        dv.onclick = post('delivered', 'Buyer notified — marked delivered');
        acts.appendChild(dv);
      }
      if (isBuyer) {
        const b = el('<button>Confirm received — release funds</button>');
        b.onclick = post('confirm-received', 'Funds released to seller', 'Release the held funds to the seller? This cannot be undone.');
        acts.appendChild(b);
      }
      const d = el('<button class="warn">Open a dispute</button>');
      d.onclick = () => openDisputeDialog(actions, id);
      acts.appendChild(d);
    } else if (t.status === 'RELEASED') {
      if (t.rating) {
        acts.appendChild(el(`<div class="muted">Rated: <span class="stars">${'★'.repeat(t.rating.score)}${'☆'.repeat(5 - t.rating.score)}</span></div>`));
      } else {
        const r = el('<button>Rate the other party</button>');
        r.onclick = () => rateDialog(actions, id);
        acts.appendChild(r);
      }
    } else {
      acts.appendChild(el('<div class="muted">No actions available for this status.</div>'));
    }
    view.appendChild(actions);

    // Dispute detail
    if (t.dispute) {
      const dp = t.dispute;
      view.appendChild(el(`<div class="card">
        <div class="row-between"><h2>Dispute</h2><span class="badge ${dp.status}">${dp.status}</span></div>
        <p><strong>Reason:</strong> ${esc(dp.reason)}</p>
        ${dp.adminNote ? `<p><strong>Admin note:</strong> ${esc(dp.adminNote)}</p>` : ''}
        ${(dp.evidence || []).length ? `<p class="muted">${dp.evidence.length} piece(s) of evidence attached.</p>` : ''}
      </div>`));
    }

    // Timeline
    const tl = el('<div class="card"><h2>Timeline</h2><ul class="timeline"></ul></div>');
    const ul = $('.timeline', tl);
    for (const ev of (t.events || [])) {
      ul.appendChild(el(`<li>
        <div>${ev.fromStatus ? `${ev.fromStatus} → ` : ''}<strong>${ev.toStatus}</strong>${ev.note ? ` — ${esc(ev.note)}` : ''}</div>
        <div class="t-time">${when(ev.createdAt)}</div>
      </li>`));
    }
    if (!ul.children.length) ul.appendChild(el('<li class="muted">No events.</li>'));
    view.appendChild(tl);
  });

  function openDisputeDialog(container, txId) {
    if ($('#disputeForm', container)) return;
    const form = el(`<div id="disputeForm" style="margin-top:16px;border-top:1px solid var(--border);padding-top:16px">
      <label>Why are you disputing?</label>
      <textarea id="reason" minlength="3" maxlength="1000" placeholder="Describe the problem…"></textarea>
      <label>Evidence URL (optional)</label>
      <input id="ev" type="url" placeholder="https://link-to-photo-or-doc" />
      <div class="btn-row"><button class="danger" id="submit">Submit dispute</button></div>
    </div>`);
    container.appendChild(form);
    $('#submit', form).onclick = async () => {
      const reason = $('#reason', form).value.trim();
      const evUrl = $('#ev', form).value.trim();
      if (reason.length < 3) return toast('Please describe the problem', 'err');
      try {
        await api('/disputes', { method: 'POST', body: { transactionId: txId, reason, evidenceUrls: evUrl ? [evUrl] : [] } });
        toast('Dispute opened', 'ok');
        render();
      } catch (e) { toast(e.message, 'err'); }
    };
  }

  function rateDialog(container, txId) {
    if ($('#rateForm', container)) return;
    const form = el(`<div id="rateForm" style="margin-top:16px;border-top:1px solid var(--border);padding-top:16px">
      <label>Score</label>
      <select id="score"><option value="5">★★★★★ (5)</option><option value="4">★★★★ (4)</option><option value="3">★★★ (3)</option><option value="2">★★ (2)</option><option value="1">★ (1)</option></select>
      <label>Comment (optional)</label>
      <input id="comment" maxlength="500" placeholder="How was the transaction?" />
      <div class="btn-row"><button id="submit">Submit rating</button></div>
    </div>`);
    container.appendChild(form);
    $('#submit', form).onclick = async () => {
      try {
        await api('/ratings', { method: 'POST', body: { transactionId: txId, score: Number($('#score', form).value), comment: $('#comment', form).value.trim() || undefined } });
        toast('Thanks for rating', 'ok');
        render();
      } catch (e) { toast(e.message, 'err'); }
    };
  }

  route('admin', async (view) => {
    if (!session.isAdmin) { view.innerHTML = '<div class="card"><h2>Admins only</h2></div>'; return; }
    const [overview, disputes] = await Promise.all([api('/admin/overview'), api('/disputes')]);
    view.innerHTML = '';
    view.appendChild(el('<h1>Admin Dashboard</h1>'));

    const stats = el('<div class="grid cols-3"></div>');
    const totalTx = Object.values(overview.byStatus || {}).reduce((a, b) => a + b, 0);
    const cards = [
      ['Users', overview.userCount ?? '—'],
      ['Held funds', money(overview.heldCents ?? 0)],
      ['Open disputes', overview.openDisputes ?? disputes.length],
      ['Transactions', totalTx],
    ];
    for (const [lbl, num] of cards) stats.appendChild(el(`<div class="stat"><div class="num">${esc(num)}</div><div class="lbl">${lbl}</div></div>`));
    view.appendChild(stats);

    // Dispute queue
    const dq = el('<div class="card" style="margin-top:16px"><h2>Dispute queue</h2></div>');
    if (!disputes.length) {
      dq.appendChild(el('<div class="empty">No open disputes 🎉</div>'));
    } else {
      for (const d of disputes) {
        const item = el(`<div style="border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px">
          <div class="row-between">
            <div><strong>${esc(d.transaction?.description || 'Transaction')}</strong>
              <span class="badge ${d.status}">${d.status}</span></div>
            <div>${d.transaction ? money(d.transaction.amountCents, d.transaction.currency) : ''}</div>
          </div>
          <p>${esc(d.reason)}</p>
          <p class="muted">${(d.evidence || []).length} evidence • opened ${when(d.createdAt)}</p>
          <div class="btn-row">
            <button data-r="RELEASE">Rule: release to seller</button>
            <button class="warn" data-r="REFUND">Rule: refund buyer</button>
          </div>
        </div>`);
        item.querySelectorAll('button[data-r]').forEach((b) => {
          b.onclick = async () => {
            const note = prompt('Optional admin note for this ruling:') || undefined;
            try { await api(`/disputes/${d.id}/rule`, { method: 'POST', body: { ruling: b.dataset.r, adminNote: note } }); toast('Dispute resolved', 'ok'); render(); }
            catch (e) { toast(e.message, 'err'); }
          };
        });
        dq.appendChild(item);
      }
    }
    view.appendChild(dq);

    // All transactions
    const all = await api('/admin/transactions');
    const txCard = el('<div class="card" style="margin-top:16px"><h2>All transactions</h2></div>');
    const table = el(`<table><thead><tr><th>Description</th><th>Amount</th><th>Method</th><th>Status</th><th>Created</th></tr></thead><tbody></tbody></table>`);
    const tb = $('tbody', table);
    for (const t of all) {
      const tr = el(`<tr class="clickable">
        <td>${esc(t.description)}</td><td>${money(t.amountCents, t.currency)}</td>
        <td>${t.method}</td><td><span class="badge ${t.status}">${t.status}</span></td>
        <td class="muted">${when(t.createdAt)}</td></tr>`);
      tr.onclick = () => go('tx', { id: t.id });
      tb.appendChild(tr);
    }
    if (!all.length) txCard.appendChild(el('<div class="empty">No transactions.</div>'));
    else txCard.appendChild(table);
    view.appendChild(txCard);

    // Payment ledger
    const [payments, reviews] = await Promise.all([api('/admin/payments'), api('/admin/reviews')]);
    const payCard = el('<div class="card" style="margin-top:16px"><h2>Payment ledger</h2></div>');
    if (!payments.length) payCard.appendChild(el('<div class="empty">No payments yet.</div>'));
    else {
      const pt = el(`<table><thead><tr><th>Type</th><th>Amount</th><th>Method</th><th>Transaction</th><th>Status</th><th>When</th></tr></thead><tbody></tbody></table>`);
      const ptb = $('tbody', pt);
      for (const p of payments) {
        const tr = el(`<tr class="clickable">
          <td><span class="badge kind-${p.kind}">${p.kind}</span></td>
          <td>${money(p.amountCents, p.transaction?.currency || 'KES')}</td>
          <td>${p.method}</td>
          <td>${esc(p.transaction?.description || p.transactionId)}</td>
          <td class="muted">${esc(p.status)}</td>
          <td class="muted">${when(p.createdAt)}</td></tr>`);
        if (p.transaction?.id) tr.onclick = () => go('tx', { id: p.transaction.id });
        ptb.appendChild(tr);
      }
      payCard.appendChild(pt);
    }
    view.appendChild(payCard);

    // Reviews
    const revCard = el('<div class="card" style="margin-top:16px"><h2>Reviews</h2></div>');
    if (!reviews.length) revCard.appendChild(el('<div class="empty">No reviews yet.</div>'));
    else {
      for (const r of reviews) {
        revCard.appendChild(el(`<div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px">
          <div class="row-between">
            <div><span class="stars">${'★'.repeat(r.score)}${'☆'.repeat(5 - r.score)}</span>
              <span class="muted">${esc(r.rater?.email || '')} → ${esc(r.ratee?.email || '')}</span></div>
            <div class="muted">${when(r.createdAt)}</div>
          </div>
          ${r.comment ? `<p>${esc(r.comment)}</p>` : ''}
          <p class="muted">on ${esc(r.transaction?.description || r.transactionId)}</p>
        </div>`));
      }
    }
    view.appendChild(revCard);
  });

  // ---------- notifications bell ----------
  let bellTimer = null;
  function buildBell() {
    const wrap = el(`<span class="bell" style="position:relative">
      <a id="bellBtn" title="Notifications">${icon('bell', 20)}<span id="bellCount" class="bell-count" hidden>0</span></a>
      <div id="bellPanel" class="bell-panel" hidden></div>
    </span>`);
    wrap.querySelector('#bellBtn').onclick = (e) => { e.stopPropagation(); toggleBell(wrap); };
    return wrap;
  }
  async function toggleBell(wrap) {
    const panel = $('#bellPanel', wrap);
    if (!panel.hidden) { panel.hidden = true; return; }
    panel.hidden = false;
    panel.innerHTML = '<div class="muted" style="padding:10px">Loading…</div>';
    try {
      const { items } = await api('/notifications');
      if (!items.length) { panel.innerHTML = '<div class="muted" style="padding:12px">No notifications yet.</div>'; }
      else {
        panel.innerHTML = '';
        const head = el('<div class="bell-head"><strong>Notifications</strong><span class="link" id="markAll">Mark all read</span></div>');
        head.querySelector('#markAll').onclick = async () => { await api('/notifications/read-all', { method: 'POST' }); refreshBellCount(); toggleBell(wrap); toggleBell(wrap); };
        panel.appendChild(head);
        for (const n of items) {
          panel.appendChild(el(`<div class="bell-item ${n.read ? '' : 'unread'}">
            <div>${esc(n.message)}</div>
            <div class="t-time">${when(n.createdAt)}</div>
          </div>`));
        }
      }
      await api('/notifications/read-all', { method: 'POST' }); // opening the panel marks them read
      refreshBellCount();
    } catch (e) { panel.innerHTML = `<div class="muted" style="padding:10px">${esc(e.message)}</div>`; }
  }
  async function refreshBellCount() {
    const badge = document.getElementById('bellCount');
    if (!badge) return;
    try {
      const { unread } = await api('/notifications');
      if (unread > 0) { badge.textContent = unread > 99 ? '99+' : unread; badge.hidden = false; }
      else badge.hidden = true;
    } catch {}
  }
  function startBellPolling() {
    stopBellPolling();
    refreshBellCount();
    bellTimer = setInterval(refreshBellCount, 20000);
  }
  function stopBellPolling() { if (bellTimer) { clearInterval(bellTimer); bellTimer = null; } }
  document.addEventListener('click', () => { const p = document.getElementById('bellPanel'); if (p) p.hidden = true; });

  // ---------- boot ----------
  $('.brand').innerHTML = `${brandLogo()} SafePay <span>Escrow</span>`;
  $('.brand').onclick = () => go(session.isAuthed ? 'dashboard' : 'login');
  window.addEventListener('hashchange', render);
  renderNav();
  render();
})();
