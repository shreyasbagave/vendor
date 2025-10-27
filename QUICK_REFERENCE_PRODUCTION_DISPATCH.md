# Production Dispatch - Quick Reference Card

## 🎯 Quick Start

### Two Ways to Enter Data

#### 📝 Method 1: Auto-Calculate As Cast (Fastest)
```
1. Enter "Total Production Quantity" → 1000
2. Enter OK Qty → 850
3. Enter CR Qty → 50
4. Enter MR Qty → 20
5. As Cast auto-calculated → 80 ✨
```

#### 📝 Method 2: Manual Entry (Traditional)
```
1. Skip "Total Production Quantity" (leave empty)
2. Enter OK Qty → 850
3. Enter CR Qty → 50
4. Enter MR Qty → 20
5. Enter As Cast → 80
6. Total auto-calculated → 1000 ✨
```

## 🔢 Field Reference

| Field | Icon | Meaning | Color |
|-------|------|---------|-------|
| **Total Production Qty** | - | Optional manual entry | 🔵 Blue |
| **OK Qty** | ✓ | Approved for dispatch | 🟢 Green |
| **CR Qty** | ↩ | Customer return | 🟠 Orange |
| **MR Qty** | ✗ | Material rejection | 🔴 Red |
| **As Cast** | 📦 | Remaining stock | 🟣 Purple |

## 📐 Formula

```
Total Qty = OK Qty + CR Qty + MR Qty + As Cast

OR

As Cast = Total Qty - (OK Qty + CR Qty + MR Qty)
```

## ✅ Validation Rules

- ✓ All quantities must be ≥ 0 (no negatives)
- ✓ Total must be > 0 to submit
- ✓ Date required
- ✓ Challan number required
- ✓ Customer and Item must be selected
- ✓ Decimal precision: 0.01

## 🎨 Visual Indicators

| Indicator | Meaning |
|-----------|---------|
| 🟡 Yellow field | As Cast is auto-calculated |
| 🟢 Green badge | Valid total (> 0) |
| ⚪ Gray badge | No quantity entered |
| 🔵 Blue box | Manual total input area |
| ⚫ Dark footer | Summary row with totals |

## 📊 Summary Row

At the bottom of the table:
- Sum of all OK quantities
- Sum of all CR quantities
- Sum of all MR quantities
- Sum of all As Cast quantities
- **Grand Total** (green highlight)
- Number of entries

## 📱 Mobile Tips

- Scroll table horizontally to see all columns
- Quantity fields in 2×2 grid on mobile
- Calculation formula stacks vertically
- Full-width buttons for easy tapping

## 🚀 Productivity Tips

💡 **Tip 1:** Use Method 1 when you know total production quantity
💡 **Tip 2:** Watch As Cast field turn yellow when auto-calculated
💡 **Tip 3:** Check summary row for overall distribution
💡 **Tip 4:** Formula display helps verify your entries
💡 **Tip 5:** Edit individual fields to recalculate automatically

## ⚠️ Common Issues

### As Cast not auto-calculating?
→ Enter "Total Production Quantity" first

### Can't enter negative values?
→ By design - all quantities must be positive

### Form won't submit?
→ Check: Date, Challan, Customer, Item, Total > 0

### Total shows 0.00?
→ Enter at least one quantity > 0

## 🎓 Examples

### Example 1: Perfect Production
```
Total Qty: 1000
OK: 1000, CR: 0, MR: 0, As Cast: 0
(100% approved, no rejections)
```

### Example 2: With Rejections
```
Total Qty: 1000
OK: 850, CR: 50, MR: 20, As Cast: 80
(85% approved, 7% rejection rate)
```

### Example 3: High As Cast
```
Total Qty: 1000
OK: 500, CR: 100, MR: 100, As Cast: 300
(50% dispatched, 30% still in process)
```

---

**Print this page for quick reference at your desk!**

**Need more help?** See `PRODUCTION_DISPATCH_GUIDE.md` for detailed documentation.

