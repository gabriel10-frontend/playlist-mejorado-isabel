"use strict";

// The original five songs and audio files are preserved.
const items = Array.from(document.querySelectorAll('input[name="slider"]'));
const songInfos = Array.from(document.querySelectorAll('.song-info'));
const cards = Array.from(document.querySelectorAll('.card'));
const audioElements = items.map((_, index) => document.getElementById(`audio-${index + 1}`));
const progressBars = songInfos.map((info) => info.querySelector('.progress-bar'));
const prevButton = document.getElementById('prev');
const nextButton = document.getElementById('next');
const playButton = document.getElementById('pause');
const favoriteButton = document.getElementById('favorite');
const modal = document.getElementById('notificationModal');
const openButton = document.getElementById('openPlaylist');
const app = document.getElementById('playlistApp');

let currentIndex = 0;
let playlistOpened = false;
const favoriteStorageKey = 'playlist-isabel-favoritos-v1';
const fallbackColors = [
  [120, 145, 167], [185, 136, 147], [122, 157, 157],
  [133, 166, 188], [184, 142, 168]
];

function readFavorites() {
  try {
    const stored = JSON.parse(localStorage.getItem(favoriteStorageKey) || '[]');
    return new Set(Array.isArray(stored) ? stored.filter((number) => Number.isInteger(number) && number >= 0 && number < items.length) : []);
  } catch (_) {
    return new Set();
  }
}
const favorites = readFavorites();

function saveFavorites() {
  try { localStorage.setItem(favoriteStorageKey, JSON.stringify([...favorites])); }
  catch (_) { /* Favorites still work during this visit when storage is disabled. */ }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function updateProgress(index) {
  const audio = audioElements[index];
  const info = songInfos[index];
  const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
  const elapsed = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  const percentage = duration ? Math.min(100, Math.max(0, elapsed / duration * 100)) : 0;
  const progress = progressBars[index];
  progress.value = percentage;
  progress.style.setProperty('--progress', `${percentage}%`);
  progress.disabled = !duration;
  info.querySelector('.duration').textContent = duration ? formatTime(duration) : '--:--';
  info.querySelector('.elapsed').textContent = formatTime(elapsed);
  info.querySelector('.remaining').textContent = duration ? `-${formatTime(Math.max(0, duration - elapsed))}` : '--:--';
}

function syncPlayButton() {
  const isPlaying = playlistOpened && !audioElements[currentIndex].paused;
  playButton.textContent = isPlaying ? '▐▐' : '►';
  playButton.setAttribute('aria-label', isPlaying ? 'Pausar' : 'Reproducir');
  playButton.title = isPlaying ? 'Pausar' : 'Reproducir';
}

function syncFavoriteButton() {
  const selected = favorites.has(currentIndex);
  favoriteButton.classList.toggle('favorited', selected);
  favoriteButton.textContent = selected ? '♥' : '♡';
  favoriteButton.setAttribute('aria-pressed', String(selected));
  favoriteButton.setAttribute('aria-label', selected ? 'Quitar de favoritos' : 'Agregar a favoritos');
  favoriteButton.title = selected ? 'Quitar de favoritos' : 'Agregar a favoritos';
}

function playCurrent() {
  if (!playlistOpened) return;
  const playingIndex = currentIndex;
  const audio = audioElements[playingIndex];
  const result = audio.play();
  if (result && typeof result.catch === 'function') {
    result.catch((error) => {
      // A browser may block sound (or the file may be unavailable). Keep the controls usable.
      if (playingIndex === currentIndex) {
        syncPlayButton();
        if (error?.name !== 'AbortError') console.warn('No se pudo reproducir esta canción:', error);
      }
    });
  }
}

function selectTrack(index, shouldPlay = playlistOpened) {
  if (!Number.isInteger(index) || index < 0 || index >= items.length) return;
  const changed = index !== currentIndex;
  audioElements.forEach((audio, i) => {
    if (i !== index) {
      audio.pause();
      if (changed && Number.isFinite(audio.duration)) {
        try { audio.currentTime = 0; } catch (_) {}
      }
      updateProgress(i);
    }
  });
  currentIndex = index;
  if (changed) {
    try { audioElements[index].currentTime = 0; } catch (_) {}
  }
  items.forEach((item, i) => { item.checked = i === index; });
  songInfos.forEach((info, i) => { info.classList.toggle('active', i === index); });
  updateProgress(index);
  syncFavoriteButton();
  applySoftTheme(cards[index]);
  if (shouldPlay && playlistOpened) playCurrent();
  syncPlayButton();
}

function closeModal() {
  if (playlistOpened) return;
  playlistOpened = true;
  document.body.classList.remove('welcome-open');
  modal.classList.add('is-closing');
  modal.setAttribute('aria-hidden', 'true');
  if ('inert' in modal) modal.inert = true;
  if ('inert' in app) app.inert = false;
  openButton.blur();
  playButton.focus({ preventScroll: true });
  playCurrent();
  syncPlayButton();
  window.setTimeout(() => { modal.hidden = true; }, 580);
}

openButton.addEventListener('click', closeModal);
// Do not dismiss on a click outside: the opening action must be a user gesture to allow audio.
if ('inert' in app) app.inert = true;
window.addEventListener('load', () => openButton.focus({ preventScroll: true }));

items.forEach((radio, i) => {
  radio.addEventListener('change', () => {
    if (radio.checked) selectTrack(i);
  });
});

prevButton.addEventListener('click', () => selectTrack((currentIndex - 1 + items.length) % items.length));
nextButton.addEventListener('click', () => selectTrack((currentIndex + 1) % items.length));

playButton.addEventListener('click', () => {
  if (!playlistOpened) return;
  const audio = audioElements[currentIndex];
  if (audio.paused) playCurrent();
  else audio.pause();
  syncPlayButton();
});

favoriteButton.addEventListener('click', () => {
  if (favorites.has(currentIndex)) favorites.delete(currentIndex);
  else favorites.add(currentIndex);
  saveFavorites();
  syncFavoriteButton();
});

audioElements.forEach((audio, index) => {
  audio.addEventListener('loadedmetadata', () => updateProgress(index));
  audio.addEventListener('durationchange', () => updateProgress(index));
  audio.addEventListener('timeupdate', () => updateProgress(index));
  audio.addEventListener('seeked', () => updateProgress(index));
  audio.addEventListener('pause', () => { if (index === currentIndex) syncPlayButton(); });
  audio.addEventListener('play', () => { if (index === currentIndex) syncPlayButton(); });
  audio.addEventListener('playing', () => { if (index === currentIndex) syncPlayButton(); });
  audio.addEventListener('ended', () => {
    if (index === currentIndex && playlistOpened) selectTrack((index + 1) % items.length);
  });
  audio.addEventListener('error', () => {
    if (index === currentIndex) syncPlayButton();
  });
  progressBars[index].addEventListener('input', (event) => {
    const duration = audio.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    audio.currentTime = (Number(event.target.value) / 100) * duration;
    updateProgress(index);
  });
  updateProgress(index);
});

// Subtle original pastel theme, synchronized with each active cover.
function mixColors(a, b, t) {
  return a.map((value, i) => Math.round(value + (b[i] - value) * t));
}
function rgb([r, g, b]) { return `rgb(${r}, ${g}, ${b})`; }
function applySoftTheme(card) {
  if (!card) return;
  const index = cards.indexOf(card);
  const base = card._palette || fallbackColors[index] || fallbackColors[0];
  const dark = mixColors(base, [36, 39, 48], 0.58);
  const light = mixColors(base, [255, 255, 255], 0.74);
  const playerLight = mixColors(base, [255, 255, 255], 0.59);
  const appColor = document.querySelector('.container');
  const player = document.querySelector('.player');
  document.body.style.backgroundColor = rgb(mixColors(base, [255, 255, 255], 0.65));
  appColor.style.backgroundColor = rgb(light);
  appColor.style.borderColor = rgb(dark);
  appColor.style.color = rgb(dark);
  player.style.backgroundColor = rgb(playerLight);
  player.style.borderColor = rgb(dark);
  player.style.color = rgb(dark);
  document.querySelectorAll('.left-side h1, .left-side p, .controls button').forEach((el) => {
    el.style.color = rgb(dark);
  });
  document.documentElement.style.setProperty('--track-fill', rgb(dark));
  document.documentElement.style.setProperty('--track-base', rgb(mixColors(base, [255, 255, 255], 0.18)));
}

function useCardPalette(card, index, palette) {
  card._palette = palette;
  const dark = mixColors(palette, [36, 39, 48], 0.38);
  card.style.backgroundColor = rgb(palette);
  card.style.borderColor = rgb(dark);
  if (index === currentIndex) applySoftTheme(card);
}

function readImageColor(img, fallback) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return fallback;
    ctx.drawImage(img, 0, 0, 32, 32);
    const pixelData = ctx.getImageData(0, 0, 32, 32).data;
    let r = 0, g = 0, b = 0, total = 0;
    for (let i = 0; i < pixelData.length; i += 4) {
      if (pixelData[i + 3] < 128) continue;
      r += pixelData[i]; g += pixelData[i + 1]; b += pixelData[i + 2]; total++;
    }
    return total ? [Math.round(r / total), Math.round(g / total), Math.round(b / total)] : fallback;
  } catch (_) {
    // A remote cover may load but refuse canvas color extraction due to CORS.
    return fallback;
  }
}

cards.forEach((card, index) => {
  const img = card.querySelector('img');
  useCardPalette(card, index, fallbackColors[index]);
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Seleccionar ${songInfos[index].querySelector('.title').textContent}`);
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectTrack(index);
    }
  });
  if (!img) return;
  let fallbackUsed = false;
  img.addEventListener('load', () => useCardPalette(card, index, readImageColor(img, fallbackColors[index])));
  img.addEventListener('error', () => {
    if (fallbackUsed) return;
    fallbackUsed = true;
    img.src = `portada-respaldo-${index + 1}.svg`;
  });
  if (img.complete) {
    if (img.naturalWidth) useCardPalette(card, index, readImageColor(img, fallbackColors[index]));
    else { fallbackUsed = true; img.src = `portada-respaldo-${index + 1}.svg`; }
  }
});

// The player starts paused behind the welcome screen.
selectTrack(0, false);
