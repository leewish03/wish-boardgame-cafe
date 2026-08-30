import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

export const HeraldicGuardIcon: React.FC<IconProps> = ({ size = 28, color = '#d4af37' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 4L8 10V22C8 33 15 41 24 44C33 41 40 33 40 22V10L24 4Z" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="rgba(212, 175, 55, 0.08)" />
    <path d="M24 14V34M17 21L31 21" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="24" cy="24" r="5" stroke={color} strokeWidth="2" fill="rgba(212, 175, 55, 0.2)" />
  </svg>
);

export const HeraldicPriestIcon: React.FC<IconProps> = ({ size = 28, color = '#d4af37' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 8H34V18C34 25 29 30 24 30C19 30 14 25 14 18V8Z" stroke={color} strokeWidth="2.5" fill="rgba(212, 175, 55, 0.08)" />
    <path d="M24 30V40M16 40H32" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <path d="M24 12V22M20 16H28" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const HeraldicBaronIcon: React.FC<IconProps> = ({ size = 28, color = '#d4af37' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 8L36 36M36 36L40 40M36 36L32 40M36 36L40 32" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <path d="M40 8L12 36M12 36L8 40M12 36L16 40M12 36L8 32" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="24" cy="22" r="6" stroke={color} strokeWidth="2" fill="rgba(212, 175, 55, 0.15)" />
  </svg>
);

export const HeraldicHandmaidIcon: React.FC<IconProps> = ({ size = 28, color = '#2dd4bf' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="24" cy="20" rx="12" ry="14" stroke={color} strokeWidth="2.5" fill="rgba(45, 212, 191, 0.08)" />
    <path d="M24 34V44M18 44H30" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <path d="M20 16C22 13 26 13 28 16" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const HeraldicPrinceIcon: React.FC<IconProps> = ({ size = 28, color = '#d4af37' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 36L14 16L24 26L34 16L38 36H10Z" stroke={color} strokeWidth="2.5" strokeLinejoin="round" fill="rgba(212, 175, 55, 0.08)" />
    <circle cx="14" cy="14" r="3" stroke={color} strokeWidth="2" fill={color} />
    <circle cx="24" cy="23" r="3" stroke={color} strokeWidth="2" fill={color} />
    <circle cx="34" cy="14" r="3" stroke={color} strokeWidth="2" fill={color} />
    <path d="M14 40H34" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export const HeraldicKingIcon: React.FC<IconProps> = ({ size = 28, color = '#f59e0b' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 38L12 14L20 24L24 10L28 24L36 14L40 38H8Z" stroke={color} strokeWidth="2.5" strokeLinejoin="round" fill="rgba(245, 158, 11, 0.12)" />
    <circle cx="24" cy="8" r="3" stroke={color} strokeWidth="2" fill={color} />
    <circle cx="12" cy="12" r="2.5" stroke={color} strokeWidth="1.5" fill={color} />
    <circle cx="36" cy="12" r="2.5" stroke={color} strokeWidth="1.5" fill={color} />
    <line x1="8" y1="42" x2="40" y2="42" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export const HeraldicCountessIcon: React.FC<IconProps> = ({ size = 28, color = '#f43f5e' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="16" stroke={color} strokeWidth="2.5" fill="rgba(244, 63, 94, 0.08)" />
    <path d="M24 16C21 20 21 24 24 28C27 24 27 20 24 16Z" stroke={color} strokeWidth="2" fill="rgba(244, 63, 94, 0.25)" />
    <path d="M16 24C20 21 24 21 28 24C24 27 20 27 16 24Z" stroke={color} strokeWidth="2" fill="rgba(244, 63, 94, 0.25)" />
    <circle cx="24" cy="24" r="3" stroke={color} strokeWidth="2" fill={color} />
  </svg>
);

export const HeraldicPrincessIcon: React.FC<IconProps> = ({ size = 28, color = '#fb7185' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 8L27 16L35 17L29 23L31 31L24 27L17 31L19 23L13 17L21 16L24 8Z" stroke={color} strokeWidth="2.5" strokeLinejoin="round" fill="rgba(251, 113, 133, 0.15)" />
    <path d="M12 38C18 35 30 35 36 38" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="24" cy="40" r="2.5" fill={color} />
  </svg>
);

export const getHeraldicIcon = (value: number, size = 28) => {
  switch (value) {
    case 1: return <HeraldicGuardIcon size={size} />;
    case 2: return <HeraldicPriestIcon size={size} />;
    case 3: return <HeraldicBaronIcon size={size} />;
    case 4: return <HeraldicHandmaidIcon size={size} />;
    case 5: return <HeraldicPrinceIcon size={size} />;
    case 6: return <HeraldicKingIcon size={size} />;
    case 7: return <HeraldicCountessIcon size={size} />;
    case 8: return <HeraldicPrincessIcon size={size} />;
    default: return <HeraldicGuardIcon size={size} />;
  }
};
