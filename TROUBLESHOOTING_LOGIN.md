# 🔧 Troubleshooting Login Issues

## ✅ **Good News: Your Production Backend is Working!**

I tested your production API at **https://vendor-11.onrender.com** and it's responding correctly! 

---

## 🔍 **Debugging Your Login Issue**

### **Step 1: Check Browser Console**

1. Open your application in the browser
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Try to login
5. You should see debug messages:
   ```
   🔐 Attempting login to: /api
   ```

6. If you see an error, check what URL it's trying to access

---

### **Step 2: Check Network Tab**

1. In Developer Tools, go to **Network** tab
2. Try to login again
3. Look for the request to `/api/auth/login`
4. Click on it to see:
   - **Request URL**: Should be `https://vendor-11.onrender.com/api/auth/login` or `http://localhost:5000/api/auth/login`
   - **Status Code**: 
     - `401` = Wrong username/password ✅ (API working!)
     - `404` = API route not found ❌
     - `500` = Server error ❌

---

## 🖥️ **For LOCAL Development**

If you're testing locally, you need BOTH servers running:

### **1. Create Backend .env File**

You need a `.env` file in the `backend/` folder. Create it:

**File: `backend/.env`**
```
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://merabhaimickel_db_user:NewPassword@cluster0.gbbuacw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=dev_jwt_secret_change_in_production
JWT_EXPIRE=7d
```

**How to create (Windows Command Prompt):**
```bash
cd backend
copy env.example .env
```

Then edit `.env` file with the content above.

---

### **2. Start Backend Server**

**Terminal 1:**
```bash
cd backend
npm install
npm start
```

**Expected output:**
```
Server running on port 5000
Environment: development
MongoDB connected successfully
```

**If you see errors:**
- ❌ "MONGODB_URI is not set" → Check `.env` file exists
- ❌ "MongoDB connection error" → Check internet connection
- ❌ Port already in use → Kill process on port 5000 or change PORT in `.env`

---

### **3. Start Frontend**

**Terminal 2 (NEW terminal window):**
```bash
cd frontend/client
npm start
```

Browser opens at: **http://localhost:3000**

---

## 🌐 **For PRODUCTION** (https://vendor-11.onrender.com)

### **1. Check Render Dashboard**

Go to: https://dashboard.render.com

1. Find your service
2. Check **Logs** tab for errors
3. Check **Environment** tab - make sure these are set:
   ```
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb+srv://...
   JWT_SECRET=strong_secret_here
   JWT_EXPIRE=7d
   ```

---

### **2. Create a User Account**

If you don't have a user yet, you need to create one:

**Option A: Use Signup Page**
1. Go to https://vendor-11.onrender.com/signup
2. Create an account

**Option B: Use API Directly**

```bash
Invoke-WebRequest -Uri "https://vendor-11.onrender.com/api/auth/register" -Method POST -ContentType "application/json" -Body '{"username":"admin","email":"admin@example.com","password":"admin123"}'
```

---

## 🐛 **Common Issues & Fixes**

### **Issue 1: 404 Error on Login**

**Symptoms:**
- "Failed to load resource: 404"
- Login button does nothing

**Possible Causes:**

1. **Frontend not using correct API URL**
   - Check if `REACT_APP_API_URL` is set incorrectly
   - Delete `frontend/client/.env.local` if it exists with wrong URL

2. **Backend not running (local)**
   - Start backend server: `cd backend && npm start`

3. **Wrong URL in browser**
   - Local: Use `http://localhost:3000` (NOT `localhost:5000`)
   - Production: Use `https://vendor-11.onrender.com`

---

### **Issue 2: CORS Error**

**Symptoms:**
- "Access-Control-Allow-Origin" error in console
- Network request shows "blocked by CORS"

**Fix:**

1. Check `backend/.env` has:
   ```
   NODE_ENV=development
   ```

2. Restart backend server

3. Make sure frontend is on `localhost:3000` and backend on `localhost:5000`

---

### **Issue 3: "Username or password is wrong"**

**Symptoms:**
- API responds with 401
- Error message shows in red

**Fix:**

1. **You need to create a user first!**
   - Go to `/signup` page
   - OR use the register API

2. Check credentials are correct

---

### **Issue 4: Blank Page / White Screen**

**Symptoms:**
- Page loads but shows nothing
- No errors in console

**Fix:**

1. Clear browser cache (Ctrl + Shift + Delete)
2. Hard reload (Ctrl + Shift + R)
3. Check console for JavaScript errors
4. Make sure React app compiled successfully

---

## 📋 **Quick Diagnostic Checklist**

### **Local Development:**
- [ ] Created `backend/.env` file
- [ ] Backend server is running on port 5000
- [ ] Frontend is running on port 3000
- [ ] Can see "MongoDB connected successfully" in backend terminal
- [ ] Browser opens to `localhost:3000` (not 5000)
- [ ] Created a user account via signup

### **Production:**
- [ ] Code pushed to GitHub
- [ ] Render environment variables are set
- [ ] Render build completed successfully
- [ ] Can access https://vendor-11.onrender.com
- [ ] Created a user account via signup

---

## 🔍 **Get Detailed Logs**

Now when you try to login, you'll see detailed logs in the **Browser Console**:

```
🔐 Attempting login to: /api
✅ Login response: 200 {success: true, ...}
```

OR if there's an error:

```
❌ Login error: Request failed with status code 404
```

**Share these logs with me** and I can help you further!

---

## 🎯 **Most Common Solution**

**90% of the time, the issue is:**

1. **Local**: Backend not running or `.env` file missing
2. **Production**: No user account created yet - go to `/signup` first!

---

## 🚀 **Quick Test**

**Test if backend is accessible:**

**Local:**
```bash
Invoke-WebRequest -Uri "http://localhost:5000/api/auth/me" -Method GET
```

Should get: `401 Unauthorized` ✅ (means API is working!)

**Production:**
```bash
Invoke-WebRequest -Uri "https://vendor-11.onrender.com/api/auth/me" -Method GET
```

Should get: `401 Unauthorized` ✅ (means API is working!)

---

## 📞 **Still Not Working?**

Please provide:

1. **Which environment?** (Local or Production)
2. **Browser console output** (F12 → Console tab)
3. **Network tab output** (F12 → Network tab, look for failed request)
4. **Backend terminal output** (if local)
5. **Screenshot of the error**

I'll help you debug! 🔧

