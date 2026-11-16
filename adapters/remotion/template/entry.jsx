// entry.jsx: mounts a Remotion <Player> in the page and exposes the small player object VHAdapter needs.
// Build: npx esbuild entry.jsx --bundle --outfile=bundle.js --define:process.env.NODE_ENV='"production"' --loader:.js=jsx
import React, { useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from '@remotion/player';
import { MyComposition } from './MyComposition.jsx';   // your Remotion composition

const FPS = 30, WIDTH = 1080, HEIGHT = 1920, FRAMES = 300;   // keep in sync with .videohub/project.json and data.json

function App() {
  const ref = useRef(null);
  useEffect(() => {
    const p = ref.current;
    window.vhPlayer = {
      total: FRAMES / FPS,
      seekTo: sec => { p.pause(); p.seekTo(Math.round(sec * FPS)); },
      play: () => p.play(),
      pause: () => p.pause(),
      time: () => p.getCurrentFrame() / FPS,
      // ready when every <video> in the player has the frame it needs (readyState 4 = HAVE_ENOUGH_DATA)
      ready: () => [...document.querySelectorAll('video')].every(v => v.readyState >= 3 && !v.seeking),
    };
  }, []);
  return <Player ref={ref} component={MyComposition} durationInFrames={FRAMES} fps={FPS} compositionWidth={WIDTH} compositionHeight={HEIGHT}
    controls={false} clickToPlay={false} initiallyMuted acknowledgeRemotionLicense style={{ width: WIDTH, height: HEIGHT }} />;
}
createRoot(document.getElementById('root')).render(<App />);
