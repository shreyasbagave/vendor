# 🚀 Quick Start - Local Development

## **One-Time Setup**

### 1. Create Backend Environment File

Create `backend/.env` file:

```bash
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://merabhaimickel_db_user:NewPassword@cluster0.gbbuacw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=dev_jwt_secret_change_in_production
JWT_EXPIRE=7d
```

### 2. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend/client
npm install --legacy-peer-deps
```

---

## **🏃‍♂️ Running the Application**

### **Method 1: Run Both Servers (Recommended)**

**Terminal 1 - Start Backend:**
```bash
cd backend
npm start
```

You should see:
```
Server running on port 5000
Environment: development
MongoDB connected successfully
```

**Terminal 2 - Start Frontend:**
```bash
cd frontend/client
npm start
```

Browser will automatically open at: **http://localhost:3000**

---

### **Method 2: Use Production Backend**

If you want to use the production backend (https://vendor-11.onrender.com) while developing:

Create `frontend/client/.env.local`:
```bash
REACT_APP_API_URL=https://vendor-11.onrender.com/api
```

Then start only the frontend:
```bash
cd frontend/client
npm start
```

---

## **✅ Verify Everything Works**

1. Open **http://localhost:3000**
2. You should see the **Login page**
3. Try logging in with your credentials
4. After login, you should see the **Dashboard**

---

## **🐛 Troubleshooting**

### Backend won't start:
- ✅ Check `backend/.env` file exists
- ✅ Check MongoDB connection string is correct
- ✅ Run `npm install` in `backend/` folder

### Frontend shows "Cannot connect":
- ✅ Make sure backend is running on `http://localhost:5000`
- ✅ Check `frontend/client/package.json` has `"proxy": "http://localhost:5000"`
- ✅ Restart both servers

### CORS errors:
- ✅ Check `NODE_ENV=development` in `backend/.env`
- ✅ Restart backend server
- ✅ Clear browser cache and reload

---

## **📱 Access the Application**

- **Local Development**: http://localhost:3000
- **Production**: https://vendor-11.onrender.com

---

## **🔐 Default Login (if you created admin account)**

Check your database or backend logs for admin credentials.

---

## **🛑 Stop Servers**

Press `Ctrl + C` in each terminal window.

---

## **📚 More Information**

See `LOCAL_AND_PRODUCTION_SETUP.md` for detailed configuration options.

