# 🚀 Quick Start: OIDC Fix for Week 4 Lab

**Problem:** Using long-lived `AZURE_CLIENT_SECRET` undermines OIDC security.  
**Solution:** Use `MicahWW/acr-oidc-login` action with zero stored secrets.

---

## 3 Steps to Fix

### Step 1: Update Workflow (Already Done ✅)

File: `.github/workflows/build-and-push.yml`

The workflow has been updated to use OIDC-based ACR authentication. The problematic `azure/docker-login` step has been replaced with:

```yaml
- name: 🐳 Login to Azure Container Registry (OIDC)
  uses: MicahWW/acr-oidc-login@v1
  with:
    client-id: ${{ vars.AZURE_CLIENT_ID }}
    tenant-id: ${{ vars.AZURE_TENANT_ID }}
    subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
    registry-url: ${{ vars.ACR_LOGIN_SERVER }}
    registry-suffix: ${{ vars.ACR_SUFFIX }}
```

### Step 2: Add GitHub Variable

Go to: **Repository Settings → Secrets and variables → Actions → Variables**

Add this **new variable:**

- **Name:** `ACR_SUFFIX`
- **Value:** The suffix from your registry URL
  - Example: If your registry is `netiksstoreacr.0123456789abcd.azurecr.io`
  - Then suffix is: `0123456789abcd`
  - To find it: Azure Portal → Container Registries → Your Registry → Login server field

### Step 3: Delete Secret

Go to: **Repository Settings → Secrets and variables → Actions → Secrets**

Delete: `AZURE_CLIENT_SECRET`

---

## Verify It Works

```bash
# Make a test commit
git add -A
git commit -m "Fix: OIDC-based ACR authentication"
git push origin main
```

Check GitHub Actions:
- ✅ Workflow runs
- ✅ All jobs pass
- ✅ No secret-related errors
- ✅ Images pushed to ACR

Check Azure Portal:
- ✅ New images appear in ACR
- ✅ Tagged with Git SHA

---

## Why This Is Better

| Feature | Old Way | New Way |
|---------|---------|---------|
| Secrets stored | ❌ Yes (`AZURE_CLIENT_SECRET`) | ✅ No |
| Token lifetime | ❌ Indefinite | ✅ 1 hour |
| Manual rotation | ❌ Required | ✅ Automatic |
| Security | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## Troubleshooting

**"registry-suffix is required"**
→ Add `ACR_SUFFIX` variable to GitHub Actions variables

**"Authentication failed"**
→ Verify ACR_SUFFIX value is correct (check Azure Portal)

**Still seeing AZURE_CLIENT_SECRET errors**
→ Make sure you deleted the secret from GitHub

---

## Next: Submit for Re-Evaluation

Once verified:
1. Push the workflow changes
2. Confirm GitHub Actions passes
3. Submit the updated lab with:
   - Updated `.github/workflows/build-and-push.yml`
   - Confirmation that `AZURE_CLIENT_SECRET` is deleted
   - Screenshot of GitHub Actions passing
   - Screenshot of ACR showing new images

---

**Status:** ✅ End-to-End OIDC Implemented  
**Security:** Zero stored secrets, fully automated credential rotation
