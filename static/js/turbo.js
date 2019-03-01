const toggleTurbo = () => {
  const main = document.querySelector('.js-main');
  main.classList.toggle('turbo-mode');
};

document.addEventListener('DOMContentLoaded', () => {
  const turboButton = document.querySelector('.js-turbo');
  turboButton.addEventListener('click', toggleTurbo);
  turboButton.addEventListener('touchend', toggleTurbo);
});
