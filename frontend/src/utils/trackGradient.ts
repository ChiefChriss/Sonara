/** Generate a consistent gradient for a track (used as default cover art). */
const GRADIENTS = [
  'linear-gradient(135deg, #1a1035 0%, #4c1d95 50%, #7c3aed 100%)',
  'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #3b82f6 100%)',
  'linear-gradient(135deg, #1c1017 0%, #831843 50%, #ec4899 100%)',
  'linear-gradient(135deg, #0a1628 0%, #164e63 50%, #06b6d4 100%)',
  'linear-gradient(135deg, #14142b 0%, #4338ca 50%, #818cf8 100%)',
  'linear-gradient(135deg, #1a0b2e 0%, #6b21a8 50%, #c084fc 100%)',
  'linear-gradient(135deg, #0d1b2a 0%, #065f46 50%, #34d399 100%)',
  'linear-gradient(135deg, #1b1024 0%, #701a75 50%, #e879f9 100%)',
  'linear-gradient(135deg, #0f1a2e 0%, #92400e 50%, #f59e0b 100%)',
  'linear-gradient(135deg, #1a0a2e 0%, #be123c 50%, #fb7185 100%)',
];

export function getTrackGradient(id: number): string {
  return GRADIENTS[Math.abs(id) % GRADIENTS.length];
}
