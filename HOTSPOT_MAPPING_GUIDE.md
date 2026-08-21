# HOTSPOT MAPPING GUIDE - BENEFICIARY PILOT

## Current Status

**Flow ID:** 3099f83f-7650-4f83-8258-4faae42a3988  
**Interactions:** 5 mapped  
**Hotspots:** 0 (ready to create)

---

## Admin URL

```
http://localhost:3001/admin/flows/3099f83f-7650-4f83-8258-4faae42a3988
```

---

## Mapped Interactions (Verify Against Figma)

### 1. Click: Default → Row Selected
- **Source:** Beneficiaries Tab - Default (21:19162)
- **Destination:** Beneficiaries Tab - Row Selected (21:19194)
- **Action:** Select beneficiary row
- **Hotspot needed:** YES - Draw over the beneficiary row in the table

### 2. Click: Row Selected → Add Modal Empty
- **Source:** Beneficiaries Tab - Row Selected (21:19194)
- **Destination:** Add Beneficiary Modal - Empty (21:18725)
- **Action:** Add Beneficiary
- **Hotspot needed:** YES - Draw over "Add Beneficiary" button

### 3. Next: Add Modal Empty → Populated
- **Source:** Add Beneficiary Modal - Empty (21:18725)
- **Destination:** Add Beneficiary Modal - Populated (21:19067)
- **Action:** Fill form
- **Hotspot needed:** NO - This is a guided transition

### 4. Branch: Populated → Success
- **Source:** Add Beneficiary Modal - Populated (21:19067)
- **Destination:** Add Beneficiary Modal - Success (21:18761)
- **Action:** Save (Success)
- **Hotspot needed:** NO - Branch decision

### 5. Branch: Populated → Error
- **Source:** Add Beneficiary Modal - Populated (21:19067)
- **Destination:** Add Beneficiary Modal - Error (21:19062)
- **Action:** Save (Error)
- **Hotspot needed:** NO - Branch decision

---

## Step-by-Step Hotspot Creation

### HOTSPOT #1: Select Beneficiary Row

1. Open admin page
2. Scroll to "Interaction Mapping" section
3. Find interaction: "Select beneficiary row"
4. Click "Edit Hotspot"
5. The source screen preview will appear (Beneficiaries Tab - Default)
6. Click and drag to draw a rectangle over the **beneficiary row in the table**
   - Look for the first data row in the beneficiaries table
   - Cover the entire clickable row area
7. Release mouse - hotspot saves automatically
8. Verify: Reload page, hotspot should persist

### HOTSPOT #2: Add Beneficiary Button

1. Find interaction: "Add Beneficiary"
2. Click "Edit Hotspot"
3. Source screen: Beneficiaries Tab - Row Selected
4. Draw rectangle over the **"Add Beneficiary" button**
   - Typically in the top-right or action area
   - Cover the entire button
5. Release mouse - saves automatically
6. Verify: Reload page, hotspot should persist

---

## Testing in Player

### Open Player
```
http://localhost:3001/flows/3099f83f-7650-4f83-8258-4faae42a3988
```

### Test Sequence

1. Click "Start Interactive Flow"
2. **Expected:** Beneficiaries Tab - Default appears
3. Toggle "Show clickable areas" ON
4. **Expected:** Hotspot #1 visible over beneficiary row
5. Click the hotspot
6. **Expected:** Navigate to Beneficiaries Tab - Row Selected
7. **Expected:** Hotspot #2 visible over Add Beneficiary button
8. Click hotspot #2
9. **Expected:** Navigate to Add Beneficiary Modal - Empty
10. **Expected:** Right arrow (→) advances to Populated (next interaction)
11. **Expected:** Branch decision appears with Success/Error options
12. Click "Save (Success)"
13. **Expected:** Navigate to Add Beneficiary Modal - Success
14. Click Left arrow (←)
15. **Expected:** Return to branch decision
16. Click "Save (Error)"
17. **Expected:** Navigate to Add Beneficiary Modal - Error

### Keyboard Test

- **Tab:** Should focus hotspots
- **Enter/Space:** Should activate focused hotspot
- **Left Arrow:** Previous step in history
- **Right Arrow:** Next (only if one deterministic path)
- **Esc:** Exit player

---

## Hotspot Alignment Verification

### Test at Different Widths

1. Full browser width (e.g., 1920px)
   - Hotspot should align to control
2. Narrow width (e.g., 1200px)
   - Hotspot should STILL align to same control
3. If hotspot drifts:
   - Check coordinate calculation
   - Verify using image bounds, not container bounds

---

## Guidance Association (Optional)

1. In admin page, scroll to "Guidance & Actions"
2. Find a relevant guidance item for one of the screens
3. Select the associated screen from dropdown
4. Save
5. Verify in Player: Guidance appears on that screen

---

## Expected Final State

**Database:**
- Interactions: 5
- Hotspots: 2
- Guidance associations: 1+

**Working Path:**
```
Beneficiaries Tab - Default
    ↓ [HOTSPOT CLICK]
Beneficiaries Tab - Row Selected
    ↓ [HOTSPOT CLICK]
Add Beneficiary Modal - Empty
    ↓ [NEXT →]
Add Beneficiary Modal - Populated
    ↓ [BRANCH DECISION]
   ↙              ↘
Success         Error
```

---

## Troubleshooting

### Hotspot doesn't save
- Check browser console for errors
- Verify server is running
- Check network tab for failed requests

### Hotspot in wrong position
- Coordinates are percentages of image size
- Draw on the actual rendered preview image
- Not on container or background

### Player doesn't navigate
- Check interaction exists in database
- Verify sourceStepId and destinationStepId match
- Check browser console for errors

### Branch doesn't appear
- Verify both branch interactions exist
- Both must have same sourceStepId
- Both must have trigger="branch"

---

## Figma Links to Verify

**Flow:**
- Should open: https://www.figma.com/file/kZjw4BrecmEnfFqcYri5Ya?node-id=21-18642
- NOT the old: 14:16311

**Each Screen:**
- Should open exact node (e.g., 21:19162 for Default)
- Verify in admin page and player

---

## Success Criteria

✅ 2 hotspots drawn and saved  
✅ Hotspots persist after reload  
✅ Hotspots aligned at different widths  
✅ Player navigates Default → Row Selected → Add Modal  
✅ Next advances to Populated  
✅ Branch shows Success/Error options  
✅ History (←) works correctly  
✅ Keyboard navigation works  
✅ Figma links open correct nodes  

---

**READY TO MAP:** Open admin page and start drawing hotspots!
