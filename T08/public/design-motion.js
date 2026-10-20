/* T08 v6: presentation only. No authentication state, server response or
 * passkey behavior is read or modified here. Original T01 details remain. */
(() => {
  'use strict';
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const hoverMedia = matchMedia('(hover: hover) and (pointer: fine)');
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const root = document.documentElement;

  // Condense the first view without removing any original T01 content.
  const intro = $('.intro');
  const introText = intro?.querySelector('.intro-text');
  const audience = intro?.querySelector('.audience');
  if (intro && introText && audience && !$('.t08-standfirst')) {
    const short = document.createElement('p');
    short.className = 't08-standfirst';
    short.textContent = '보안을 공부하며, 실험하고 기록합니다.';
    introText.before(short);
    const details = document.createElement('details');
    details.className = 't08-context-note';
    const summary = document.createElement('summary');
    summary.textContent = '소개 자세히';
    details.append(summary, introText, audience);
    intro.querySelector('.intro-evidence')?.before(details);
  }

  // Put the existing summary inside its corresponding expanded description.
  // The text remains in the DOM and is available with keyboard interaction.
  $$('.strength').forEach(strength => {
    const story = strength.querySelector('.story');
    const abstract = strength.querySelector('.summary-text');
    const auxiliary = strength.querySelector('.strength-main > p');
    if (story && abstract) story.prepend(abstract);
    if (story && auxiliary) story.append(auxiliary);
    // Keep the original disclosure button in the right-hand column,
    // but let the expanded article span the empty middle and right columns.
    // The original T01 script targets the panel by ID, so moving it within
    // its article does not change open/close behavior.
    if (story && story.parentElement !== strength) strength.append(story);
  });

  // T01 prose is preserved, but hand-inserted line breaks in the three
  // experience headings are removed in the T08 view (natural wrapping only).
  $$('.strength h3').forEach(title => {
    title.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode(' ')));
  });

  // Animate each original title line independently. Move nodes, not text:
  // the h1 and its original wording remain available to assistive tech.
  const heading = $('.intro h1');
  if (heading && !heading.querySelector('.t08-title-line')) {
    const fragment = document.createDocumentFragment();
    let inner = document.createElement('span');
    const finishLine = () => {
      if (!inner.childNodes.length) return;
      const clip = document.createElement('span');
      clip.className = 't08-title-line';
      inner.className = 't08-title-inner';
      clip.append(inner);
      fragment.append(clip);
      inner = document.createElement('span');
    };
    for (const node of [...heading.childNodes]) {
      if (node.nodeName === 'BR') finishLine();
      else inner.append(node);
    }
    finishLine();
    heading.replaceChildren(fragment);
  }

  // Small luminous ambient layer gives the hero depth; purely decorative.
  const hero = $('.hero');
  if (hero) {
    const ambient = document.createElement('div');
    ambient.className = 't08-ambient';
    ambient.setAttribute('aria-hidden', 'true');
    ambient.innerHTML = '<span class="t08-ambient-ring t08-ring-a"></span><span class="t08-ambient-ring t08-ring-b"></span><span class="t08-ambient-dot"></span>';
    hero.prepend(ambient);
  }

  // Reading-progress indicator follows scrolling, without masking content.
  if (!$('.t08-reading-progress')) {
    const bar = document.createElement('div');
    bar.className = 't08-reading-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.prepend(bar);
  }
  const bar = $('.t08-reading-progress');
  let scrollQueued = false;
  const updateScroll = () => {
    scrollQueued = false;
    const possible = root.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${possible > 0 ? Math.min(1, window.scrollY / possible) : 0})`;
  };
  const onScroll = () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(updateScroll);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  updateScroll();

  // Reveal sections on scroll; don't hide anything before JS is initialized.
  const revealTargets = $$('.section-heading, .strength, .project, .scope-toggle, .private-heading, .private-panel');
  let revealObserver;
  const applyMotionPreference = () => {
    revealObserver?.disconnect();
    if (media.matches || !('IntersectionObserver' in window)) {
      root.classList.remove('t08-motion');
      revealTargets.forEach(el => {
        el.classList.remove('t08-reveal', 't08-visible');
        el.style.removeProperty('--t08-delay');
      });
      return;
    }
    revealTargets.forEach((el, index) => {
      el.classList.add('t08-reveal');
      el.style.setProperty('--t08-delay', `${(index % 3) * 95}ms`);
    });
    revealObserver = new IntersectionObserver(changes => {
      changes.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('t08-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -25px 0px' });
    revealTargets.forEach(el => revealObserver.observe(el));
    root.classList.add('t08-motion');
  };
  applyMotionPreference();
  media.addEventListener('change', applyMotionPreference);

  // Active navigation section is not inferred from authentication content.
  const links = $$('header nav a[href^="#"]');
  if ('IntersectionObserver' in window) {
    const entries = links.map(link => ({ link, section: $(link.getAttribute('href')) })).filter(item => item.section);
    const navObserver = new IntersectionObserver(changes => {
      changes.forEach(change => {
        if (!change.isIntersecting) return;
        entries.forEach(item => item.link.classList.toggle('t08-active', item.section === change.target));
      });
    }, { rootMargin: '-23% 0px -65% 0px' });
    entries.forEach(item => navObserver.observe(item.section));
  }

  // Pointer-follow spotlight: ease the light towards the pointer instead of
  // snapping to each new position. This is independent of the hover cards.
  const spot = { x:50, y:36, targetX:50, targetY:36 };
  let pointerFrame = 0;
  const paintSpotlight = () => {
    pointerFrame = 0;
    if (!hero || media.matches) return;
    // Exponential interpolation yields the same gentle pace on any monitor.
    spot.x += (spot.targetX-spot.x)*.105;
    spot.y += (spot.targetY-spot.y)*.105;
    hero.style.setProperty('--spot-x', `${spot.x.toFixed(2)}%`);
    hero.style.setProperty('--spot-y', `${spot.y.toFixed(2)}%`);
    if (Math.abs(spot.targetX-spot.x)>0.08 || Math.abs(spot.targetY-spot.y)>0.08)
      pointerFrame = requestAnimationFrame(paintSpotlight);
  };
  const aimSpotlight = (x,y) => {
    spot.targetX=Math.min(100,Math.max(0,x));
    spot.targetY=Math.min(100,Math.max(0,y));
    if (!pointerFrame) pointerFrame=requestAnimationFrame(paintSpotlight);
  };
  hero?.addEventListener('pointermove', event => {
    if (media.matches || !hoverMedia.matches) return;
    const rect = hero.getBoundingClientRect();
    aimSpotlight((event.clientX-rect.left)/rect.width*100,
                 (event.clientY-rect.top)/rect.height*100);
  }, { passive:true });
  hero?.addEventListener('pointerleave', () => {
    if (!media.matches && hoverMedia.matches) aimSpotlight(50,36);
  });

  // Hover responds through subtle light and lift, not a distracting 3D tilt.
  [...$$('.project'), ...$$('.overview-list li')].forEach(el => {
    el.addEventListener('pointermove', event => {
      if (media.matches || !hoverMedia.matches) return;
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--local-x', `${Math.round((event.clientX - rect.left) / rect.width * 100)}%`);
      el.style.setProperty('--local-y', `${Math.round((event.clientY - rect.top) / rect.height * 100)}%`);
    }, { passive: true });
  });
})();
