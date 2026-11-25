const CHAPTERS = [
  { id: "00", tag: "Intro", bookTitle: "Visão Geral da Obra", episodeTitle: "Como seus pensamentos alteram sua biologia", file: "audio/00-intro.m4a" },
  { id: "01", tag: "Cap. 1", bookTitle: "Abrindo a Porta para o Sobrenatural", episodeTitle: "Como Anna curou o câncer pela mente", file: "audio/01-cap1.m4a" },
  { id: "02", tag: "Cap. 2", bookTitle: "O Momento Presente", episodeTitle: "Como o corpo se vicia no estresse", file: "audio/02-cap2.m4a" },
  { id: "03", tag: "Cap. 3", bookTitle: "Sintonizando com Novos Potenciais", episodeTitle: "Como alterar a realidade no campo quântico", file: "audio/03-cap3.m4a" },
  { id: "04", tag: "Cap. 4", bookTitle: "A Bênção dos Centros de Energia", episodeTitle: "Como a mente reprograma a biologia (Chakras)", file: "audio/04-cap4.m4a" },
  { id: "05", tag: "Cap. 5", bookTitle: "Recondicionando o Corpo a uma Nova Mente", episodeTitle: "Como libertar a energia presa no corpo", file: "audio/05-cap5.m4a" },
  { id: "06", tag: "Cap. 6", bookTitle: "Casos de Estudo: Exemplos de Cura", episodeTitle: "A biologia da cura espontânea", file: "audio/06-cap6.m4a" },
  { id: "07", tag: "Cap. 7", bookTitle: "Inteligência do Coração e Coerência", episodeTitle: "O coração é um segundo cérebro", file: "audio/07-cap7.m4a" },
  { id: "08", tag: "Cap. 8", bookTitle: "Mind Movies e o Caleidoscópio", episodeTitle: "Caleidoscópio e Mind Movies na reprogramação", file: "audio/08-cap8.m4a" },
  { id: "09", tag: "Cap. 9", bookTitle: "Meditação Caminhada", episodeTitle: "Meditação caminhada de olhos abertos", file: "audio/09-cap9.m4a" },
  { id: "10", tag: "Cap. 10", bookTitle: "Estudos de Caso: Tornando Real", episodeTitle: "Como a mente reprograma a biologia (Casos)", file: "audio/10-cap10.m4a" },
  { id: "11", tag: "Cap. 11", bookTitle: "Espaço-Tempo e Tempo-Espaço", episodeTitle: "A ciência da quinta dimensão", file: "audio/11-cap11.m4a" },
  { id: "12", tag: "Cap. 12", bookTitle: "A Glândula Pineal", episodeTitle: "Como a glândula pineal produz DMT", file: "audio/12-cap12.m4a" },
  { id: "13", tag: "Cap. 13", bookTitle: "Projeto Coerência: Mundo Melhor", episodeTitle: "Como a meditação coletiva reduz a violência", file: "audio/13-cap13.m4a" },
  { id: "14", tag: "Cap. 14", bookTitle: "Estudos de Caso: Poderia Acontecer com Você", episodeTitle: "Como o cérebro cura doenças instantaneamente", file: "audio/14-cap14.m4a" },
  { id: "15", tag: "Bônus", bookTitle: "Deep Dive Extra", episodeTitle: "Como a mente cura o corpo", file: "audio/15-bonus.m4a" }
];

const STORAGE_KEY = "sobrenatural_audio_state_v1";
const AUDIO_CACHE = "sobrenatural-audio-files-v1";
const SPEEDS = [1.0, 1.25, 1.5, 1.75, 2.0];
const SLEEP_OPTIONS = [0, 15, 30, 45, -1]; // -1 = fim do capítulo

const defaultState = () => ({
  lastChapterId: null,
  speed: 1.0,
  autoplay: true,
  progress: {} // { [id]: { time: number, duration: number, done: boolean } }
});

let state = loadState();
let currentIndex = -1;
let pendingSeek = null;
let isSeeking = false;
let sleepTimerId = null;
let sleepModeIndex = 0;
let cachedFiles = new Set();

const audio = document.getElementById("audio-el");
const listEl = document.getElementById("chapters-list");
const resumeCard = document.getElementById("resume-card");
const miniPlayer = document.getElementById("mini-player");
const fullPlayer = document.getElementById("full-player");
const seekSlider = document.getElementById("seek-slider");

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "--:--";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

async function refreshCachedSet() {
  if (!("caches" in window)) return;
  try {
    const cache = await caches.open(AUDIO_CACHE);
    const keys = await cache.keys();
    cachedFiles = new Set(keys.map(req => new URL(req.url).pathname));
  } catch {
    cachedFiles = new Set();
  }
}

function isFileCached(file) {
  const fullPath = new URL(file, window.location.href).pathname;
  return cachedFiles.has(fullPath);
}

async function cacheChapterAudio(file, btn) {
  if (!("caches" in window)) return;
  if (btn) btn.textContent = "Baixando...";
  try {
    const cache = await caches.open(AUDIO_CACHE);
    await cache.add(file);
    await refreshCachedSet();
    renderList();
  } catch {
    if (btn) btn.textContent = "Erro";
  }
}

async function cacheAllAudios() {
  if (!("caches" in window)) return;
  const label = document.getElementById("offline-all-label");
  const cache = await caches.open(AUDIO_CACHE);
  for (let i = 0; i < CHAPTERS.length; i++) {
    label.textContent = `Baixando ${i + 1}/${CHAPTERS.length}`;
    if (!isFileCached(CHAPTERS[i].file)) {
      await cache.add(CHAPTERS[i].file);
    }
  }
  await refreshCachedSet();
  label.textContent = "Tudo offline ✓";
  renderList();
}

function renderOverall() {
  const doneCount = CHAPTERS.filter(c => state.progress[c.id]?.done).length;
  const pct = Math.round((doneCount / CHAPTERS.length) * 100);
  document.getElementById("overall-count").textContent = `${doneCount} de ${CHAPTERS.length} concluídos`;
  document.getElementById("overall-percent").textContent = `${pct}%`;
  document.getElementById("overall-bar").style.width = `${pct}%`;
}

function renderResume() {
  const idx = CHAPTERS.findIndex(c => c.id === state.lastChapterId);
  if (idx === -1) {
    resumeCard.classList.add("hidden");
    return;
  }
  const ch = CHAPTERS[idx];
  const prog = state.progress[ch.id] || {};
  resumeCard.classList.remove("hidden");
  document.getElementById("resume-chapter-title").textContent = `${ch.tag} · ${ch.bookTitle}`;
  document.getElementById("resume-episode-title").textContent = ch.episodeTitle;
  const timeText = prog.duration ? `${formatTime(prog.time || 0)} / ${formatTime(prog.duration)}` : formatTime(prog.time || 0);
  document.getElementById("resume-time").textContent = `Parou em ${timeText}`;
}

function renderList() {
  listEl.innerHTML = "";
  CHAPTERS.forEach((ch, idx) => {
    const prog = state.progress[ch.id] || {};
    const pct = prog.duration ? Math.min(100, Math.round(((prog.time || 0) / prog.duration) * 100)) : 0;
    const isActive = idx === currentIndex;
    const isCached = isFileCached(ch.file);

    const li = document.createElement("li");
    li.className = `chapter-item${isActive ? " active" : ""}${prog.done ? " done" : ""}`;
    li.innerHTML = `
      <div class="chapter-top">
        <div>
          <div class="chapter-badge">${ch.tag}${isActive && !audio.paused ? " · Tocando" : ""}</div>
          <div class="chapter-book-title">${ch.bookTitle}</div>
          <div class="chapter-ep-title">${ch.episodeTitle}</div>
        </div>
        <div class="chapter-right">
          <button class="btn-dl-chap${isCached ? " cached" : ""}" type="button" data-dl="${ch.file}">
            ${isCached ? "Offline ✓" : "↓"}
          </button>
          <span class="status-pill${prog.done ? " done" : ""}">
            ${prog.done ? "Concluído" : (prog.time > 5 ? formatTime(prog.time) : (prog.duration ? formatTime(prog.duration) : "Ouvir"))}
          </span>
        </div>
      </div>
      <div class="chapter-progress-track">
        <div class="chapter-progress-fill" style="width: ${prog.done ? 100 : pct}%"></div>
      </div>
    `;

    li.addEventListener("click", (e) => {
      const dlBtn = e.target.closest("[data-dl]");
      if (dlBtn) {
        e.stopPropagation();
        cacheChapterAudio(ch.file, dlBtn);
        return;
      }
      playChapter(idx, true);
    });
    listEl.appendChild(li);
  });

  renderOverall();
  renderResume();
}

function updatePlayerUI() {
  if (currentIndex < 0) return;
  const ch = CHAPTERS[currentIndex];
  const playing = !audio.paused;

  document.getElementById("mini-chap").textContent = ch.tag;
  document.getElementById("mini-title").textContent = `${ch.bookTitle} · ${ch.episodeTitle}`;
  document.getElementById("mini-play").textContent = playing ? "❚❚" : "▶";
  document.getElementById("btn-play-main").textContent = playing ? "❚❚" : "▶";

  document.getElementById("full-chap-tag").textContent = ch.tag;
  document.getElementById("full-chap-name").textContent = ch.bookTitle;
  document.getElementById("full-episode-title").textContent = ch.episodeTitle;
  document.getElementById("full-chap-subtitle").textContent = `${ch.tag} · ${ch.bookTitle}`;

  const prog = state.progress[ch.id] || {};
  document.getElementById("btn-mark-done").textContent = prog.done ? "✓ Concluído" : "✓ Concluir";
  document.getElementById("btn-speed").textContent = `Velocidade: ${state.speed}x`;
  document.getElementById("btn-autoplay").textContent = `Contínuo: ${state.autoplay ? "On" : "Off"}`;
  document.getElementById("btn-autoplay").classList.toggle("active", state.autoplay);

  updateMediaSession(ch);
}

function updateMediaSession(ch) {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: `${ch.tag}: ${ch.episodeTitle}`,
    artist: "Dr. Joe Dispenza",
    album: "Como se Tornar Sobrenatural"
  });
  navigator.mediaSession.setActionHandler("play", () => audio.play());
  navigator.mediaSession.setActionHandler("pause", () => audio.pause());
  navigator.mediaSession.setActionHandler("seekbackward", () => skipBy(-15));
  navigator.mediaSession.setActionHandler("seekforward", () => skipBy(30));
  navigator.mediaSession.setActionHandler("previoustrack", () => prevChapter());
  navigator.mediaSession.setActionHandler("nexttrack", () => nextChapter());
}

function playChapter(idx, autoStart = true) {
  if (idx < 0 || idx >= CHAPTERS.length) return;
  currentIndex = idx;
  const ch = CHAPTERS[idx];
  const saved = state.progress[ch.id] || {};
  const resumeAt = saved.done ? 0 : (saved.time || 0);

  state.lastChapterId = ch.id;
  saveState();

  miniPlayer.classList.remove("hidden");
  pendingSeek = resumeAt > 2 ? resumeAt : 0;

  if (audio.getAttribute("data-id") !== ch.id) {
    audio.setAttribute("data-id", ch.id);
    audio.src = ch.file;
    audio.load();
  } else if (pendingSeek !== null) {
    audio.currentTime = pendingSeek;
    pendingSeek = null;
  }

  audio.playbackRate = state.speed;
  if (autoStart) {
    audio.play().catch(() => {});
  }
  updatePlayerUI();
  renderList();
}

function togglePlay() {
  if (currentIndex < 0) {
    const idx = Math.max(0, CHAPTERS.findIndex(c => c.id === state.lastChapterId));
    playChapter(idx, true);
    return;
  }
  if (audio.paused) {
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
}

function skipBy(delta) {
  if (currentIndex < 0) return;
  const target = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + delta));
  audio.currentTime = target;
  persistCurrentTime();
}

function prevChapter() {
  if (currentIndex > 0) playChapter(currentIndex - 1, true);
}

function nextChapter() {
  if (currentIndex < CHAPTERS.length - 1) playChapter(currentIndex + 1, true);
}

function persistCurrentTime() {
  if (currentIndex < 0) return;
  const ch = CHAPTERS[currentIndex];
  const dur = Number.isFinite(audio.duration) ? audio.duration : (state.progress[ch.id]?.duration || 0);
  const cur = audio.currentTime || 0;
  const wasDone = state.progress[ch.id]?.done || false;
  const isDone = wasDone || (dur > 0 && cur >= dur * 0.96);

  state.progress[ch.id] = { time: cur, duration: dur, done: isDone };
  state.lastChapterId = ch.id;
  saveState();
}

let lastSavedTick = 0;
audio.addEventListener("loadedmetadata", () => {
  if (pendingSeek !== null && pendingSeek < (audio.duration || Infinity)) {
    audio.currentTime = pendingSeek;
  }
  pendingSeek = null;
  audio.playbackRate = state.speed;
  persistCurrentTime();
  updateTimeUI();
});

audio.addEventListener("timeupdate", () => {
  if (!isSeeking) updateTimeUI();
  const now = Date.now();
  if (now - lastSavedTick > 2000) {
    lastSavedTick = now;
    persistCurrentTime();
  }
});

audio.addEventListener("play", () => {
  updatePlayerUI();
  renderList();
});

audio.addEventListener("pause", () => {
  persistCurrentTime();
  updatePlayerUI();
  renderList();
});

audio.addEventListener("ended", () => {
  const ch = CHAPTERS[currentIndex];
  if (ch) {
    state.progress[ch.id] = { time: audio.duration || 0, duration: audio.duration || 0, done: true };
    saveState();
  }
  if (SLEEP_OPTIONS[sleepModeIndex] === -1) {
    sleepModeIndex = 0;
    document.getElementById("btn-sleep").textContent = "Sono: Off";
    renderList();
    return;
  }
  if (state.autoplay && currentIndex < CHAPTERS.length - 1) {
    playChapter(currentIndex + 1, true);
  } else {
    renderList();
  }
});

function updateTimeUI() {
  const cur = audio.currentTime || 0;
  const dur = audio.duration || 0;
  const pct = dur > 0 ? (cur / dur) * 100 : 0;

  document.getElementById("time-current").textContent = formatTime(cur);
  document.getElementById("time-duration").textContent = formatTime(dur);
  document.getElementById("mini-progress-fill").style.width = `${pct}%`;
  seekSlider.value = pct;
}

// Eventos de UI
document.getElementById("btn-resume-play").addEventListener("click", () => {
  const idx = Math.max(0, CHAPTERS.findIndex(c => c.id === state.lastChapterId));
  playChapter(idx, true);
});

document.getElementById("mini-open-area").addEventListener("click", (e) => {
  if (e.target.closest("button")) return;
  fullPlayer.classList.remove("hidden");
});

document.getElementById("btn-close-full").addEventListener("click", () => {
  fullPlayer.classList.add("hidden");
});

document.getElementById("mini-play").addEventListener("click", togglePlay);
document.getElementById("btn-play-main").addEventListener("click", togglePlay);
document.getElementById("mini-rew").addEventListener("click", () => skipBy(-15));
document.getElementById("btn-rew").addEventListener("click", () => skipBy(-15));
document.getElementById("mini-fwd").addEventListener("click", () => skipBy(30));
document.getElementById("btn-fwd").addEventListener("click", () => skipBy(30));
document.getElementById("btn-prev").addEventListener("click", prevChapter);
document.getElementById("btn-next").addEventListener("click", nextChapter);

seekSlider.addEventListener("input", () => {
  isSeeking = true;
  if (audio.duration) {
    const target = (seekSlider.value / 100) * audio.duration;
    document.getElementById("time-current").textContent = formatTime(target);
  }
});

seekSlider.addEventListener("change", () => {
  if (audio.duration) {
    audio.currentTime = (seekSlider.value / 100) * audio.duration;
    persistCurrentTime();
  }
  isSeeking = false;
});

document.getElementById("btn-speed").addEventListener("click", () => {
  const idx = (SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length;
  state.speed = SPEEDS[idx];
  audio.playbackRate = state.speed;
  saveState();
  updatePlayerUI();
});

document.getElementById("btn-autoplay").addEventListener("click", () => {
  state.autoplay = !state.autoplay;
  saveState();
  updatePlayerUI();
});

document.getElementById("btn-mark-done").addEventListener("click", () => {
  if (currentIndex < 0) return;
  const ch = CHAPTERS[currentIndex];
  const cur = state.progress[ch.id] || {};
  state.progress[ch.id] = { ...cur, done: !cur.done };
  saveState();
  updatePlayerUI();
  renderList();
});

document.getElementById("btn-sleep").addEventListener("click", () => {
  clearTimeout(sleepTimerId);
  sleepModeIndex = (sleepModeIndex + 1) % SLEEP_OPTIONS.length;
  const val = SLEEP_OPTIONS[sleepModeIndex];
  const btn = document.getElementById("btn-sleep");
  if (val === 0) {
    btn.textContent = "Sono: Off";
    btn.classList.remove("active");
  } else if (val === -1) {
    btn.textContent = "Sono: Fim cap.";
    btn.classList.add("active");
  } else {
    btn.textContent = `Sono: ${val}m`;
    btn.classList.add("active");
    sleepTimerId = setTimeout(() => {
      audio.pause();
      sleepModeIndex = 0;
      btn.textContent = "Sono: Off";
      btn.classList.remove("active");
    }, val * 60 * 1000);
  }
});

document.getElementById("btn-offline-all").addEventListener("click", cacheAllAudios);

window.addEventListener("pagehide", persistCurrentTime);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persistCurrentTime();
});

// Inicialização
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

(async () => {
  await refreshCachedSet();
  renderList();
  if (state.lastChapterId) {
    const idx = CHAPTERS.findIndex(c => c.id === state.lastChapterId);
    if (idx >= 0) {
      playChapter(idx, false);
    }
  }
})();
