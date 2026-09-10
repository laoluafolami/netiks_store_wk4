# 🚀 Netiks Store - Week 4 Lab: Azure CI/CD Implementation Guide

## 📋 **Table of Contents**
- [Part 1: Understanding the Basics](#part-1-understanding-the-basics)
- [Part 2: GitHub Actions Configuration](#part-2-github-actions-configuration)
- [Part 3: Secure Azure Authentication](#part-3-secure-azure-authentication)
- [Part 4: Image Tagging Strategy](#part-4-image-tagging-strategy)
- [Part 5: Testing the Pipeline](#part-5-testing-the-pipeline)
- [Part 6: Deployment Process](#part-6-deployment-process)
- [Deliverables Checklist](#deliverables-checklist)
- [Complete Implementation Files](#complete-implementation-files)

---

## 📚 **Part 1: Understanding the Basics**

### **Question 1: What are two problems with building Docker images manually from your laptop?**

**Answer:**
1. **Environment Inconsistency**: Different developers may have different Docker versions, operating systems, or local dependencies, leading to "it works on my machine" problems and inconsistent builds across the team.

2. **Lack of Automation & Traceability**: Manual builds are error-prone, not reproducible, and lack an audit trail. They can't be easily integrated into a continuous delivery pipeline, making it difficult to track which code version produced which image.

### **Question 2: What is OIDC, and why is it better than storing a long-lived AWS access key or Azure client secret?**

**Answer:**
**OIDC (OpenID Connect)** is an identity layer built on top of OAuth 2.0 that enables third-party applications to verify user identities. In the context of CI/CD pipelines:

**Why OIDC is superior to static credentials:**

| Aspect | Long-lived Secrets | OIDC Federation |
|--------|-------------------|------------------|
| **Security** | Static credentials can be leaked/stolen | Short-lived tokens (typically 1 hour) |
| **Rotation** | Manual rotation required | Automatic token rotation |
| **Scope** | Broad permissions | Fine-grained, scoped permissions |
| **Auditability** | Hard to trace usage | Each token usage is logged with identity context |
| **Compliance** | Higher risk profile | Meets security best practices |

**Azure Implementation**: OIDC allows GitHub Actions to authenticate to Azure Container Registry (ACR) using Microsoft Entra ID federated credentials, eliminating the need for storing Azure client secrets in GitHub.

### **Question 3: Why should CI images be tagged with a Git commit SHA?**

**Answer:**
1. **Traceability**: Each Docker image can be directly traced back to the exact code version (Git commit) that produced it
2. **Reproducibility**: You can rebuild the exact same image from the same commit SHA at any time
3. **Immutable Deployments**: SHA-tagged images never change, ensuring consistent and predictable deployments
4. **Rollback Capability**: Easy to roll back to previous working versions by referencing their SHA tags
5. **Audit Trail**: Provides complete lineage from code commit to production deployment

---

## ⚙️ **Part 2: GitHub Actions Configuration**

### **Step-by-Step Implementation Guide**

#### **Step 1: Create GitHub Actions Directory Structure**
```bash
mkdir -p .github/workflows
```

#### **Step 2: Create the Complete Workflow File**
Create `.github/workflows/build-and-push.yml`:

```yaml
name: 🐳 Build and Push Docker Images

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  validate:
    name: 🔍 Validate Code Quality
    runs-on: ubuntu-latest
    
    steps:
    - name: 📥 Checkout repository
      uses: actions/checkout@v4
      
    - name: 🐍 Set up Python 3.11
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: 📦 Install Python dependencies
      run: |
        pip install black flake8 mypy
        pip install -e packages/shared-python
    
    - name: 🧹 Lint Python code
      run: |
        echo "Running Python linting..."
        black --check apps/gateway services/
        flake8 apps/gateway services/
    
    - name: ⚛️ Set up Node.js 20
      uses: actions/setup-node@v4
      with:
        node-version: '20'
    
    - name: 📦 Install Node.js dependencies
      run: |
        cd apps/web
        npm ci
    
    - name: 🧹 Lint web application
      run: |
        cd apps/web
        npm run lint
    
    - name: 🐳 Validate Docker Compose configuration
      run: |
        docker compose config --quiet

  build-and-push:
    name: 🐳 Build and Push Images
    needs: validate
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    
    strategy:
      matrix:
        service: 
          - web
          - gateway
          - identity-service
          - vendor-service
          - catalog-service
          - media-service
          - admin-service
        include:
          - service: web
            dockerfile: infra/docker/web.Dockerfile
          - service: gateway
            dockerfile: apps/gateway/Dockerfile
          - service: identity-service
            dockerfile: services/identity-service/Dockerfile
          - service: vendor-service
            dockerfile: services/vendor-service/Dockerfile
          - service: catalog-service
            dockerfile: services/catalog-service/Dockerfile
          - service: media-service
            dockerfile: services/media-service/Dockerfile
          - service: admin-service
            dockerfile: services/admin-service/Dockerfile
    
    steps:
    - name: 📥 Checkout repository
      uses: actions/checkout@v4
      
    - name: 🔐 Azure Login (OIDC)
      uses: azure/login@v2
      with:
        client-id: ${{ vars.AZURE_CLIENT_ID }}
        tenant-id: ${{ vars.AZURE_TENANT_ID }}
        subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
    
    - name: 🐳 Login to Azure Container Registry
      uses: azure/docker-login@v2
      with:
        login-server: ${{ vars.ACR_LOGIN_SERVER }}
        username: ${{ vars.AZURE_CLIENT_ID }}
        password: ${{ secrets.AZURE_CLIENT_SECRET }}
    
    - name: 🏷️ Extract metadata for Docker tags
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ vars.ACR_LOGIN_SERVER }}/${{ matrix.service }}
        tags: |
          type=sha,prefix=
          type=ref,event=tag
    
    - name: 🛠️ Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
    
    - name: 🐳 Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ${{ matrix.dockerfile }}
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        platforms: linux/amd64
```

---

## 🔐 **Part 3: Secure Azure Authentication**

### **Azure OIDC Configuration Steps**

#### **Step 1: Create Azure Resources**

1. **Create Azure Container Registry (ACR)**
   ```bash
   az acr create \
     --resource-group NetiksStore \
     --name netiksstoreacr \
     --sku Basic \
     --admin-enabled false
   ```

2. **Create Microsoft Entra App Registration**
   ```bash
   az ad app create \
     --display-name "GitHub Actions Netiks Store"
   ```

3. **Create Federated Credential for GitHub**
   ```bash
   az ad app federated-credential create \
     --id <app-id> \
     --parameters federated-credential.json
   ```

   `federated-credential.json`:
   ```json
   {
     "name": "GitHubActions",
     "issuer": "https://token.actions.githubusercontent.com",
     "subject": "repo:your-username/netiks-store:ref:refs/heads/main",
     "audiences": ["api://AzureADTokenExchange"]
   }
   ```

#### **Step 2: Configure GitHub Repository Variables**

Go to your GitHub repository:
**Settings → Secrets and variables → Actions → Variables**

Add these **non-secret** variables:

| Variable Name | Example Value | Purpose |
|--------------|--------------|---------|
| `AZURE_CLIENT_ID` | `00000000-0000-0000-0000-000000000000` | Application Client ID |
| `AZURE_TENANT_ID` | `00000000-0000-0000-0000-000000000000` | Azure AD Tenant ID |
| `AZURE_SUBSCRIPTION_ID` | `00000000-0000-0000-0000-000000000000` | Azure Subscription ID |
| `ACR_LOGIN_SERVER` | `netiksstoreacr.azurecr.io` | ACR Registry URL |

**[SCREENSHOT PLACEHOLDER 1]:** Screenshot of GitHub Repository Variables page showing the 4 variable names (blur any actual IDs for security)

#### **Step 3: Configure GitHub Secrets**

Go to **Settings → Secrets and variables → Actions → Secrets**

Add this **secret**:
- `AZURE_CLIENT_SECRET` = The client secret from your Azure App Registration

**[SCREENSHOT PLACEHOLDER 2]:** Screenshot showing the Secrets page with AZURE_CLIENT_SECRET secret name (blur the actual secret value)

#### **Step 4: Grant ACR Permissions**
```bash
# Get the Object ID of your App Registration
az ad sp show --id <client-id> --query id -o tsv

# Grant AcrPush role to ACR
az role assignment create \
  --assignee <app-object-id> \
  --role AcrPush \
  --scope /subscriptions/<subscription-id>/resourceGroups/NetiksStore/providers/Microsoft.ContainerRegistry/registries/netiksstoreacr
```

---

## 🏷️ **Part 4: Image Tagging Strategy**

### **Tagging Logic Implementation**

The workflow automatically creates different tags based on the trigger:

| Trigger | Tags Generated | Example |
|---------|----------------|---------|
| **Push to main** | `<git-sha>` | `netiksstoreacr.azurecr.io/web:abc123def` |
| **Git tag v1.1.0** | `<git-sha>`, `v1.1.0`, `latest` | `netiksstoreacr.azurecr.io/web:v1.1.0` |

### **Question: Why should `latest` not be updated on every commit to `main`?**

**Answer:**
The `latest` tag should **only** be updated during **official releases** (version tags) for these reasons:

1. **Production Stability**: `latest` should represent a stable, tested release ready for production, not every development commit
2. **Rollback Clarity**: If `latest` moves with every commit, rolling back becomes confusing and risky
3. **Deployment Confidence**: Operations teams need confidence that `latest` represents a validated release, not untested code
4. **Semantic Versioning**: Aligns with semantic versioning practices where `latest` tracks the most recent stable release
5. **CI/CD Best Practice**: Following industry standards where `latest` is reserved for production-ready releases

**Azure Implementation**: In our workflow, `latest` is only pushed when a version tag (like `v1.1.0`) is created, ensuring it always points to a release.

---

## 🧪 **Part 5: Testing the Pipeline**

### **5a. Testing Normal Commit Flow**

**Steps to Test:**
1. Make a small change to any service (e.g., add a comment to `services/catalog-service/app/main.py`)
2. Commit and push to main:
   ```bash
   git add .
   git commit -m "Test: Trigger CI/CD pipeline"
   git push origin main
   ```

**Expected Results:**
- ✅ Validation job passes
- ✅ All 7 images are built
- ✅ Images are pushed with Git SHA tags only
- ❌ `latest` tag is NOT updated

**[SCREENSHOT PLACEHOLDER 3]:** Screenshot of successful GitHub Actions run for a normal commit (showing both validate and build jobs passing)

### **5b. Testing Release Flow**

**Steps to Test:**
1. Create and push a version tag:
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```

**Expected Results:**
- ✅ Workflow runs automatically
- ✅ All 7 images are built
- ✅ SHA tags are pushed
- ✅ `v1.1.0` tags are pushed
- ✅ `latest` tags are pushed

**[SCREENSHOT PLACEHOLDER 4]:** Screenshot of successful GitHub Actions run for a release tag (showing v1.1.0 and latest tags being created)

### **5c. Verify Azure Container Registry**

**Check ACR Repository:**
1. Navigate to Azure Portal → Container Registries → netiksstoreacr
2. Check each repository (web, gateway, identity-service, etc.)
3. Verify tags exist:
   - Git SHA tag (e.g., `abc123def`)
   - `v1.1.0` tag
   - `latest` tag

**[SCREENSHOT PLACEHOLDER 5]:** Screenshot of Azure Container Registry showing all 7 repositories with SHA, v1.1.0, and latest tags

---

## 🚀 **Part 6: Deployment Process**

### **Update Production Configuration**

**Step 1: Update `docker-compose.prod.yml`**
```yaml
version: '3.8'

services:
  web:
    image: netiksstoreacr.azurecr.io/web:v1.1.0
    pull_policy: always
  
  gateway:
    image: netiksstoreacr.azurecr.io/gateway:v1.1.0
    pull_policy: always
  
  identity-service:
    image: netiksstoreacr.azurecr.io/identity-service:v1.1.0
    pull_policy: always
  
  vendor-service:
    image: netiksstoreacr.azurecr.io/vendor-service:v1.1.0
    pull_policy: always
  
  catalog-service:
    image: netiksstoreacr.azurecr.io/catalog-service:v1.1.0
    pull_policy: always
  
  media-service:
    image: netiksstoreacr.azurecr.io/media-service:v1.1.0
    pull_policy: always
  
  admin-service:
    image: netiksstoreacr.azurecr.io/admin-service:v1.1.0
    pull_policy: always
```

**[SCREENSHOT PLACEHOLDER 6]:** Screenshot showing updated docker-compose.prod.yml file

### **Step 2: Deploy to Azure VM**

**On your Azure VM:**
```bash
# 1. Pull the repository
git pull origin main

# 2. Login to Azure Container Registry
az acr login --name netiksstoreacr

# 3. Pull updated images
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  pull

# 4. Restart services
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d

# 5. Verify deployment
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
```

**[SCREENSHOT PLACEHOLDER 7]:** Screenshot of `docker ps` showing containers running with v1.1.0 images

### **Step 3: Verify Application**

1. Access your application at the public IP
2. Verify your changes are visible
3. Test critical functionality (login, product browsing, etc.)

**[SCREENSHOT PLACEHOLDER 8]:** Screenshot of the running application showing the new changes

---

## 📋 **Deliverables Checklist**

### **1. GitHub Actions Screenshots**
- [ ] **[SCREENSHOT 1]** GitHub Repository Variables (names only)
- [ ] **[SCREENSHOT 2]** GitHub Secrets page (showing AZURE_CLIENT_SECRET name)
- [ ] **[SCREENSHOT 3]** Successful `main` pipeline run
- [ ] **[SCREENSHOT 4]** Successful release pipeline (v1.1.0)

### **2. Azure Container Registry Screenshots**
- [ ] **[SCREENSHOT 5]** ACR showing SHA, v1.1.0, and latest tags

### **3. Configuration Files**
- [ ] `.github/workflows/build-and-push.yml`
- [ ] Updated `docker-compose.prod.yml`

### **4. Deployment Verification**
- [ ] **[SCREENSHOT 6]** Updated docker-compose.prod.yml
- [ ] **[SCREENSHOT 7]** `docker ps` showing v1.1.0 containers
- [ ] **[SCREENSHOT 8]** Application running with changes

### **5. Short Questions Answers**

**Q1. What problem does OIDC solve?**
OIDC solves the security problem of storing long-lived, static credentials in CI/CD systems by providing short-lived, automatically rotated tokens with fine-grained permissions and full auditability.

**Q2. Why do we use Git SHA tags?**
Git SHA tags provide immutable, traceable, and reproducible builds that can be directly linked to specific code commits, enabling reliable rollbacks and audit trails.

**Q3. Why should validation happen before the build?**
Validation acts as a quality gate to prevent building and pushing broken or non-compliant code, saving compute resources and ensuring only valid code progresses through the pipeline.

**Q4. Why shouldn't `latest` be updated on every commit?**
`latest` should represent stable, production-ready releases, not every development commit. Updating it only on releases ensures production stability and clear rollback paths.

**Q5. What part of this process would you automate next in Week 5?**
The manual deployment step on the Azure VM should be automated next using either:
1. **Azure Container Instances** with managed updates
2. **Azure Kubernetes Service (AKS)** with GitOps (Flux/ArgoCD)
3. **Azure DevOps Pipeline** for automated VM deployment
4. **Custom deployment script** triggered by the GitHub Actions workflow

---

## 🎯 **What Good Looks Like**

By completing this lab, you'll achieve:

> **A developer pushes code → GitHub Actions validates it → GitHub authenticates to Azure using OIDC → All 7 Docker images are built → Images are pushed to ACR with Git SHA tags → Version tags create release images → Production is manually updated with the new version**

**Success Metrics:**
- ✅ Fully automated CI pipeline
- ✅ Secure OIDC authentication to Azure
- ✅ Immutable, traceable Docker images
- ✅ Separation of development commits from production releases
- ✅ Ready for Week 5 automation improvements

---

## 📁 **Complete Implementation Files**

### **File 1: `.github/workflows/build-and-push.yml`**
```yaml
# [Full implementation from Part 2 above]
```

### **File 2: Updated `docker-compose.prod.yml`**
```yaml
# [Full implementation from Part 6 above]
```

### **File 3: Azure Setup Scripts**
```bash
# Azure Resource Creation Script
#!/bin/bash
# create-azure-resources.sh

RESOURCE_GROUP="NetiksStore"
ACR_NAME="netiksstoreacr"
LOCATION="eastus"

# Create Resource Group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Azure Container Registry
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled false

echo "Azure resources created successfully!"
echo "ACR Login Server: ${ACR_NAME}.azurecr.io"
```

---

## 🏆 **Submission Requirements**

Submit all deliverables as `Week4_<FirstName>_<LastName>.pdf` containing:

1. All 8 required screenshots
2. Configuration file contents
3. Answers to all 5 short questions
4. Brief explanation of your implementation

**Email to:** shulammite.odde@cognetiks.com  
**CC:** flora.owhiroro@cognetiks.com

---

## 💡 **Pro Tips for Success**

1. **Test Incrementally**: Start with one service before implementing all 7
2. **Check Logs**: Use GitHub Actions logs to debug issues
3. **Security First**: Never commit secrets to version control
4. **Document Everything**: Keep notes of each step for your submission
5. **Validate Early**: Run validation steps locally before pushing

**Good luck with your Week 4 implementation! 🚀**

---
*Created with ❤️ for Netiks Store Internship Program*  
*Last Updated: September 8, 2026*
