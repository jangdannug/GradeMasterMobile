import { WEB_TOKENS } from './tokens.generated';

/** The app's themes, matching GradeMasterFrontend/client/app/lib/theme.ts. Swatch is [page, card, sidebar]. */
export const THEMES = [
  { id: 'mist', label: 'Mist Blue', swatch: ['#D9E3EF', '#E9EFF6', '#192C48'] },
  { id: 'slate', label: 'Slate Grey', swatch: ['#DDE3EC', '#EBEFF4', '#1C2533'] },
  { id: 'paper', label: 'Warm Paper', swatch: ['#EAE4D9', '#F6F3EC', '#2F241D'] },
  { id: 'sage', label: 'Soft Sage', swatch: ['#DCE5E0', '#EDF3EF', '#173028'] },
  { id: 'dark', label: 'Dark', swatch: ['#0A111E', '#111827', '#101D32'] },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'mist';

const isThemeId = (value: unknown): value is ThemeId => THEMES.some((theme) => theme.id === value);

/** Reads a stored theme: the old "light" becomes Mist Blue, "dark" stays Dark, anything else falls back to the default. */
export function normalizeTheme(value: string | null | undefined): ThemeId {
  if (value === 'light') return 'mist';
  if (value === 'dark') return 'dark';
  return isThemeId(value) ? value : DEFAULT_THEME;
}

// Dark keeps the 50/100 ramp steps light, so its tints are the status colour mixed into the card instead
function mix(color: string, base: string, amount: number): string {
  const channel = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16);
  const out = [1, 3, 5].map((at) => {
    const value = Math.round(channel(color, at) * amount + channel(base, at) * (1 - amount));
    return value.toString(16).padStart(2, '0').toUpperCase();
  });
  return `#${out.join('')}`;
}

function build(id: ThemeId) {
  const web = WEB_TOKENS[id];
  const isDark = id === 'dark';
  const tint = (solid: string, step50: string) => (isDark ? mix(solid, web.card, 0.16) : step50);
  return {
    ...web,
    isDark,
    // Web --muted is a surface; mobile's long-standing `muted` is the secondary text colour
    surfaceMuted: web.muted,
    muted: web.mutedForeground,
    primaryTint: tint(web.primary, web.primary100),
    successTint: tint(web.success, web.success50),
    warningTint: tint(web.warning, web.warning50),
    destructiveTint: tint(web.destructive, web.destructive50),
    infoTint: tint(web.info, web.info50),
    secondaryTint: web.secondary,
    chartTeachers: '#10b981',
  };
}

export type ThemeTokens = ReturnType<typeof build>;

export const THEME_TOKENS: Record<ThemeId, ThemeTokens> = {
  mist: build('mist'),
  slate: build('slate'),
  paper: build('paper'),
  sage: build('sage'),
  dark: build('dark'),
};
