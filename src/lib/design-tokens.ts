export const tokens = {
  bg: {
    base:     '#0C0C0E',
    subtle:   '#111114',
    muted:    '#17171B',
    elevated: '#1E1E23',
  },
  border: {
    default: '#222226',
    strong:  '#2E2E34',
  },
  text: {
    primary:   '#F2F2F0',
    secondary: '#8A8A8E',
    muted:     '#555558',
    inverse:   '#0C0C0E',
  },
  sage: {
    DEFAULT: '#7D9E8C',
    light:   '#9AB5A6',
    dim:     '#4A6358',
    subtle:  '#1A2E26',
    text:    '#A8C4B4',
  },
  status: {
    success: { bg: '#1A2E26', text: '#7DBF9E', border: '#2A4A3A' },
    warning: { bg: '#2A2318', text: '#C9A84C', border: '#3D3220' },
    error:   { bg: '#2A1818', text: '#C97B7B', border: '#3D2626' },
    info:    { bg: '#181E2A', text: '#7B9BC9', border: '#26303D' },
  },
  font: {
    display: '"DM Sans", sans-serif',
    body:    '"DM Sans", sans-serif',
    mono:    '"DM Mono", monospace',
  },
  radius: {
    sm:  '4px',
    md:  '6px',
    lg:  '8px',
    xl:  '12px',
  },
  shadow: {
    sm:  '0 1px 2px rgba(0,0,0,0.4)',
    md:  '0 4px 12px rgba(0,0,0,0.5)',
    lg:  '0 8px 32px rgba(0,0,0,0.6)',
  },
} as const;
