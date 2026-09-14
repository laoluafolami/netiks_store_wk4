# 🚀 Netiks Store - Week 4 Lab: Azure CI/CD Implementation Guide

## 📋 **Table of Contents**
- [Part 1: Understanding the Basics](#part-1-understanding-the-basics)
- [Part 2: GitHub Actions Configuration](#part-2-github-actions-configuration)
- [Part 3: Secure Azure Authentication](#part-3-secure-azure-authentication)
- [Part 4: Image Tagging Strategy](#part-4-image-tagging-strategy)
- [Part 5: Testing the Pipeline](#part-5-testing-the-pipeline)
- [Part 6: Deployment Process](#part-6-deployment-process)
- [Deliverables Checklist](#deliverables-checklist)

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

## 🔐 **Part 3: Secure Azure Authentication (Federated Credentials)**

### **Azure OIDC Configuration Steps**

#### **Step 1: Create Federated Credentials**

*Goal: Tell Azure to trust GitHub Actions when you push code to the `main` branch or create a `v1.1.0` tag.*

1. **Open** "**Microsoft Entra ID**" again -> **Click** "**App registrations**".
2. **Click** on your App Registration.
3. **Click** "**Certificates & secrets**" on the left, then **click** the "**Federated credentials**" tab.
4. **Click** "**+ Add credential**".
5. **Select** "**GitHub Actions deploying Azure resources**" under Scenario.
6. **Fill** in the details for your **Main Branch**:
   - **Organization:** *Your GitHub Username*
   - **Repository:** *Your GitHub Repository Name*
   - **Entity type:** Select **Branch**
   - **Branch name:** `main`
   - **Name:** `github-main`
7. **Click** "**Add**".
8. **Click** "**+ Add credential**" again to add a second one for your **Release Tag**:
   - **Organization:** *Your GitHub Username*
   - **Repository:** *Your GitHub Repository Name*
   - **Entity type:** Select **Tag**
   - **Tag name:** `v1.1.0`
   - **Name:** `github-tag-v1`
9. **Click** "**Add**".

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

**<img width="981" height="346" alt="Screenshot 2026-09-10 161226" src="https://github.com/user-attachments/assets/afd1359e-928a-4624-a757-49483f700ac5" />:** Screenshot of GitHub Repository Variables page showing the 4 variable names.

#### **Step 3: Configure GitHub Secrets**

Go to **Settings → Secrets and variables → Actions → Secrets**

Add this **secret**:
- `AZURE_CLIENT_SECRET` = The client secret from your Azure App Registration

  
**<img width="995" height="216" alt="Screenshot 2026-09-10 161648" src="https://github.com/user-attachments/assets/580ce416-15d0-4619-9a00-cb45a699b039" />:** Screenshot showing the Secrets page with AZURE_CLIENT_SECRET secret name


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

**<img width="1095" height="704" alt="Screenshot 2026-09-10 171719" src="https://github.com/user-attachments/assets/d9772499-e9cb-41e8-a930-4ff55fd6fe6b" />:** Screenshot of successful GitHub Actions run for a normal commit (showing both validate and build jobs passing)

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
  

**<img width="1653" height="668" alt="Screenshot 2026-09-10 174352" src="https://github.com/user-attachments/assets/18b0c36b-acc7-498d-a84f-9cc89339211f" />:**  Screenshot of successful GitHub Actions run for a release tag (showing v1.1.0 and latest tags being created).


### **5c. Verify Azure Container Registry**

**Check ACR Repository:**
1. Navigate to Azure Portal → Container Registries → netiksstoreacr
2. Check each repository (web, gateway, identity-service, etc.)
3. Verify tags exist:
   - Git SHA tag (e.g., `abc123def`)
   - `v1.1.0` tag
   - `latest` tag

**<img width="1338" height="433" alt="Screenshot 2026-09-10 180846" src="https://github.com/user-attachments/assets/1baa25d3-198d-4610-b473-0e83f43a7c05" />** 
<img width="1343" height="472" alt="Screenshot 2026-09-10 174655" src="https://github.com/user-attachments/assets/83915cec-e944-4da3-80d7-47b30d30f64c" />
<img width="1336" height="448" alt="Screenshot 2026-09-10 181025" src="https://github.com/user-attachments/assets/c6d0160b-bb85-4731-ae66-755ab46c954a" />
<img width="1322" height="452" alt="Screenshot 2026-09-10 181009" src="https://github.com/user-attachments/assets/1079c5f5-cf59-430e-97b8-9baa3b5518f4" />
<img width="1328" height="424" alt="Screenshot 2026-09-10 180943" src="https://github.com/user-attachments/assets/6b7aff33-2647-4d09-a609-336ebcb100e3" />
<img width="1331" height="433" alt="Screenshot 2026-09-10 180927" src="https://github.com/user-attachments/assets/0f7dc86a-2dea-4905-ae4c-9952af45e27e" />
<img width="1329" height="432" alt="Screenshot 2026-09-10 180912" src="https://github.com/user-attachments/assets/d10ee2c0-07cb-4c66-ab8e-a81afd4582b4" />
Screenshot of Azure Container Registry showing all 7 repositories with SHA, v1.1.0, and latest tags

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

**<img width="1038" height="691" alt="Screenshot 2026-09-10 174941" src="https://github.com/user-attachments/assets/25a4ab3d-f975-4018-b135-62a66a09d5e9" />:** Screenshot showing updated docker-compose.prod.yml file

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

**<img width="1035" height="223" alt="Screenshot 2026-09-10 183613" src="https://github.com/user-attachments/assets/aad01747-7df5-47ac-a37d-a953cd978903" />** Screenshot of `docker ps` showing containers running with v1.1.0 images

### **Step 3: Verify Application**

1. Access your application at the public IP
2. Verify your changes are visible
3. Test critical functionality (login, product browsing, etc.)

**<img width="1652" height="967" alt="Screenshot 2026-08-31 182231" src="https://github.com/user-attachments/assets/3411f31e-c159-456f-bc55-80c19e4dac15" />:** Screenshot of the running application showing the new changes
<img width="1427" height="914" alt="Screenshot 2026-08-20 092322" src="https://github.com/user-attachments/assets/5f2c0f22-a4c9-43be-a132-0c66c1c627c2" />
<img width="1495" height="799" alt="Screenshot 2026-08-20 124304" src="https://github.com/user-attachments/assets/f447717b-57cf-4c58-87ab-8e7a23145606" />
<img width="1343" height="814" alt="Screenshot 2026-08-20 131455" src="https://github.com/user-attachments/assets/72229bc9-4afb-4ff6-9b7c-d0336bce7afb" />

---

## 📋 **Deliverables Checklist**

### **1. GitHub Actions Screenshots**
- [ ] **<img width="981" height="346" alt="Screenshot 2026-09-10 161226" src="https://github.com/user-attachments/assets/7b5d48fb-babe-4ead-b078-a2887f4c6206" />** GitHub Repository Variables (names only)
- [ ] **<img width="995" height="216" alt="Screenshot 2026-09-10 161648" src="https://github.com/user-attachments/assets/f922e9c0-6582-460e-8cd5-4828015cb8f0" />** GitHub Secrets page (showing AZURE_CLIENT_SECRET name)
- [ ] **<img width="1095" height="704" alt="Screenshot 2026-09-10 171719" src="https://github.com/user-attachments/assets/c7f7316f-9756-475d-9136-649960c8dfca" />** Successful `main` pipeline run
- [ ] **<img width="1653" height="668" alt="Screenshot 2026-09-10 174352" src="https://github.com/user-attachments/assets/cfdc7fc0-3a64-4662-9bbe-04db08b3c73c" />** Successful release pipeline (v1.1.0)

### **2. Azure Container Registry Screenshots**
- [ ] **<img width="1343" height="472" alt="Screenshot 2026-09-10 174655" src="https://github.com/user-attachments/assets/40474630-001a-4895-92ed-cb6f3b64afbc" />** ACR showing SHA, v1.1.0, and latest tags
- [ ] <img width="1338" height="433" alt="Screenshot 2026-09-10 180846" src="https://github.com/user-attachments/assets/008e8067-7cd1-42ea-98a5-ba0d846f46c8" />
- [ ] <img width="1329" height="432" alt="Screenshot 2026-09-10 180912" src="https://github.com/user-attachments/assets/973d4e36-702c-4617-8176-fbbabe5e6d39" />
- [ ] <img width="1331" height="433" alt="Screenshot 2026-09-10 180927" src="https://github.com/user-attachments/assets/d4c577f1-4c24-46fb-a036-9bd65617d72e" />
- [ ] <img width="1328" height="424" alt="Screenshot 2026-09-10 180943" src="https://github.com/user-attachments/assets/8e812831-0384-4507-b9aa-2350e294def7" />
- [ ] <img width="1322" height="452" alt="Screenshot 2026-09-10 181009" src="https://github.com/user-attachments/assets/226a0f12-f2db-4420-9bd7-109a19da91bd" />
- [ ] <img width="1336" height="448" alt="Screenshot 2026-09-10 181025" src="https://github.com/user-attachments/assets/9108a0e2-c4f5-472a-984d-c1f7847e9988" />



  
### **3. Configuration Files**
- [ ] `.github/workflows/build-and-push.yml`
- [ ] Updated `docker-compose.prod.yml`

### **4. Deployment Verification**
- [ ] **<img width="1038" height="691" alt="Screenshot 2026-09-10 174941" src="https://github.com/user-attachments/assets/b9b8d6b2-cb8e-4c47-97a8-e90f3afc9a47" />** Updated docker-compose.prod.yml
- [ ] **<img width="1035" height="223" alt="Screenshot 2026-09-10 183613" src="https://github.com/user-attachments/assets/b1602fdb-56c0-4842-87cf-35c254ae0b36" />** `docker ps` showing v1.1.0 containers
- [ ] **<img width="1654" height="966" alt="Screenshot 2026-08-31 125913" src="https://github.com/user-attachments/assets/b47bc874-4581-4cee-850a-01497709708d" />** Application running with changes

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

By completing this lab, I achieved:

> **A developer pushes code → GitHub Actions validates it → GitHub authenticates to Azure using OIDC → All 7 Docker images are built → Images are pushed to ACR with Git SHA tags → Version tags create release images → Production is manually updated with the new version**

**Success Metrics:**
- ✅ Fully automated CI pipeline
- ✅ Secure OIDC authentication to Azure
- ✅ Immutable, traceable Docker images
- ✅ Separation of development commits from production releases

---


*Last Updated: September 8, 2026*
---