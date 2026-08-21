# Beneficiary Modal — Golden Flow Specification

**Source of truth:** `Beneficiary Modal - Flow.pdf`, page 1  
**Rule:** Implement only relationships explicitly visible in the PDF. Do not infer or create missing destinations.

---

## 1. Canonical screen/state inventory

The PDF contains 14 distinct screen/state visuals.

### S1 — Beneficiaries Tab — initial/default
- Source title: `Participant Profile - Beneficiaries Tab - Default`
- Existing project Figma node mapping: `21:19162`
- Semantic role: Entry/default Beneficiaries state.

### S2 — Beneficiaries Tab — row selected
- Source title in PDF: `Participant Profile - Beneficiaries Tab - Default`
- Existing project Figma node mapping: `21:19194`
- Semantic role: Same Beneficiaries view after a beneficiary row is selected.
- Important controls visible in this state: `Delete`, `Update`, `Add`.

### S3 — Add Beneficiary Modal — empty
- Source title: `Beneficiaries Tab - Add Beneficiary Modal`
- Existing project Figma node mapping: `21:18725`

### S4 — Add Beneficiary Modal — populated
- Source title: `Beneficiaries Tab - Annuity - Add Beneficiary Modal - Populated`
- Existing project Figma node mapping: `21:19067`

### S5 — Add Beneficiary — success / confirmation
- Source title: `Beneficiaries Tab - Beneficiary Modal - Confirmation`
- Existing project Figma node mapping: `21:19094`
- State signature: green success toast `Beneficiary has been Added Successfully`.

### S6 — Add Beneficiary — error
- Source title: `Beneficiaries Tab - Beneficiary Modal - Error`
- Existing project Figma node mapping: `21:18761`
- State signature: red error banner `Oops! Something wasn't right. Please Try again.`

### S7 — QDRO Documents Modal
- Source title: `Beneficiaries Tab - QDRO Document Modal`
- Existing project Figma node mapping: `21:19062`
- Visible content includes `QDRO Documents`, file names, drag-and-drop/upload area, `Cancel`, `Upload`.

### S8 — Add Beneficiary Modal — QDRO
- Source title: `Beneficiaries Tab - Add Beneficiary Modal - QDRO`
- Existing project Figma node mapping: `21:18735`
- State signature: populated beneficiary form with a QDRO filename visible.

### S9 — Edit Beneficiary Modal — initial/default
- Source title: `Beneficiaries Tab - Annuity - Edit Beneficiary Modal`
- Existing project Figma node mapping: `21:18730`

### S10 — Edit Beneficiary Modal — populated/edited
- Source title: `Beneficiaries Tab - Annuity - Edit Beneficiary Modal`
- Existing project Figma node mapping: `21:19236`

### S11 — Edit Beneficiary Modal — phone dropdown open
- Source title: `Beneficiaries Tab - Annuity - Edit Beneficiary Modal - DropDown Phone`
- Existing project Figma node mapping: `21:18654`

### S12 — Edit Beneficiary Modal — error
- Source title: `Beneficiaries Tab - Annuity - Edit Beneficiary Modal - Error Banner`
- Existing project Figma node mapping: `21:19057`

### S13 — Edit Beneficiary Modal — success
- Source title: `Beneficiaries Tab - Annuity - Edit Beneficiary Modal- Success Toast`
- Existing project Figma node mapping: `21:19127`

### S14 — SSN Exists confirmation modal
- Visible modal title: `SSN Exists`
- Existing project Figma node mapping: `21:19263`
- Exact modal guidance:
  `This SSN exists in the system. Existing details will be pulled into this beneficiary profile. Any changes you save here will update this person's data including contact information across all areas of the system. Continue?`
- Visible choices: `No`, `Yes`.

---

## 2. Verified Golden Flow graph

### ENTRY

`START`
→ label `Beneficiary Tab`
→ **S1 Beneficiaries Tab — initial/default**

---

### ROW SELECTION

**S1 Beneficiaries Tab — initial/default**
→ action `Check a row`
→ clickable control: beneficiary table row
→ **S2 Beneficiaries Tab — row selected**

This is a state transition, not a separate Add/Edit journey.

---

## 3. Branch from the selected Beneficiary screen

The selected Beneficiary state has independent outgoing controls. Do not model them as a single linear sequence.

### ADD path entry

**S2 Beneficiaries Tab — row selected**
→ clickable control: `Add`
→ flow action label: `Go to Add Beneficiary Modal`
→ **S3 Add Beneficiary Modal — empty**

### EDIT / UPDATE path entry

**S2 Beneficiaries Tab — row selected**
→ clickable control: `Update`
→ flow action label: `Go to Edit Beneficiary Modal`
→ **S9 Edit Beneficiary Modal — initial/default**

`Add` and `Update` are separate actions from the same source screen.

---

# 4. Add Beneficiary path

## Add form → SSN decision

**S3 Add Beneficiary Modal — empty**
→ **D1 decision: `SSN Match?`**

The PDF shows three explicit branches from this decision:

### D1-A — Matching SSN
`SSN Match?`
→ branch label `Matching SSN`
→ **S14 SSN Exists confirmation modal**

### D1-B — No Match
`SSN Match?`
→ branch label `No Match`
→ **S4 Add Beneficiary Modal — populated**

### D1-C — With QDRO
`SSN Match?`
→ branch label `With QDRO`
→ **S8 Add Beneficiary Modal — QDRO**

Do not replace these three branches with a generic next transition.

---

## Add populated → save outcome

**S4 Add Beneficiary Modal — populated**
→ the visible `Add` control submits the populated form
→ **D2 decision: `Success ?`**

### D2-A — Yes
`Success ?`
→ branch `Yes`
→ **S5 Add Beneficiary — success / confirmation**

### D2-B — No
`Success ?`
→ branch `No`
→ **S6 Add Beneficiary — error**

---

## Add QDRO → QDRO Documents

**S8 Add Beneficiary Modal — QDRO**
→ action/guidance instance:
`Clicking the file icon opens the QDRO Documents modal.`
→ clickable control: QDRO file icon / file affordance
→ **S7 QDRO Documents Modal**

No return destination from S7 is explicitly drawn. Do not create one.

---

# 5. Edit / Update Beneficiary path

## Edit form progression

**S9 Edit Beneficiary Modal — initial/default**
→ action `Enter Beneficiary details`
→ **S10 Edit Beneficiary Modal — populated/edited**

---

## Phone dropdown side interaction

**S9 Edit Beneficiary Modal — initial/default**
→ action `Click on the Dropdown`
→ clickable control: phone contact type/value dropdown
→ **S11 Edit Beneficiary Modal — phone dropdown open**

Associated yellow guidance:
`A dropdown menu will appear, showing a list of available phone contact numbers to choose from.`

No explicit return edge from S11 is drawn. Do not invent one.

---

## Edit populated → save outcome

**S10 Edit Beneficiary Modal — populated/edited**
→ submit/save action
→ **D3 decision: `Success ?`**

### D3-A — Yes
`Success ?`
→ branch `Yes`
→ **S13 Edit Beneficiary Modal — success**

### D3-B — No
`Success ?`
→ branch `No`
→ **S12 Edit Beneficiary Modal — error**

---

## Edit success → QDRO Documents

The PDF also contains a second visible instance of:
`Clicking the file icon opens the QDRO Documents modal.`

A connector links the Edit success area to the shared QDRO Documents path.

**S13 Edit Beneficiary Modal — success**
→ file icon action
→ **S7 QDRO Documents Modal**

Preserve this as a separate interaction instance from the Add-QDRO file-icon interaction.

---

# 6. ALL yellow annotations — preserve every instance

Do not deduplicate these merely because wording repeats.

## Y1 — plus-icon / aliases annotation — instance 1
Exact text:

`When the user clicks the plus icon, they are taken to the aliases modal where they can view all aliases associated with that pensioner in the system.`

- Visible as a yellow annotation in the left/start portion of the flow.
- Preserve as its own Figma-authored guidance record.
- Important: an Aliases Modal screen is NOT drawn in this Beneficiary Flow PDF. Therefore this note must NOT be used to invent a new navigation destination.

## Y2 — plus-icon / aliases annotation — instance 2
Exact same text, visibly repeated elsewhere in the flow:

`When the user clicks the plus icon, they are taken to the aliases modal where they can view all aliases associated with that pensioner in the system.`

- Preserve as a second annotation instance with its own Figma source node/position.
- Do not silently deduplicate it.
- Association should remain reviewable if Figma node proximity does not prove a specific target.

## Y3 — QDRO display rules
Exact text:

`If no QDRO document, leave field blank`

`If 1 QDRO document, display file name`

`If >1 QDRO document, display “x documents”`

Association:
- **S8 Add Beneficiary Modal — QDRO**
- Category: user guidance / display rule.

## Y4 — phone dropdown explanation
Exact text:

`A dropdown menu will appear, showing a list of available phone contact numbers to choose from.`

Association:
- action `Click on the Dropdown`
- source **S9 Edit Beneficiary Modal — initial/default**
- destination **S11 Edit Beneficiary Modal — phone dropdown open**

---

# 7. Complete external action / decision / branch annotation inventory

Every item below is visibly authored in the PDF and must be preserved.

1. `START`
2. `Beneficiary Tab`
3. `Check a row`
4. `Go to Add Beneficiary Modal`
5. `Go to Edit Beneficiary Modal`
6. `SSN Match?`
7. `Matching SSN`
8. `No Match`
9. `With QDRO`
10. `Success ?` — Add path decision
11. `Yes` — Add success branch
12. `No` — Add error branch
13. `Enter Beneficiary details`
14. `Click on the Dropdown`
15. `Success ?` — Edit path decision
16. `Yes` — Edit success branch
17. `No` — Edit error branch
18. `Clicking the file icon opens the QDRO Documents modal.` — instance 1
19. `Clicking the file icon opens the QDRO Documents modal.` — instance 2
20. `Matches?` — a separate large external label is present in the PDF, but its semantic association is not unambiguous from the page geometry alone. Preserve it as an unresolved authored annotation; do not create an edge from it without Figma-node evidence.

---

# 8. Important screen-level authored content

These are not yellow notes, but they are important state signatures and should remain visible in the player when the corresponding state is active.

## S14 SSN Exists
`This SSN exists in the system. Existing details will be pulled into this beneficiary profile. Any changes you save here will update this person's data including contact information across all areas of the system. Continue?`

Choices:
- `No`
- `Yes`

The PDF does NOT explicitly draw where those two choices lead. Keep both choices visible, but do not create destinations until exact Figma evidence exists.

## S5 Add success
`Beneficiary has been Added Successfully`

## S6 Add error
`Oops! Something wasn't right. Please Try again.`

## S13 Edit success
Success-toast state.

## S12 Edit error
Error-banner state.

## S7 QDRO Documents
Visible files include:
- `QDRO_01_01_2026.pdf`
- `QDRO_03_01_2025.pdf`
- `QDRO_09_08_2023.pdf`
- `QDRO_01_02_2022.pdf`

Visible actions:
- `Drag and Drop files here`
- `Or click to upload`
- `Cancel`
- `Upload`

No outgoing flow relationship from these actions is drawn in the PDF. Do not invent one.

---

# 9. Explicitly unresolved / DO NOT INVENT

The following information is not explicitly resolved by the PDF diagram:

1. Destination of `Yes` inside **S14 SSN Exists**.
2. Destination of `No` inside **S14 SSN Exists**.
3. Return path after **S7 QDRO Documents Modal** (`Cancel`, `Upload`, close, etc.).
4. Return path after **S11 Phone Dropdown**.
5. Whether **S8 Add Beneficiary Modal — QDRO** also submits directly to the Add `Success ?` decision; that edge is not explicitly drawn.
6. The exact semantic target of the separate external label `Matches?`.
7. The Aliases Modal mentioned in yellow annotations is not drawn as a screen in this Flow. Do not create it.

If Claude cannot prove any of these from the exact Figma node/connector geometry, leave them `needs_review`.

---

# 10. Player requirements derived from this Golden Flow

1. Player starts at S1.
2. S1 has row-selection hotspot(s).
3. S2 must expose at least TWO independent actions:
   - `Add` → S3
   - `Update` → S9
4. Never force Add and Edit into one next/previous sequence.
5. S3 resolves into the three-way SSN decision.
6. S4 resolves through Add `Success ?`.
7. S9 has both:
   - `Enter Beneficiary details` → S10
   - phone dropdown interaction → S11
8. S10 resolves through Edit `Success ?`.
9. S8 and S13 each have their own file-icon interaction to S7 where supported by the exact Figma controls.
10. Only approved/verified edges should be interactive.
11. Every yellow annotation and authored action/decision label must remain traceable to its Figma node.
12. Duplicate annotation instances must remain separate records.
13. Do not invent any navigation edge listed in the unresolved section.

---

# 11. Claude implementation contract

Claude must treat this Golden Flow as the semantic source of truth.

Claude's job is NOT to reinterpret the flow.

Claude should use Figma/API/MCP only to:

- resolve exact Figma node IDs for the authored labels and notes;
- resolve exact child control nodes for `Add`, `Update`, rows, dropdowns, file icons, and submit controls;
- calculate hotspot rectangles from the child nodes' `absoluteBoundingBox` relative to the source screen;
- persist the verified interactions;
- preserve every yellow annotation as its own guidance record;
- preserve duplicate authored annotations as separate instances;
- mark unresolved items `needs_review`;
- verify the resulting player visually against this PDF.

No new screen, action, decision, branch, note, or destination may be invented.
