(() => {
  'use strict';
  const config = window.invitationConfig;
  const $ = (id) => document.getElementById(id);
  const arabicNumber = new Intl.NumberFormat('ar-LB-u-nu-arab', { minimumIntegerDigits: 2, useGrouping: false });
  // Convert the wall-clock date in the configured IANA zone, independently of the visitor's zone.
  function zonedTimestamp(event) {
    const intended = Date.UTC(event.year, event.month - 1, event.day, event.hour, event.minute);
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: event.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    let timestamp = intended;
    for (let i = 0; i < 4; i++) {
      const parts = Object.fromEntries(formatter.formatToParts(timestamp).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
      const displayed = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
      timestamp += intended - displayed;
    }
    return timestamp;
  }
  const eventTime = zonedTimestamp(config.event);
  const date = new Date(eventTime);
  const dateLabel = new Intl.DateTimeFormat('ar-LB-u-nu-arab', { timeZone: config.event.timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  // Use the requested Arabic month and exact date typography for this invitation.
  const fullDate = config.event.year === 2026 && config.event.month === 10 && config.event.day === 31 ? 'السبت، ٣١ أكتوبر ٢٠٢٦' : dateLabel;
  $('event-date').textContent = fullDate;
  $('cover-date').textContent = fullDate;
  $('event-time').textContent = config.event.hour === 19 && config.event.minute === 0 ? 'الساعة السابعة مساءً' : 'الساعة ' + new Intl.DateTimeFormat('ar-LB-u-nu-arab', { timeZone: config.event.timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
  $('groom-name').textContent = config.groomName;
  $('bride-name').textContent = config.brideName;
  $('signature').textContent = `بِحُبٍّ، ${config.groomName.split(' ')[0]} و${config.brideName.split(' ')[0]}`;
  document.title = `${config.groomName} و${config.brideName} | دعوة كتب كتاب`;
  $('location').href = config.locationUrl;
  $('open').setAttribute('aria-label', `فتح دعوة كتب كتاب ${config.groomName} و${config.brideName}`);
  const coupleImage = $('couple-image');
  const coupleScene = $('couple-scene');
  coupleScene.setAttribute('aria-label', `${config.groomName} و${config.brideName} معًا`);
  const imageFallback = $('couple-image-fallback');
  coupleImage.onload = () => {
    const imageUrl = coupleImage.currentSrc || coupleImage.src;
    $('scene-base').setAttribute('href', imageUrl);
    $('scene-left-decorations').setAttribute('href', imageUrl);
    $('scene-girl').setAttribute('href', imageUrl);
    coupleScene.removeAttribute('hidden');
    imageFallback.hidden = true;
    fitCard();
  };
  coupleImage.onerror = () => {
    coupleScene.setAttribute('hidden', '');
    imageFallback.hidden = false;
    fitCard();
  };
  if (config.coupleImage && config.coupleImage.trim()) {
    coupleImage.src = config.coupleImage;
  } else {
    imageFallback.hidden = false;
  }
  const catImage = $('cat-image');
  catImage.onload = () => { $('cat-companion').hidden = false; };
  catImage.onerror = () => { $('cat-companion').hidden = true; };
  if (config.catImage && config.catImage.trim()) catImage.src = config.catImage;
  let countdownTimer;
  function updateCountdown() {
    const remaining = Math.max(0, Math.ceil((eventTime - Date.now()) / 1000));
    $('countdown-section').hidden = remaining === 0;
    if (!remaining) { clearInterval(countdownTimer); return; }
    const values = { days: Math.floor(remaining / 86400), hours: Math.floor(remaining / 3600) % 24, minutes: Math.floor(remaining / 60) % 60, seconds: remaining % 60 };
    for (const [key, value] of Object.entries(values)) $(key).textContent = arabicNumber.format(value);
  }
  updateCountdown();
  if (eventTime > Date.now()) countdownTimer = setInterval(updateCountdown, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateCountdown(); });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const openingScene = document.querySelector('.opening');
  const envelope = document.querySelector('.envelope');
  const pocket = document.querySelector('.paper-pocket');
  const card = document.querySelector('.invitation');
  const cardContent = card.querySelector('.card-content');
  const invitation = $('invitation');
  let opening = false;
  let openTimer;
  let sparkleTimer;
  let expansion;

  function centerNameConjunction() {
    const row = card.querySelector('.couple');
    const rowBounds = row.getBoundingClientRect();
    if (!rowBounds.width || !row.clientWidth) return;
    const groomBounds = $('groom-name').getBoundingClientRect();
    const brideBounds = $('bride-name').getBoundingClientRect();
    const scale = rowBounds.width / row.clientWidth;
    const gapCenter = (brideBounds.right + groomBounds.left) / 2;
    row.querySelector('.ampersand').style.left = `${(gapCenter - rowBounds.left) / scale}px`;
  }

  // Fit the complete invitation into the paper, without an inner scroll area.
  function fitCard() {
    if (invitation.hidden || card.parentElement !== invitation) return;
    cardContent.style.height = '100%';
    cardContent.style.transform = '';
    const styles = getComputedStyle(card);
    const available = card.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom);
    const needed = Math.max(cardContent.scrollHeight, cardContent.clientHeight);
    const scale = Math.min(1, available / needed);
    if (scale < 1) {
      cardContent.style.height = `${needed}px`;
      cardContent.style.transform = `scale(${scale})`;
    }
    centerNameConjunction();
  }
  window.addEventListener('resize', fitCard);
  if (document.fonts) document.fonts.ready.then(fitCard);

  function finishOpening() {
    expansion = null;
    centerNameConjunction();
    document.body.classList.remove('opening-in-progress', 'card-expanding');
    card.classList.add('celebrate');
    card.focus({ preventScroll: true });
    $('status').textContent = 'رسالة الدعوة مفتوحة';
    sparkleTimer = setTimeout(() => card.classList.remove('celebrate'), 1500);
  }

  function expandCard() {
    // Keep the same physical sheet: measure it before moving it back into page flow.
    const from = pocket.getBoundingClientRect();
    invitation.prepend(card);
    card.style.removeProperty('width');
    card.style.removeProperty('transform');
    openingScene.hidden = true;
    invitation.hidden = false;
    fitCard();
    document.body.classList.add('opened', 'card-expanding');
    window.scrollTo({ top: 0, behavior: 'instant' });
    const to = card.getBoundingClientRect();
    const scale = from.width / to.width;
    expansion = card.animate([
      {
        transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${scale})`,
        height: `${from.height / scale}px`
      },
      { transform: 'translate(0, 0) scale(1)', height: `${to.height}px` }
    ], { duration: 1150, easing: 'cubic-bezier(.22, .68, .24, 1)' });
    expansion.onfinish = finishOpening;
  }

  $('open').addEventListener('click', () => {
    if (opening) return;
    opening = true;
    $('open').setAttribute('aria-disabled', 'true');
    $('open').setAttribute('aria-expanded', 'true');
    $('status').textContent = 'تُفتح رسالة الدعوة';
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (reducedMotion.matches) {
      openingScene.hidden = true;
      invitation.hidden = false;
      fitCard();
      document.body.classList.add('opened');
      finishOpening();
      return;
    }

    // Measure the final responsive width without displaying a second card.
    invitation.classList.add('measuring');
    invitation.hidden = false;
    const cardWidth = card.getBoundingClientRect().width;
    invitation.hidden = true;
    invitation.classList.remove('measuring');
    envelope.style.transform = getComputedStyle(envelope).transform;
    pocket.append(card);
    card.style.width = `${cardWidth}px`;
    card.style.transform = `scale(${pocket.getBoundingClientRect().width / cardWidth})`;
    document.body.classList.add('opening-in-progress');
    // The seal and flap open first; the sheet clears the envelope before expanding.
    openTimer = setTimeout(expandCard, 1700);
  });

  $('replay').addEventListener('click', () => {
    clearTimeout(openTimer);
    clearTimeout(sparkleTimer);
    if (expansion) {
      expansion.onfinish = null;
      expansion.cancel();
      expansion = null;
    }
    invitation.prepend(card);
    card.style.removeProperty('width');
    card.style.removeProperty('transform');
    cardContent.style.height = '';
    cardContent.style.transform = '';
    envelope.style.removeProperty('transform');
    invitation.hidden = true;
    openingScene.hidden = false;
    document.body.classList.remove('opened', 'opening-in-progress', 'card-expanding');
    card.classList.remove('celebrate');
    $('open').setAttribute('aria-expanded', 'false');
    $('open').removeAttribute('aria-disabled');
    opening = false;
    window.scrollTo({ top: 0, behavior: 'instant' });
    $('open').focus({ preventScroll: true });
    $('status').textContent = 'الظرف مغلق. يمكن فتح الدعوة مجددًا';
  });
})();
