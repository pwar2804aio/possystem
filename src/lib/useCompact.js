import { useState, useEffect } from 'react';

// Returns true when the viewport is smaller (Sunmi D3 Pro, small Android tablets)
// Threshold: width < 1400 or height < 900
export function useCompact() {
  const [compact, setCompact] = useState(
    () => window.innerWidth < 1400 || window.innerHeight < 900
  );
  useEffect(() => {
    const check = () => setCompact(window.innerWidth < 1400 || window.innerHeight < 900);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return compact;
}
