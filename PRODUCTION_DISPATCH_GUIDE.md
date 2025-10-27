# Production Dispatch Logic - User Guide

## Overview
The Outward Issue page has been enhanced with advanced production dispatch logic that helps you manage stock distribution with automatic calculations and comprehensive validation.

## Key Features

### 1. **Manual Total Production Quantity Entry**
You can now enter the total production quantity directly, and the system will automatically calculate the "As Cast" value.

**How it works:**
- Enter your total production quantity in the highlighted blue field
- Fill in OK Qty, CR Qty, and MR Qty
- **As Cast is automatically calculated** using the formula:
  ```
  As Cast = Total Production Quantity - (OK Qty + CR Qty + MR Qty)
  ```
- The As Cast field will turn yellow to indicate it's auto-calculated

### 2. **Field Definitions**

| Field | Full Name | Description | Icon |
|-------|-----------|-------------|------|
| **OK Qty** | OK Quantity | Total quantity approved for dispatch to customer | ✓ (Green) |
| **CR Qty** | Customer Return | Quantity returned by customer for quality issues | ↩ (Orange) |
| **MR Qty** | Material Rejection | Quantity rejected due to material defects | ✗ (Red) |
| **As Cast** | As Cast Quantity | Remaining stock after dispatch (work-in-progress) | 📦 (Purple) |
| **Total Qty** | Total Quantity | Sum of all quantities (OK + CR + MR + As Cast) | - |

### 3. **Two Ways to Enter Data**

#### **Method A: Manual Total Quantity (Recommended for known production runs)**
1. Enter **Total Production Quantity** first
2. Enter **OK Qty**, **CR Qty**, and **MR Qty**
3. **As Cast** is calculated automatically
4. System ensures Total = OK + CR + MR + As Cast

**Example:**
```
Total Production Quantity: 1000
OK Qty: 850
CR Qty: 50
MR Qty: 20
As Cast: 80 (automatically calculated: 1000 - 850 - 50 - 20)
```

#### **Method B: Individual Quantities (Traditional method)**
1. Leave **Total Production Quantity** empty
2. Enter **OK Qty**, **CR Qty**, **MR Qty**, and **As Cast** individually
3. System calculates total: Total = OK + CR + MR + As Cast

**Example:**
```
OK Qty: 850
CR Qty: 50
MR Qty: 20
As Cast: 80
Calculated Total: 1000 (automatically calculated)
```

### 4. **Real-Time Calculation Display**
Below the input fields, you'll see:
- **Calculated Total** in a green badge (if > 0)
- **Breakdown formula** showing: `= OK (850.00) + CR (50.00) + MR (20.00) + As Cast (80.00)`
- Visual color coding:
  - Green = Total is valid (> 0)
  - Gray = No quantity entered yet

### 5. **Summary Row**
At the bottom of the outward entries table, a **dark summary row** displays:
- **Total OK Qty** across all entries
- **Total CR Qty** across all entries
- **Total MR Qty** across all entries
- **Total As Cast** across all entries
- **Grand Total Qty** (highlighted in green)
- **Number of entries**

This gives you instant visibility into your overall stock distribution.

### 6. **Validation & Error Prevention**

#### **Built-in Validations:**
✅ All quantity fields accept only **non-negative numbers**
✅ Minimum value: `0`
✅ Step precision: `0.01` (supports decimal quantities)
✅ Date is required and validated
✅ Challan number is required
✅ Customer and Item must be selected
✅ Total quantity must be greater than 0

#### **Automatic Negative Prevention:**
- If you enter Total Qty that would result in negative As Cast, the calculation won't apply
- Individual quantity handlers prevent negative input
- Form won't submit if total is 0 or less

### 7. **Visual Indicators**

| Indicator | Meaning |
|-----------|---------|
| 🔵 Blue highlighted field | Total Production Quantity input (optional) |
| 🟡 Yellow background | Auto-calculated As Cast field |
| 🟢 Green badge | Valid total quantity |
| ⚪ Gray badge | No quantity entered |
| 🟡 Yellow info box | Usage instructions |

### 8. **Mobile Responsiveness**
- **2x2 grid layout** on mobile (< 768px) for quantity fields
- **Stacked calculation display** on mobile
- **Full-width buttons** for better touch experience
- **Scrollable table** with sticky header and summary
- **Optimized font sizes** for mobile readability

## Usage Examples

### Example 1: Standard Production Run
```
Date: 2025-10-26
Challan No: CH/2025/101
Customer: ABC Industries
Item: Casting Part XYZ

Total Production Quantity: 500
OK Qty: 450
CR Qty: 20
MR Qty: 10
As Cast: 20 (auto-calculated)

Calculated Total: 500.00
```

### Example 2: High Rejection Rate
```
Date: 2025-10-26
Challan No: CH/2025/102
Customer: XYZ Corp
Item: Machined Component

Total Production Quantity: 1000
OK Qty: 750
CR Qty: 100
MR Qty: 100
As Cast: 50 (auto-calculated)

Calculated Total: 1000.00
```

### Example 3: Manual Entry (No Total)
```
Date: 2025-10-26
Challan No: CH/2025/103
Customer: DEF Limited
Item: Forged Part

Total Production Quantity: (leave empty)
OK Qty: 300
CR Qty: 15
MR Qty: 5
As Cast: 30

Calculated Total: 350.00 (auto-calculated)
```

## Benefits

✅ **Faster Data Entry** - Enter total and let system calculate As Cast
✅ **Reduced Errors** - Automatic calculations eliminate manual math errors
✅ **Better Visibility** - Summary row shows overall distribution at a glance
✅ **Quality Tracking** - Clear separation of OK, CR, and MR quantities
✅ **Responsive Design** - Works perfectly on desktop, tablet, and mobile
✅ **Real-time Feedback** - See calculations update as you type
✅ **Validation** - Prevents invalid data entry

## Tips

💡 **Tip 1:** If you know your total production quantity upfront, use Method A for fastest entry
💡 **Tip 2:** Watch the As Cast field turn yellow when auto-calculated
💡 **Tip 3:** Check the summary row after adding multiple entries to verify totals
💡 **Tip 4:** On mobile, scroll the table horizontally to see all columns
💡 **Tip 5:** Use the calculated total formula to verify your entries

## Technical Details

### Calculation Logic
```javascript
// When Total Quantity is entered manually:
As Cast = Total Quantity - (OK Qty + CR Qty + MR Qty)

// When entering individually:
Total Quantity = OK Qty + CR Qty + MR Qty + As Cast

// Summary row calculations:
Total OK = Sum of all entries' OK Qty
Total CR = Sum of all entries' CR Qty
Total MR = Sum of all entries' MR Qty
Total As Cast = Sum of all entries' As Cast
Grand Total = Sum of all entries' Total Qty
```

### State Management
- **Reactive updates:** All fields recalculate automatically when any quantity changes
- **Input clearing:** Editing individual quantities clears manual total input
- **Validation:** Real-time validation prevents negative values
- **Reset:** All fields reset after successful save

## Troubleshooting

### Issue: As Cast not calculating automatically
**Solution:** Make sure you've entered a value in the "Total Production Quantity" field first

### Issue: Can't enter negative values
**Solution:** This is by design - all quantities must be non-negative

### Issue: Total shows 0.00
**Solution:** Enter at least one quantity field with a value > 0

### Issue: Form won't submit
**Solution:** Check that:
- Date is filled
- Challan number is filled
- Customer is selected
- Item is selected
- Total quantity is greater than 0

## Support

For additional help or to report issues, contact your system administrator or refer to the main application documentation.

---

**Version:** 1.0
**Last Updated:** October 26, 2025

