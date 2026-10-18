'use strict';
// Cookie consent for Google Analytics (POPIA: analytics only with an opt-in).
// The choice is kept for 12 months in localStorage. Google's script is only requested after "Accept",
// and only when a measurement ID is set (<meta name="ga-id">, from ga_id in src/site.json).
// Any [.cookie-settings] button reopens the banner so a visitor can change their mind.
(() => {
  const KEY = 'dm-cookie-consent';
  const YEAR = 365 * 24 * 60 * 60 * 1000;
  const banner = document.querySelector('.cookie-banner');
  const gaId = document.querySelector('meta[name="ga-id"]')?.content.trim();

  const read = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      return saved && Date.now() - saved.at < YEAR ? saved.choice : null;
    } catch { return null; }
  };
  const save = choice => {
    try { localStorage.setItem(KEY, JSON.stringify({ choice, at: Date.now() })); } catch {}
  };

  let loaded = false;
  const loadAnalytics = () => {
    if (!gaId || loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    gtag('js', new Date());
    gtag('config', gaId);
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.append(script);
  };

  // Withdrawing consent: tell Google to stop and remove its cookies from this site.
  const removeAnalytics = () => {
    if (window.gtag) gtag('consent', 'update', { analytics_storage: 'denied' });
    const host = location.hostname;
    const domains = ['', host, `.${host}`, `.${host.split('.').slice(-3).join('.')}`];
    for (const name of document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(n => n.startsWith('_ga'))) {
      for (const domain of domains) document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`;
    }
  };

  const show = () => { if (banner) banner.hidden = false; };
  const hide = () => { if (banner) banner.hidden = true; };

  banner?.addEventListener('click', event => {
    const button = event.target.closest('[data-consent]');
    if (!button) return;
    const choice = button.dataset.consent;
    const before = read();
    save(choice);
    hide();
    if (choice === 'granted') loadAnalytics();
    else if (before === 'granted') removeAnalytics();
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.cookie-settings')) return;
    show();
    banner?.querySelector('[data-consent]')?.focus();
  });

  const choice = read();
  if (choice === 'granted') loadAnalytics();
  else if (!choice) show();
})();
