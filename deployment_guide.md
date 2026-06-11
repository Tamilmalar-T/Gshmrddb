# MedFlow Production Deployment Guide

This guide explains how to deploy the MedFlow clinical portal with its Node.js backend and React frontend connected to a production database (MongoDB Atlas) and Google Drive storage.

---

## Step 1: Push Code to GitHub

Since Render and Vercel sync directly with GitHub to trigger automatic builds:

1. **Open VS Code** and click the **Source Control** icon on the left (or press `Ctrl+Shift+G`).
2. Verify all modifications to `Backend/server.js` and the new `deployment_guide.md` are listed.
3. Stage and commit these files (e.g., commit message: `"Configure Google Auth production safety variables and add deployment guide"`).
4. Click **Sync Changes / Push** to push the code to your GitHub repository at `https://github.com/Tamilmalar-T/demoform.git`.

> [!NOTE]
> If your command-line Git displays compatibility errors on Windows, using VS Code's visual Git panel (Source Control) or **GitHub Desktop** will bypass the command-line client and allow you to push successfully.

---

## Step 2: Set Up MongoDB Atlas (Cloud Database)

1. Sign in or create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a new free cluster (Shared tier, e.g., M0).
3. In the **Security ➔ Network Access** tab:
   * Click **Add IP Address**.
   * Choose **Allow Access from Anywhere** (`0.0.0.0/0`) so Render's cloud servers can connect. Click **Confirm**.
4. In the **Security ➔ Database Access** tab:
   * Create a database user (e.g., `admin`).
   * Choose **Read and write to any database** privileges. Note the password.
5. In the **Database ➔ Cluster** tab:
   * Click **Connect**.
   * Select **Drivers** (Node.js).
   * Copy the connection string. It will look like this:
     ```text
     mongodb+srv://admin:<password>@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
     ```
   * Replace `<password>` in the string with your database user's password.

---

## Step 3: Deploy the Backend on Render

1. Sign in to [Render](https://render.com/).
2. Click **New +** and select **Web Service**.
3. Choose **Build and deploy from a Git repository**, select your `demoform` repository, and click **Connect**.
4. Configure the Web Service settings as follows:
   * **Name:** `medflow-backend` (or a name of your choice)
   * **Language/Runtime:** `Node`
   * **Branch:** `main`
   * **Root Directory:** `Backend` *(This is important! It ensures Render runs inside the Backend folder)*
   * **Build Command:** `npm install`
   * **Start Command:** `npm start`
5. Scroll down and click **Advanced**. Under **Environment Variables**, add the following keys and values:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Tells the server to run in production mode. |
| `MONGODB_URI` | `mongodb+srv://...` | Paste your MongoDB Atlas connection string from Step 2. |
| `GMAIL_USER` | `tamilmalar520d@gmail.com` | Your Gmail address. |
| `GMAIL_APP_PASSWORD` | `vvvv mmda yulh eupu` | Gmail SMTP app password. |
| `GOOGLE_CREDENTIALS` | *(Copy JSON contents below)* | Open your local file `Backend/credentials.json` and paste its entire JSON contents. |
| `GOOGLE_TOKEN` | *(Copy JSON contents below)* | Open your local file `Backend/token.json` and paste its entire JSON contents. |

6. Click **Create Web Service**. 
7. Once deployed, Render will provide a public URL at the top of the dashboard (e.g. `https://medflow-backend.onrender.com`). Copy this URL.

---

## Step 4: Deploy the Frontend on Vercel

1. Sign in to [Vercel](https://vercel.com/).
2. Click **Add New ➔ Project**.
3. Import your `demoform` repository.
4. Configure the Project settings as follows:
   * **Framework Preset:** `Vite` (Vercel will detect the root build pipeline)
   * **Root Directory:** Leave empty (the root of the project contains the unified build script)
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
5. Expand the **Environment Variables** section and add:

| Key | Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://medflow-backend.onrender.com` | Paste your deployed Render Backend URL (without a trailing slash). |

6. Click **Deploy**.
7. Vercel will build the frontend, output the static site, and generate a live URL (e.g. `https://demoform-lt2b.vercel.app`).

Your live React frontend will now communicate securely with your live Express backend on Render, saving files directly to Google Drive and persisting logs to MongoDB Atlas!
