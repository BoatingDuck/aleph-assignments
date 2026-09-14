'use strict';
const disclosureButtons = document.querySelectorAll('.disclosure');
const panelAnimations = new Map();
function setExpanded(button, expanded) {
  const panel = document.getElementById(button.getAttribute('aria-controls'));
  if (!panel) return;
  if (button.getAttribute('aria-expanded') === String(expanded)) return;
  const startHeight = panel.hidden ? 0 : panel.getBoundingClientRect().height;
  const startPadding = panel.hidden ? '0px' : getComputedStyle(panel).paddingTop;
  const startOpacity = panel.hidden ? 0 : Number(getComputedStyle(panel).opacity);
  const previous = panelAnimations.get(panel);
  if (previous) {
    previous.animation.onfinish = null;
    previous.animation.cancel();
    panelAnimations.delete(panel);
  }
  button.setAttribute('aria-expanded', String(expanded));
  button.innerHTML = `${expanded ? '접기' : '자세히'} <span aria-hidden="true">${expanded ? '−' : '+'}</span>`;
  panel.inert = !expanded;
  const useMotion = document.documentElement.dataset.motion === 'on' && typeof panel.animate === 'function';
  if (!useMotion) {
    panel.hidden = !expanded;
    panel.style.removeProperty('overflow');
    return;
  }
  panel.hidden = false;
  const endHeight = expanded ? panel.getBoundingClientRect().height : 0;
  const endPadding = expanded ? getComputedStyle(panel).paddingTop : '0px';
  panel.style.overflow = 'hidden';
  const animation = panel.animate([
    { height: `${startHeight}px`, paddingTop: startPadding, opacity: startOpacity },
    { height: `${endHeight}px`, paddingTop: endPadding, opacity: expanded ? 1 : 0 }
  ], { duration: expanded ? 360 : 280, easing: 'cubic-bezier(.22,.68,.25,1)', fill: 'both' });
  const finish = () => {
    if (panelAnimations.get(panel)?.animation !== animation) return;
    panel.hidden = !expanded;
    animation.cancel();
    panel.style.removeProperty('overflow');
    panelAnimations.delete(panel);
  };
  panelAnimations.set(panel, { animation, finish });
  animation.onfinish = finish;
}
disclosureButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setExpanded(button, button.getAttribute('aria-expanded') !== 'true');
  });
});
document.querySelectorAll('[data-story-target]').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const button = Array.from(disclosureButtons).find(
      (item) => item.getAttribute('aria-controls') === link.dataset.storyTarget
    );
    if (button) {
      setExpanded(button, true);
      button.focus({ preventScroll: true });
    }
    // Keep native hash navigation and its browser history behavior.
  });
});
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
function syncMotion() {
  document.documentElement.dataset.motion = motionPreference.matches ? 'off' : 'on';
  if (motionPreference.matches) Array.from(panelAnimations.values()).forEach(({ finish }) => finish());
}
motionPreference.addEventListener('change', syncMotion);
syncMotion();
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('has-entered');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.strength, .project, .section-heading').forEach((element) => observer.observe(element));
}
