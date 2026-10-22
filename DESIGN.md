# Design A: Classic

## Concept
A polished version of the wireframe: a soft gray rail of account circles on the left, a slim top bar, and the Google page in a rounded white card with a thin accent in the current account's color. Standard native window frame, light theme, Segoe UI Variable.

## What's on screen
- **Rail (64px):** initials-on-color avatars, a pill on the rail edge plus a ring on the active one, red unread badges, dashed "+" button below.
- **Top bar left:** color dot, account label and email (always visible), and a ⋯ button to edit the current account. Shows "signing in..." until the email is known.
- **Top bar right:** back and reload buttons, then a segmented control (Gmail / Calendar / Drive) with original inline-SVG glyphs; the active segment is raised and its glyph takes the account color.
- **Card:** rounded, shadowed, 4px top edge in the account color; the native view is inset inside it. A white sweep animates along the accent edge while `state.loading` is true for the active account/service.
- **Welcome:** with no accounts, a friendly empty state with an "Add a Google account" button.

## Interactions
- Click avatar to switch account (keeps current service); click a segment to switch service.
- Right-click an avatar, or use ⋯ in the top bar, to rename, recolor (from `state.palette`) or remove. Remove asks for confirmation and says it signs the account out.
- "+" or Ctrl+Shift+K (`palette`) opens Add dialog (label and color; next unused palette color preselected).
- Dialogs call `setOverlay(true/false)`, close on Escape or backdrop click, and restore focus.
- Tooltips carry shortcuts: Ctrl+1..9 on avatars, Alt+1/2/3 on services, F5, Alt+Left.

## Why it suits the goal
- Fast switching: everything is one click, always visible, with shortcut hints.
- Never confusing accounts: the account is stated three ways at once (rail ring and pill, top-bar dot with label and email, colored card edge and active glyph).

## Trade-offs
- The native view has square corners inside a rounded card, so it is inset 6px to hide that; this costs a little content space.
- Only ~8 accounts fit comfortably before the rail scrolls (it scrolls without a scrollbar).
- Native `title` tooltips are plain; no drag-to-reorder (API supports it, not built).
- Fixed-width rail means no account names at a glance, only initials and colors.

## Plumbing requests
None.
