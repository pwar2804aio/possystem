import { useState, useEffect } from 'react';

// Returns true when the viewport is smaller than typical desktop
// Sunmi D3 Pro: 1920x1080 physical, DPR ~1.5-2 → logical ~960-1280px wide
// Sunmi T2: 1366x768 physical, DPR 1 → logical 1366px wide  
// Threshold raised to 1600 to catch more Sunmi form factors
export function useCompact() {
  const check = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Compact if width < 1600 OR height < 950 OR effective pixel density indicates small screen
    return w < 1600 || h < 950;
  };
  const [compact, setCompact] = useState(check);
  useEffect(() => {
    const handler = () => setCompact(check());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return compact;
}
