/**
 * BrandCraft Landing Page Controller
 * Features:
 * - Elevated Hero Video Studio Frame with tactile Live HUD
 * - Apple-grade Interactive Studio Walkthrough Stage (4 Steps, crossfade, progress tracking, auto-tour)
 * - Tactile 1-Click Share Code Copy with microcopy feedback
 * - Reduced motion & GPU performance optimization (IntersectionObserver)
 */

document.addEventListener('DOMContentLoaded', initLanding);

function initLanding() {
  setupHeroVideoHUD();
  setupWalkthroughStage();
  setupShareCodeCopy();
  setupAmbientIntersection();
}

/**
 * 1. Hero Video HUD Controller
 */
function setupHeroVideoHUD() {
  const heroVideo = document.querySelector('.hero-video');
  const heroHudBtn = document.getElementById('hero-hud-toggle');
  if (!heroVideo || !heroHudBtn) return;

  const statusText = heroHudBtn.querySelector('.hud-status-text');
  const iconPause = heroHudBtn.querySelector('.icon-pause');
  const iconPlay = heroHudBtn.querySelector('.icon-play');

  function updateHeroState(isPlaying) {
    if (isPlaying) {
      heroHudBtn.classList.remove('is-paused');
      if (statusText) statusText.textContent = 'LIVE';
      if (iconPause) iconPause.classList.remove('hidden');
      if (iconPlay) iconPlay.classList.add('hidden');
    } else {
      heroHudBtn.classList.add('is-paused');
      if (statusText) statusText.textContent = 'PAUSED';
      if (iconPause) iconPause.classList.add('hidden');
      if (iconPlay) iconPlay.classList.remove('hidden');
    }
  }

  heroHudBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (heroVideo.paused) {
      heroVideo.play().then(() => updateHeroState(true)).catch(() => {});
    } else {
      heroVideo.pause();
      updateHeroState(false);
    }
  });

  heroVideo.addEventListener('play', () => updateHeroState(true));
  heroVideo.addEventListener('pause', () => updateHeroState(false));
  heroVideo.addEventListener('click', () => {
    if (heroVideo.paused) {
      heroVideo.play().catch(() => {});
    } else {
      heroVideo.pause();
    }
  });
}

/**
 * 2. Apple-Grade Interactive Studio Walkthrough Stage
 */
function setupWalkthroughStage() {
  const stage = document.getElementById('workflow-walkthrough');
  if (!stage) return;

  const tabs = Array.from(stage.querySelectorAll('.walkthrough-tab'));
  const panels = Array.from(stage.querySelectorAll('.walkthrough-panel'));
  const counter = document.getElementById('stage-step-counter');
  const playbackToggle = document.getElementById('stage-playback-toggle');
  const prevBtn = document.getElementById('stage-prev-btn');
  const nextBtn = document.getElementById('stage-next-btn');

  if (tabs.length === 0 || panels.length === 0) return;

  let currentStep = 0;
  const totalSteps = tabs.length;
  const STEP_DURATION_MS = 6500;
  let isTourRunning = true;
  let timerId = null;
  let progressStartTime = 0;
  let animFrameId = null;

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motionQuery.matches) {
    isTourRunning = false;
  }

  function getActiveProgressFill() {
    const activeTab = tabs[currentStep];
    return activeTab ? activeTab.querySelector('.tab-progress-fill') : null;
  }

  function resetAllProgressBars() {
    tabs.forEach((tab) => {
      const fill = tab.querySelector('.tab-progress-fill');
      if (fill) fill.style.width = '0%';
    });
  }

  function goToStep(index, restartTimer = true) {
    if (index === currentStep && panels[index].classList.contains('is-active')) {
      return;
    }

    // Cancel current animation frame
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    // Pause previous video
    const prevPanel = panels[currentStep];
    if (prevPanel) {
      const prevVideo = prevPanel.querySelector('video');
      if (prevVideo) prevVideo.pause();
      prevPanel.classList.remove('is-active');
      prevPanel.setAttribute('hidden', '');
    }

    if (tabs[currentStep]) {
      tabs[currentStep].classList.remove('is-active');
      tabs[currentStep].setAttribute('aria-selected', 'false');
    }

    // Update active index
    currentStep = (index + totalSteps) % totalSteps;
    const activePanel = panels[currentStep];
    const activeTab = tabs[currentStep];

    if (activeTab) {
      activeTab.classList.add('is-active');
      activeTab.setAttribute('aria-selected', 'true');
    }

    if (activePanel) {
      activePanel.removeAttribute('hidden');
      // Trigger reflow for clean opacity transition
      void activePanel.offsetWidth;
      activePanel.classList.add('is-active');

      const nextVideo = activePanel.querySelector('video');
      if (nextVideo) {
        nextVideo.currentTime = 0;
        nextVideo.play().catch(() => {});
      }
    }

    // Update counter
    if (counter) {
      const displayIndex = currentStep + 1;
      counter.textContent = `0${displayIndex} / 0${totalSteps}`;
    }

    resetAllProgressBars();

    if (restartTimer && isTourRunning) {
      startTourTimer();
    }
  }

  function startTourTimer() {
    if (timerId) clearTimeout(timerId);
    if (animFrameId) cancelAnimationFrame(animFrameId);

    progressStartTime = performance.now();

    function updateProgress(now) {
      if (!isTourRunning) return;
      const elapsed = now - progressStartTime;
      const progress = Math.min(elapsed / STEP_DURATION_MS, 1);
      const fill = getActiveProgressFill();
      if (fill) {
        fill.style.width = `${(progress * 100).toFixed(1)}%`;
      }

      if (progress < 1) {
        animFrameId = requestAnimationFrame(updateProgress);
      }
    }

    animFrameId = requestAnimationFrame(updateProgress);

    timerId = setTimeout(() => {
      goToStep(currentStep + 1, true);
    }, STEP_DURATION_MS);
  }

  function pauseTour() {
    isTourRunning = false;
    if (timerId) clearTimeout(timerId);
    if (animFrameId) cancelAnimationFrame(animFrameId);

    if (playbackToggle) {
      playbackToggle.classList.add('is-paused');
      const label = playbackToggle.querySelector('.stage-hud-label');
      if (label) label.textContent = 'PAUSED';
      const iconPause = playbackToggle.querySelector('.icon-pause');
      const iconPlay = playbackToggle.querySelector('.icon-play');
      if (iconPause) iconPause.classList.add('hidden');
      if (iconPlay) iconPlay.classList.remove('hidden');
    }
  }

  function resumeTour() {
    isTourRunning = true;
    if (playbackToggle) {
      playbackToggle.classList.remove('is-paused');
      const label = playbackToggle.querySelector('.stage-hud-label');
      if (label) label.textContent = 'AUTO-TOUR';
      const iconPause = playbackToggle.querySelector('.icon-pause');
      const iconPlay = playbackToggle.querySelector('.icon-play');
      if (iconPause) iconPause.classList.remove('hidden');
      if (iconPlay) iconPlay.classList.add('hidden');
    }
    startTourTimer();
  }

  // Tab click listeners
  tabs.forEach((tab, idx) => {
    tab.addEventListener('click', () => {
      goToStep(idx, true);
    });
  });

  // Prev / Next controls
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      goToStep(currentStep - 1, true);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      goToStep(currentStep + 1, true);
    });
  }

  // Playback toggle button
  if (playbackToggle) {
    playbackToggle.addEventListener('click', () => {
      if (isTourRunning) {
        pauseTour();
      } else {
        resumeTour();
      }
    });
  }

  // Direct video click on panel toggles its playback
  panels.forEach((panel) => {
    const video = panel.querySelector('video');
    if (!video) return;
    video.addEventListener('click', () => {
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  });

  // Keyboard navigation support for tabs
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      goToStep(currentStep + 1, true);
    } else if (e.key === 'ArrowLeft') {
      goToStep(currentStep - 1, true);
    }
  });

  // Start tour timer on visible stage
  if (isTourRunning) {
    startTourTimer();
  }
}

/**
 * 3. Portable Share Code 1-Click Copy
 */
function setupShareCodeCopy() {
  const copyBtn = document.getElementById('btn-copy-code');
  const codeEl = document.getElementById('preset-share-code');
  if (!copyBtn || !codeEl) return;

  const copyLabel = copyBtn.querySelector('.copy-feedback-text');
  const iconCopy = copyBtn.querySelector('.icon-copy');
  const iconCopied = copyBtn.querySelector('.icon-copied');

  let revertTimeout = null;

  copyBtn.addEventListener('click', async () => {
    const textToCopy = codeEl.textContent.trim();
    if (!textToCopy) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback for non-https or restricted contexts
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      // Success state feedback
      copyBtn.classList.add('is-copied');
      if (copyLabel) copyLabel.textContent = 'Copied!';
      if (iconCopy) iconCopy.classList.add('hidden');
      if (iconCopied) iconCopied.classList.remove('hidden');

      if (revertTimeout) clearTimeout(revertTimeout);
      revertTimeout = setTimeout(() => {
        copyBtn.classList.remove('is-copied');
        if (copyLabel) copyLabel.textContent = 'Copy';
        if (iconCopy) iconCopy.classList.remove('hidden');
        if (iconCopied) iconCopied.classList.add('hidden');
      }, 2200);
    } catch {
      if (copyLabel) copyLabel.textContent = 'Failed';
      setTimeout(() => {
        if (copyLabel) copyLabel.textContent = 'Copy';
      }, 1500);
    }
  });
}

/**
 * 4. Ambient Video Visibility & Performance Optimization
 */
function setupAmbientIntersection() {
  const allVideos = Array.from(document.querySelectorAll('video.ambient-video'));
  if (allVideos.length === 0) return;

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let isReduced = motionQuery.matches;

  allVideos.forEach((video) => {
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('playsinline', '');
  });

  if (isReduced) {
    allVideos.forEach((v) => v.pause());
    return;
  }

  // Initial play of active video in viewport
  const startInView = () => {
    allVideos.forEach((video) => {
      const panel = video.closest('.walkthrough-panel');
      if (panel && !panel.classList.contains('is-active')) return;

      const rect = video.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (inView && video.paused) {
        video.play().catch(() => {});
      }
    });
  };

  startInView();

  // Retry on first user interaction if blocked by autoplay policy
  const onInteraction = () => {
    startInView();
    window.removeEventListener('click', onInteraction);
    window.removeEventListener('scroll', onInteraction);
    window.removeEventListener('keydown', onInteraction);
  };
  window.addEventListener('click', onInteraction, { passive: true });
  window.addEventListener('scroll', onInteraction, { passive: true });
  window.addEventListener('keydown', onInteraction, { passive: true });

  // Conserve GPU cycles when offscreen
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (isReduced) return;
        entries.forEach((entry) => {
          const video = entry.target;
          const panel = video.closest('.walkthrough-panel');
          if (panel && !panel.classList.contains('is-active')) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.15) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: [0, 0.15, 0.5], rootMargin: '100px 0px' }
    );

    allVideos.forEach((v) => observer.observe(v));
  }
}
