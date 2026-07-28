import { useState, useEffect } from 'react';

const COLORS_KEY = 'print_show_colors';

export function usePrintSettings({ initialShowNumbers, initialShowZones, initialShowGroups }) {
  const [showNumbers, setShowNumbers] = useState(initialShowNumbers);
  const [showZones, setShowZones] = useState(initialShowZones);
  const [showGroups, setShowGroups] = useState(initialShowGroups);
  const [showColors, setShowColors] = useState(() => {
    const stored = localStorage.getItem(COLORS_KEY);
    return stored === null ? true : stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(COLORS_KEY, String(showColors));
  }, [showColors]);

  return {
    settings: { showNumbers, showZones, showGroups, showColors },
    setShowNumbers, setShowZones, setShowGroups, setShowColors,
  };
}
