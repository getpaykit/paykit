# UI Design Principles

## Design References

These are landing pages we admire and draw inspiration from. We don't copy any of them directly — PayKit has its own identity. Use these as a reference for quality, tone, and craft.

- [Vercel](https://vercel.com/home)
- [Better Auth](https://better-auth.com/)
- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.com)
- [Emdash](https://www.emdash.sh/)
- [Vite+](https://viteplus.dev)
- [Notra](https://www.usenotra.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Drizzle ORM](https://orm.drizzle.team/)

## Components

- Use shadcn/ui components as the base. Never build custom buttons, inputs, etc. from scratch.
- To customize styles, overwrite the default component with Tailwind class names. Don't fork or duplicate the component.
- Co-locate component props with the function definition. Don't separate them into standalone interfaces.

## Colors & Theme

- Prefer theme CSS variables (`bg-background`, `text-foreground`, `bg-card`, `border-border`) over hardcoded colors.
- Only use hardcoded hex/oklch when the design system doesn't cover the specific case (e.g., Shiki theme colors, brand-specific provider colors).
- Dark mode uses oklch neutral grays with zero chroma. All defined in CSS variables in `globals.css`.

## Rounding

- **Containers** (cards, panels, nav, sections, code blocks): sharp or `rounded-md`
- **Interactive elements** (buttons, inputs, badges, message bubbles): `rounded-md` or inherit from the component default (Button uses `rounded-lg`)
- **Simulated windows** (browser frames, terminal): `rounded-lg`
- Buttons keep their component default rounding. Never override buttons to sharp.
- Podium wrappers: inner element rounding + padding = outer rounding (e.g., inner `rounded-md` + `p-1` = outer `rounded-lg`)

## Sizing & Spacing

- Use Tailwind's spacing scale over arbitrary pixel values. `w-50` not `w-[200px]`.
- Arbitrary values only when no scale equivalent exists.
- Font sizes below the Tailwind scale (`text-[10px]`, `text-[11px]`, `text-[13px]`) are acceptable since they have no standard equivalent.
- Prefer `rem`-based sizing via Tailwind classes. Avoid raw `px` units.

## Section Layout

- All landing sections use `Section` + `SectionContent` from `layout/section.tsx`.
- Dashed borders are rendered via SVG `DashedLine` components, not CSS `border-dashed`.
- Section separators use `SectionSeparator` for full section-width dashed lines.
- Uniform padding across all sections via `SectionContent` (currently `p-12`).

## Typography & Content

- No emdashes in user-facing text. Use periods, commas, or shorter sentences instead.
- Use Geist (sans) and Geist Mono (mono) via CSS variables `--font-sans` and `--font-mono`.
- Prefer standard Tailwind text sizes (`text-xs`, `text-sm`, `text-base`). Use arbitrary values only for sub-scale sizes.

## Code Blocks

- Server-rendered syntax highlighting via Shiki (fumadocs integration).
- `CodeBlockContent` for full code blocks with line numbers and copy button.
- `InlineCode` for small inline snippets (uses `codeToTokens` API, no `dangerouslySetInnerHTML`).
- Active theme: `github-light` (light) / `one-dark-pro` (dark). Alternative themes stored in `lib/shiki-themes/`.
