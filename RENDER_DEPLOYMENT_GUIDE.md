# 🚀 Render Deployment Guide - Stock Management Application

## Prerequisites
- GitHub account with your code repository
- Render account (free tier works)
- MongoDB Atlas account with connection string

---

## 📋 Step-by-Step Deployment

### 1. Prepare Your Repository

Make sure your repository has:
- ✅ Updated `backend/package.json` with proper build scripts
- ✅ `render.yaml` in the root directory
- ✅ All mobile-responsive changes committed
- ✅ `.gitignore` includes `node_modules`, `.env`

### 2. Set Up MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a cluster (free tier is fine)
3. Create a database user
4. Whitelist all IPs: `0.0.0.0/0` (for Render)
5. Get your connection string - should look like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/stock-management?retryWrites=true&w=majority
   ```

### 3. Deploy on Render

#### Option A: Using render.yaml (Recommended)

1. **Connect Repository:**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Render will detect `render.yaml` automatically

2. **Configure Environment Variables:**
   - In the blueprint setup, add:
     ```
     MONGODB_URI=<your-mongodb-connection-string>
     JWT_SECRET=<generate-a-random-secret-key>
     NODE_ENV=production
     PORT=5000
     ```

3. **Deploy:**
   - Click "Apply" to create the service
   - Render will automatically build and deploy

#### Option B: Manual Configuration

1. **Create Web Service:**
   - Go to Render Dashboard
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

2. **Configure Build Settings:**
   ```
   Name: stock-management-app
   Region: Oregon (or closest to you)
   Branch: main (or your default branch)
   Root Directory: backend
   Environment: Node
   Build Command: npm run render-build
   Start Command: npm start
   ```

3. **Add Environment Variables:**
   - Go to "Environment" tab
   - Add these variables:
     ```
     MONGODB_URI=<your-mongodb-atlas-connection-string>
     JWT_SECRET=<your-secret-key-min-32-chars>
     NODE_ENV=production
     PORT=5000
     ```

4. **Deploy:**
   - Click "Create Web Service"
   - Wait for build to complete (5-10 minutes)

---

## 🔧 Build Command Details

The updated build command in `package.json`:
```json
"render-build": "npm install && npm install --prefix ../frontend/client && npm run build --prefix ../frontend/client"
```

This command:
1. ✅ Installs backend dependencies
2. ✅ Installs frontend dependencies using `--prefix`
3. ✅ Builds the React app in production mode
4. ✅ Places build files in `frontend/client/build/`

---

## 🐛 Troubleshooting

### Error: "react-scripts: not found"

**Solution:** This is fixed by the updated build script. Make sure you're using:
```bash
npm run render-build
```

### Error: "Cannot find module 'react-scripts'"

**Cause:** Dependencies not installed in correct directory

**Solution:** The `--prefix ../frontend/client` flag ensures npm installs in the right location.

### Error: "MONGODB_URI is not set"

**Solution:** 
1. Go to Render Dashboard → Your Service → Environment
2. Add `MONGODB_URI` environment variable
3. Redeploy

### Build takes too long or times out

**Solution:**
- Free tier on Render has limited resources
- Consider upgrading to paid tier
- Or optimize build by removing unused dependencies

### App loads but shows blank page

**Check:**
1. Browser console for errors
2. Render logs: `Dashboard → Service → Logs`
3. Ensure `NODE_ENV=production` is set
4. Check if build folder was created successfully

---

## 📱 Verify Mobile Responsiveness

After deployment:

1. **Test on desktop:** `https://your-app.onrender.com`
2. **Test on mobile:** Open Chrome DevTools
   - Press F12
   - Click device toolbar icon (Ctrl+Shift+M)
   - Select iPhone/Android device
3. **Check features:**
   - ✅ Hamburger menu works
   - ✅ Forms are responsive
   - ✅ Tables scroll horizontally
   - ✅ Buttons are touch-friendly
   - ✅ Modal dialogs fit screen

---

## 🔐 Security Checklist

Before going live:

- [ ] Change default JWT_SECRET to strong random string
- [ ] Set MongoDB Atlas IP whitelist appropriately
- [ ] Enable HTTPS (Render provides this automatically)
- [ ] Review CORS settings in `server.js`
- [ ] Set secure passwords for all users
- [ ] Enable MongoDB Atlas backup

---

## 📊 Monitoring

**Render provides:**
- Real-time logs
- Automatic restarts on crashes
- Health checks
- Metrics dashboard

**Access logs:**
```
Dashboard → Your Service → Logs
```

---

## 🔄 Continuous Deployment

Render automatically deploys when you push to your main branch:

1. Make changes locally
2. Commit and push:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```
3. Render will automatically rebuild and redeploy

---

## 💡 Pro Tips

1. **Use Environment Variables:** Never hardcode secrets
2. **Monitor Logs:** Check regularly for errors
3. **Test Locally First:** Run `npm run render-build` locally before pushing
4. **Database Backups:** Enable Atlas automated backups
5. **Custom Domain:** Add your own domain in Render settings

---

## 📞 Need Help?

- **Render Docs:** https://render.com/docs
- **MongoDB Atlas Docs:** https://www.mongodb.com/docs/atlas/
- **Check Logs:** Most issues show up in Render logs

---

## ✅ Deployment Checklist

- [ ] Repository pushed to GitHub
- [ ] MongoDB Atlas cluster created
- [ ] Connection string obtained
- [ ] Render account created
- [ ] Web service created
- [ ] Environment variables set
- [ ] Build completed successfully
- [ ] App accessible via URL
- [ ] Mobile responsiveness verified
- [ ] Login/logout works
- [ ] All CRUD operations tested
- [ ] Reports generate correctly

---

**Your mobile-friendly Stock Management Application is now live! 🎉**

Access your app at: `https://your-app-name.onrender.com`

