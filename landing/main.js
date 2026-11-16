/**
 * BrandCraft Landing Page Controller
 * Handles:
 * - Direct click-to-pause on all ambient videos
 * - Viewport visibility management (IntersectionObserver)
 * - Prefers-reduced-motion compliance
 */

function initLanding() {
  setupVideoPlayback();
}

/**
 * Ambient Video Playback & Click-to-Pause
 * Muted autoplay starts on visibility; clicking any video toggles pause/play.
 */
function setupVideoPlayback() {
  const videos = Array.from(document.querySelectorAll('video.ambient-video'));
  if (videos.length === 0) return;

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let isReducedMotion = motionQuery.matches;

  videos.forEach((video) => {
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('playsinline', '');

    // Direct click to toggle play / pause
    video.addEventListener('click', () => {
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  });

  // Handle system reduced motion changes
  motionQuery.addEventListener('change', (e) => {
    isReducedMotion = e.matches;
    videos.forEach((vid) => {
      if (isReducedMotion) {
        vid.pause();
      } else {
        vid.play().catch(() => {});
      }
    });
  });

  if (isReducedMotion) {
    videos.forEach((vid) => vid.pause());
    return;
  }

  // Attempt initial play for all visible videos
  const startVisibleVideos = () => {
    videos.forEach((video) => {
      const rect = video.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (inView && video.paused) {
        video.play().catch(() => {});
      }
    });
  };

  startVisibleVideos();

  // Retry on first user gesture if browser autoplay was blocked
  const onFirstInteraction = () => {
    startVisibleVideos();
    window.removeEventListener('click', onFirstInteraction);
    window.removeEventListener('scroll', onFirstInteraction);
    window.removeEventListener('keydown', onFirstInteraction);
  };
  window.addEventListener('click', onFirstInteraction, { passive: true });
  window.addEventListener('scroll', onFirstInteraction, { passive: true });
  window.addEventListener('keydown', onFirstInteraction, { passive: true });

  // Pause videos when offscreen to conserve GPU cycles
  if ('IntersectionObserver' in window) {
    const videoObserver = new IntersectionObserver(
      (entries) => {
        if (isReducedMotion) return;
        entries.forEach((entry) => {
          const video = entry.target;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.15) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: [0, 0.15, 0.5], rootMargin: '200px 0px' }
    );

    videos.forEach((video) => videoObserver.observe(video));
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLanding);
} else {
  initLanding();
}
