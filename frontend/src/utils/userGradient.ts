/** Generate a consistent gradient for a username (used as default banner). */
const GRADIENTS = [
  'linear-gradient(135deg, #1a1035 0%, #2d1b69 40%, #4c1d95 100%)',
  'linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #1d4ed8 100%)',
  'linear-gradient(135deg, #1a0a2e 0%, #5b21b6 40%, #7c3aed 100%)',
  'linear-gradient(135deg, #1c1017 0%, #831843 40%, #be185d 100%)',
  'linear-gradient(135deg, #0a1628 0%, #164e63 40%, #0891b2 100%)',
  'linear-gradient(135deg, #14142b 0%, #4338ca 40%, #6366f1 100%)',
  'linear-gradient(135deg, #1a0b2e 0%, #6b21a8 40%, #a855f7 100%)',
  'linear-gradient(135deg, #0f1a2e 0%, #1e40af 40%, #3b82f6 100%)',
  'linear-gradient(135deg, #1b1024 0%, #701a75 40%, #c026d3 100%)',
  'linear-gradient(135deg, #0d1b2a 0%, #065f46 40%, #059669 100%)',
];

export function getUserGradient(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}
