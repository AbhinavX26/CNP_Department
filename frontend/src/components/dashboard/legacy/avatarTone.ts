/** Coloured initials avatars for faculty names on the dashboard cards. */
const TONES = ['#c2410c', '#3b2a9e', '#0f766e', '#9a3412', '#1d4ed8', '#047857'];

/** Same name, same colour, every time. */
export function avatarTone(name?: string | null): string {
  const text = (name ?? '').trim();
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length];
}

/** "Dr. Rahul Desai" -> "RD" (titles are skipped). */
export function avatarInitials(name?: string | null, fallback = '?'): string {
  const words = (name ?? '')
    .replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return fallback;
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0];
  return letters.toUpperCase();
}
