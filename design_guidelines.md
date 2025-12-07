# Marketing Budget Tracker - Design Guidelines

## Design Approach

**Selected Approach:** Design System-Based (Material Design principles adapted for financial clarity)

**Rationale:** This is a utility-focused budget management tool where clarity, efficiency, and data legibility are paramount. Drawing inspiration from financial dashboard applications like Mint and Expensify, with emphasis on clean data presentation and simple interactions.

**Key Principles:**
- Clarity over decoration
- Immediate data visibility
- Efficient data entry
- Clear visual hierarchy for financial information

---

## Core Design Elements

### Typography

**Font Family:** Inter or Roboto (via Google Fonts CDN)

**Hierarchy:**
- Page Title: 2xl (24px), semibold
- Budget Display (large numbers): 4xl-5xl (36-48px), bold
- Section Headers: lg (18px), medium
- Expense Items: base (16px), regular
- Labels/Meta: sm (14px), medium
- Currency symbols: Tabular numbers for alignment

### Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, and 8
- Component padding: p-4 to p-6
- Section gaps: gap-4 to gap-6
- Card spacing: p-6
- Form field spacing: space-y-4

**Container:**
- Max width: max-w-4xl (centered)
- Horizontal padding: px-4 (mobile), px-6 (desktop)
- Vertical rhythm: py-8 sections

---

## Component Library

### Budget Overview Card
- Prominent display at top of page
- Large numerical display of remaining budget
- Smaller total budget reference
- Progress indicator (horizontal bar or ring showing percentage used)
- Visual status indicators:
  - Above 50% remaining: Success state
  - 25-50% remaining: Warning state  
  - Below 25% remaining: Alert state

### Add Expense Form
- Inline form positioned below budget overview
- Fields: Expense name (text), Amount (number), Category (dropdown/select)
- Single "Add Expense" button (primary)
- Form inputs with clear labels above fields
- Compact, single-row layout on desktop, stacked on mobile

### Expense List
- Table-like structure with clear columns:
  - Name (left-aligned)
  - Category (badge/pill style)
  - Amount (right-aligned, tabular numbers)
  - Actions (edit/delete icons)
- Alternating subtle backgrounds for readability
- Running total footer row (bold, slightly larger)
- Empty state: Simple centered message when no expenses

### Category Pills
- Rounded badges for expense categories
- Different subtle background shades per category
- Compact size, medium weight text

### Set Budget Control
- Simple input field with currency prefix
- "Set Budget" or "Update Budget" button
- Positioned at very top or as modal/inline edit

---

## Layout Structure

**Single Page Dashboard:**
```
1. Header (minimal)
   - App title "Marketing Budget Tracker"
   - Total budget display/edit option

2. Budget Overview Section
   - Large remaining budget card
   - Progress visualization
   - Total spent summary

3. Add Expense Section  
   - Inline form
   - Immediate feedback on submission

4. Expenses List Section
   - All expenses in chronological order (newest first)
   - Quick edit/delete actions
```

---

## Interaction Patterns

**Data Entry:**
- Auto-focus on first field
- Enter key submits form
- Clear form after successful submission
- Instant budget update animation

**Expense Management:**
- Click to edit inline
- Confirmation for deletions (simple modal or inline confirm)
- Smooth removal animations

**Budget Updates:**
- Smooth number transitions when adding/removing expenses
- Progress bar animates on changes

---

## Responsive Behavior

**Desktop (lg+):**
- Centered container with comfortable width
- Form fields in row
- Expense list in table format

**Mobile (base):**
- Full width with padding
- Stacked form fields
- Card-style expense items instead of table
- Simplified layout maintaining all functionality

---

## Images

**No hero image required** - This is a utility dashboard focused on data clarity, not marketing content.