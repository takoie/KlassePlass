import { useState, useEffect } from 'react';

const COLORS_KEY = 'print_show_colors';
const GROUP_LAYOUT_KEY = 'print_group_layout';

export function usePrintSettings({ initialShowNumbers, initialShowZones, initialShowGroups }) {
  const [showNumbers, setShowNumbers] = useState(initialShowNumbers);
  const [showZones, setShowZones] = useState(initialShowZones);
  const [showGroups, setShowGroups] = useState(initialShowGroups);
  const [showColors, setShowColors] = useState(() => {
    const stored = localStorage.getItem(COLORS_KEY);
    return stored === null ? true : stored === 'true';
  });
  // Kun brukt av gruppearbeid-print: 'vertical' (rutenett med kort, likt
  // GroupEditor sin egen visning) eller 'horizontal' (én full-bredde stripe per gruppe).
  const [groupLayout, setGroupLayout] = useState(() => {
    const stored = localStorage.getItem(GROUP_LAYOUT_KEY);
    return stored === 'horizontal' ? 'horizontal' : 'vertical';
  });

  useEffect(() => {
    localStorage.setItem(COLORS_KEY, String(showColors));
  }, [showColors]);

  useEffect(() => {
    localStorage.setItem(GROUP_LAYOUT_KEY, groupLayout);
  }, [groupLayout]);

  return {
    settings: { showNumbers, showZones, showGroups, showColors, groupLayout },
    setShowNumbers, setShowZones, setShowGroups, setShowColors, setGroupLayout,
  };
}
