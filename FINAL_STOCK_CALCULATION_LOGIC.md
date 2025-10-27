# ✅ FINAL Stock Calculation Logic - As Cast from Item Stock

## 🎯 **CORRECT & FINAL Business Rule**

### **As Cast is Auto-Calculated from Item Stock!**

This means:
- **Item Stock** = Available quantity in workshop (from item master)
- **OK Qty** = Total dispatched quantity (includes CR and MR within it)
- **CR** = Customer returns (part of OK, not separate)
- **MR** = Material defects (part of OK, not separate)
- **As Cast** = **Item Stock - OK Qty** (remaining in workshop, AUTO-CALCULATED)
- **Net Good** = OK - CR - MR (actual approved quantity)
- **Total** = OK + As Cast

---

## 📊 **Example**

### Production Scenario:
```
Item Stock in Workshop: 1000 units

User enters:
📦 OK Qty = 500        ← Total dispatched (includes CR & MR)
   ↩ CR = 10          ← Part of the 500 (customer returned)
   ✗ MR = 5           ← Part of the 500 (material defect)
   ✓ Net Good = 485   ← 500 - 10 - 5 (actual approved)

System auto-calculates:
🏭 As Cast = 500       ← AUTO: 1000 (item stock) - 500 (OK dispatched)

───────────────────────────────────────────
Total = 500 (OK) + 500 (As Cast) = 1000 ✓
As Cast = Remaining stock in workshop
```

---

## 🧮 **Formulas**

### Auto-Calculation Formula:
```
As Cast = Item Stock - OK Qty
```

### Main Formula:
```
Total = OK + As Cast
```

### Quality Calculation:
```
Net Good Quantity = OK - CR - MR
```

### Validations:
```
1. CR + MR must be ≤ OK (they are part of OK)
2. OK must be ≤ Item Stock (can't dispatch more than available)
```

---

## 🎨 **How It Works in the UI**

### 1. **Select Item**
- Dropdown shows: "Item Name (Stock: 1000)"
- System loads item's `currentStock` value
- Shows green box: "📦 Available Item Stock: 1000.00 units"

### 2. **Enter OK Quantity**
- User enters: OK Qty = 500
- System immediately calculates: As Cast = 1000 - 500 = 500
- As Cast field shows **auto-calculated value** (not editable)

### 3. **Enter CR and MR**
- User enters: CR = 10, MR = 5
- System validates: CR + MR (15) ≤ OK (500) ✓
- System calculates: Net Good = 500 - 10 - 5 = 485

### 4. **Visual Display**
```
┌─────────────────────────────────────┐
│ Item Stock: 1000 units              │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ OK Qty (you enter): 500             │
│ CR Qty (you enter): 10 (part of OK) │
│ MR Qty (you enter): 5 (part of OK)  │
│ As Cast (AUTO): 500  ← 1000 - 500   │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ Total: 1000 (OK 500 + As Cast 500)  │
│ Net Good: 485 (OK - CR - MR)        │
└─────────────────────────────────────┘
```

---

## 🔒 **Validations**

### ✅ Validation 1: CR + MR cannot exceed OK
```javascript
if (CR + MR > OK) {
    Error: "CR + MR quantities cannot exceed OK quantity (they are part of OK)"
}
```

**Example:**
- ❌ OK = 100, CR = 60, MR = 50 → **INVALID** (110 > 100)
- ✅ OK = 100, CR = 60, MR = 40 → **VALID** (100 = 100)
- ✅ OK = 100, CR = 30, MR = 20 → **VALID** (50 < 100)

### ✅ Validation 2: OK cannot exceed Item Stock
```javascript
if (OK > Item Stock) {
    Error: "OK quantity (600) cannot exceed available item stock (500)"
}
```

**Example:**
- ❌ Item Stock = 500, OK = 600 → **INVALID** (can't dispatch more than available)
- ✅ Item Stock = 500, OK = 400 → **VALID**

### ✅ Validation 3: All quantities must be non-negative
```javascript
All fields must be >= 0
```

---

## 📝 **Data Entry Workflow**

### Step-by-Step Process:
```
Step 1: Select Item
        → System loads item stock (e.g., 1000 units)
        → Shows: "📦 Available Item Stock: 1000.00 units"

Step 2: Enter OK Qty: 500
        → System auto-calculates: As Cast = 1000 - 500 = 500
        → Shows in As Cast field: "500.00" (yellow background, not editable)

Step 3: Enter CR: 10 (part of OK)
        → System validates: 10 ≤ 500 ✓

Step 4: Enter MR: 5 (part of OK)
        → System validates: 10 + 5 = 15 ≤ 500 ✓
        → System calculates: Net Good = 500 - 10 - 5 = 485

Step 5: Review calculations:
        → Total: 1000 (OK 500 + As Cast 500)
        → Net Good: 485
        
Step 6: Submit
        → System saves with calculated As Cast value
```

---

## 🎨 **Visual Indicators**

### Field Colors:
- **Green box** (OK) = "Total dispatched (includes CR & MR)"
- **Orange box** (CR) = "Part of OK (Customer return)"
- **Red box** (MR) = "Part of OK (Material defect)"
- **Yellow/Purple box** (As Cast) = "🏭 (Auto) - Auto-calculated from item stock"

### Labels:
- OK: "Total dispatched (includes CR & MR)"
- CR: "Part of OK (Customer return)"
- MR: "Part of OK (Material defect)"
- **As Cast: "🏭 (Auto)" with yellow background and formula display**

### Auto-Calculation Display:
```
As Cast field shows:
┌────────────────────┐
│    500.00          │  ← Large, bold number
│ ⚡ Auto: 1000 - 500 │  ← Formula explanation
└────────────────────┘
```

---

## 🚫 **What Changed from Before**

### ❌ Before (WRONG):
```
User manually entered As Cast
No connection to item stock
Total = OK + CR + MR + As Cast (WRONG formula)
```

### ✅ After (CORRECT):
```
As Cast auto-calculates from item stock
As Cast = Item Stock - OK
Total = OK + As Cast (CORRECT formula)
Validates OK doesn't exceed stock
```

---

## 📊 **Real-World Scenario**

### Workshop Inventory Management:

```
Workshop has 1000 units of "Casting Part A"

Day 1: Dispatch 500 units to customer
├─ Enter OK Qty: 500
├─ System calculates: As Cast = 1000 - 500 = 500
└─ Remaining in workshop: 500 units

Day 2: Customer returns 10 defective units
├─ Update entry: CR = 10 (still part of the 500 dispatched)
├─ As Cast remains: 500 (didn't change, those 10 were already dispatched)
└─ Net approved: 500 - 10 = 490

Day 3: Quality finds 5 more defects from the dispatch
├─ Update entry: MR = 5 (part of the 500 dispatched)
├─ As Cast remains: 500
└─ Net approved: 500 - 10 - 5 = 485
```

---

## ✅ **Testing Examples**

### Test 1: Normal Dispatch
```
Item Stock: 1000
OK: 500, CR: 10, MR: 5
As Cast: AUTO = 1000 - 500 = 500
Total: 500 + 500 = 1000 ✓
Net Good: 500 - 10 - 5 = 485 ✓
```

### Test 2: Full Dispatch
```
Item Stock: 1000
OK: 1000, CR: 0, MR: 0
As Cast: AUTO = 1000 - 1000 = 0
Total: 1000 + 0 = 1000 ✓
Net Good: 1000 - 0 - 0 = 1000 ✓
```

### Test 3: Partial Dispatch
```
Item Stock: 1000
OK: 300, CR: 20, MR: 10
As Cast: AUTO = 1000 - 300 = 700
Total: 300 + 700 = 1000 ✓
Net Good: 300 - 20 - 10 = 270 ✓
```

### Test 4: Invalid - OK exceeds stock
```
Item Stock: 500
OK: 600
❌ Error: "OK quantity (600) cannot exceed available item stock (500)"
```

### Test 5: Invalid - CR + MR > OK
```
Item Stock: 1000
OK: 100, CR: 60, MR: 50
❌ Error: "CR + MR quantities cannot exceed OK quantity (they are part of OK)"
```

---

## 📖 **Quick Reference Card**

```
┌────────────────────────────────────────────────────┐
│  FINAL STOCK CALCULATION FORMULA                   │
├────────────────────────────────────────────────────┤
│                                                    │
│  As Cast = Item Stock - OK  (AUTO-CALCULATED)      │
│  Total = OK + As Cast                              │
│  Net Good = OK - CR - MR                           │
│                                                    │
│  Item Stock = Available qty in workshop (from DB)  │
│  OK Qty     = Total dispatched (includes CR/MR)    │
│  CR         = Part of OK (customer return)         │
│  MR         = Part of OK (material defect)         │
│  As Cast    = Remaining in workshop (AUTO)         │
│  Net Good   = Actual approved quantity             │
│                                                    │
│  Validations:                                      │
│  1. CR + MR must be ≤ OK                           │
│  2. OK must be ≤ Item Stock                        │
│  3. All quantities ≥ 0                             │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## 🎊 **Summary**

Your application now **correctly implements** the business logic where:

1. ✅ **As Cast auto-calculates from item stock** (Item Stock - OK)
2. ✅ **CR and MR are part of OK** (not separate additions)
3. ✅ **Total = OK + As Cast** (simplified, correct formula)
4. ✅ **Net Good = OK - CR - MR** (actual approved quantity)
5. ✅ **Validation prevents OK > Item Stock**
6. ✅ **Validation prevents CR + MR > OK**
7. ✅ **Item dropdown shows current stock**
8. ✅ **Green box shows available stock after item selection**
9. ✅ **As Cast field is read-only with auto-calculated value**
10. ✅ **Formula display shows: "⚡ Auto: 1000 - 500"**

**The system now correctly tracks workshop inventory with auto-calculated remaining stock!** 🎉

---

**Version:** 4.0 (Final - As Cast from Item Stock)  
**Last Updated:** October 26, 2025  
**Status:** ✅ CORRECT, TESTED & ACTIVE

