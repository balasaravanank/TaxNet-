# Deployment Guide for GST TaxNet

This guide covers two recommended approaches to host the GST Fraud Detector application.

---

## Option 1: Railway (Recommended - Easiest)

Railway deploys both frontend and backend from a single GitHub repo with minimal configuration.

### Prerequisites
- GitHub account with this repo pushed
- Railway account (https://railway.app)

### Steps

1. **Push to GitHub** (if not already):
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/gst-fraud-detector.git
   git push -u origin main
   ```

2. **Create Backend Service on Railway**:
   - Go to https://railway.app → New Project → Deploy from GitHub repo
   - Select the repo, then configure:
     - **Root Directory**: `backend`
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `python app.py`
   - Add environment variables:
     - `ANTHROPIC_API_KEY` = your API key
     - `FLASK_ENV` = production
   - Note the generated URL (e.g., `https://gst-backend-xxx.up.railway.app`)

3. **Create Frontend Service on Railway**:
   - Add another service in the same project
   - Configure:
     - **Root Directory**: `frontend`
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npx serve dist -s -l 3000`
   - Add environment variable:
     - `VITE_API_URL` = your backend Railway URL

4. **Update Frontend API URL**:
   Before deploying, update the frontend to use environment variables for the API URL.

---

## Option 2: Vercel (Frontend) + Render (Backend)

This is a production-ready setup with free tiers for both platforms.

### Backend on Render

1. **Create `render.yaml`** in project root (already created below)

2. **Go to Render** (https://render.com):
   - New → Web Service → Connect GitHub repo
   - Select repo, configure:
     - **Root Directory**: `backend`
     - **Runtime**: Python 3
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT`
   - Add environment variable: `ANTHROPIC_API_KEY`

3. **Note your Render URL** (e.g., `https://gst-backend.onrender.com`)

### Frontend on Vercel

1. **Go to Vercel** (https://vercel.com):
   - New Project → Import GitHub repo
   - Configure:
     - **Root Directory**: `frontend`
     - **Framework Preset**: Vite
   - Add environment variable:
     - `VITE_API_URL` = your Render backend URL

2. **Deploy** - Vercel auto-builds on every push

---

## Required Code Changes for Production

### 1. Add Gunicorn to Backend (for Render)

Add to `backend/requirements.txt`:
```
gunicorn>=21.0.0
```

### 2. Update Flask App for Production

In `backend/app.py`, ensure it binds to the correct port:
```python
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
```

### 3. Configure Frontend API URL

Create `frontend/.env.production`:
```
VITE_API_URL=https://your-backend-url.com
```

Update API calls in frontend to use:
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
```

---

## Environment Variables Summary

| Variable | Where | Value |
|----------|-------|-------|
| `ANTHROPIC_API_KEY` | Backend | Your Anthropic API key |
| `FLASK_ENV` | Backend | `production` |
| `VITE_API_URL` | Frontend | Backend deployed URL |

---

## Post-Deployment Checklist

- [ ] Backend health check: `curl https://your-backend-url/api/health`
- [ ] Frontend loads and connects to backend
- [ ] CORS is properly configured for production domain
- [ ] Environment variables are set correctly
- [ ] Database is initialized (run `python generate_data.py` once)

---

## Important Notes

1. **Memory Requirements**: Your ML dependencies (sentence-transformers, chromadb) need ~1-2GB RAM. Choose a plan accordingly.

2. **Cold Starts**: Free tiers on Render/Railway may have cold starts (30-60s delay after inactivity).

3. **SQLite Limitation**: SQLite data doesn't persist across deployments on serverless platforms. For production, migrate to PostgreSQL.

4. **CORS**: Ensure `app.py` allows your frontend domain:
   ```python
   CORS(app, origins=["https://your-frontend-domain.vercel.app"])
   ```

---

## Cost Estimates

| Platform | Free Tier | Paid |
|----------|-----------|------|
| Railway | 500 hours/month | $5-20/month |
| Render | 750 hours/month | $7+/month |
| Vercel | Unlimited for hobby | $20/month pro |

---

## Need Help?

- Railway Docs: https://docs.railway.app
- Render Docs: https://render.com/docs
- Vercel Docs: https://vercel.com/docs
