// PROTOTYPE — avatar styles for the start page (not shipped).
import {
  Bird,
  Cat,
  Club,
  Crown,
  Diamond,
  Dices,
  Feather,
  Flower2,
  Gem,
  Key,
  Moon,
  Rose,
  Spade,
  VenetianMask,
  Wine,
  Anchor,
  type LucideIcon,
} from 'lucide-react';

type Hat = 'fedora' | 'cap' | 'top' | 'beret' | 'veil' | 'wreath' | 'none';
type Hair = 'short' | 'long' | 'bun' | 'chub' | 'grey' | 'bald';
type Extra = 'shades' | 'mask' | 'monocle' | 'mustache' | 'cigar' | 'glasses' | 'earrings' | 'lips' | 'scar' | 'longMustache';

export interface CharacterSpec {
  id: string;
  label: string;
  bg: [string, string];
  skin: string;
  hair: Hair;
  hairColor: string;
  hat: Hat;
  hatColor?: string;
  band?: string;
  suit: string;
  tie?: string;
  bow?: boolean;
  vyshyvanka?: boolean;
  extras?: Extra[];
}

export const CHARACTERS: CharacterSpec[] = [
  { id: 'don', label: 'Don', bg: ['#3b1d1d', '#7f1d1d'], skin: '#e8b48f', hair: 'grey', hairColor: '#9ca3af', hat: 'fedora', hatColor: '#111827', band: '#b91c1c', suit: '#111827', tie: '#b91c1c', extras: ['cigar'] },
  { id: 'detective', label: 'Detective', bg: ['#1e293b', '#334155'], skin: '#f1c7a5', hair: 'short', hairColor: '#4b3621', hat: 'fedora', hatColor: '#8b6b4a', band: '#3f2d1c', suit: '#6b4f35', tie: '#1f2937', extras: [] },
  { id: 'lady', label: 'Lady in red', bg: ['#4c0519', '#9f1239'], skin: '#f3d0b5', hair: 'long', hairColor: '#1c1917', hat: 'none', suit: '#991b1b', extras: ['lips', 'earrings'] },
  { id: 'masked', label: 'Stranger', bg: ['#0f172a', '#312e81'], skin: '#d9a47e', hair: 'short', hairColor: '#111827', hat: 'none', suit: '#0f172a', tie: '#4338ca', extras: ['mask'] },
  { id: 'kozak', label: 'Kozak', bg: ['#1e3a8a', '#2563eb'], skin: '#e9b892', hair: 'chub', hairColor: '#3b2a1a', hat: 'none', suit: '#1f2937', vyshyvanka: true, extras: ['longMustache'] },
  { id: 'vinok', label: 'Вінок', bg: ['#a16207', '#facc15'], skin: '#f5d2b8', hair: 'long', hairColor: '#7c4a1e', hat: 'wreath', suit: '#f8fafc', vyshyvanka: true, extras: [] },
  { id: 'shades', label: 'Bodyguard', bg: ['#111827', '#374151'], skin: '#8d5a3b', hair: 'bald', hairColor: '#000', hat: 'none', suit: '#0b0b0f', tie: '#0b0b0f', extras: ['shades'] },
  { id: 'rookie', label: 'Rookie', bg: ['#14532d', '#15803d'], skin: '#f0c19c', hair: 'short', hairColor: '#a16207', hat: 'cap', hatColor: '#57534e', suit: '#44403c', tie: '#a16207', extras: [] },
  { id: 'boss', label: 'Old money', bg: ['#422006', '#854d0e'], skin: '#efc6a3', hair: 'grey', hairColor: '#d1d5db', hat: 'top', hatColor: '#0c0a09', band: '#a16207', suit: '#0c0a09', bow: true, extras: ['monocle', 'mustache'] },
  { id: 'femme', label: 'Femme fatale', bg: ['#2e1065', '#6d28d9'], skin: '#f1cdb3', hair: 'bun', hairColor: '#111827', hat: 'veil', hatColor: '#111827', suit: '#18181b', extras: ['lips', 'earrings'] },
  { id: 'prof', label: 'Professor', bg: ['#134e4a', '#0f766e'], skin: '#e3b08a', hair: 'short', hairColor: '#6b7280', hat: 'beret', hatColor: '#7f1d1d', suit: '#3f3f46', tie: '#0f766e', extras: ['glasses', 'mustache'] },
  { id: 'scar', label: 'Enforcer', bg: ['#450a0a', '#1c1917'], skin: '#c68a63', hair: 'short', hairColor: '#1c1917', hat: 'cap', hatColor: '#1c1917', suit: '#27272a', tie: '#52525b', extras: ['scar'] },
];

function Hair({ c }: { c: CharacterSpec }) {
  const h = c.hairColor;
  switch (c.hair) {
    case 'short':
    case 'grey':
      return <path d="M34.5 45 C33 30, 41 25.5, 50 25.5 C60 25.5, 67 30, 65.5 45 C63 37, 57 34, 50 34 C43 34, 37 37, 34.5 45 Z" fill={h} />;
    case 'long':
      return (
        <>
          <path d="M32 72 C28 56, 31 30, 50 27 C69 30, 72 56, 68 72 C64 66, 66 52, 64 44 C60 36, 55 34, 50 34 C45 34, 40 36, 36 44 C34 52, 36 66, 32 72 Z" fill={h} />
          <path d="M35 44 C37 31, 44 27.5, 50 27.5 C58 27.5, 64 31, 65 44 C60 36, 54 34.5, 47 35 C42 36, 38 39, 35 44 Z" fill={h} />
        </>
      );
    case 'bun':
      return (
        <>
          <circle cx="50" cy="24" r="6.5" fill={h} />
          <path d="M34.5 46 C33 31, 41 27, 50 27 C59 27, 67 31, 65.5 46 C62 37, 56 34.5, 50 34.5 C44 34.5, 38 37, 34.5 46 Z" fill={h} />
        </>
      );
    case 'chub':
      // shaved head with the Kozak forelock (чуб/оселедець)
      return <path d="M50 27 C54 27, 56 29, 55 33 C53 37, 47 38, 43 42 C42 37, 44 31, 50 27 Z" fill={h} />;
    default:
      return null;
  }
}

function HatShape({ c }: { c: CharacterSpec }) {
  const col = c.hatColor ?? '#111827';
  switch (c.hat) {
    case 'fedora':
      return (
        <>
          <ellipse cx="50" cy="34" rx="25" ry="5.2" fill={col} />
          <path d="M36 34 C35.5 22, 41 16.5, 50 16.5 C59 16.5, 64.5 22, 64 34 Z" fill={col} />
          <path d="M44 17.5 C47 21, 53 21, 56 17.5" stroke="rgba(0,0,0,.35)" strokeWidth="1.4" fill="none" />
          <rect x="35.6" y="28.5" width="28.8" height="4.2" fill={c.band ?? '#000'} />
        </>
      );
    case 'cap':
      return (
        <path d="M33.5 38 C33 25, 42 20.5, 51 21 C61 21.5, 67 27, 67 35 L74 37.5 C71 40, 60 40, 50 39 C42 39, 37 39, 33.5 38 Z" fill={col} />
      );
    case 'top':
      return (
        <>
          <ellipse cx="50" cy="31.5" rx="21" ry="4.2" fill={col} />
          <rect x="38" y="9" width="24" height="22.5" rx="2" fill={col} />
          <rect x="38" y="25" width="24" height="3.6" fill={c.band ?? '#7f1d1d'} />
        </>
      );
    case 'beret':
      return (
        <>
          <ellipse cx="48" cy="29" rx="18" ry="7.5" fill={col} transform="rotate(-10 48 29)" />
          <circle cx="45" cy="21" r="1.6" fill={col} />
        </>
      );
    case 'veil':
      return (
        <>
          <ellipse cx="44" cy="28" rx="11" ry="4.5" fill={col} transform="rotate(-12 44 28)" />
          <path d="M33 30 L58 26 L60 50 L36 52 Z" fill="url(#veilNet)" opacity="0.55" />
          <circle cx="36" cy="27" r="2.6" fill="#be123c" />
        </>
      );
    case 'wreath':
      // вінок: flowers across the top of the head
      return (
        <>
          {[
            [33, 36, '#dc2626'],
            [38, 29, '#facc15'],
            [44, 25, '#2563eb'],
            [50, 23.5, '#dc2626'],
            [56, 25, '#facc15'],
            [62, 29, '#2563eb'],
            [67, 36, '#dc2626'],
          ].map(([x, y, col], i) => (
            <g key={i}>
              <circle cx={x as number} cy={y as number} r="3.6" fill={col as string} />
              <circle cx={x as number} cy={y as number} r="1.2" fill="#fef3c7" />
            </g>
          ))}
          <path d="M66 38 C70 48, 69 58, 72 66" stroke="#dc2626" strokeWidth="1.6" fill="none" />
          <path d="M68 38 C73 47, 73 57, 76 64" stroke="#2563eb" strokeWidth="1.6" fill="none" />
        </>
      );
    default:
      return null;
  }
}

export function CharacterAvatar({ c, size = 48 }: { c: CharacterSpec; size?: number }) {
  const ex = new Set(c.extras ?? []);
  const gid = `g-${c.id}`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={c.label} className="block">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c.bg[0]} />
          <stop offset="1" stopColor={c.bg[1]} />
        </linearGradient>
        <pattern id="veilNet" width="3" height="3" patternUnits="userSpaceOnUse">
          <path d="M0 0 L3 3 M3 0 L0 3" stroke="#000" strokeWidth="0.5" />
        </pattern>
        <clipPath id={`clip-${c.id}`}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${c.id})`}>
        <rect width="100" height="100" fill={`url(#${gid})`} />
        {/* long hair goes behind the shoulders */}
        {c.hair === 'long' && <Hair c={c} />}
        {/* suit / shoulders */}
        <path d="M12 100 C16 79, 33 70.5, 50 70.5 C67 70.5, 84 79, 88 100 Z" fill={c.suit} />
        {c.vyshyvanka ? (
          <>
            <path d="M42 71 L50 82 L58 71 Z" fill={c.skin} />
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <rect x={45.5 + (i % 2) * 5} y={84 + Math.floor(i / 2) * 5} width="4" height="4" fill="#b91c1c" transform={`rotate(45 ${47.5 + (i % 2) * 5} ${86 + Math.floor(i / 2) * 5})`} />
              </g>
            ))}
            <path d="M24 92 L30 86 L36 92 L30 98 Z M64 92 L70 86 L76 92 L70 98 Z" fill="#b91c1c" />
            <path d="M24 92 L30 86 L36 92 L30 98 Z M64 92 L70 86 L76 92 L70 98 Z" fill="none" stroke="#111827" strokeWidth="0.8" />
          </>
        ) : (
          <>
            <path d="M41 71.5 L50 90 L59 71.5 Z" fill="#e5e7eb" />
            <path d="M41 71.5 L50 90 L37 87 L35.5 76 Z" fill="rgba(0,0,0,.28)" />
            <path d="M59 71.5 L50 90 L63 87 L64.5 76 Z" fill="rgba(0,0,0,.28)" />
            {c.bow ? (
              <path d="M44 74 L50 76.5 L56 74 L56 79.5 L50 77 L44 79.5 Z" fill="#111" />
            ) : c.tie ? (
              <path d="M48.4 75 L51.6 75 L53.2 88 L50 93 L46.8 88 Z" fill={c.tie} />
            ) : null}
          </>
        )}
        {/* neck + head */}
        <rect x="44" y="57" width="12" height="15" rx="3" fill={c.skin} />
        <rect x="44" y="64" width="12" height="4" fill="rgba(0,0,0,.12)" />
        <ellipse cx="35.5" cy="49" rx="2.6" ry="3.8" fill={c.skin} />
        <ellipse cx="64.5" cy="49" rx="2.6" ry="3.8" fill={c.skin} />
        <ellipse cx="50" cy="46" rx="15" ry="17.5" fill={c.skin} />
        {c.hair !== 'long' && <Hair c={c} />}
        {c.hair === 'long' && (
          <path d="M35 44 C37 31, 44 27.5, 50 27.5 C58 27.5, 64 31, 65 44 C60 36, 54 34.5, 47 35 C42 36, 38 39, 35 44 Z" fill={c.hairColor} />
        )}
        {/* face */}
        {!ex.has('shades') && !ex.has('mask') && (
          <>
            <circle cx="44" cy="47" r="1.7" fill="#1f2937" />
            <circle cx="56" cy="47" r="1.7" fill="#1f2937" />
            <path d="M41 43 L46.5 42.4 M53.5 42.4 L59 43" stroke="rgba(0,0,0,.55)" strokeWidth="1.2" strokeLinecap="round" />
          </>
        )}
        <path d="M50 48.5 L48.6 53 L50.8 53.4" stroke="rgba(0,0,0,.25)" strokeWidth="1" fill="none" strokeLinecap="round" />
        {ex.has('lips') ? (
          <path d="M46 57 C48 55.6, 52 55.6, 54 57 C52 59, 48 59, 46 57 Z" fill="#be123c" />
        ) : (
          <path d="M46.5 57.2 C48.5 58.4, 51.5 58.4, 53.5 57.2" stroke="rgba(0,0,0,.45)" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        )}
        {ex.has('mustache') && <path d="M43.5 55.5 C46 53, 49 54, 50 55 C51 54, 54 53, 56.5 55.5 C54 55, 52 55.8, 50 56 C48 55.8, 46 55, 43.5 55.5 Z" fill={c.hairColor} />}
        {ex.has('longMustache') && (
          <path d="M50 54.5 C46 53.5, 42 55, 40 60 C39 63, 37 64, 36 64 C40 65, 43 61, 45 57.5 C47 56.5, 49 56, 50 56.2 C51 56, 53 56.5, 55 57.5 C57 61, 60 65, 64 64 C63 64, 61 63, 60 60 C58 55, 54 53.5, 50 54.5 Z" fill={c.hairColor} />
        )}
        {ex.has('shades') && (
          <>
            <rect x="38.5" y="43.5" width="10" height="6.5" rx="2.2" fill="#0a0a0a" />
            <rect x="51.5" y="43.5" width="10" height="6.5" rx="2.2" fill="#0a0a0a" />
            <path d="M48.5 46 L51.5 46" stroke="#0a0a0a" strokeWidth="1.4" />
            <path d="M40 45 L43 44.8" stroke="rgba(255,255,255,.5)" strokeWidth="0.9" strokeLinecap="round" />
          </>
        )}
        {ex.has('mask') && (
          <>
            <path d="M36 45 C40 40.5, 46 41, 50 44 C54 41, 60 40.5, 64 45 C62 50, 56 51.5, 50 48.5 C44 51.5, 38 50, 36 45 Z" fill="#111827" />
            <ellipse cx="44" cy="46" rx="2.6" ry="1.6" fill={c.skin} />
            <ellipse cx="56" cy="46" rx="2.6" ry="1.6" fill={c.skin} />
            <circle cx="44" cy="46" r="1" fill="#1f2937" />
            <circle cx="56" cy="46" r="1" fill="#1f2937" />
          </>
        )}
        {ex.has('glasses') && (
          <>
            <circle cx="44" cy="47" r="3.6" fill="none" stroke="#111827" strokeWidth="1.1" />
            <circle cx="56" cy="47" r="3.6" fill="none" stroke="#111827" strokeWidth="1.1" />
            <path d="M47.6 47 L52.4 47" stroke="#111827" strokeWidth="1" />
          </>
        )}
        {ex.has('monocle') && (
          <>
            <circle cx="56" cy="47" r="3.8" fill="rgba(255,255,255,.12)" stroke="#d4a017" strokeWidth="1.1" />
            <path d="M59.5 49 C61 55, 60 60, 62 66" stroke="#d4a017" strokeWidth="0.6" fill="none" />
          </>
        )}
        {ex.has('cigar') && (
          <>
            <rect x="53" y="56.2" width="11" height="2.6" rx="1" fill="#7c2d12" transform="rotate(12 53 57)" />
            <circle cx="64.3" cy="60.3" r="1.3" fill="#f97316" />
            <path d="M65 58 C67 55, 64 53, 66.5 50" stroke="rgba(229,231,235,.5)" strokeWidth="0.8" fill="none" />
          </>
        )}
        {ex.has('earrings') && (
          <>
            <circle cx="35.5" cy="54" r="1.4" fill="#fbbf24" />
            <circle cx="64.5" cy="54" r="1.4" fill="#fbbf24" />
          </>
        )}
        {ex.has('scar') && <path d="M57 41 L61 52" stroke="#9f1239" strokeWidth="1.1" strokeLinecap="round" />}
        <HatShape c={c} />
      </g>
    </svg>
  );
}

export interface EmblemSpec {
  id: string;
  label: string;
  Icon: LucideIcon;
  bg: [string, string];
  fg: string;
}

export const EMBLEMS: EmblemSpec[] = [
  { id: 'mask', label: 'Mask', Icon: VenetianMask, bg: ['#312e81', '#6d28d9'], fg: '#ede9fe' },
  { id: 'crown', label: 'Crown', Icon: Crown, bg: ['#78350f', '#d97706'], fg: '#fef3c7' },
  { id: 'spade', label: 'Spade', Icon: Spade, bg: ['#111827', '#374151'], fg: '#f9fafb' },
  { id: 'rose', label: 'Rose', Icon: Rose, bg: ['#4c0519', '#be123c'], fg: '#ffe4e6' },
  { id: 'moon', label: 'Moon', Icon: Moon, bg: ['#0f172a', '#1e3a8a'], fg: '#fde68a' },
  { id: 'cat', label: 'Cat', Icon: Cat, bg: ['#1c1917', '#57534e'], fg: '#fde68a' },
  { id: 'bird', label: 'Owl', Icon: Bird, bg: ['#14532d', '#15803d'], fg: '#dcfce7' },
  { id: 'flower', label: 'Sunflower', Icon: Flower2, bg: ['#1d4ed8', '#facc15'], fg: '#ffffff' },
  { id: 'gem', label: 'Gem', Icon: Gem, bg: ['#164e63', '#0891b2'], fg: '#cffafe' },
  { id: 'key', label: 'Key', Icon: Key, bg: ['#422006', '#a16207'], fg: '#fef9c3' },
  { id: 'dice', label: 'Dice', Icon: Dices, bg: ['#7f1d1d', '#dc2626'], fg: '#fee2e2' },
  { id: 'wine', label: 'Wine', Icon: Wine, bg: ['#3b0764', '#86198f'], fg: '#fae8ff' },
  { id: 'club', label: 'Club', Icon: Club, bg: ['#052e16', '#166534'], fg: '#dcfce7' },
  { id: 'diamond', label: 'Diamond', Icon: Diamond, bg: ['#7f1d1d', '#e11d48'], fg: '#fff1f2' },
  { id: 'feather', label: 'Feather', Icon: Feather, bg: ['#134e4a', '#14b8a6'], fg: '#ccfbf1' },
  { id: 'anchor', label: 'Anchor', Icon: Anchor, bg: ['#0c4a6e', '#0369a1'], fg: '#e0f2fe' },
];

export function EmblemAvatar({ e, size = 48 }: { e: EmblemSpec; size?: number }) {
  const { Icon } = e;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '9999px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${e.bg[0]}, ${e.bg[1]})`,
      }}
      aria-label={e.label}
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5, color: e.fg }} strokeWidth={1.8} />
    </div>
  );
}

/** Deterministic avatar for a nickname (prototype: lets the game tiles show one). */
export function characterFor(name: string): CharacterSpec {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CHARACTERS[h % CHARACTERS.length];
}

export type AvatarChoice = { kind: 'character'; id: string } | { kind: 'emblem'; id: string } | { kind: 'photo' };

export function AvatarView({ choice, size = 48 }: { choice: AvatarChoice; size?: number }) {
  if (choice.kind === 'character') {
    const c = CHARACTERS.find((x) => x.id === choice.id) ?? CHARACTERS[0];
    return <CharacterAvatar c={c} size={size} />;
  }
  if (choice.kind === 'emblem') {
    const e = EMBLEMS.find((x) => x.id === choice.id) ?? EMBLEMS[0];
    return <EmblemAvatar e={e} size={size} />;
  }
  return null;
}
