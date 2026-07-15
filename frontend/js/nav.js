export function go(page) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.getElementById(`${page}-page`)?.classList.add('active');
  document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'));
  document.querySelector(`.nav-link[data-page="${page}"]`)?.classList.add('active');
  window.scrollTo(0, 0);
}

export function initNav() {
  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      go(el.dataset.nav);
    });
  });

  window.addEventListener('scroll', () => {
    document.getElementById('nav')?.classList.toggle('scrolled', window.scrollY > 8);
  });
}
