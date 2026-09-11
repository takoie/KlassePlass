import React from 'react';

// Faste, tema-trygge farger (finnes i alle 8 temaene) - ingen hardkodet hex.
const PALETTE = [
  'bg-primary/20 text-primary',
  'bg-accent/20 text-accent',
  'bg-success/20 text-success',
  'bg-info/20 text-info',
  'bg-warning/20 text-warning',
  'bg-secondary/20 text-secondary',
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return hash;
}

function initialsFor(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Sirkel med elevens initialer i en farge som er stabil per elev-id. */
export default function StudentAvatar({ student, size = 'md' }) {
  const colorClass = PALETTE[hashString(student.id) % PALETTE.length];
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-9 h-9 text-xs';
  return (
    <div className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center font-bold flex-shrink-0`}>
      {initialsFor(student.name)}
    </div>
  );
}
