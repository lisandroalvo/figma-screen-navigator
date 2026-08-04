# Figma Screen Detection Calibration Report

## Executive summary

The Pension Calculation Figma file was re-scanned with a calibrated confidence model. The candidate count dropped from **600** to **66** — an **89% reduction**. The remaining candidates are mostly medium-confidence wireframes that require human review before they can be published.

## File

- **File name:** Pension Calculation
- **File key (masked):** h0EjBt...pI23FY
- **Last modified:** 2026-07-23T16:21:44Z

## Counts

| Category | Count |
|---|---|
| Original candidates | 600 |
| Calibrated candidates | 66 |
| High confidence | 0 |
| Medium confidence | 37 |
| Low confidence | 29 |
| Rejected | 39,108 |
| Ignored pages/nodes | 1 |
| Breakpoints discovered | 10 |

## Proposed changes from calibration sync job

- **Sync job ID:** `18090b51-18b2-4f24-bbc4-b7ba404a883a`
- **Ambiguous candidates proposed:** 37
- **Missing existing screens proposed:** 9
- **New screens proposed automatically:** 0

## Pages and strategy

All indexed pages use the `direct_children` strategy, bounded by `maxDepth`, `minWidth`, `minHeight`, and `minWidthRatio` from `src/lib/figma/config.ts`.

| Page | Strategy |
|---|---|
| List Estimates/Calculations | direct_children |
| Floor Detail | direct_children |
| Accrual Detail | direct_children |
| Calculation Detail | direct_children |
| Estimate Detail | direct_children |

## Main false-positive patterns removed

- Repeated side-bar frames (186 instances in the original scan)
- Repeated `Org Profile / Bottom Navigation` frames
- Modal, popover, and tooltip overlays that belong inside a complete wireframe
- Generic `Frame NNNNNNN` containers
- Component internals: chips, widgets, cards, rows, tabs, adjustment containers
- Deeply nested layout frames without a recognizable application shell

## Confidence rules introduced

Positive signals:

- Under a recognized breakpoint
- Width close to breakpoint (>= 0.8)
- Width above the page-configured minimum ratio
- Descriptive, non-generic name
- Contains recognizable application shell (header, sidebar, navigation, footer, content, main)
- Contains only behavior-variant children (tooltip, popover, modal, accordion, etc.)

Negative signals:

- Generic `Frame NNNNNNN` names
- Names matching ignored component patterns (side-bar, card, widget, chip, row, button, etc.)
- Dimensions below the configured minimum
- Width ratio below the page minimum
- Behavior overlays with width < 80% of the breakpoint
- Exceeding the configured `maxDepth`

## Ambiguity flags introduced

- `possible_component_internal`
- `possible_layout_container`
- `low_width_ratio`
- `unusual_dimensions`
- `generic_name`
- `unclassified_segment`
- `duplicate_state`
- `duplicate_behavior`
- `uncertain_parent_boundary`
- `responsive_parent_uncertain`
- `standalone_behavior_uncertain`

## Next manual-review requirements

1. Review the 37 medium-confidence `ambiguous` proposals in `/admin/sync/18090b51-18b2-4f24-bbc4-b7ba404a883a`.
2. Decide whether any of the 29 low-confidence candidates should be promoted to medium/high.
3. Tune per-page `minWidth`, `minWidthRatio`, and `maxDepth` if QA expects a different wireframe boundary.
4. Add explicitly included or excluded node IDs to `src/lib/figma/config.ts` for exceptions.
5. Approve, reject, or ignore the 9 `missing` existing-screen proposals.
