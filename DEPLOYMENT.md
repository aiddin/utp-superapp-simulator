# Deployment Guide — UTP Super App Simulator

This guide covers deploying the UTP Super App Simulator to GitHub Pages.

## Table of Contents

- [Automatic Deployment (GitHub Actions)](#automatic-deployment-github-actions)
- [Initial Setup](#initial-setup)
- [Manual Deployment](#manual-deployment)
- [Troubleshooting](#troubleshooting)
- [Configuration Details](#configuration-details)

---

## Automatic Deployment (GitHub Actions)

The simulator is configured for automatic deployment to GitHub Pages using GitHub Actions.

### How It Works

1. **Trigger**: Any push to the `main` branch triggers the deployment workflow
2. **Build**: GitHub Actions runs `npm ci` and `npm run build`
3. **Deploy**: The `dist/` folder is deployed to GitHub Pages
4. **Live**: Changes appear at https://aiddin.github.io/utp-superapp-simulator/ within 2-3 minutes

### Workflow File

Location: `.github/workflows/deploy.yml`

The workflow:
- Runs on Ubuntu latest
- Uses Node.js 20
- Caches npm dependencies for faster builds
- Uploads build artifacts to GitHub Pages
- Deploys automatically

---

## Initial Setup

Follow these steps when deploying for the first time:

### 1. Copy Files to GitHub Repository

If moving from the architecture-super-app monorepo:

```bash
# Clone the target repository
git clone https://github.com/aiddin/utp-superapp-simulator.git
cd utp-superapp-simulator

# Copy simulator files (from architecture-super-app/apps/simulator/)
# Copy all files except node_modules and dist
```

### 2. Enable GitHub Pages

1. Go to repository **Settings** > **Pages**
2. Under **Source**, select:
   - Source: **GitHub Actions** (recommended)
3. Save the settings

### 3. Configure Repository Permissions

Ensure the repository has the following permissions:

1. Go to **Settings** > **Actions** > **General**
2. Under **Workflow permissions**, select:
   - **Read and write permissions**
3. Check **Allow GitHub Actions to create and approve pull requests**
4. Save

### 4. Push to Main Branch

```bash
git add .
git commit -m "feat: initial simulator deployment setup"
git push origin main
```

### 5. Monitor Deployment

1. Go to **Actions** tab in GitHub
2. Watch the "Deploy to GitHub Pages" workflow
3. Wait for green checkmark (usually 2-3 minutes)
4. Visit https://aiddin.github.io/utp-superapp-simulator/

---

## Manual Deployment

For manual deployment or local testing:

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher

### Build Locally

```bash
# Install dependencies
npm install

# Build for production
npm run build
```

The production build will be in the `dist/` folder with the correct base path (`/utp-superapp-simulator/`).

### Preview Production Build

```bash
npm run preview
```

**Note**: The preview server serves from root `/`, so some paths may not match production. For accurate testing, use a local static server with base path support or test on GitHub Pages directly.

### Deploy to Other Hosting

The `dist/` folder can be deployed to any static hosting service:

- **Netlify**: Drag & drop the `dist/` folder
- **Vercel**: `vercel --prod dist/`
- **Cloudflare Pages**: Connect repository or upload `dist/`
- **AWS S3 + CloudFront**: Upload `dist/` to S3 bucket

**Important**: Update `vite.config.js` base path for different hosting:
```javascript
base: '/',  // For custom domain or root deployment
```

---

## Troubleshooting

### Deployment Failed

**Check GitHub Actions logs**:
1. Go to **Actions** tab
2. Click the failed workflow run
3. Expand the failed step to see error details

**Common issues**:
- Node modules cache conflict → Clear cache in workflow settings
- Build errors → Test `npm run build` locally first
- Permissions error → Check repository permissions (Settings > Actions)

### Page Not Loading (404)

**Verify GitHub Pages settings**:
1. Settings > Pages
2. Source should be **GitHub Actions**
3. If using branch, ensure it's `gh-pages` (not `main`)

**Check base path**:
- Vite config should have `base: '/utp-superapp-simulator/'`
- Verify in deployed `index.html`: assets should reference `/utp-superapp-simulator/assets/...`

### Assets Not Loading

**Symptom**: Page loads but CSS/JS files return 404

**Solution**:
1. Check browser console for failed requests
2. Verify all requests include `/utp-superapp-simulator/` prefix
3. Ensure `vite.config.js` has correct `base` setting
4. Rebuild and redeploy

### First Deployment Taking Too Long

**First deployment** may take 5-10 minutes as GitHub sets up the Pages environment.

**Subsequent deployments** are faster (2-3 minutes).

---

## Configuration Details

### Vite Configuration

File: `vite.config.js`

```javascript
export default defineConfig({
  base: '/utp-superapp-simulator/',  // ← Critical for GitHub Pages
  root: '.',
  publicDir: 'public',
  // ... other config
});
```

**Why this matters**:
- GitHub Pages serves repos at `username.github.io/repo-name/`
- Without `base`, assets would try to load from `username.github.io/assets/` (404)
- With `base`, assets load from `username.github.io/utp-superapp-simulator/assets/` ✓

### GitHub Actions Workflow

File: `.github/workflows/deploy.yml`

**Key sections**:

```yaml
on:
  push:
    branches:
      - main          # Trigger on main branch
  workflow_dispatch:  # Allow manual trigger

permissions:
  contents: read
  pages: write        # Required for Pages deployment
  id-token: write     # Required for attestation
```

**Jobs**:
1. **build**: Install deps, run build, upload artifact
2. **deploy**: Take artifact, deploy to Pages

### .gitignore

The `dist/` folder is gitignored because:
- CI builds it fresh on every deployment
- Keeps repository clean
- Prevents merge conflicts on build artifacts

---

## Development Workflow

### Local Development

```bash
npm run dev
```

- Opens https://localhost:5173 (with HTTPS via mkcert)
- Hot module replacement (HMR) enabled
- Uses base path `/` (not `/utp-superapp-simulator/`)

### Production Testing

```bash
npm run build
npm run preview
```

- Builds with production optimizations
- Previews on http://localhost:4173
- Still uses base path `/` locally

### To Test with Production Base Path

Use a local static server:

```bash
npm install -g serve
npm run build
cd dist
serve -s . -p 8080
```

Then visit: http://localhost:8080/utp-superapp-simulator/

---

## Monitoring & Maintenance

### Check Deployment Status

- **Actions Tab**: Shows all workflow runs
- **Environments Tab**: Shows deployment history
- **Pages Settings**: Shows current deployment URL

### Update Dependencies

```bash
npm update
npm audit fix
```

### Rollback Deployment

If a bad deployment goes live:

1. **Option A**: Revert the commit
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Option B**: Redeploy a previous good commit
   ```bash
   git checkout <good-commit-hash>
   git push origin main --force
   ```

**Note**: Force push is generally not recommended but acceptable for main branch in this single-user scenario.

---

## Security Considerations

### No Secrets Required

The simulator is a client-side application with no backend. It:
- Uses mock data for SDK calls
- Does not require API keys or secrets
- Can be deployed without environment variables

### HTTPS

GitHub Pages serves all content over HTTPS automatically.

### CORS

The simulator uses client-side only code. No CORS configuration needed.

---

## FAQ

### Q: Can I change the repository name?

**A**: Yes, but you must update `base` in `vite.config.js`:

```javascript
base: '/new-repo-name/',
```

Then rebuild and redeploy.

### Q: Can I use a custom domain?

**A**: Yes!

1. Add custom domain in GitHub Pages settings
2. Update `vite.config.js`:
   ```javascript
   base: '/',  // Root for custom domain
   ```
3. Rebuild and redeploy

### Q: How do I run the workflow manually?

1. Go to **Actions** tab
2. Select "Deploy to GitHub Pages" workflow
3. Click **Run workflow** button
4. Select branch (main)
5. Click **Run workflow**

### Q: Can I deploy from a different branch?

**A**: Yes, update `.github/workflows/deploy.yml`:

```yaml
on:
  push:
    branches:
      - staging  # Change to your branch
```

---

## Support

For issues or questions:

- **Repository Issues**: https://github.com/aiddin/utp-superapp-simulator/issues
- **GitHub Pages Docs**: https://docs.github.com/pages
- **Vite Docs**: https://vitejs.dev/guide/static-deploy.html

---

**Last Updated**: March 2026
