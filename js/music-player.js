/* Music Player - shared across all pages */
(function() {
const ALL_TRACKS = [
    { name: 'theme of SSS', artist: 'ANANT-GARDE EYES', src: 'music/01-theme-of-SSS.mp3', art: 'pic/01-theme-of-SSS.jpg' },
    { name: 'Isekai Phonk', artist: 'Gaiyu', src: 'music/02-Isekai-Phonk.mp3', art: 'pic/02-Isekai-Phonk.jpg' },
    { name: 'Butterflies', artist: 'Nohidea', src: 'music/03-Butterflies.mp3', art: 'pic/03-Butterflies.jpg' },
    { name: 'Bumble Bee', artist: 'Xanemusic', src: 'music/04-Bumble-Bee.mp3', art: 'pic/04-Bumble-Bee.jpg' },
    { name: 'Dear Mr\u300cF\u300d', artist: '\u3064\u3063\u3066\u771f\u591c\u4e2d\u3067\u3044\u308b\u306e\u306b\u3002', src: 'music/05-Dear-Mr-F.mp3', art: 'pic/05-Dear-Mr-F.jpg' },
    { name: 'Ham', artist: '\u3064\u3063\u3066\u771f\u591c\u4e2d\u3067\u3044\u308b\u306e\u306b\u3002', src: 'music/06-Ham.mp3', art: 'pic/06-Ham.jpg' },
    { name: 'MILABO', artist: '\u3064\u3063\u3066\u771f\u591c\u4e2d\u3067\u3044\u308b\u306e\u306b\u3002', src: 'music/07-MILABO.mp3', art: 'pic/07-MILABO.jpg' },
    { name: 'Gate of steiner -piano-', artist: '\u963f\u4fdd\u521a', src: 'music/08-Gate-of-Steiner.mp3', art: 'pic/08-Gate-of-Steiner.jpg' },
    { name: '\u7231\u6ee1\u6ea2\u7684\u82b1\u675f', artist: 'Superfly', src: 'music/09-\u732e\u4e0a\u7231\u7684\u82b1\u675f.mp3', art: 'pic/09-\u732e\u4e0a\u7231\u7684\u82b1\u675f.jpg' },
    { name: '\u3044\u3064\u3082\u3053\u306e\u5834\u6240\u3067', artist: '\u5f69\u97f3', src: 'music/12-itsumono-basho.mp3', art: 'pic/12-itsumono-basho.jpg' },
    { name: '\u6211\u4e0e\u4f60', artist: '\u9e23\u6f6e\u5148\u7ea6\u7535\u53f0 auburn', src: 'music/10-you-and-me.mp3', art: 'pic/10-you-and-me.jpg' },
    { name: '\u3044\u3064\u3082\u306e\u98a8\u666f\u304b\u3089\u59cb\u307e\u308b\u7269\u8a9e', artist: '\u795e\u524d\u66c1 \u9af5\u7530\u9f8d\u4e00\uff08MONACA)', src: 'music/11-monaca-story.mp3', art: 'pic/11-monaca-story.jpg' },
    { name: '\u30bd\u30e9\u30a4\u30ed', artist: '\u6c34\u701d\u3044\u306e\u308a', src: 'music/14-sorairo.mp3', art: 'pic/14-sorairo.jpg' },
    { name: '\u30ac\u30e9\u30b9\u306e\u83ef', artist: '\u6c34\u6a39\u5948\u3005', src: 'music/13-glass-hana.mp3', art: 'pic/13-glass-hana.jpg' },
  ];

  const TRACKS = ALL_TRACKS;
  const STORAGE_KEY = 'sunny-music-state';
  let curIdx = 0, isPlaying = false;
  const audio = new Audio();
  audio.volume = 0.8;

  // 提前加载：在 DOM 就绪前就开始拉取上次播放的歌曲（服务器已带缓存头 + Range 支持），
  // 让切页后声音几乎立即续上，避免"加载页面时卡顿一下"。
  const earlySaved = loadState();
  if (earlySaved && TRACKS[earlySaved.idx]) {
    audio.preload = 'auto';
    audio.src = TRACKS[earlySaved.idx].src;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        idx: curIdx,
        time: audio.currentTime || 0,
        playing: isPlaying,
        volume: audio.volume,
        name: TRACKS[curIdx] ? TRACKS[curIdx].name : '',
      }));
    } catch(e) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const st = JSON.parse(raw);
      if (!st || typeof st.idx !== 'number' || !TRACKS[st.idx]) return null;
      return st;
    } catch(e) { return null; }
  }

  function clearState() {
    try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
  }

  function init() {
    const disc = document.getElementById('mc-disc');
    const discImg = disc ? disc.querySelector('.mc-center img') : null;
    const playBtn = document.getElementById('mc-play');
    const prevBtn = document.getElementById('mc-prev');
    const nextBtn = document.getElementById('mc-next');
    const shuffleBtn = document.getElementById('mc-shuffle');
    const progressBar = document.getElementById('mc-progress');
    const bar = document.getElementById('mc-bar');
    const songName = document.getElementById('mc-name');
    const songArtist = document.getElementById('mc-artist');
    const cdCurrent = document.getElementById('mc-current');
    const cdTotal = document.getElementById('mc-total');
    const musicCard = document.getElementById('music-card');
    const heroAva = document.getElementById('hero-ava');
    const volSlider = document.getElementById('mc-vol');
    const volIcon = document.getElementById('mc-vol-icon');

    if (!disc) return;

    function fmt(s) { const m = Math.floor(s / 60); return m + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }

    volSlider.addEventListener('input', () => {
      audio.volume = volSlider.value / 100;
      volIcon.textContent = audio.volume === 0 ? '\ud83d\udd07' : audio.volume < 0.5 ? '\ud83d\udd29' : '\ud83d\udd0a';
      saveState();
    });

    function openCard() {
      musicCard.classList.remove('collapsed');
      musicCard.classList.add('expanded');
      resetIdleTimer();
    }
    function closeCard() {
      musicCard.classList.remove('expanded');
      musicCard.classList.add('collapsed');
    }

    /* 10 秒无操作自动缩回 */
    let idleTimer = null;
    function resetIdleTimer() {
      if (!musicCard.classList.contains('expanded')) return;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(closeCard, 10000);
    }
    musicCard.addEventListener('click', resetIdleTimer);
    musicCard.addEventListener('mousemove', resetIdleTimer);
    musicCard.addEventListener('touchstart', resetIdleTimer);

    if (heroAva) heroAva.addEventListener('click', openCard);
    // PJAX 软导航后首页节点会重建，直接给 document 上事件委托，保证头像点击仍能展开卡片
    document.addEventListener('click', (e) => {
      if (e.target.id === 'hero-ava' || (e.target.closest && e.target.closest('#hero-ava'))) openCard();
    });
    musicCard.addEventListener('click', (e) => {
      if (suppressClick) return;
      if (!musicCard.classList.contains('expanded')) {
        openCard();
      } else if (e.target === musicCard) {
        closeCard();
      }
    });

    /* 沿右边缘垂直拖动卡片（只纵向、贴右） */
    let dragStartY = 0, dragStartTop = 0, dragging = false, suppressClick = false, lastTop = null;
    const MIN_TOP = 8;
    function clampTop(v) {
      const h = musicCard.offsetHeight || 0;
      return Math.max(MIN_TOP, Math.min(v, window.innerHeight - h - 6));
    }
    function applyVertTop(px) {
      musicCard.style.top = px + 'px';
    }
    /* 恢复/初始化垂直位置（默认居中）；移动端交给 CSS 底部样式，不设 top */
    (function initVertPos() {
      if (window.innerWidth > 640) {
        let saved = null;
        try { saved = parseInt(localStorage.getItem('sunny-music-top'), 10); } catch(_) {}
        if (!isNaN(saved)) {
          applyVertTop(clampTop(saved));
        } else {
          const h = musicCard.offsetHeight || 0;
          applyVertTop(clampTop((window.innerHeight - h) / 2));
        }
      }
    })();
    window.addEventListener('resize', () => {
      if (window.innerWidth <= 640) {
        musicCard.style.top = '';
        return;
      }
      applyVertTop(clampTop(musicCard.getBoundingClientRect().top));
    });
    musicCard.addEventListener('pointerdown', (e) => {
      if (window.innerWidth <= 640) return;
      if (e.target.closest && e.target.closest('button, .music-card-close, input, #mc-progress')) return;
      dragging = true;
      suppressClick = false;
      dragStartY = e.clientY;
      dragStartTop = musicCard.getBoundingClientRect().top;
      if (musicCard.setPointerCapture) musicCard.setPointerCapture(e.pointerId);
    });
    musicCard.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dy = e.clientY - dragStartY;
      if (Math.abs(dy) > 4) suppressClick = true;
      lastTop = clampTop(dragStartTop + dy);
      applyVertTop(lastTop);
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      if (lastTop !== null) {
        lastTop = clampTop(lastTop);
        applyVertTop(lastTop);
        try { localStorage.setItem('sunny-music-top', String(Math.round(lastTop))); } catch(_) {}
      }
      setTimeout(() => { suppressClick = false; }, 0);
    }
    musicCard.addEventListener('pointerup', endDrag);
    musicCard.addEventListener('pointercancel', endDrag);

    /* 恢复上次跨页状态 */
    const saved = loadState();
    curIdx = saved ? saved.idx : 0;
    /* 首帧即显示当前曲目封面（无存档时也换掉默认头像） */
    if (discImg && TRACKS[curIdx] && TRACKS[curIdx].art) discImg.src = TRACKS[curIdx].art;
    if (saved && typeof saved.volume === 'number') {
      audio.volume = saved.volume;
      volSlider.value = saved.volume * 100;
      volIcon.textContent = saved.volume === 0 ? '\ud83d\udd07' : saved.volume < 0.5 ? '\ud83d\udd29' : '\ud83d\udd0a';
    }

    function applyTrack(idx, pos, autoPlay) {
      curIdx = (idx + TRACKS.length) % TRACKS.length;
      const t = TRACKS[curIdx];

      // 快速路径：音频已在预加载/缓存中且 src 未变 → 跳过 pause+src+load 避免重新拉取（解决切页卡顿）
      const preloaded = audio.getAttribute('src') === t.src && audio.readyState >= 2;

      if (!preloaded) {
        audio.pause();
        audio.src = t.src;
      }
      songName.textContent = t.name;
      songArtist.textContent = t.artist;
      if (discImg && t.art) discImg.src = t.art;
      bar.style.width = '0%';
      cdCurrent.textContent = '0:00';
      cdTotal.textContent = '0:00';

      function start() {
        audio.removeEventListener('canplay', start);
        audio.removeEventListener('loadeddata', start);

        /* 期望恢复为续播：
           1. 先同步 UI 播放态（部分浏览器会拦截自动播放，但界面不能看起来「被重置」）
           2. seek 完成（seeked 事件）后才真正播放并保存——避免把 time=0/未播放 写回存档 */
        if (autoPlay) {
          isPlaying = true;
          disc.classList.add('playing');
          playBtn.textContent = '\u23f8'; // ⏸
        }

        if (pos >= 1) {
          const onSeeked = () => {
            audio.removeEventListener('seeked', onSeeked);
            saveState(); // seek 生效后才保存真实续播位置
            if (autoPlay) audio.play().catch(() => {
              /* 自动播放被拦截：保持 UI 播放态，等 resumeOnce 首次点击接管 */
            });
          };
          audio.addEventListener('seeked', onSeeked);
          audio.currentTime = pos;
        } else {
          saveState();
          if (autoPlay) audio.play().catch(() => {});
        }
      }

      /* 本地音频可能秒加载，canplay 会早于监听触发，需用 readyState 兜底 */
      if (preloaded || audio.readyState >= 2) {
        start();
      } else {
        audio.addEventListener('loadeddata', start);
        audio.addEventListener('canplay', start);
        audio.load();
      }
    }

    function loadTrack(i, autoPlay) {
      if (!TRACKS.length) return;
      curIdx = (i + TRACKS.length) % TRACKS.length;
      const t = TRACKS[curIdx];
      const wasPlaying = isPlaying || autoPlay;
      audio.pause();
      audio.src = t.src;
      songName.textContent = t.name;
      songArtist.textContent = t.artist;
      if (discImg && t.art) discImg.src = t.art;
      bar.style.width = '0%';
      cdCurrent.textContent = '0:00';
      cdTotal.textContent = '0:00';
      audio.load();
      if (wasPlaying) {
        const handler = () => {
          audio.removeEventListener('canplay', handler);
          audio.play().catch(()=>{});
        };
        audio.addEventListener('canplay', handler);
      }
      saveState();
    }

    function togglePlay() {
      if (!TRACKS.length) return;
      if (isPlaying) { audio.pause(); } else { audio.play().catch(()=>{}); }
    }

    audio.addEventListener('play', () => {
      isPlaying = true;
      disc.classList.add('playing');
      playBtn.textContent = '\u23f8';
      saveState();
    });
    audio.addEventListener('pause', () => {
      isPlaying = false;
      disc.classList.remove('playing');
      playBtn.textContent = '\u25b6';
      saveState();
    });
    audio.addEventListener('timeupdate', () => {
      if (!audio.duration) return;
      bar.style.width = (audio.currentTime / audio.duration * 100) + '%';
      cdCurrent.textContent = fmt(audio.currentTime);
      cdTotal.textContent = fmt(audio.duration);
      saveState();
    });
    audio.addEventListener('ended', () => {
      curIdx = (curIdx + 1) % TRACKS.length;
      if (curIdx === 0) { saveState(); return; }
      loadTrack(curIdx, true);
    });

    playBtn.addEventListener('click', togglePlay);
    prevBtn.addEventListener('click', () => loadTrack(curIdx - 1, isPlaying));
    nextBtn.addEventListener('click', () => loadTrack(curIdx + 1, isPlaying));

    /* 随机换曲：避开当前曲目 */
    if (shuffleBtn) shuffleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      shuffleBtn.classList.add('spinning');
      setTimeout(() => shuffleBtn.classList.remove('spinning'), 600);
      let next;
      if (TRACKS.length <= 1) {
        next = 0;
      } else {
        do { next = Math.floor(Math.random() * TRACKS.length); } while (next === curIdx);
      }
      loadTrack(next, isPlaying);
    });

    progressBar.addEventListener('click', (e) => {
      if (!audio.duration) return;
      const rect = progressBar.getBoundingClientRect();
      audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
      bar.style.width = (audio.currentTime / audio.duration * 100) + '%';
      saveState();
    });

    let isDragging = false;
    progressBar.addEventListener('mousedown', (e) => { isDragging = true; updateProgress(e); });
    document.addEventListener('mousemove', (e) => { if (isDragging) updateProgress(e); });
    document.addEventListener('mouseup', () => { isDragging = false; });
    progressBar.addEventListener('touchstart', (e) => { isDragging = true; updateProgress(e.touches[0]); });
    progressBar.addEventListener('touchmove', (e) => { if (isDragging) { e.preventDefault(); updateProgress(e.touches[0]); } });
    progressBar.addEventListener('touchend', () => { isDragging = false; });

    function updateProgress(e) {
      if (!audio.duration) return;
      const rect = progressBar.getBoundingClientRect();
      let x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audio.currentTime = x * audio.duration;
      bar.style.width = (x * 100) + '%';
      saveState();
    }

    /* 恢复跨页播放 */
    if (saved) {
      applyTrack(saved.idx, saved.time, saved.playing);
      if (saved.playing) {
        /* 浏览器可能拦截自动播放，首次点击页面时恢复 */
        const resumeOnce = () => {
          document.removeEventListener('click', resumeOnce);
          if (audio.paused) audio.play().catch(()=>{});
        };
        document.addEventListener('click', resumeOnce);
      }
    } else {
      loadTrack(0, false);
    }

    /* 页面离开前保存：仅当音频真实加载过才覆盖，避免把已销毁的 audio（time=0）写进去 */
    window.addEventListener('pagehide', () => {
      if (audio.duration && isFinite(audio.duration)) saveState();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();