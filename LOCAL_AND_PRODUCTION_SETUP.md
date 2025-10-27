# 🚀 Local and Production Setup Guide

Your Stock Management Application works seamlessly in **both environments**!

---

## 🌐 **Production (Render)**

**Live URL**: https://vendor-11.onrender.com

### How It Works:
- Backend serves the built React app as static files
- API routes are at `/api/*`
- Single deployment handles both frontend and backend

### Environment Variables on Render:
```
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://merabhaimickel_db_user:NewPassword@cluster0.gbbuacw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRE=7d
```

**⚠️ IMPORTANT**: Change `JWT_SECRET` to a strong random value in production!

---

## 🖥️ **Local Development**

### Setup Steps:

#### 1️⃣ **Backend Setup**

Create `backend/.env` file:
```bash
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://merabhaimickel_db_user:NewPassword@cluster0.gbbuacw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=dev_jwt_secret_change_in_production
JWT_EXPIRE=7d
```

Start backend:
```bash
cd backend
npm install
npm start
```

✅ Backend runs at: `http://localhost:5000`

---

#### 2️⃣ **Frontend Setup**

**Option A: Use Local Backend (Recommended for Development)**

Just start the frontend - it will automatically proxy to `localhost:5000`:

```bash
cd frontend/client
npm install
npm start
```

✅ Frontend runs at: `http://localhost:3000`  
✅ API calls automatically go to: `http://localhost:5000/api`

---

**Option B: Use Production Backend While Developing**

If you want to test against the production backend:

Create `frontend/client/.env.local` file:
```bash
REACT_APP_API_URL=https://vendor-11.onrender.com/api
```

Then start the frontend:
```bash
cd frontend/client
npm start
```

✅ Frontend runs at: `http://localhost:3000`  
✅ API calls go to: `https://vendor-11.onrender.com/api`

---

## 🔧 **How It Works**

### **Local Development Mode**

```
Frontend (localhost:3000)
    ↓ API calls to /api/*
    ↓ Proxied by package.json "proxy": "http://localhost:5000"
    ↓
Backend (localhost:5000)
    ↓
MongoDB Atlas (Cloud Database)
```

### **Production Mode (Render)**

```
User requests https://vendor-11.onrender.com
    ↓
Backend Server (Node.js + Express)
    ↓
    ├─→ /api/* routes → API handlers
    └─→ /* routes → Serves React build files
    ↓
MongoDB Atlas (Cloud Database)
```

---

## 📋 **Quick Commands**

### **Local Development (Both Servers)**

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend/client
npm start
```

---

### **Local Development (Frontend Only, Using Production Backend)**

Create `frontend/client/.env.local`:
```bash
REACT_APP_API_URL=https://vendor-11.onrender.com/api
```

Then:
```bash
cd frontend/client
npm start
```

---

### **Build for Production**
```bash
cd backend
npm run render-build
```

This will:
1. Install backend dependencies
2. Install frontend dependencies
3. Build the React app
4. Backend will serve the built files in production

---

## 🔐 **Authentication Flow**

Both local and production use the **same authentication system**:

1. User must login at `/login`
2. JWT token is stored in browser localStorage
3. Token is valid for 7 days
4. All API requests include the token in `Authorization: Bearer <token>` header
5. Backend verifies token on every request

---

## 🐛 **Troubleshooting**

### **Local: "Cannot connect to backend"**
- ✅ Check backend is running on `localhost:5000`
- ✅ Check `frontend/client/package.json` has `"proxy": "http://localhost:5000"`
- ✅ Check backend `.env` has `NODE_ENV=development`

### **Local: "CORS error"**
- ✅ Backend `server.js` allows `http://localhost:3000` in development mode
- ✅ Restart both frontend and backend

### **Production: "API not found"**
- ✅ Check Render environment variables are set correctly
- ✅ Check `NODE_ENV=production` is set on Render
- ✅ Check build completed successfully

---

## 📁 **Environment Files**

| File | Location | Purpose | Git Tracked? |
|------|----------|---------|--------------|
| `.env` | `backend/.env` | Local backend config | ❌ No (.gitignore) |
| `.env.local` | `frontend/client/.env.local` | Local frontend config (optional) | ❌ No (.gitignore) |
| `env.example` | `backend/env.example` | Example configuration | ✅ Yes |

**Never commit** `.env` or `.env.local` files to Git!

---

## ✅ **Deployment Checklist**

### **For Render Deployment:**

1. ✅ Push code to GitHub
2. ✅ Render automatically builds and deploys
3. ✅ Environment variables are set on Render dashboard
4. ✅ Build command: `npm run render-build`
5. ✅ Start command: `npm start`
6. ✅ Root directory: `backend`

### **For Local Development:**

1. ✅ Create `backend/.env` file (see above)
2. ✅ Run `npm install` in both `backend/` and `frontend/client/`
3. ✅ Start backend: `cd backend && npm start`
4. ✅ Start frontend: `cd frontend/client && npm start`

---

## 🎯 **Summary**

Your application is **already configured** to work in both environments!

| Environment | Frontend URL | Backend URL | Database |
|-------------|--------------|-------------|----------|
| **Local** | `localhost:3000` | `localhost:5000` | MongoDB Atlas |
| **Production** | `vendor-11.onrender.com` | `vendor-11.onrender.com/api` | MongoDB Atlas |

**No code changes needed** - just set environment variables! 🎉

