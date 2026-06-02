# Chatvora — Production Deployment Guide

## 📋 Table of Contents
1. [Electron Desktop App (.exe)](#1-electron-desktop-app-exe)
2. [Web Deployment (Render.com)](#2-web-deployment-rendercom)
3. [Environment Variables](#3-environment-variables)
4. [Build Commands](#4-build-commands)

---

## 1. Electron Desktop App (.exe)

### Prerequisites
- Node.js 18+ installed
- Windows 10/11 (for .exe build)

### Build Steps

```bash
# Quick build
npm run build

# Clean build (removes old artifacts first)
npm run build:clean
```

This will:
1. Install all dependencies
2. Build Next.js in standalone mode
3. Copy static files + public folder to standalone output
4. Package everything with electron-builder
5. Output `.exe` installer to `release/` folder

### What gets bundled
| Component | Location |
|-----------|----------|
| Electron shell | `electron/` |
| Next.js standalone | `frontend/.next/standalone/` |
| Static assets | `frontend/public/` |
| Backend server | `backend/` |

### How it works at runtime
1. Electron starts → spawns **Backend** (Node.js on port 5000)
2. Electron spawns **Next.js standalone** (on port 3000)
3. Electron window loads `http://127.0.0.1:3000`
4. Frontend auto-detects backend at `http://127.0.0.1:5000/api`

---

## 2. Web Deployment (Render.com)

### Backend Deployment (Render Web Service)

1. Create a **Web Service** on [Render.com](https://render.com)
2. Connect your GitHub repo
3. Set **Root Directory** to `backend`
4. Set **Build Command**: `npm install`
5. Set **Start Command**: `node server.js`
6. Add environment variables (see below)

### Frontend Deployment (Vercel or Render)

#### Option A: Vercel (Recommended)
1. Import project on [Vercel.com](https://vercel.com)
2. Set **Root Directory** to `frontend`
3. Add environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api
   ```
4. Deploy

#### Option B: Render Static Site
1. Build the frontend locally:
   ```bash
   npm run build:web
   ```
2. Deploy `frontend/.next/standalone/` as a web service

---

## 3. Environment Variables

### Backend `.env` (required for both Electron & Web)

```env
# Server
PORT=5000
NODE_ENV=production

# Database (MongoDB Atlas for production)
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/chatvora

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_REFRESH_SECRET=your-refresh-secret-key-change-this
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d

# CORS
CLIENT_URL=http://localhost:3000,https://your-frontend.vercel.app

# File Uploads
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=52428800
```

### Frontend `.env.production`

```env
# For Electron desktop: leave commented (auto-detects localhost)
# For Web deployment: set to your backend URL
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api
```

---

## 4. Build Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Run in development mode (Electron + Backend + Frontend) |
| `npm run build` | Build Electron .exe installer |
| `npm run build:clean` | Clean + build .exe from scratch |
| `npm run build:web` | Build for web deployment only |
| `npm run build:mac` | Build macOS .dmg |
| `npm run build:linux` | Build Linux .AppImage |
| `npm run cleanup` | Kill orphan processes on ports 3000/5000 |

---

## Architecture

```
┌─────────────────────────────────────────┐
│              Electron Shell              │
│  ┌──────────┐    ┌──────────────────┐   │
│  │ Backend   │    │  Next.js         │   │
│  │ :5000/api │◄───│  :3000           │   │
│  │ (Node.js) │    │  (Standalone)    │   │
│  └──────────┘    └──────────────────┘   │
│         │                │               │
│         ▼                ▼               │
│  ┌──────────────────────────────────┐   │
│  │     BrowserWindow (Chromium)     │   │
│  │     http://127.0.0.1:3000        │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘

Web Deployment:
┌──────────────┐         ┌──────────────┐
│   Vercel     │  HTTP   │   Render     │
│   Frontend   │ ──────► │   Backend    │
│   :443       │         │   :443/api   │
└──────────────┘         └──────┬───────┘
                                │
                         ┌──────▼───────┐
                         │  MongoDB     │
                         │  Atlas       │
                         └──────────────┘