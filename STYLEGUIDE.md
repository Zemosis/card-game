# UI/UX Style Guide — Card-Lore / Khuzur Card Hall

Reference this document when building any new UI components, pages, modals, or popups. Every element must feel like it belongs in a pixel-art dungeon card hall.

## Design Language

**Theme:** Retro pixel-art dungeon/card-hall. Dark backgrounds, glowing accents, hard pixel borders, no rounded corners, no gradients that feel "modern." Everything looks like it was rendered on a 16-bit console.

**Vibe words:** Gritty, warm lamplight, dungeon tavern, enchanted cards, worn parchment.

## Typography

| Role | Font | CSS Class | Usage |
|------|------|-----------|-------|
| Headings, labels, tags | `Press Start 2P` | `.font-pixel-display` | Panel titles, buttons, stat labels, section headers |
| Body text, values, chat | `VT323` | `.font-pixel-body` | Descriptions, player names, messages, numeric values |
| Mid-weight UI | `Silkscreen` | `.font-pixel-mid` | Breadcrumbs, secondary labels |

**Sizing convention:**
- Display headings: `text-[9px]` to `text-[14px]` (Press Start 2P is naturally large)
- Body text: `text-sm` to `text-xl` (VT323 is thin, needs larger sizes)
- All text uppercase where thematic (headings, labels, buttons)

## Color Palette

Defined in `index.css` via `@theme`:

| Token | Hex | Role |
|-------|-----|------|
| `void` | `#0a0712` | Deepest background, borders, shadows |
| `night` | `#14102a` | Secondary background |
| `twilight` | `#1f1a3d` | Card/panel backgrounds, input backgrounds |
| `dusk` | `#2a234d` | Tertiary panels, inactive borders |
| `mist` | `#463a78` | Muted purple UI elements |
| `gold` | `#f4c430` | Primary accent — active states, XP, highlights |
| `gold-deep` | `#c89820` | Gold borders, secondary gold |
| `gold-glow` | `#ffe066` | Inner glow on gold elements |
| `cyan-glow` | `#5fd4d6` | Secondary accent — online indicators, wins |
| `cyan-deep` | `#2a8a8c` | Cyan borders |
| `rose` | `#e85a7a` | Danger/private/warning accent |
| `rose-deep` | `#a83a5a` | Rose borders |
| `parchment` | `#ead8b1` | Primary text color |
| `bone` | `#c8b890` | Secondary/muted text |
| `poison` | `#9bd14f` | Success/join/easy accent |
| `poison-deep` | `#6a9a30` | Poison borders |
| `felt` | `#4a1a2c` | Table felt background |
| `oak` | `#6b3a1f` | Wood trim accents |

## Component Patterns

### Panels (`PixelPanel`)
- 4px solid border in accent color
- Outer 4px `void` shadow
- Inner highlight: `inset 0 4px 0 rgba(255,255,255,0.06)`
- Title bar: full-width colored strip with `border-bottom: 4px solid void`
- Title text: `font-pixel-display text-[10px]` uppercase

### Buttons (`PixelButton` / `.pixel-btn`)
- 4px solid `void` border
- Inner top highlight + inner bottom shadow
- 4px `void` drop shadow (creates "raised" pixel look)
- Hover: `translateY(-2px)`, shadow extends to 6px
- Active: `translateY(2px)`, shadow collapses to 0
- Disabled: `opacity: 0.4`, no transform, `cursor: not-allowed`
- Sizes: `sm`, `md`, `lg`, `xl`
- Colors: `gold`, `cyan`, `rose`, `poison`, `dusk`, `bone`, `danger`

### Inputs
- Background: `#0a0712` (void)
- Border: `3px solid #1f1a3d` (twilight)
- Inner shadow: `inset 0 2px 0 0 rgba(0,0,0,0.5)`
- Text: `parchment` color, `font-pixel-display` or `font-pixel-body`
- No border-radius, no outline on focus
- Uppercase where thematic (codes, names)

### Avatars (`PixelAvatar`)
- Square, no border-radius
- 3px `void` border + pixel shadow
- CSS-only face: `::before` for eyes, `::after` for mouth
- 6 gradient variants: avatar-1 (gold), avatar-2 (cyan), avatar-3 (rose), avatar-4 (poison), avatar-5 (purple), avatar-me (parchment)
- Sizes passed via `size` prop (px value)

### Modals / Popups
- Must use same panel style as `PixelPanel`
- Backdrop: semi-transparent void `rgba(10, 7, 18, 0.85)` with optional dither
- Modal itself: `night` background, accent-colored border
- Title bar at top, same pattern as panel titles
- Close button: small pixel-btn in top-right or integrated into title bar
- Content area: standard padding, void-colored inner sections for inputs/groups
- Action buttons: full-width or side-by-side at bottom, using `PixelButton`

### Tags / Badges
- Small rectangles: `font-pixel-display text-[7px]` to `text-[9px]`
- Solid background color, 2px void border
- Used for: "SOON", "LOCKED", level badges, status indicators

## Backgrounds

- **Starfield** (`.starfield`): Main menu / lobby backgrounds — scattered radial-gradient dots on void-to-night gradient
- **Felt** (`.felt-bg`): Game table surfaces — dark red with subtle radial gradient
- **Dither** (`.dither-shadow`, `.dither-light`): 45-degree repeating line overlays for texture
- **Checker strip** (`.checker-strip`): Decorative divider bars

## Glow Effects

- `.glow-gold` / `.text-glow-gold`: Gold drop-shadow / text-shadow
- `.glow-cyan` / `.text-glow-cyan`: Cyan glow
- `.glow-rose` / `.text-glow-rose`: Rose glow
- `.text-shadow-hard`: Simple `2px 2px 0 #000` text shadow

## Animations

- `.pulse-gold`: Pulsing gold border glow (1.6s cycle)
- `.blink`: Step-blink (1s cycle, binary on/off)
- `.float-y`: Gentle vertical float (2.4s cycle)
- `.shimmer-text`: Gold shimmer sweep across text (3s cycle)
- Button transitions: 80ms ease transforms
- Card transitions: 120ms ease transforms
- Hover lifts: `translateY(-2px)` to `translateY(-8px)` depending on element

## Identity System

### Player Identity Format
- **Display name**: max 6 characters, uppercase, `font-pixel-display`
- **Hashtag ID**: `#` + 4 alphanumeric characters (e.g., `#4A2F`), `font-pixel-body`
- **Combined display**: `NAME #ID` — e.g., `WANDER #4719`
- **Avatar**: one of the 6 `PixelAvatar` variants (1-5 + "me")

### Guest Users (not signed in)
- Name, ID, and avatar are **randomly assigned** on first visit
- Stored in `localStorage` for session persistence
- **Cannot change** name, ID, or avatar — inputs are disabled/hidden
- Guest identity shown with muted styling (e.g., `text-bone/60` label "Guest")
- No stats persistence server-side

### Signed-in Users (Supabase Auth)
- **Can change** display name (6 char max), hashtag ID (4 char max), and avatar
- Profile editable in the lobby "Adventurer" panel
- Name/ID validated for uniqueness server-side (via `profiles` table)
- Stats (EXP, wins, level) persist and display with glow accents
- Avatar selection: clickable grid of all variants, selected one gets gold border highlight

### Login / Signup Popup
- Triggered by "Sign In" button on MainMenu top bar
- **Modal overlay**, not a separate route — keeps the main menu visible behind backdrop
- Same pixel-art style as all other panels (see Modals section above)
- Auth methods: email + password (primary), optional OAuth later
- Two-tab or two-step flow: "SIGN IN" / "SIGN UP" toggle
- After signup: prompt for display name + ID + avatar pick (profile setup step)
- After login: close modal, update top-bar identity from profile data
- Error states: red-tinted inline messages using rose accent

## Spacing & Layout Conventions

- Page structure: `w-full h-screen` with flex column, top bar at top
- Grid layouts for lobby-style pages: `grid-cols-[400px_1fr]`
- Gap sizes: `gap-2` to `gap-4` between panels, `p-2` to `p-3` inside panels
- All positioning uses inline styles for pixel-precise control
- No border-radius anywhere — everything is sharp rectangles
