---
name: Ledger
description: Expense tracker read like a railway platform — a station board for the total, metro lines for categories, a timetable for entries.
colors:
  platform-concrete: "#ecede9"
  panel-white: "#ffffff"
  rule: "#dcddd7"
  rule-soft: "#e7e8e4"
  ink: "#121212"
  ink-secondary: "#3d403b"
  muted: "#5f625c"
  rail: "#121212"
  rail-ink: "#b4b7b0"
  signal-yellow: "#f6c400"
  signal-yellow-hover: "#ffd21f"
  spend-up: "#a8200d"
  spend-down: "#1e7a3a"
  line-food: "#e2231a"
  line-transport: "#1d5fbf"
  line-shopping: "#d9488f"
  line-bills: "#e8731c"
  line-entertainment: "#7b3fa0"
  line-health: "#2e9b4a"
  line-education: "#b0177f"
  line-other: "#8a8d87"
typography:
  board-figure:
    fontFamily: "Anek Latin, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(56px, 7vw, 120px)"
    fontWeight: 760
    lineHeight: 1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Anek Latin, Segoe UI, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.1
  panel-heading:
    fontFamily: "Anek Latin, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 650
    lineHeight: 1.45
  figure:
    fontFamily: "Anek Latin, Segoe UI, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Anek Latin, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Anek Latin, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.45
rounded:
  none: "0px"
  roundel: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  gutter: "20px"
  canvas: "32px"
components:
  button-primary:
    backgroundColor: "{colors.signal-yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.signal-yellow-hover}"
  button-ghost:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "44px"
  segmented-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.signal-yellow}"
    rounded: "{rounded.none}"
    height: "34px"
  panel:
    backgroundColor: "{colors.panel-white}"
    rounded: "{rounded.none}"
    padding: "18px 20px 20px"
  input:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "44px"
  nav-item-active:
    backgroundColor: "#1d1d1d"
    textColor: "#ffffff"
    height: "42px"
---

# Design System: Ledger

## Overview

Ledger reads like a railway platform. The total is a yellow station board. Categories are metro lines in the Delhi Metro colours. Entries read like a timetable. The world contributes four things only: the board's type and yellow, the line colours, the dense ruled rhythm, and the board's rolling digits. Navigation, tables, inputs and charts stay standard web controls.

The scene is a laptop in daylight or a classroom projector, so the ground is light: platform-concrete grey with white panels. The black rail frames the screens the way a signboard frames its lettering. Every screen answers one question and fits a 1440×900 viewport without page scroll. The transactions table scrolls inside its panel.

## Colors

### Primary
- **Signal Yellow** (`#f6c400`): the station board, the active nav line, the selected range, and the one primary action (Add expense). Nowhere else.

### Neutral
- **Platform Concrete** (`#ecede9`): page ground and day-row bands.
- **Panel White** (`#ffffff`): every working surface.
- **Ink** (`#121212`): text, rail, chart bars when no line is selected, panel heading rules.
- **Muted** (`#5f625c`): labels, axis text, secondary figures (5.9:1 on white).
- **Rule** (`#dcddd7`) / **Rule Soft** (`#e7e8e4`): panel edges and row dividers.

### Lines (data)
Food red, Transport blue, Shopping pink, Bills orange, Entertainment violet, Health green, Education magenta, Other grey. A category keeps its line colour on every screen: route line, bullet, chart bars when filtered, share bar. The Delhi Metro yellow line is deliberately absent so yellow stays the signal.

### Named Rules
**Spending Up Is Red.** A rise in spending is `#a8200d`, a fall is `#1e7a3a`, and an unchanged figure is ink. Colour shows whether the change is good or bad, never just its direction.
**Yellow Is Scarce.** The yellow appears on the board, the active state and the primary button only. Never use it as a chart fill: it fails 3:1 against white.

## Typography

**Face:** Anek (Ek Type), self-hosted variable woff2 with weight 100–800 and width 75–125%. Anek Latin carries everything. One family throughout. The UI is English only. Tabular numerals are set on `body`.

### Hierarchy
- **Board figure** 760 weight, 122% width, clamp(56px, 7vw, 120px). Only the total. It shrinks to fit when a lakh-sized figure would overflow.
- **Title (h1)** 28px / 700 / 112% width.
- **Panel heading** 16px / 650 / 108% width, sitting on a 1px ink rule.
- **Figure** 24px / 700 (board strip values).
- **Body** 15px / 400 / 1.45.
- **Label** 13px / 500, sentence case, in muted ink. Never uppercase-tracked.

### Named Rules
**Width Is the Display Voice.** Emphasis comes from the width axis (110–122%) and weight, never from a second face or italics.

## Layout

A 248px rail (220px under 1180px) and a fluid canvas with 32px side padding. The header puts the title on the left and the one primary action, **Add expense**, in the top-right corner; the finding sentence and the range controls share the row below. The rail holds navigation, the line filter, Install app and a link back to the landing page. Overview and Analytics use a 12-column grid with a 20px gutter: the board and chart span 7 columns with lines and recent entries at 5, and on Analytics the month chart and category table span 8 with weekday and pipeline at 4. Cards in a row share top and bottom edges. Under 900px the rail becomes a sticky top bar with a scrolling row of line chips, navigation moves to a bottom tab bar with a yellow Add tab (the header button hides), and every grid becomes a single column.

## Elevation & Depth

Panels stay flat: separation comes from 1px rules and the ground/panel tone step. Only real overlays get a shadow: toasts (`0 10px 30px -10px rgba(0,0,0,.4)`) and the drawer's backdrop scrim. The board's double frame is drawn with inset rings, not shadows.

Depth lives in a few named places, all CSS 3D (no WebGL in the app):
- **The board** turns up to 6°/8° toward the pointer (`perspective(1400px)`), with a soft white sheen following the cursor. Fine pointers only.
- **The coin**: a ₹ coin made of ten stacked ink discs floats 60px above the board face, spinning (7s) and bobbing (3.6s), with a shadow on the board. It hops and spins when an expense is saved, and the rail's ₹ mark flips.
- **Screen entrances**: when a screen opens, its panels swing up from `rotateX(9deg)` with a 70ms stagger, 560ms.
- **Bars** rise from the baseline when new data arrives (not on resize).
All of it is off under reduced motion.

## Shapes

Square corners everywhere. The only round shape is the metro roundel: a 12–16px circle with a 3–4px ring in the line colour and a white centre, filled solid when selected.

## Components

### Buttons
- **Primary** (Add expense, Save): yellow fill, ink text, 44px, square. Scales to 0.97 on press. One per screen.
- **Ghost**: 1px rule border, ink on hover.
- **Icon button**: 32px, muted to ink on hover; delete turns red on hover.

### Station Board (signature)
Yellow field with an 8px margin, a 3px ink inner frame, the caption ("Total spent · Last 30 days"), then the figure. Below them is a 2px ink rule and a three-column strip (This month, Entries, Largest) split by 1px ink rules. Each character of the figure carries a hairline split like a split-flap board; when the figure changes, changed characters flip over in 3D (top flap falls 160ms ease-in, bottom flap lands 260ms with a slight bounce, 45ms stagger left to right). This is skipped under reduced motion.

### Category Route
One row per line: name and entry count, a 6px line whose length is proportional to the largest category and ends in a roundel, then the amount and share. Clicking a row filters every screen, and the other rows fade to 40%.

### Timetable
Tables have sentence-case grey headers, 1px soft row rules, right-aligned tabular amounts, and no zebra striping. When sorted by date, entries are grouped under concrete-toned day rows that carry the day total.

### Charts
Hand-drawn SVG bars with square ends, 3–4 faint gridlines, an ink baseline, and grey axis labels with no y-axis line. The tallest bucket gets a 1px leader and a label naming its largest entry.

### Drawer
A right-side `<dialog>` of 460px that slides in over 280ms with the iOS drawer curve and closes in 200ms. When opened with the N key or closed with Esc it appears and disappears instantly. The amount field is a small yellow board.

## Do's and Don'ts

### Do:
- **Do** give every new category a line colour and a roundel, and use it on every screen.
- **Do** state the baseline in words for every change ("+52% vs Sept").
- **Do** fit each screen into the viewport and scroll inside the panel that holds long content.

### Don't:
- **Don't** add KPI tiles, donuts, decorative gradients, glows, or rounded cards. (The board's pointer sheen is the one exception.)
- **Don't** use yellow for data or decoration.
- **Don't** add motion beyond the named set: press, drawer, toast, split-flap digits, board tilt, the coin, screen entrances and rising bars. Everything respects reduced motion.

## Landing page

`/` is a marketing page in the same system (`public/index.html`, `landing.css`, `landing.js`); the app lives at `/app`. The hero is a night-platform ink band with the hero art (`public/hero.webp`): a glossy pink piggy bank on a stone platform with gold ₹ coins, cropped from the supplied render with its watermark removed. The glass card in the art was cleared of baked-in text; the live "Spent this month" figure is HTML laid over it (positioned in % of the image, sized in `cqw`), so it always shows the real total. The art's left, top and bottom edges fade into the background, it tilts up to 4°/6° toward the pointer and floats gently (both off under reduced motion), and on phones it sits above the headline. Below: the real app screenshots in a tilted 3D frame that flips between tabs; a night section where the category lines glow as neon (brightened variants of the line hues, soft blur glow, rounded bends) on a rounded glass panel, fanning out from a black ₹ hub to roundels with each share in its line colour, drawn from the API; the live aggregation pipeline, and a closing station board. Figures on the page come from the API or are hidden; none are invented.
