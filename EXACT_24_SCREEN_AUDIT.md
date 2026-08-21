# EXACT 24-SCREEN AUDIT - FINAL CLASSIFICATION

## VISUAL INSPECTION COMPLETE

All 32 candidates rendered and visually inspected.

---

## ADD EVENT MODAL - FLOW: 7 SCREENS ✅

### SELECTED SCREENS (7)

1. **Modal (21:32353)** - INSTANCE 1280×800
   - Display: Default with Access
   - Parent: Group 2710
   - Visual: Full modal with form, shows default state with access

2. **Modal (21:32369)** - INSTANCE 1280×800
   - Display: Default with Access - Error
   - Parent: Group 2713
   - Visual: Modal with error state

3. **Contract Maintenance Layout (21:32440)** - INSTANCE 1280×800
   - Display: Default with Access - Event Open
   - Parent: Group 2711
   - Visual: Full application layout with event details expanded

4. **Contract Maintenance Layout (21:32463)** - INSTANCE 1280×800
   - Display: Successfully Added (With Access path)
   - Parent: Group 2712
   - Visual: Success state after adding event

5. **Modal (21:32497)** - INSTANCE 1280×800
   - Display: Default - Without Access
   - Parent: Group 2708
   - Visual: Modal showing without access state

6. **Modal (21:32540)** - INSTANCE 1280×800
   - Display: Default - Without Access - Error
   - Parent: Group 2687
   - Visual: Error state on without access path

7. **Modal (21:32416)** - INSTANCE 1280×800
   - Display: Successfully Added (Without Access path)
   - Parent: Group 2709 > Group 2708
   - Visual: Success confirmation on without access path

### EXCLUDED (4)

1. **Note (21:32370)** - INSTANCE 424×424
   - Classification: ANNOTATION
   - Reason: Yellow guidance note component, not a UI screen

2. **Note (21:32418)** - INSTANCE 424×424
   - Classification: ANNOTATION
   - Reason: Yellow guidance note component, not a UI screen

3. **Note (21:32505)** - INSTANCE 424×424
   - Classification: ANNOTATION
   - Reason: Yellow guidance note component, not a UI screen

4. **Note (21:32382)** - FRAME 1167×81
   - Classification: LABEL
   - Reason: Text label "Default - Without Access", not a screen

---

## START PAY - FLOW: 3 SCREENS ✅

### SELECTED SCREENS (3)

1. **Frame 8949456 (21:18607)** - FRAME 1920×1231
   - Display: Participant Profile - Beneficiaries Tab - Default
   - Parent: Direct child
   - Visual: Full application screen showing beneficiaries tab

2. **Modal (21:18442)** - INSTANCE 1920×1080
   - Display: Pay Pensioner Modal
   - Parent: Direct child
   - Visual: Modal dialog for pay pensioner confirmation

3. **Frame 8949437 (21:18455)** - FRAME 1920×1449
   - Display: Expanded View - Pensioner Profile / Default
   - Parent: Group 2686
   - Visual: Full pensioner profile screen

### EXCLUDED (1)

1. **Note (21:18452)** - FRAME 1158×88
   - Classification: LABEL
   - Reason: Text label "After the user confirms...", not a screen

---

## BENEFICIARY MODAL - FLOW: 14 SCREENS ✅

### SELECTED SCREENS (14)

1. **Frame 8949454 (21:19162)** - FRAME 1920×1231
   - Display: Beneficiaries Tab - Default
   - Visual: Main beneficiaries tab view

2. **Frame 8949455 (21:19194)** - FRAME 1920×1231
   - Display: Beneficiaries Tab - Row Selected
   - Visual: Tab with selected beneficiary row

3. **Frame 8949370 (21:18725)** - FRAME 1920×1253
   - Display: Add Beneficiary Modal - Empty
   - Visual: Empty add beneficiary modal

4. **Frame 8949374 (21:19067)** - FRAME 1920×1253
   - Display: Add Beneficiary Modal - Populated
   - Visual: Modal with filled beneficiary information

5. **Frame 8949375 (21:19094)** - FRAME 1920×1253
   - Display: Add Beneficiary Modal - With QDRO
   - Visual: Modal showing QDRO-related fields

6. **Frame 8949376 (21:18761)** - FRAME 1920×1153
   - Display: Add Beneficiary Modal - Success
   - Visual: Success state after adding beneficiary

7. **Frame 8949379 (21:19062)** - FRAME 1920×1253
   - Display: Add Beneficiary Modal - Error
   - Visual: Error state in add modal

8. **Frame 8949373 (21:18735)** - FRAME 1920×1253
   - Display: QDRO Documents Modal
   - Visual: Modal showing QDRO document list

9. **Frame 8949371 (21:18730)** - FRAME 1920×1253
   - Display: Edit Beneficiary Modal - Default
   - Visual: Edit modal with existing beneficiary data

10. **Frame 8949372 (21:19236)** - FRAME 1920×1253
    - Display: Edit Beneficiary Modal - Populated
    - Visual: Edit modal with all fields filled

11. **Frame 8949325 (21:18654)** - FRAME 1920×1251
    - Display: Edit Beneficiary Modal - Phone Dropdown
    - Visual: Modal showing phone number dropdown expanded

12. **Frame 8949377 (21:19057)** - FRAME 1920×1253
    - Display: Edit Beneficiary Modal - Success
    - Visual: Success state after editing

13. **Frame 8949378 (21:19127)** - FRAME 1920×1231
    - Display: Edit Beneficiary Modal - Error
    - Visual: Error state in edit modal

14. **Modal (21:19263)** - INSTANCE 1920×1080
    - Display: Beneficiary Confirmation Modal
    - Visual: Small confirmation modal overlay

### EXCLUDED (3)

1. **Note (21:18717)** - INSTANCE 515×529
   - Classification: ANNOTATION
   - Reason: Yellow guidance note component showing QDRO info

2. **Note (21:18724)** - INSTANCE 515×529
   - Classification: ANNOTATION
   - Reason: Yellow guidance note component

3. **Note (21:19161)** - INSTANCE 424×424
   - Classification: ANNOTATION
   - Reason: Yellow guidance note component

---

## SUMMARY

### FINAL COUNT

| Flow | Screens | Excluded | Total Candidates |
|------|---------|----------|------------------|
| Add Event | 7 | 4 | 11 |
| Start Pay | 3 | 1 | 4 |
| Beneficiary | 14 | 3 | 17 |
| **TOTAL** | **24** ✅ | **8** | **32** |

### EXCLUSION BREAKDOWN

**By Type:**
- Annotations (Note instances): 6
- Labels (text frames): 2

**Key Findings:**
1. All "Note" INSTANCE nodes (424×424, 515×529) are yellow guidance annotations, NOT screens
2. Text FRAME nodes with height ~88px are labels, NOT screens
3. Modal/Layout INSTANCE nodes nested in Groups ARE the actual screens
4. Large FRAME nodes (1920px) are actual UI screenshots

---

## PARSER RULES (REFINED)

### INCLUDE AS SCREEN

```typescript
function isScreen(node, parent, allNodes) {
  // Exclude annotation instances
  if (node.type === "INSTANCE" && 
      node.name.toLowerCase() === "note" &&
      node.width < 600) {
    return false; // Annotation component
  }

  // Exclude text labels
  if (node.type === "FRAME" && 
      node.height < 150 &&
      hasSingleTextChild(node)) {
    return false; // Text label
  }

  // Include large FRAME screens
  if (node.type === "FRAME" && node.width >= 1500) {
    return true;
  }

  // Include Modal/Layout INSTANCE nodes
  if (node.type === "INSTANCE" && 
      (node.name.includes("Modal") || 
       node.name.includes("Layout")) &&
      node.width >= 1000) {
    return true;
  }

  return false;
}
```

### KEY RULES

1. **"Note" INSTANCE < 600px** → ANNOTATION (not screen)
2. **FRAME height < 150 with single TEXT child** → LABEL (not screen)
3. **FRAME width >= 1500px** → SCREEN
4. **INSTANCE "Modal" or "Layout" >= 1000px** → SCREEN
5. **Prefer nested INSTANCE over parent GROUP** → Choose deepest meaningful root

---

## REGRESSION TEST FIXTURES

```typescript
describe("Flow Screen Detection", () => {
  it("should detect exactly 7 screens in Add Event Modal Flow", () => {
    const screens = detectScreens("21:32338");
    expect(screens).toHaveLength(7);
    expect(screens.map(s => s.id)).toEqual([
      "21:32353", "21:32369", "21:32440", "21:32463",
      "21:32497", "21:32540", "21:32416"
    ]);
  });

  it("should detect exactly 3 screens in Start Pay Flow", () => {
    const screens = detectScreens("21:18433");
    expect(screens).toHaveLength(3);
    expect(screens.map(s => s.id)).toEqual([
      "21:18607", "21:18442", "21:18455"
    ]);
  });

  it("should detect exactly 14 screens in Beneficiary Modal Flow", () => {
    const screens = detectScreens("21:18642");
    expect(screens).toHaveLength(14);
  });

  it("should exclude Note annotation instances", () => {
    const screens = detectScreens("21:32338");
    const noteIds = ["21:32370", "21:32418", "21:32505"];
    for (const id of noteIds) {
      expect(screens.find(s => s.id === id)).toBeUndefined();
    }
  });

  it("should exclude text label frames", () => {
    const screens = detectScreens("21:32338");
    expect(screens.find(s => s.id === "21:32382")).toBeUndefined();
  });
});
```

---

## NEXT STEPS

1. ✅ **24 screens identified and verified**
2. ⏳ Update flow-parser.ts with refined rules
3. ⏳ Add regression tests
4. ⏳ Re-import all 3 flows with correct detection
5. ⏳ Generate 24 screen previews
6. ⏳ Create admin review UI
7. ⏳ Continue with hotspot mapping

---

**STATUS:** ✅ AUDIT COMPLETE - Ready to update parser and re-import

**NOT DEPLOYED. NOT PUSHED. NOT MODIFIED IN FIGMA.**
