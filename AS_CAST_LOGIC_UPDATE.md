# As Cast Logic Update - Outward Stock

## Overview
This document explains the corrected logic for **As Cast** calculation in the Outward Stock management system.

## Previous (Incorrect) Logic

**Before:**
- As Cast = Current Stock - OK Dispatched
- Total = OK + As Cast
- **Stock reduced by Total** (meaning entire stock was depleted!)
- This was incorrect because it reduced stock by the entire amount including what stayed in workshop

**Example (Old - Wrong):**
- Item Stock: 1000 units
- Dispatch OK: 300 units
- As Cast calculated: 700 units
- Total: 1000 units
- ❌ **Stock reduced by 1000** (entire stock gone!)
- New Stock: 0 units (WRONG!)

## New (Correct) Logic

**Now:**
- As Cast = Current Stock - OK Dispatched (remaining in workshop)
- Total recorded = OK + As Cast (for reference only)
- **Stock reduced ONLY by OK quantity** (what actually left the workshop)
- As Cast is just a record of what remained at time of dispatch

**Example (New - Correct):**
- Item Stock: 1000 units
- Dispatch OK: 300 units
- As Cast auto-calculated: 700 units (remains in workshop)
- ✅ **Stock reduced by 300** (only what was dispatched!)
- New Stock: 700 units (CORRECT!)

## Key Changes Made

### Backend Changes

1. **OutwardStock Model** (`backend/models/OutwardStock.js`)
   - Stock now reduces by `okQty` only (not `totalQty`)
   - As Cast is auto-calculated in pre-save middleware
   - Delete/restore operations only affect `okQty`

2. **Outward Routes** (`backend/routes/outward.js`)
   - Validation checks only `okQty` against available stock
   - As Cast is calculated automatically on server
   - Update operations properly handle stock adjustments

### Frontend Changes

3. **Outward Page** (`frontend/client/src/pages/Outward.tsx`)
   - No longer sends `asCastQty` to backend (auto-calculated)
   - Updated UI to clearly show dispatch vs remaining
   - Better explanations and examples
   - Three-column summary: Dispatched | Remaining | Net Good

## Business Logic Clarification

### Quantity Types:

1. **OK Qty** = Quantity dispatched to customer
   - This physically leaves the workshop
   - Reduces item stock
   - Includes CR and MR within it

2. **CR (Customer Return)** = Part of OK that customer returned
   - Not a separate quantity
   - Part of the OK total
   - Doesn't affect stock (already counted in OK)

3. **MR (Material Defect)** = Part of OK with material issues
   - Not a separate quantity
   - Part of the OK total
   - Doesn't affect stock (already counted in OK)

4. **As Cast** = Remaining stock in workshop after dispatch
   - Auto-calculated: Item Stock - OK Qty
   - Does NOT leave the workshop
   - Does NOT reduce stock (it's what's left!)
   - Recorded for historical reference

5. **Net Good** = Approved quantity
   - Calculated: OK - CR - MR
   - Shows actual good units delivered

### Stock Impact:

```
Before Dispatch: Item Stock = 1000 units

Dispatch Entry:
- OK Qty: 300 (dispatched)
- CR: 10 (part of 300)
- MR: 5 (part of 300)
- As Cast: 700 (auto-calculated, stays in workshop)
- Net Good: 285 (300 - 10 - 5)

After Dispatch: Item Stock = 700 units (1000 - 300)
```

## UI Updates

### Information Display:
- Shows "Current Item Stock in Workshop"
- Displays auto-calculation formula for As Cast
- Example with before/after stock values
- Clear distinction between dispatched vs remaining

### Summary Metrics:
- **Dispatched (OK)**: Leaves workshop
- **Remaining (As Cast)**: Stays in workshop  
- **Net Good (Approved)**: OK - CR - MR

## Migration Notes

⚠️ **Important**: If you have existing outward entries in the database, they may have been calculated with the old logic. The stock values may need to be recalculated or adjusted manually if they were entered with the previous system.

To check if recalculation is needed:
1. Review existing outward entries
2. Compare As Cast values with current item stocks
3. Verify that stock reductions make sense

## Testing

After deploying these changes, verify:

1. ✅ Create new outward entry - stock reduces by OK qty only
2. ✅ As Cast shows correct remaining stock
3. ✅ Update outward entry - stock adjusts correctly
4. ✅ Delete outward entry - stock restores by OK qty only
5. ✅ Item stock remains accurate across multiple operations

## Summary

**The core principle**: Only the OK quantity physically leaves the workshop and reduces stock. As Cast is a snapshot record of what remained at the time of dispatch, not an additional quantity to track separately.

This change makes the system accurate and prevents incorrect stock depletion.

