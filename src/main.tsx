import { createRoot } from 'react-dom/client';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import App from './App';
import './styles/tokens.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <MotionConfig reducedMotion="user">
    {/* `strict` rejects motion.* components: only the lighter m.* set may be used. */}
    <LazyMotion features={domAnimation} strict>
      <App />
    </LazyMotion>
  </MotionConfig>,
);
