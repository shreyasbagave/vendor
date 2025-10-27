# Authentication & Data Isolation Guide

## Overview

This application now implements **complete user-based authentication and data isolation**. Every user can only see and manage their own data, ensuring complete privacy and security.

## Key Features

### 1. **Mandatory Authentication**
- **All routes require login** - No page is accessible without authentication
- Users must sign up and log in to access any part of the application
- JWT (JSON Web Token) based authentication for secure session management

### 2. **Complete Data Isolation**
- Each user sees **only their own data**
- Data is automatically filtered by `createdBy` field (user ID)
- Users cannot access, modify, or delete another user's data
- All queries, updates, and deletions are scoped to the logged-in user

### 3. **Frontend Protection**
- `ProtectedRoute` component wraps all authenticated pages
- Automatic redirect to login page if not authenticated
- Persistent authentication via localStorage (token & user info)

## How It Works

### Backend Implementation

#### Authentication Middleware (`backend/middleware/auth.js`)

```javascript
const protect = async (req, res, next) => {
  // Verifies JWT token from request headers
  // Attaches user to req.user
  // Returns 401 if token is invalid or missing
};
```

**All API routes now use only `protect` middleware** (removed `authorize('admin')`)

#### Data Filtering

Every database query automatically includes user filtering:

**Items Example:**
```javascript
// GET all items
filter.createdBy = req.user._id;
const items = await Item.find(filter);

// GET single item
const item = await Item.findOne({
  _id: req.params.id,
  createdBy: req.user._id
});

// CREATE item
const itemData = {
  ...req.body,
  createdBy: req.user._id
};
const item = await Item.create(itemData);

// UPDATE item
const item = await Item.findOne({
  _id: req.params.id,
  createdBy: req.user._id
});

// DELETE item
const item = await Item.findOne({
  _id: req.params.id,
  createdBy: req.user._id
});
```

**This pattern is consistently applied across all entities:**
- Items
- Suppliers
- Customers
- Inward Stock
- Outward Stock
- Reports
- Dashboard Stats

### Frontend Implementation

#### Auth Context (`frontend/client/src/auth/AuthContext.tsx`)

Provides authentication state and methods to the entire application:

```typescript
const { user, token, isAuthenticated, login, register, logout, api } = useAuth();
```

#### Protected Routes (`frontend/client/src/App.tsx`)

All application pages are wrapped with `ProtectedRoute`:

```typescript
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};
```

**Protected Pages:**
- Dashboard (`/`)
- Items (`/items`)
- Suppliers (`/suppliers`)
- Customers (`/customers`)
- Inward Stock (`/inward`)
- Outward Stock (`/outward`)
- Reports (`/reports`)

**Public Pages:**
- Login (`/login`)
- Signup (`/signup`)

## User Workflow

### New User Registration

1. User visits the application
2. Automatically redirected to `/login` (not authenticated)
3. Clicks "Sign Up" and creates account with:
   - Username
   - Email
   - Password
4. Upon successful registration:
   - JWT token is issued
   - User info is stored in localStorage
   - Automatically logged in and redirected to Dashboard

### Existing User Login

1. User enters username and password
2. Backend validates credentials
3. JWT token issued and stored
4. Redirected to Dashboard
5. All subsequent API calls include the token in headers

### Data Access

**Scenario 1: User A creates items**
- User A can see, edit, delete their items
- User B cannot see User A's items
- User B only sees their own items

**Scenario 2: User A creates inward stock entry**
- Only User A can see/edit/delete this entry
- User B has a completely separate inward stock list

**Scenario 3: Dashboard Stats**
- User A sees stats based only on their data
- User B sees stats based only on their data
- No data mixing or leakage

## Database Schema

All entities have a `createdBy` field:

```javascript
{
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}
```

**Entities with `createdBy`:**
- Item
- Supplier
- Customer
- InwardStock
- OutwardStock
- ActivityLog

## Security Features

### 1. JWT Token Management
- Tokens stored securely in localStorage
- Tokens sent in `Authorization: Bearer <token>` header
- Server-side token verification on every request
- Token includes user ID for automatic user identification

### 2. Route Protection
- Backend: All routes require `protect` middleware
- Frontend: All pages require `ProtectedRoute` wrapper
- No public access to data endpoints

### 3. Data Validation
- Input validation with `express-validator`
- MongoDB ObjectId validation
- User ownership validation before operations

### 4. Error Handling
- 401 Unauthorized: Missing or invalid token
- 403 Forbidden: Insufficient permissions (future use)
- 404 Not Found: Resource doesn't exist or user doesn't own it

## API Endpoints Summary

### Authentication
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Login and get JWT token
- `POST /api/auth/change-password` - Change user password (protected)

### Items (Protected - User's Own Data)
- `GET /api/items` - Get all user's items
- `GET /api/items/:id` - Get single user's item
- `POST /api/items` - Create new item
- `PUT /api/items/:id` - Update user's item
- `DELETE /api/items/:id` - Delete user's item

### Suppliers (Protected - User's Own Data)
- `GET /api/suppliers` - Get all user's suppliers
- `GET /api/suppliers/:id` - Get single user's supplier
- `POST /api/suppliers` - Create new supplier
- `PUT /api/suppliers/:id` - Update user's supplier
- `DELETE /api/suppliers/:id` - Delete user's supplier

### Customers (Protected - User's Own Data)
- `GET /api/customers` - Get all user's customers
- `GET /api/customers/:id` - Get single user's customer
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update user's customer
- `DELETE /api/customers/:id` - Delete user's customer

### Inward Stock (Protected - User's Own Data)
- `GET /api/inward` - Get all user's inward entries
- `GET /api/inward/:id` - Get single user's inward entry
- `POST /api/inward` - Create new inward entry
- `PUT /api/inward/:id` - Update user's inward entry
- `DELETE /api/inward/:id` - Delete user's inward entry

### Outward Stock (Protected - User's Own Data)
- `GET /api/outward` - Get all user's outward entries
- `GET /api/outward/:id` - Get single user's outward entry
- `POST /api/outward` - Create new outward entry
- `PUT /api/outward/:id` - Update user's outward entry
- `DELETE /api/outward/:id` - Delete user's outward entry

### Reports (Protected - User's Own Data)
- `GET /api/reports/stock-statement` - Current stock for user
- `GET /api/reports/monthly` - Monthly report for user
- `GET /api/reports/item-history` - Item history for user
- `GET /api/reports/supplier-performance` - Supplier performance for user
- `GET /api/reports/customer-performance` - Customer performance for user
- `GET /api/reports/export/excel` - Export user's data to Excel
- `GET /api/reports/export/pdf` - Export user's data to PDF

### Dashboard (Protected - User's Own Data)
- `GET /api/dashboard/overview` - Dashboard stats for user
- `GET /api/dashboard/alerts/low-stock` - Low stock alerts for user
- `GET /api/dashboard/alerts/rejects` - Reject alerts for user
- `GET /api/dashboard/activities` - Recent activities for user

## Testing Data Isolation

### Manual Testing Steps

1. **Create two test users:**
   - User A: `userA@test.com`
   - User B: `userB@test.com`

2. **Login as User A:**
   - Create 3 items (Item A1, A2, A3)
   - Create 2 suppliers (Supplier A1, A2)
   - Create 1 inward entry

3. **Logout and Login as User B:**
   - Verify: Cannot see User A's items
   - Create 2 items (Item B1, B2)
   - Verify: Only see Item B1 and B2

4. **Check Dashboard:**
   - User A's dashboard shows stats for A's data only
   - User B's dashboard shows stats for B's data only

5. **Attempt to access another user's data directly:**
   - Copy an item ID from User A
   - As User B, try `GET /api/items/{userA_item_id}`
   - Expected: 404 Not Found (User B doesn't own this item)

## Migration Notes

### What Changed?

**Before:**
- Routes required `authorize('admin')` - only admin users could access
- No data filtering by user
- All users could see all data

**After:**
- Routes require only `protect` - any authenticated user can access
- Automatic data filtering by `req.user._id`
- Each user sees only their own data

### No Database Migration Required

The `createdBy` field already exists in all models. Existing data will be associated with the users who created them.

## Troubleshooting

### "Not authorized to access this route"
- Ensure JWT token is present in localStorage
- Check token is sent in Authorization header
- Verify token hasn't expired

### "Item not found" when item exists
- Item likely belongs to another user
- Check if correct user is logged in
- Verify `createdBy` field in database

### Cannot see any data after login
- Data might not have `createdBy` set (old data)
- Create new data - it will have correct user association
- Check browser console for API errors

## Future Enhancements

1. **Role-Based Access Control (RBAC)**
   - Reintroduce `admin` role for managing all users' data
   - Add `viewer` role for read-only access
   - Add `manager` role for team-based access

2. **Team/Organization Support**
   - Allow multiple users to belong to an organization
   - Share data within organization
   - Organization-level data isolation

3. **Data Sharing**
   - Allow users to share specific items/reports
   - Invite-only access to data
   - Granular permission controls

4. **Audit Logging**
   - Enhanced activity logging per user
   - Track all data access attempts
   - Alert on suspicious activities

## Support

For issues or questions about authentication and data isolation, please contact the development team or refer to the main README.

---

**Last Updated:** October 26, 2025
**Version:** 2.0
**Authentication:** JWT-based with complete data isolation

