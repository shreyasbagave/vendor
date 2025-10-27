# Vehicle Number Field Added & As Cast Column Removed

## Summary of Changes

This update adds a **Vehicle Number** field to both Inward and Outward stock management, and removes the **As Cast** column from the Outward table display.

## Backend Changes

### Models Updated

1. **InwardStock Model** (`backend/models/InwardStock.js`)
   - Added `vehicleNumber` field (optional, max 20 characters)
   ```javascript
   vehicleNumber: {
     type: String,
     trim: true,
     maxlength: [20, 'Vehicle number cannot exceed 20 characters']
   }
   ```

2. **OutwardStock Model** (`backend/models/OutwardStock.js`)
   - Added `vehicleNumber` field (optional, max 20 characters)
   ```javascript
   vehicleNumber: {
     type: String,
     trim: true,
     maxlength: [20, 'Vehicle number cannot exceed 20 characters']
   }
   ```

### Routes Updated

3. **Inward Routes** (`backend/routes/inward.js`)
   - POST route: Added vehicle number validation
   - PUT route: Added vehicle number validation
   ```javascript
   body('vehicleNumber').optional().trim().isLength({ max: 20 })
   ```

4. **Outward Routes** (`backend/routes/outward.js`)
   - POST route: Added vehicle number validation
   - PUT route: Added vehicle number validation
   ```javascript
   body('vehicleNumber').optional().trim().isLength({ max: 20 })
   ```

## Frontend Changes

### Inward Page (`frontend/client/src/pages/Inward.tsx`)

**Added:**
- Vehicle Number state variable
- Vehicle Number input field in the form
- Vehicle Number column in the table (between Challan No and Supplier)
- Vehicle Number handling in submit, update, edit, and cancel functions

**Table Structure (7 columns):**
1. Date
2. Challan No
3. **Vehicle No** (NEW)
4. Supplier
5. Item
6. Qty
7. Actions

### Outward Page (`frontend/client/src/pages/Outward.tsx`)

**Added:**
- Vehicle Number state variable
- Vehicle Number input field in the form
- Vehicle Number column in the table
- Vehicle Number handling in submit, update, edit, and cancel functions

**Removed:**
- As Cast column from table display
- As Cast from footer summary

**Table Structure (9 columns):**
1. Date
2. Challan No
3. **Vehicle No** (NEW)
4. Customer
5. Item
6. OK
7. CR
8. MR
9. Actions

**Note:** As Cast is still calculated and stored in the database, but is no longer displayed in the table.

## Data Structure

### Vehicle Number Field:
- **Type:** String
- **Required:** No (optional)
- **Max Length:** 20 characters
- **Format Example:** "MH-12-AB-1234"
- **Display:** Shows "-" if empty

## UI Changes

### Form Fields:
Both Inward and Outward forms now have a "Vehicle Number" input field:
- Located after Challan No field
- Placeholder: "e.g. MH-12-AB-1234"
- Not required (optional field)
- Accepts alphanumeric characters and hyphens

### Table Display:
- Vehicle Number appears as a new column
- Shows "-" when no vehicle number is entered
- Positioned between Challan No and Supplier/Customer

## Migration Notes

⚠️ **Important:** This is a non-breaking change.
- Existing records without vehicle numbers will display "-"
- Vehicle number is optional, so existing functionality is not affected
- No data migration required

## API Changes

### Request Body (POST/PUT):

**Inward:**
```json
{
  "date": "2025-01-15",
  "challanNo": "CH/2025/001",
  "vehicleNumber": "MH-12-AB-1234",  // NEW - Optional
  "supplier": "supplier_id",
  "item": "item_id",
  "quantityReceived": 100
}
```

**Outward:**
```json
{
  "date": "2025-01-15",
  "challanNo": "CH/2025/101",
  "vehicleNumber": "MH-12-AB-1234",  // NEW - Optional
  "customer": "customer_id",
  "item": "item_id",
  "okQty": 50,
  "crQty": 2,
  "mrQty": 1
}
```

## Benefits

1. **Better Tracking:** Vehicle numbers help track which vehicle delivered/picked up stock
2. **Logistics Management:** Useful for fleet management and delivery tracking
3. **Record Keeping:** Complete documentation of stock movement with vehicle details
4. **Cleaner UI:** Removed redundant As Cast column from Outward display (still calculated in background)

## Testing Checklist

✅ Create inward entry with vehicle number
✅ Create inward entry without vehicle number
✅ Update inward entry vehicle number
✅ Create outward entry with vehicle number
✅ Create outward entry without vehicle number
✅ Update outward entry vehicle number
✅ Verify As Cast is still calculated correctly (backend)
✅ Confirm As Cast removed from table display
✅ Table displays correctly with new column
✅ Summary totals work correctly

## Future Enhancements

Potential future improvements:
- Add vehicle number to reports (PDF/Excel exports)
- Add vehicle number to activity logs
- Vehicle number dropdown with previously used vehicles
- Vehicle-wise stock movement reports

## Backward Compatibility

✅ **Fully Backward Compatible**
- All existing records work without modification
- Vehicle number is optional
- API accepts requests with or without vehicle number
- No breaking changes to existing functionality

