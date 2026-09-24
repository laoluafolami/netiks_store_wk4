# 🚀 Netiks Store - Week 6 Lab: Staging Environment Implementation Guide
## Complete Step-by-Step Implementation with Pre-Production Deployment

**Lab Duration:** 1 week  
**Submission Deadline:** Friday, 25 September, 5:00 PM  
**Prerequisite:** Week 5 Lab (Production deployment pipeline working)

---

## 📋 Executive Summary

**Week 5 Limitation:** Version tags deploy directly to production after approval, without testing the changes in a production-like environment first.

**Week 6 Solution:** Introduce a **staging environment** that automatically receives every commit to `main`, allowing you to test changes before creating a production release tag.

**Final Workflow:**
```
Developer pushes to main
    ↓
CI builds and pushes SHA-tagged images
    ↓
Staging automatically deploys SHA images (no approval)
    ↓
Team tests changes in staging
    ↓
Developer creates version tag (e.g., v1.3.0)
    ↓
Production requires approval
    ↓
Production deploys after approval
```

**Key Benefits:**
- ✅ Test every change before production
- ✅ Catch bugs in staging, not production
- ✅ Staging and production run side-by-side on same VM
- ✅ Complete isolation between environments

---

# PART 1: Understand the Basics

## Question 1.1: Why is a successful CI build not enough to know that an application is ready for production?

### Answer

A successful CI build only proves that:
- ✅ Code compiles without errors
- ✅ Linters pass (code style checks)
- ✅ Docker images can be built
- ✅ Static analysis succeeds

**But it does NOT prove:**

**1. Runtime Behavior**
- ❌ Application actually runs without crashing
- ❌ Services can communicate with each other
- ❌ Database connections work
- ❌ API endpoints respond correctly
- ❌ Frontend renders properly

**Example:**
```python
# This builds successfully:
def get_user(user_id):
    return database.query(f"SELECT * FROM users WHERE id = {user_id}")  # SQL injection!

# But causes runtime issues:
# - Security vulnerability
# - Works with test data
# - Fails with production-scale data
```

**2. Integration Issues**
- ❌ Services might fail to connect in real network
- ❌ Database migrations might fail on actual data
- ❌ Environment variables might be misconfigured
- ❌ Volumes and mounts might not exist

**Example:**
```yaml
# docker-compose.yml
services:
  api:
    environment:
      DATABASE_URL: ${DATABASE_URL}  # Missing in .env!

# Build succeeds, but runtime fails:
# "Error: DATABASE_URL not set"
```

**3. Performance Problems**
- ❌ Application might be too slow with real data
- ❌ Memory leaks only appear after hours of running
- ❌ Database queries might be inefficient
- ❌ API might timeout under load

**4. User Experience Issues**
- ❌ UI might have broken links
- ❌ Forms might not submit
- ❌ Images might not load
- ❌ Mobile layout might be broken

**5. Business Logic Errors**
- ❌ Calculations might be wrong
- ❌ Permissions might allow unauthorized access
- ❌ Workflows might skip critical steps

**Real-World Scenario:**

```
CI Build: ✅ Passed
    ├─ Code compiles
    ├─ Linting passes
    ├─ Docker build succeeds
    └─ "Ship it!"

Deploy to Production:
    ├─ App crashes on startup (missing env var)
    ├─ Database connection timeout
    ├─ Frontend shows blank page (API URL wrong)
    ├─ Users cannot login (JWT secret mismatch)
    └─ ❌ Production down for 2 hours

vs.

CI Build: ✅ Passed

Deploy to Staging:
    ├─ App crashes (missing env var)
    ├─ Fix: Add env var to .env.staging
    ├─ Redeploy staging: ✅ Works
    └─ Now safe to deploy to production

Deploy to Production: ✅ Works
```

**Summary:**

| CI Build Tests | Staging Tests |
|----------------|---------------|
| Code compiles | App actually runs |
| Syntax correct | Services communicate |
| Linting passes | Database connects |
| Images build | API endpoints work |
| | Frontend renders |
| | User workflows complete |
| | Performance acceptable |

**Conclusion:**
> A successful CI build proves the code is syntactically correct. Staging deployment proves the application actually works in a production-like environment.

---

## Question 1.2: Why should staging deploy the exact SHA-tagged image produced by the build job instead of building another image?

### Answer

**The Problem with Building Again:**

If staging builds its own image instead of using the CI-built image:

**1. Image Drift (Different Images)**

```
CI Build Job:
    ├─ Builds image at 1:00 PM
    ├─ Base image: node:20.5.0
    ├─ Dependencies: express@4.18.2
    ├─ Image SHA: abc123
    └─ Pushes to registry

Staging builds separately at 1:05 PM:
    ├─ Base image: node:20.5.1 (updated!)
    ├─ Dependencies: express@4.18.3 (new version!)
    ├─ Image SHA: def456 (completely different!)
    └─ ❌ Not the same image!

Result:
    Staging tests: def456 (different image)
    Production gets: abc123 (original image)
    ❌ You tested the WRONG thing!
```

**2. Time-Based Inconsistencies**

```
Dockerfile:
    FROM node:20-alpine  # No specific version

11:00 AM - CI builds:
    └─ Uses node:20.5.0 (latest at that time)

11:05 AM - Staging rebuilds:
    └─ Uses node:20.5.1 (new version released!)

Result: Different base images = untested configuration in staging
```

**3. External Dependency Changes**

```
Dockerfile:
    RUN pip install fastapi  # No version pinned

CI Build:
    └─ Installs fastapi 0.104.0

Staging Rebuild (5 minutes later):
    └─ Installs fastapi 0.104.1 (just released with bug!)

Result:
    Staging: Tests with buggy fastapi 0.104.1
    Production: Gets fastapi 0.104.0
    ❌ Bug might not be caught in staging
```

**4. Build Context Differences**

```
CI build:
    ├─ COPY package.json
    ├─ COPY src/
    ├─ Commit: abc123
    └─ Image built from exact commit

Staging rebuild:
    ├─ main branch has moved forward
    ├─ New commits added
    ├─ Commit: def456
    └─ ❌ Built from different code!

Result: Staging tests newer code than what was built
```

**5. Build Timing Issues**

```
CI build at 1:00 PM:
    ├─ npm install → downloads dependencies
    ├─ All package versions locked
    ├─ Image: abc123
    └─ Pushed to registry

Staging rebuild at 1:05 PM:
    ├─ npm install → one package updated
    ├─ New package version introduced
    ├─ Image: def456
    └─ ❌ Different packages!

Result: Staging has different dependencies
```

**6. Wasted Resources**

```
Build once (CI):
    ├─ Duration: 5 minutes
    ├─ Resources: 1 build
    └─ Cost: $0.01

Build twice (CI + Staging):
    ├─ Duration: 10 minutes total
    ├─ Resources: 2 builds
    ├─ Cost: $0.02
    └─ ❌ Doubles build time and cost
```

**The Correct Approach: Use SHA-Tagged Images**

```
1:00 PM - Developer pushes commit abc123 to main

1:01 PM - CI build-and-push job:
    ├─ Checks out abc123
    ├─ Builds 7 images
    ├─ Tags with SHA: netiksstoreregistry.azurecr.io/web:abc123
    ├─ Pushes to registry
    └─ ✅ Images ready

1:03 PM - Staging deployment:
    ├─ Uses IMAGE_TAG=abc123
    ├─ Pulls: netiksstoreregistry.azurecr.io/web:abc123
    ├─ Same exact image CI built
    └─ ✅ Tests the EXACT image

1:10 PM - Create production tag v1.3.0 (points to abc123)

1:11 PM - Production deployment:
    ├─ Uses version v1.3.0 (same as abc123)
    ├─ Pulls: netiksstoreregistry.azurecr.io/web:v1.3.0
    ├─ Same image staging tested
    └─ ✅ Deploys what was tested
```

**Benefits of SHA-Tagged Images:**

| Factor | Build Again | Use SHA Image |
|--------|-------------|---------------|
| **Same image?** | ❌ No (different build) | ✅ Yes (exact same) |
| **Base image version** | ❌ Might differ | ✅ Identical |
| **Dependencies** | ❌ Might differ | ✅ Identical |
| **Build time** | ❌ Doubles | ✅ Single build |
| **Cost** | ❌ 2x | ✅ 1x |
| **Test confidence** | ❌ Low (tested different thing) | ✅ High (tested exact thing) |
| **Traceability** | ❌ Hard | ✅ Easy (SHA links to commit) |

**Image Flow:**

```
Commit abc123
    ↓
CI builds image:abc123
    ↓
Registry stores image:abc123
    ↓
Staging pulls image:abc123 (exact same)
    ↓
Team tests image:abc123
    ↓
Tag v1.3.0 created for commit abc123
    ↓
Production pulls image:abc123 (via v1.3.0 tag)
    ↓
✅ Production runs EXACTLY what staging tested
```

**Summary:**
> Staging must use SHA-tagged images from CI to ensure you're testing the EXACT artifact that will go to production. Rebuilding creates a different image and undermines the entire purpose of staging.

---

## Question 1.3: Why should staging deploy automatically while production still requires approval?

### Answer

**Staging and production have different purposes and risk profiles.**

### Staging Environment Characteristics

**Purpose:** Fast feedback and experimentation
- ✅ Test every change immediately
- ✅ Catch bugs early
- ✅ Validate features quickly
- ✅ Experiment with code

**Risk Profile:** Low
- No real users affected
- No real data at risk
- Can break without consequences
- Easy to reset/redeploy

**Usage Pattern:**
```
Developer commits fix → Staging auto-deploys (5 min)
    ↓
Developer tests immediately
    ↓
Bug found? Fix and push again → Staging auto-deploys
    ↓
Iterate quickly until satisfied
```

**Why Automatic:**
1. **Fast Feedback Loop**
   ```
   Without auto-deploy:
   Commit → Wait for approval → Test (slow)
   
   With auto-deploy:
   Commit → Test immediately (fast)
   ```

2. **Encourages Testing**
   ```
   Manual approval required:
       └─ Developers skip staging ("too slow")
   
   Automatic deployment:
       └─ Developers always test in staging
   ```

3. **Development Efficiency**
   ```
   9:00 AM - Push fix to staging
   9:01 AM - Staging deploys automatically
   9:02 AM - Test and verify
   9:03 AM - Found another issue
   9:04 AM - Push another fix
   9:05 AM - Staging deploys automatically
   9:06 AM - Test and verify again
   ✅ Fast iteration
   ```

---

### Production Environment Characteristics

**Purpose:** Serve real users with stability
- ✅ Must be stable and tested
- ✅ Changes must be deliberate
- ✅ Downtime affects business
- ✅ Data integrity critical

**Risk Profile:** High
- Real users affected immediately
- Real business data at risk
- Bugs cause revenue loss
- Downtime has consequences

**Usage Pattern:**
```
Staging tested thoroughly → Create production tag
    ↓
Wait for approval (human reviews)
    ↓
Manager approves → Production deploys
    ↓
Monitor carefully for issues
```

**Why Manual Approval:**
1. **Human Oversight**
   ```
   Reviewer checks:
   - Is staging green?
   - Are there ongoing incidents?
   - Is this the right time to deploy?
   - Have we tested enough?
   - Are on-call engineers available?
   ```

2. **Timing Control**
   ```
   Without approval:
   3:00 PM Friday - Auto-deploys to production
   3:05 PM - Critical bug discovered
   3:06 PM - Weekend starts, team gone
   ❌ Bad timing

   With approval:
   3:00 PM Friday - Waits for approval
   Manager: "Let's wait until Monday morning"
   ✅ Smart timing
   ```

3. **Incident Prevention**
   ```
   Without approval:
   Deploy during active incident
   Makes incident worse
   ❌ Chaos

   With approval:
   Manager sees ongoing incident
   Blocks deployment until resolved
   ✅ Safe
   ```

4. **Accountability**
   ```
   Auto-deploy:
   - No clear decision maker
   - "The pipeline did it"
   - Hard to audit

   Manual approval:
   - Clear decision maker
   - "Manager X approved at Y time"
   - Easy audit trail
   ```

---

### Side-by-Side Comparison

| Factor | Staging | Production |
|--------|---------|-----------|
| **Users Affected** | 0 (internal team) | Thousands (customers) |
| **Risk** | Low | High |
| **Data** | Test data | Real business data |
| **Downtime Impact** | None | Revenue loss |
| **Deploy Frequency** | Many times/day | Few times/week |
| **Speed Priority** | Fast feedback | Stability |
| **Approval Needed** | ❌ No | ✅ Yes |
| **Can Break** | ✅ Yes (that's the point!) | ❌ No |

---

### Real-World Scenario

**Staging (Automatic):**
```
9:00 AM - Developer pushes to main
9:01 AM - Staging auto-deploys
9:02 AM - Developer tests
9:03 AM - "Oops, I broke the login!"
9:04 AM - Pushes fix
9:05 AM - Staging auto-deploys fixed version
9:06 AM - Developer tests: "Works now!"
✅ Fast iteration, no consequences
```

**Production (Manual Approval):**
```
4:00 PM - Staging tested all day, everything works
4:01 PM - Create production tag v1.3.0
4:02 PM - Workflow waits for approval
4:03 PM - Manager reviews:
           - Checks staging status: ✅ Green
           - Checks team availability: ✅ Engineers online
           - Checks monitoring: ✅ No incidents
           - Checks time: ✅ 4 PM, not Friday night
4:04 PM - Manager approves
4:05 PM - Production deploys
4:06 PM - Team monitors closely
✅ Deliberate, controlled change
```

---

### What Would Go Wrong With Different Configurations?

**Scenario 1: Staging with Manual Approval (BAD)**
```
Developer commits fix
    ↓
Staging waits for approval
    ↓
Developer waits 30 minutes
    ↓
Approval granted
    ↓
Staging deploys
    ↓
Developer tests: "It's broken!"
    ↓
Fix and commit
    ↓
Wait another 30 minutes for approval
    ↓
❌ Development slows to a crawl
```

**Scenario 2: Production with Auto-Deploy (DISASTER)**
```
Developer commits "quick fix" at 5 PM Friday
    ↓
Production auto-deploys immediately
    ↓
Critical bug discovered
    ↓
Entire site down
    ↓
Weekend starts, team unavailable
    ↓
❌ Site down for 48 hours
```

---

### Workflow Comparison

**Correct Configuration:**
```
Developer commits to main
    ↓
Staging auto-deploys ✅ (fast feedback)
    ↓
Test in staging
    ↓
Create production tag
    ↓
Production waits for approval ✅ (safety)
    ↓
Human approves
    ↓
Production deploys ✅ (controlled)
```

**Summary:**
> Staging deploys automatically for fast iteration and immediate testing. Production requires approval because changes affect real users and need human oversight for timing, safety, and accountability.

---

---

# PART 2: Prepare the Staging Environment

Staging and production will run on the **same VM** but remain completely isolated through:
- ✅ Separate directories
- ✅ Separate Docker Compose projects
- ✅ Separate ports
- ✅ Separate environment variables
- ✅ Separate database volumes

---

## Step 1: SSH into Your Azure VM

Open your terminal or PowerShell and connect to your VM:

```bash
ssh azureuser@<YOUR_VM_PUBLIC_IP>
```

Replace `<YOUR_VM_PUBLIC_IP>` with your actual VM IP address (e.g., `20.29.81.166`).

**Expected Output:**
```
Welcome to Ubuntu 22.04.3 LTS
Last login: ...
azureuser@netiks-vm:~$
```

**[PLACEHOLDER: Screenshot showing successful SSH connection to VM]**

---

## Step 2: Create Staging Working Directory

Clone a second copy of your repository for the staging environment.

### Action: Clone Repository for Staging

Execute this command:

```bash
sudo -u deploy git clone https://github.com/<YOUR_ORG>/netiks_store.git /home/deploy/netiks_store-staging
```

Replace `<YOUR_ORG>` with your actual GitHub organization or username.

**What this does:**
- `sudo -u deploy` = Run as the deploy user (not your personal account)
- `git clone` = Copy the repository
- `/home/deploy/netiks_store-staging` = Destination directory with `-staging` suffix

**Expected Output:**
```
Cloning into '/home/deploy/netiks_store-staging'...
remote: Enumerating objects: 1234, done.
remote: Counting objects: 100% (1234/1234), done.
remote: Compressing objects: 100% (567/567), done.
Receiving objects: 100% (1234/1234), 2.34 MiB | 5.67 MiB/s, done.
Resolving deltas: 100% (890/890), done.
```

### Action: Verify Both Directories Exist

Execute:

```bash
ls -la /home/deploy/
```

**Expected Output:**
```
drwxr-xr-x  5 deploy deploy 4096 Sep 20 10:00 netiks_store
drwxr-xr-x  5 deploy deploy 4096 Sep 20 10:05 netiks_store-staging
```

**You should now have:**
- `/home/deploy/netiks_store` → Production
- `/home/deploy/netiks_store-staging` → Staging

**[PLACEHOLDER: Screenshot showing both directories listed with `ls -la /home/deploy/`]**

---

## Step 3: Update Base docker-compose.yml for Port Variables

The base `docker-compose.yml` currently has hardcoded ports. You need to make them configurable via environment variables so staging and production can use different ports.

### Action: Open docker-compose.yml on Your Laptop

Open the file in your code editor:

```
g:\projects\netiks_store_wk4\docker-compose.yml
```

### Action: Find the `web` Service Ports Section

Locate this section (around line 8):

```yaml
  web:
    build:
      context: .
      dockerfile: infra/docker/web.Dockerfile
    env_file:
      - .env
    ports:
      - "${WEB_EXPOSE_PORT:-3001}:3000"
```

**Current state:** Already has `${WEB_EXPOSE_PORT:-3001}` ✅

### Action: Find the `gateway` Service Ports Section

Locate this section (around line 17):

```yaml
  gateway:
    build:
      context: .
      dockerfile: apps/gateway/Dockerfile
    env_file:
      - .env
    environment:
      APP_NAME: gateway
      APP_PORT: 8000
      # ... other env vars
    ports:
      - "8000:8000"
```

### Action: Replace Gateway Ports with Environment Variable

**Change FROM:**
```yaml
    ports:
      - "8000:8000"
```

**Change TO:**
```yaml
    ports:
      - "127.0.0.1:${GATEWAY_EXPOSE_PORT:-8000}:8000"
```

**What this does:**
- `${GATEWAY_EXPOSE_PORT:-8000}` = Use env var `GATEWAY_EXPOSE_PORT`, default to `8000`
- `127.0.0.1:` = Bind to localhost only (security best practice)
- `:8000` = Container internal port (doesn't change)

### Action: Update All Internal Service Ports

Find these services and update their ports:

**identity-service** (around line 36):
```yaml
    ports:
      - "${IDENTITY_EXPOSE_PORT:-8001}:8001"
```

**vendor-service** (around line 48):
```yaml
    ports:
      - "${VENDOR_EXPOSE_PORT:-8002}:8002"
```

**catalog-service** (around line 60):
```yaml
    ports:
      - "${CATALOG_EXPOSE_PORT:-8003}:8003"
```

**media-service** (around line 72):
```yaml
    ports:
      - "${MEDIA_EXPOSE_PORT:-8004}:8004"
```

**admin-service** (around line 86):
```yaml
    ports:
      - "${ADMIN_EXPOSE_PORT:-8005}:8005"
```

### Action: Save docker-compose.yml

Press `Ctrl+S` (Windows) or `Cmd+S` (Mac) to save the file.

**[PLACEHOLDER: Screenshot of updated docker-compose.yml showing environment variable ports]**

---

## Step 4: Create docker-compose.staging.yml

Now create a new file specifically for staging configuration.

### Action: Create New File

In your code editor, create a new file:

```
g:\projects\netiks_store_wk4\docker-compose.staging.yml
```

### Action: Copy This Content Into the File

```yaml
# Staging environment configuration
# Usage: docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d

version: '3.8'

services:
  web:
    image: ${REGISTRY}/web:${IMAGE_TAG}
    pull_policy: always

  gateway:
    image: ${REGISTRY}/gateway:${IMAGE_TAG}
    pull_policy: always

  identity-service:
    image: ${REGISTRY}/identity-service:${IMAGE_TAG}
    pull_policy: always

  vendor-service:
    image: ${REGISTRY}/vendor-service:${IMAGE_TAG}
    pull_policy: always

  catalog-service:
    image: ${REGISTRY}/catalog-service:${IMAGE_TAG}
    pull_policy: always

  media-service:
    image: ${REGISTRY}/media-service:${IMAGE_TAG}
    pull_policy: always

  admin-service:
    image: ${REGISTRY}/admin-service:${IMAGE_TAG}
    pull_policy: always
```

**Key points:**
- `${REGISTRY}` = Your ACR registry URL (e.g., `netiksstoreregistry.azurecr.io`)
- `${IMAGE_TAG}` = Git commit SHA (set during deployment)
- `pull_policy: always` = Always pull fresh images
- No `ports:` section = Uses defaults from base docker-compose.yml
- No `build:` section = Uses pre-built images from registry

### Action: Save docker-compose.staging.yml

Press `Ctrl+S` to save the file.

**[PLACEHOLDER: Screenshot of docker-compose.staging.yml file in code editor]**

---

## Step 5: Create Staging Environment Variables File

Staging needs its own `.env` file with different database credentials, ports, and secrets.

### Action: SSH into VM and Navigate to Staging Directory

```bash
cd /home/deploy/netiks_store-staging
```

### Action: Create Staging .env File

```bash
sudo -u deploy nano .env
```

This opens the nano text editor as the deploy user.

### Action: Copy This Content

**Paste this template and customize the values:**

```bash
# Staging Environment Configuration
# DO NOT commit this file to Git

# Application Environment
NODE_ENV=staging
NEXT_PUBLIC_API_BASE_URL=http://<YOUR_VM_IP>:8080/api/v1

# Staging Ports (different from production)
WEB_EXPOSE_PORT=3002
GATEWAY_EXPOSE_PORT=8100
IDENTITY_EXPOSE_PORT=8101
VENDOR_EXPOSE_PORT=8102
CATALOG_EXPOSE_PORT=8103
MEDIA_EXPOSE_PORT=8104
ADMIN_EXPOSE_PORT=8105

# PostgreSQL Configuration (STAGING DATABASE)
POSTGRES_DB=netiks_store_staging
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<GENERATE_NEW_PASSWORD>
# No POSTGRES_EXPOSE_PORT (internal only)

# JWT Configuration (DIFFERENT from production!)
JWT_SECRET=<GENERATE_NEW_SECRET>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# Redis Configuration
REDIS_URL=redis://redis:6379

# Image Registry Configuration
REGISTRY=netiksstoreregistry.azurecr.io
IMAGE_TAG=<will-be-set-during-deployment>

# Service URLs (internal Docker network)
IDENTITY_SERVICE_URL=http://identity-service:8001
VENDOR_SERVICE_URL=http://vendor-service:8002
CATALOG_SERVICE_URL=http://catalog-service:8003
MEDIA_SERVICE_URL=http://media-service:8004
```

### Action: Generate Secure Secrets

**For `POSTGRES_PASSWORD`:**

On your laptop, run:
```bash
openssl rand -hex 32
```

Copy the output and replace `<GENERATE_NEW_PASSWORD>`.

**For `JWT_SECRET`:**

Run again:
```bash
openssl rand -hex 64
```

Copy the output and replace `<GENERATE_NEW_SECRET>`.

**Replace `<YOUR_VM_IP>`:**

Replace with your actual VM public IP (e.g., `20.29.81.166`).

### Action: Save the .env File

In nano editor:
1. Press `Ctrl+X` to exit
2. Press `Y` to confirm save
3. Press `Enter` to confirm filename

**Expected Output:**
```
File written
```

### Action: Verify .env File Permissions

```bash
ls -la /home/deploy/netiks_store-staging/.env
```

**Expected Output:**
```
-rw-r--r-- 1 deploy deploy 1234 Sep 20 10:15 /home/deploy/netiks_store-staging/.env
```

**[PLACEHOLDER: Screenshot showing .env file created with correct permissions]**

---

## Step 6: Verify Staging Environment Setup

### Action: Check Directory Structure

```bash
tree -L 2 /home/deploy/
```

**Expected Output:**
```
/home/deploy/
├── netiks_store/              ← Production
│   ├── .env
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── apps/
│   └── services/
└── netiks_store-staging/      ← Staging
    ├── .env                   ← Different configuration
    ├── docker-compose.yml
    ├── docker-compose.staging.yml
    ├── apps/
    └── services/
```

### Action: Verify .env Differences

Check that staging has different secrets:

```bash
# Check staging JWT secret (first 20 chars)
grep JWT_SECRET /home/deploy/netiks_store-staging/.env | cut -c1-40

# Check production JWT secret (first 20 chars)
grep JWT_SECRET /home/deploy/netiks_store/.env | cut -c1-40
```

**These should be DIFFERENT!**

**[PLACEHOLDER: Screenshot showing different JWT secrets for staging and production]**

---

## Step 7: Commit Configuration Files to Git

Now commit the new `docker-compose.staging.yml` and updated `docker-compose.yml` to Git.

### Action: Stage Files

On your laptop, in PowerShell:

```bash
cd g:\projects\netiks_store_wk4

git add docker-compose.yml
git add docker-compose.staging.yml
```

### Action: Commit Changes

```bash
git commit -m "feat: Add staging environment configuration

- Update docker-compose.yml to use environment variables for ports
- Create docker-compose.staging.yml for SHA-tagged images
- Staging will use different ports to avoid conflicts with production"
```

### Action: Push to GitHub

```bash
git push origin main
```

**Expected Output:**
```
Enumerating objects: 5, done.
Counting objects: 100% (5/5), done.
Delta compression using up to 8 threads
Compressing objects: 100% (3/3), done.
Writing objects: 100% (3/3), 456 bytes | 456.00 KiB/s, done.
Total 3 (delta 2), reused 0 (delta 0), pack-reused 0
To github.com:your-org/netiks_store.git
   abc1234..def5678  main -> main
```

**[PLACEHOLDER: Screenshot of git commit and push output]**

---

## Part 2 Deliverables Checklist

- [✅] Staging directory created: `/home/deploy/netiks_store-staging`
- [✅] docker-compose.staging.yml created with SHA-tagged images
- [✅] docker-compose.yml updated with port environment variables
- [✅] Staging .env file created with different credentials
- [✅] Verified staging uses separate database name
- [✅] Verified staging uses different JWT secret
- [✅] Configuration files committed to Git

---

---

# PART 3: Add the Staging Deployment Job

Now update your GitHub Actions workflow to automatically deploy to staging after every push to `main`.

---

## Step 1: Open GitHub Actions Workflow File

On your laptop, open:

```
g:\projects\netiks_store_wk4\.github\workflows\build-and-push.yml
```

---

## Step 2: Add deploy-staging Job

Scroll to the end of the file (after the `deploy` job) and add this new job:

### Action: Copy and Paste This Job

```yaml
  deploy-staging:
    name: 🎭 Deploy to Staging
    needs: build-and-push
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: staging
    permissions:
      contents: read
      id-token: write

    steps:
      - name: 🔐 Azure Login (OIDC for ACR Token)
        uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}

      - name: 🎟️ Get Short-Lived ACR Token for Staging
        id: get_acr_token
        run: |
          TOKEN=$(az acr login --name netiksstoreregistry --expose-token --query accessToken -o tsv)
          echo "::add-mask::$TOKEN"
          echo "ACR_TOKEN=$TOKEN" >> $GITHUB_ENV

      - name: 🎭 Deploy to Staging over SSH
        uses: appleboy/ssh-action@v1
        env:
          ACR_TOKEN: ${{ env.ACR_TOKEN }}
          COMMIT_SHA: ${{ github.sha }}
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          envs: ACR_TOKEN,COMMIT_SHA
          script: |
            set -e
            
            echo "🔐 Logging into ACR with OIDC token..."
            echo "$ACR_TOKEN" | docker login netiksstoreregistry.azurecr.io -u 00000000-0000-0000-0000-000000000000 --password-stdin
            
            cd /home/deploy/netiks_store-staging
            
            echo "📥 Fetching latest main branch..."
            git fetch origin main
            git checkout --force main
            git reset --hard origin/main
            
            echo "🏷️ Setting image tag to commit SHA: $COMMIT_SHA"
            export IMAGE_TAG="$COMMIT_SHA"
            export REGISTRY="netiksstoreregistry.azurecr.io"
            
            echo "📦 Pulling SHA-tagged images..."
            docker compose \
              -p netiks_staging \
              -f docker-compose.yml \
              -f docker-compose.staging.yml \
              pull
            
            echo "🚀 Starting staging services..."
            docker compose \
              -p netiks_staging \
              -f docker-compose.yml \
              -f docker-compose.staging.yml \
              up -d
            
            echo "✅ Staging deployment complete!"
            docker compose -p netiks_staging ps
```

**Key Elements:**
- `needs: build-and-push` = Waits for images to be built
- `if: github.ref == 'refs/heads/main'` = Only runs for pushes to main (not tags)
- `environment: staging` = Uses staging GitHub environment
- `github.sha` = Current commit SHA
- `-p netiks_staging` = Docker Compose project name (isolates from production)
- `IMAGE_TAG="$COMMIT_SHA"` = Uses SHA-tagged images

### Action: Save the Workflow File

Press `Ctrl+S` to save.

**[PLACEHOLDER: Screenshot of updated build-and-push.yml showing deploy-staging job]**

---

## Step 3: Commit and Push Workflow Changes

### Action: Stage the Workflow File

```bash
git add .github/workflows/build-and-push.yml
```

### Action: Commit Changes

```bash
git commit -m "feat: Add automatic staging deployment

- Deploy to staging automatically after build-and-push
- Only runs for pushes to main branch (not tags)
- Uses SHA-tagged images from build job
- Isolated Docker Compose project: netiks_staging"
```

### Action: Push to GitHub

```bash
git push origin main
```

**Expected Output:**
```
Enumerating objects: 7, done.
Counting objects: 100% (7/7), done.
Delta compression using up to 8 threads
Compressing objects: 100% (4/4), done.
Writing objects: 100% (4/4), 789 bytes | 789.00 KiB/s, done.
Total 4 (delta 3), reused 0 (delta 0), pack-reused 0
To github.com:your-org/netiks_store.git
   def5678..ghi9012  main -> main
```

---

## Step 4: Monitor GitHub Actions Workflow

### Action: Open GitHub Actions in Browser

1. Navigate to: `https://github.com/<YOUR_ORG>/netiks_store/actions`
2. Click on the latest workflow run (should be running now)

### Action: Watch the Workflow Execute

You should see these jobs running in sequence:

```
1. 🔍 Validate Code Quality
2. 🐳 Build and Push Images (7 services in parallel)
3. 🎭 Deploy to Staging (NEW!)
```

**[PLACEHOLDER: Screenshot of GitHub Actions showing deploy-staging job running]**

---

## Step 5: Verify Staging Deployment Success

### Action: Click on deploy-staging Job

In GitHub Actions, click the `🎭 Deploy to Staging` job to see logs.

**Expected logs should show:**
```
🔐 Logging into ACR with OIDC token...
Login Succeeded

📥 Fetching latest main branch...
Already up to date.

🏷️ Setting image tag to commit SHA: abc1234567890

📦 Pulling SHA-tagged images...
Pulling web              ... done
Pulling gateway          ... done
Pulling identity-service ... done
Pulling vendor-service   ... done
Pulling catalog-service  ... done
Pulling media-service    ... done
Pulling admin-service    ... done

🚀 Starting staging services...
Creating network "netiks_staging_default" ...
Creating netiks_staging_postgres_1        ... done
Creating netiks_staging_redis_1           ... done
Creating netiks_staging_identity-service_1 ... done
Creating netiks_staging_vendor-service_1   ... done
Creating netiks_staging_catalog-service_1  ... done
Creating netiks_staging_media-service_1    ... done
Creating netiks_staging_gateway_1          ... done
Creating netiks_staging_web_1              ... done

✅ Staging deployment complete!

NAME                               IMAGE                                                  STATUS
netiks_staging_web_1              netiksstoreregistry.azurecr.io/web:abc1234567890      Up 10 seconds
netiks_staging_gateway_1          netiksstoreregistry.azurecr.io/gateway:abc1234567890  Up 10 seconds
...
```

**[PLACEHOLDER: Screenshot of successful deploy-staging job logs]**

---

## Part 3 Question: Why does `deploy-staging` use `needs: build-and-push`?

### Answer

```yaml
deploy-staging:
  needs: build-and-push
```

**The `needs: build-and-push` dependency is critical because:**

**1. Image Availability Requirement**

```
Staging deployment pulls images:
    docker compose pull
    ↓
Pulls: netiksstoreregistry.azurecr.io/web:abc123
    ↓
These images don't exist until build-and-push creates them!

Without needs:
    deploy-staging starts immediately
    ↓
    docker compose pull fails
    ↓
    Error: "manifest not found"
    ↓
    ❌ Deployment fails

With needs:
    build-and-push completes first
    ↓
    All 7 images pushed to registry
    ↓
    deploy-staging starts
    ↓
    docker compose pull succeeds
    ↓
    ✅ Deployment succeeds
```

**2. Deployment Ordering**

```
Correct sequence:
1. Build images (build-and-push)
2. Push to registry (build-and-push)
3. Pull from registry (deploy-staging)
4. Start services (deploy-staging)

Without needs: Steps 3-4 happen before steps 1-2 = FAIL
With needs: Steps happen in correct order = SUCCESS
```

**3. SHA Tag Synchronization**

```
Commit abc123 pushed to main
    ↓
build-and-push job:
    Builds web:abc123
    Pushes web:abc123 to registry
    ↓
deploy-staging job (needs: build-and-push):
    IMAGE_TAG=abc123
    Pulls web:abc123 (exists!)
    ✅ Correct image deployed

Without needs:
    deploy-staging might run before images exist
    ❌ Wrong image or failure
```

**4. Build Failure Protection**

```
Scenario: Build fails due to syntax error

With needs:
    build-and-push: FAILED
    ↓
    deploy-staging: SKIPPED (needs not met)
    ↓
    Staging stays at previous version
    ✅ Safe

Without needs:
    build-and-push: FAILED
    deploy-staging: RUNS ANYWAY
    ↓
    Tries to pull non-existent images
    ❌ Confusing failure
```

**5. Dependency Visualization**

```
GitHub Actions shows:
    ┌─────────────────┐
    │   validate      │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ build-and-push  │  ← Build 7 images
    └────────┬────────┘
             │ needs: build-and-push
             ▼
    ┌─────────────────┐
    │ deploy-staging  │  ← Pull those 7 images
    └─────────────────┘

Clear dependency graph
```

**Summary:**
> `needs: build-and-push` ensures images are built and pushed to the registry BEFORE staging tries to pull and deploy them. Without it, staging would try to pull images that don't exist yet, causing deployment failures.

---

---

# PART 4: Configure GitHub Staging Environment

Create a GitHub Environment for staging with deployment credentials.

---

## Step 1: Create Staging Environment in GitHub

### Action: Navigate to GitHub Repository Settings

1. Open browser to: `https://github.com/<YOUR_ORG>/netiks_store`
2. Click **Settings** (top navigation bar)
3. Click **Environments** (left sidebar)

**[PLACEHOLDER: Screenshot of GitHub repository Settings page with Environments highlighted]**

---

### Action: Create New Environment

1. Click **New environment** button (green button)
2. Enter name: `staging`
3. Click **Configure environment**

**[PLACEHOLDER: Screenshot of "New environment" dialog with "staging" entered]**

---

## Step 2: Configure Staging Environment (No Approval Required)

You're now on the staging environment configuration page.

### Action: Verify No Required Reviewers

**DO NOT add required reviewers for staging.**

Staging should deploy automatically without approval.

**Verify:**
- "Required reviewers" section should remain empty
- No checkboxes selected

**Why no approval for staging:**
- Fast feedback loop needed
- No real users affected
- Encourages frequent testing

**[PLACEHOLDER: Screenshot showing staging environment with NO required reviewers configured]**

---

## Step 3: Add Staging Environment Secrets

Staging will use the same VM and deploy user as production, so the secrets are identical.

### Action: Add DEPLOY_SSH_KEY Secret

1. Scroll down to "Environment secrets" section
2. Click **Add secret** button
3. Enter Name: `DEPLOY_SSH_KEY`
4. Value: Contents of your `netiks_deploy_key` private key file
   ```bash
   # On your laptop, display the key:
   cat netiks_deploy_key
   
   # Copy entire output including:
   # -----BEGIN OPENSSH PRIVATE KEY-----
   # ... key contents ...
   # -----END OPENSSH PRIVATE KEY-----
   ```
5. Click **Add secret**

---

### Action: Add DEPLOY_HOST Secret

1. Click **Add secret** again
2. Enter Name: `DEPLOY_HOST`
3. Value: Your VM public IP (e.g., `20.29.81.166`)
4. Click **Add secret**

---

### Action: Add DEPLOY_USER Secret

1. Click **Add secret** again
2. Enter Name: `DEPLOY_USER`
3. Value: `deploy`
4. Click **Add secret**

---

### Action: Verify All Three Secrets Are Added

The "Environment secrets" section should now show:
- `DEPLOY_SSH_KEY`
- `DEPLOY_HOST`
- `DEPLOY_USER`

**[PLACEHOLDER: Screenshot of staging environment showing three secret NAMES only (not values)]**

---

## Part 4 Question: What prevents the staging deployment from changing the production containers?

### Answer

**Five layers of isolation prevent staging from affecting production:**

### 1. Docker Compose Project Name

```yaml
# Production deployment:
docker compose up -d
# Default project name: netiks_store (from directory name)
# Containers: netiks_store_web_1, netiks_store_gateway_1

# Staging deployment:
docker compose -p netiks_staging up -d
# Project name: netiks_staging (explicitly set)
# Containers: netiks_staging_web_1, netiks_staging_gateway_1

Result:
    Production containers: netiks_store_*
    Staging containers: netiks_staging_*
    ✅ Completely separate
```

### 2. Separate Working Directories

```bash
Production:
    Working directory: /home/deploy/netiks_store
    docker-compose.yml path: /home/deploy/netiks_store/docker-compose.yml
    .env path: /home/deploy/netiks_store/.env

Staging:
    Working directory: /home/deploy/netiks_store-staging
    docker-compose.yml path: /home/deploy/netiks_store-staging/docker-compose.yml
    .env path: /home/deploy/netiks_store-staging/.env

Result:
    Different configuration files loaded
    Different environment variables used
    ✅ Isolated configurations
```

### 3. Separate Ports

```bash
# Production .env:
WEB_EXPOSE_PORT=3001
GATEWAY_EXPOSE_PORT=8000

# Staging .env:
WEB_EXPOSE_PORT=3002
GATEWAY_EXPOSE_PORT=8100

Result:
    Production web: localhost:3001 → container:3000
    Staging web: localhost:3002 → container:3000
    ✅ No port conflicts
```

### 4. Separate Docker Networks

```bash
# Docker Compose creates isolated networks per project

Production network:
    netiks_store_default
    └─ Contains: web, gateway, postgres, redis (production)

Staging network:
    netiks_staging_default
    └─ Contains: web, gateway, postgres, redis (staging)

Result:
    Services cannot communicate across networks
    Production database isolated from staging
    ✅ Network isolation
```

### 5. Separate Database Volumes

```bash
# Production .env:
POSTGRES_DB=netiks_store

# Staging .env:
POSTGRES_DB=netiks_store_staging

# Docker creates separate volumes:
Production volume: netiks_store_postgres_data
    └─ Contains: netiks_store database

Staging volume: netiks_staging_postgres_data
    └─ Contains: netiks_store_staging database

Result:
    Different database files
    Different data
    ✅ Data isolation
```

---

### How Isolation Works in Practice

**When staging deploys:**

```bash
cd /home/deploy/netiks_store-staging  # ← Different directory
export IMAGE_TAG="abc123"             # ← SHA-tagged image
export REGISTRY="netiksstoreregistry.azurecr.io"

docker compose \
  -p netiks_staging \                # ← Different project name
  -f docker-compose.yml \
  -f docker-compose.staging.yml \    # ← Staging config
  up -d

Docker Compose:
1. Reads .env from /home/deploy/netiks_store-staging
2. Creates containers with netiks_staging_ prefix
3. Uses WEB_EXPOSE_PORT=3002 from staging .env
4. Connects to netiks_store_staging database
5. Creates netiks_staging_default network
6. Starts staging containers

Production containers completely unaware!
```

**When production deploys:**

```bash
cd /home/deploy/netiks_store          # ← Different directory
export IMAGE_TAG="v1.3.0"             # ← Version tag

docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \         # ← Production config
  up -d                                # ← Default project (netiks_store)

Docker Compose:
1. Reads .env from /home/deploy/netiks_store
2. Creates containers with netiks_store_ prefix
3. Uses WEB_EXPOSE_PORT=3001 from production .env
4. Connects to netiks_store database
5. Uses netiks_store_default network
6. Starts production containers

Staging containers completely unaware!
```

---

### Verification Test

```bash
# List all containers:
docker ps --format "table {{.Names}}\t{{.Ports}}"

Output:
NAME                          PORTS
netiks_store_web_1           0.0.0.0:3001->3000/tcp    ← Production
netiks_store_gateway_1       0.0.0.0:8000->8000/tcp    ← Production
netiks_staging_web_1         0.0.0.0:3002->3000/tcp    ← Staging
netiks_staging_gateway_1     0.0.0.0:8100->8000/tcp    ← Staging

✅ Different names, different ports, complete isolation
```

---

### Summary: Five Isolation Layers

| Isolation Layer | Production | Staging | Prevents |
|----------------|-----------|---------|----------|
| **Project Name** | netiks_store | netiks_staging | Container name conflicts |
| **Directory** | /home/deploy/netiks_store | /home/deploy/netiks_store-staging | Config file conflicts |
| **Ports** | 3001, 8000 | 3002, 8100 | Port conflicts |
| **Network** | netiks_store_default | netiks_staging_default | Service cross-talk |
| **Database** | netiks_store | netiks_store_staging | Data conflicts |

**Conclusion:**
> The Docker Compose project name (`-p netiks_staging`) combined with separate directories, ports, networks, and database volumes creates complete isolation. Staging deployments cannot affect production containers, data, or configuration.

---

---

# PART 5: Configure Staging Access via Nginx

Configure Nginx to route traffic to staging on port 8080 while production remains on port 80.

---

## Step 1: SSH into VM

```bash
ssh azureuser@<YOUR_VM_IP>
```

---

## Step 2: Create Nginx Staging Configuration

### Action: Create Staging Site Configuration

```bash
sudo nano /etc/nginx/sites-available/netiks_store_staging
```

This opens nano text editor.

---

### Action: Paste This Configuration

```nginx
server {
    listen 8080;
    server_name _;

    client_max_body_size 20M;

    # API Gateway for staging
    location /api/ {
        proxy_pass http://127.0.0.1:8100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Web frontend for staging
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Key points:**
- `listen 8080` = Staging accessible on port 8080
- `/api/` → `http://127.0.0.1:8100` = Staging gateway port
- `/` → `http://127.0.0.1:3002` = Staging web port
- Production still uses port 80 (unchanged)

---

### Action: Save the File

In nano:
1. Press `Ctrl+X`
2. Press `Y` to confirm
3. Press `Enter`

**Expected output:**
```
File written
```

**[PLACEHOLDER: Screenshot of Nginx staging configuration in nano editor]**

---

## Step 3: Enable Staging Site

### Action: Create Symbolic Link

```bash
sudo ln -s /etc/nginx/sites-available/netiks_store_staging /etc/nginx/sites-enabled/
```

This activates the staging configuration.

---

### Action: Verify Symbolic Link

```bash
ls -la /etc/nginx/sites-enabled/
```

**Expected output:**
```
lrwxrwxrwx 1 root root   51 Sep 20 12:00 netiks_store -> /etc/nginx/sites-available/netiks_store
lrwxrwxrwx 1 root root   59 Sep 20 12:05 netiks_store_staging -> /etc/nginx/sites-available/netiks_store_staging
```

**[PLACEHOLDER: Screenshot showing both production and staging Nginx site links]**

---

## Step 4: Test Nginx Configuration

### Action: Validate Nginx Config

```bash
sudo nginx -t
```

**Expected output:**
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

**If you see errors:**
- Check for typos in the config file
- Verify ports match your staging .env
- Re-edit: `sudo nano /etc/nginx/sites-available/netiks_store_staging`

**[PLACEHOLDER: Screenshot of successful `sudo nginx -t` output]**

---

## Step 5: Reload Nginx

### Action: Reload Nginx to Apply Changes

```bash
sudo systemctl reload nginx
```

**Expected output:**
```
(no output = success)
```

---

### Action: Verify Nginx is Running

```bash
sudo systemctl status nginx
```

**Expected output:**
```
● nginx.service - A high performance web server and a reverse proxy server
     Loaded: loaded (/lib/systemd/system/nginx.service; enabled; vendor preset: enabled)
     Active: active (running) since ...
```

Press `q` to exit.

**[PLACEHOLDER: Screenshot of nginx status showing active (running)]**

---

## Step 6: Open Port 8080 in Azure NSG

### Action: Navigate to Azure Portal

1. Open browser to: `https://portal.azure.com`
2. Navigate to: Virtual Machines → Your VM → Networking
3. Click **Network settings** (left sidebar)

---

### Action: Add Inbound Port Rule

1. Click **Create port rule** button
2. Select **Inbound port rule**
3. Configure:
   - **Source:** IP Addresses (or Any for testing)
   - **Source IP addresses/CIDR ranges:** Your IP or leave blank
   - **Source port ranges:** *
   - **Destination:** Any
   - **Service:** Custom
   - **Destination port ranges:** `8080`
   - **Protocol:** TCP
   - **Action:** Allow
   - **Priority:** `1030` (or next available)
   - **Name:** `Allow_Staging_8080`
   - **Description:** "Allow access to staging environment"
4. Click **Add**

**[PLACEHOLDER: Screenshot of Azure NSG inbound rule for port 8080]**

---

### Action: Verify Port is Open

Wait 30 seconds for Azure to apply the rule, then test:

```bash
# On your laptop:
curl http://<YOUR_VM_IP>:8080/api/v1/system/services
```

**Expected output:**
```json
{
  "status": "ok",
  "services": [
    {"name": "identity-service", "url": "http://identity-service:8001"},
    {"name": "vendor-service", "url": "http://vendor-service:8002"},
    {"name": "catalog-service", "url": "http://catalog-service:8003"},
    {"name": "media-service", "url": "http://media-service:8004"}
  ]
}
```

**If connection refused:**
- Verify Azure NSG rule is saved
- Check Nginx is running: `sudo systemctl status nginx`
- Verify staging containers are running: `docker compose -p netiks_staging ps`

**[PLACEHOLDER: Screenshot of successful curl to staging API endpoint]**

---

## Part 5 Deliverables Checklist

- [✅] Nginx staging configuration created
- [✅] nginx -t test passed
- [✅] Nginx reloaded successfully
- [✅] Azure NSG rule for port 8080 created
- [✅] Staging endpoint accessible via port 8080

---

---

# PART 6: Test the Complete Flow

Now test the complete staging-to-production workflow.

---

## Test 6.1: Deploy to Staging

Make a visible change to test the staging deployment.

---

### Step 1: Make Visible Application Change

On your laptop, open the home page:

```
g:\projects\netiks_store_wk4\apps\web\src\app\page.tsx
```

### Action: Add Version Indicator

Find the return statement and add a visible version banner.

**Add this near the top of the JSX (around line 10-15):**

```tsx
export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Version indicator for Week 6 testing */}
      <div className="bg-blue-600 text-white text-center py-2 text-sm font-semibold">
        🎭 STAGING VERSION - Week 6 Lab - Commit: {process.env.NEXT_PUBLIC_COMMIT_SHA || 'latest'}
      </div>
      
      {/* Rest of your existing JSX */}
      <header>
        ...
      </header>
    </div>
  );
}
```

### Action: Save the File

Press `Ctrl+S`.

**[PLACEHOLDER: Screenshot of page.tsx with version indicator added]**

---

### Step 2: Commit and Push to Main

### Action: Stage and Commit Changes

```bash
cd g:\projects\netiks_store_wk4

git add apps/web/src/app/page.tsx
git commit -m "feat: Add staging version indicator for Week 6 testing"
```

### Action: Push to GitHub

```bash
git push origin main
```

**Expected output:**
```
Enumerating objects: 9, done.
Counting objects: 100% (9/9), done.
Delta compression using up to 8 threads
Compressing objects: 100% (5/5), done.
Writing objects: 100% (5/5), 567 bytes | 567.00 KiB/s, done.
Total 5 (delta 4), reused 0 (delta 0), pack-reused 0
To github.com:your-org/netiks_store.git
   ghi9012..jkl3456  main -> main
```

**[PLACEHOLDER: Screenshot of git push output]**

---

### Step 3: Monitor GitHub Actions Workflow

### Action: Open GitHub Actions

Navigate to: `https://github.com/<YOUR_ORG>/netiks_store/actions`

### Action: Watch Workflow Execute

The workflow should run automatically with these jobs:

```
1. 🔍 Validate Code Quality
2. 🐳 Build and Push Images (7 services)
3. 🎭 Deploy to Staging ← Automatic!
```

**Note:** The `🚀 Deploy to Production` job should NOT run (no version tag).

**[PLACEHOLDER: Screenshot of GitHub Actions showing deploy-staging running automatically]**

---

### Step 4: Verify Staging Deployment

### Action: Wait for Staging Deployment to Complete

Watch the deploy-staging job logs until you see:

```
✅ Staging deployment complete!
docker compose -p netiks_staging ps

NAME                               IMAGE                                                STATUS
netiks_staging_web_1              netiksstoreregistry.azurecr.io/web:jkl3456           Up 10 seconds
netiks_staging_gateway_1          netiksstoreregistry.azurecr.io/gateway:jkl3456       Up 10 seconds
...
```

**[PLACEHOLDER: Screenshot of successful staging deployment logs]**

---

### Step 5: Test Staging Application

### Action: Open Staging in Browser

Navigate to: `http://<YOUR_VM_IP>:8080/`

Example: `http://20.29.81.166:8080/`

**You should see:**
- ✅ Blue banner with "🎭 STAGING VERSION - Week 6 Lab"
- ✅ Application loads normally
- ✅ Products visible (if seeded)

**[PLACEHOLDER: Screenshot of staging application showing version indicator]**

---

### Step 6: Verify Production is Unchanged

### Action: Open Production in Browser

Navigate to: `http://<YOUR_VM_IP>/`

Example: `http://20.29.81.166/`

**You should see:**
- ✅ NO blue version banner
- ✅ Application unchanged from previous version
- ✅ Old version still running

**[PLACEHOLDER: Screenshot of production showing NO version indicator (unchanged)]**

---

## Test 6.2: Promote to Production

Now follow the Week 5 release process to deploy to production.

---

### Step 1: Update Production Version in docker-compose.prod.yml

On your laptop, open:

```
g:\projects\netiks_store_wk4\docker-compose.prod.yml
```

### Action: Update All Image Tags

Change all versions from current (e.g., `v1.2.0`) to new version (`v1.3.0`):

**Update these services:**

```yaml
services:
  web:
    image: netiksstoreregistry.azurecr.io/web:v1.3.0
    pull_policy: always
  
  gateway:
    image: netiksstoreregistry.azurecr.io/gateway:v1.3.0
    pull_policy: always
  
  identity-service:
    image: netiksstoreregistry.azurecr.io/identity-service:v1.3.0
    pull_policy: always
  
  vendor-service:
    image: netiksstoreregistry.azurecr.io/vendor-service:v1.3.0
    pull_policy: always
  
  catalog-service:
    image: netiksstoreregistry.azurecr.io/catalog-service:v1.3.0
    pull_policy: always
  
  media-service:
    image: netiksstoreregistry.azurecr.io/media-service:v1.3.0
    pull_policy: always
  
  admin-service:
    image: netiksstoreregistry.azurecr.io/admin-service:v1.3.0
    pull_policy: always
```

### Action: Save docker-compose.prod.yml

Press `Ctrl+S`.

**[PLACEHOLDER: Screenshot of updated docker-compose.prod.yml with v1.3.0]**

---

### Step 2: Commit Production Version

### Action: Stage and Commit

```bash
git add docker-compose.prod.yml
git commit -m "release: v1.3.0"
```

---

### Step 3: Create Version Tag

### Action: Tag the Release

```bash
git tag v1.3.0
```

---

### Step 4: Push Tag to GitHub

### Action: Push Main and Tags

```bash
git push origin main --tags
```

**Expected output:**
```
Enumerating objects: 5, done.
Counting objects: 100% (5/5), done.
Delta compression using up to 8 threads
Compressing objects: 100% (3/3), done.
Writing objects: 100% (3/3), 345 bytes | 345.00 KiB/s, done.
Total 3 (delta 2), reused 0 (delta 0), pack-reused 0
To github.com:your-org/netiks_store.git
   jkl3456..mno7890  main -> main
 * [new tag]         v1.3.0 -> v1.3.0
```

**[PLACEHOLDER: Screenshot of git push with tag]**

---

### Step 5: Monitor Production Deployment Workflow

### Action: Open GitHub Actions

The workflow should now run with ALL jobs:

```
1. 🔍 Validate Code Quality
2. 🐳 Build and Push Images
3. 🎭 Deploy to Staging (automatic)
4. 🚀 Deploy to Production (waiting for approval) ← NEW!
```

**[PLACEHOLDER: Screenshot showing production deployment waiting for approval]**

---

### Step 6: Approve Production Deployment

### Action: Review and Approve

1. Click **Review deployments** button in GitHub Actions
2. Check the `production` checkbox
3. Optional: Add approval comment: "Tested in staging, ready for production"
4. Click **Approve and deploy**

**[PLACEHOLDER: Screenshot of production approval dialog]**

---

### Step 7: Monitor Production Deployment

Watch the production deployment logs until complete:

```
🚀 Deploying version: v1.3.0

📥 Checking out v1.3.0...
Already up to date.

📦 Pulling v1.3.0 images...
Pulling web              ... done
Pulling gateway          ... done
...

🚀 Starting production services...
Recreating netiks_store_web_1      ... done
Recreating netiks_store_gateway_1  ... done
...

✅ Production deployment complete!
```

**[PLACEHOLDER: Screenshot of successful production deployment]**

---

### Step 8: Verify Production Has the Change

### Action: Open Production in Browser

Navigate to: `http://<YOUR_VM_IP>/`

**You should now see:**
- ✅ Blue banner with "🎭 STAGING VERSION"
- ✅ Version indicator visible
- ✅ Same as staging

**[PLACEHOLDER: Screenshot of production showing version indicator (now deployed)]**

---

### Step 9: Verify Staging Still Running

### Action: Open Staging in Browser

Navigate to: `http://<YOUR_VM_IP>:8080/`

**You should see:**
- ✅ Staging still accessible
- ✅ Version indicator still visible
- ✅ Running independently

**[PLACEHOLDER: Screenshot of staging still running after production deployment]**

---

## Test 6.3: Verify Isolation Between Environments

Test that staging and production are truly isolated.

---

### Step 1: Check Both Environments Running

### Action: SSH into VM

```bash
ssh azureuser@<YOUR_VM_IP>
```

### Action: List Staging Containers

```bash
docker compose -p netiks_staging ps
```

**Expected output:**
```
NAME                               IMAGE                                                STATUS          PORTS
netiks_staging_web_1              netiksstoreregistry.azurecr.io/web:jkl3456          Up 30 minutes   0.0.0.0:3002->3000/tcp
netiks_staging_gateway_1          netiksstoreregistry.azurecr.io/gateway:jkl3456      Up 30 minutes   0.0.0.0:8100->8000/tcp
netiks_staging_identity-service_1 netiksstoreregistry.azurecr.io/identity-service:jkl3456 Up 30 minutes 0.0.0.0:8101->8001/tcp
...
```

**[PLACEHOLDER: Screenshot of docker compose -p netiks_staging ps output]**

---

### Action: List Production Containers

```bash
docker compose ps
```

**Expected output:**
```
NAME                          IMAGE                                              STATUS          PORTS
netiks_store_web_1           netiksstoreregistry.azurecr.io/web:v1.3.0         Up 10 minutes   0.0.0.0:3001->3000/tcp
netiks_store_gateway_1       netiksstoreregistry.azurecr.io/gateway:v1.3.0     Up 10 minutes   0.0.0.0:8000->8000/tcp
netiks_store_identity-service_1 netiksstoreregistry.azurecr.io/identity-service:v1.3.0 Up 10 minutes 0.0.0.0:8001->8001/tcp
...
```

**[PLACEHOLDER: Screenshot of docker compose ps output for production]**

---

### Step 2: Stop Staging Web Service

### Action: Stop Only Staging Web Container

```bash
docker compose -p netiks_staging stop web
```

**Expected output:**
```
Stopping netiks_staging_web_1 ... done
```

---

### Action: Verify Staging Web is Stopped

```bash
docker compose -p netiks_staging ps web
```

**Expected output:**
```
NAME                  IMAGE                                    STATUS
netiks_staging_web_1  netiksstoreregistry.azurecr.io/web:...  Exited (0) 5 seconds ago
```

---

### Step 3: Verify Production Still Works

### Action: Check Production Web is Running

```bash
docker compose ps web
```

**Expected output:**
```
NAME                IMAGE                                         STATUS
netiks_store_web_1  netiksstoreregistry.azurecr.io/web:v1.3.0    Up 15 minutes
```

**[PLACEHOLDER: Screenshot showing staging web stopped but production web running]**

---

### Action: Test Production in Browser

Open: `http://<YOUR_VM_IP>/`

**You should see:**
- ✅ Production works perfectly
- ✅ Application loads
- ✅ No errors

**[PLACEHOLDER: Screenshot of production working while staging web is stopped]**

---

### Action: Test Staging Fails

Open: `http://<YOUR_VM_IP>:8080/`

**You should see:**
- ❌ "502 Bad Gateway" or connection error
- ❌ Nginx cannot reach staging web service

This proves staging and production are isolated.

---

### Step 4: Restore Staging

### Action: Start Staging Web Again

```bash
docker compose -p netiks_staging start web
```

**Expected output:**
```
Starting netiks_staging_web_1 ... done
```

---

### Action: Verify Staging Works Again

Open: `http://<YOUR_VM_IP>:8080/`

**You should see:**
- ✅ Staging restored
- ✅ Application loads
- ✅ Version indicator visible

**[PLACEHOLDER: Screenshot of staging working after being restarted]**

---

## Part 6 Deliverables Checklist

- [✅] Screenshot of automatic staging deployment
- [✅] Screenshot showing change in staging
- [✅] Screenshot showing change NOT in production (before promotion)
- [✅] Screenshot of production approval
- [✅] Screenshot of successful production deployment
- [✅] Screenshot showing change NOW in production (after promotion)
- [✅] `docker compose -p netiks_staging ps` output
- [✅] `docker compose ps` output (production)
- [✅] Screenshot of isolation test (staging stopped, production working)

---

---

# 🎉 FINAL DELIVERABLES CHECKLIST

Use this comprehensive checklist to ensure you have all required materials before submission.

---

## Part 1: Understand the Basics ✅

- [ ] **Question 1.1:** Why CI build not enough for production?
  - Answer includes: runtime behavior, integration issues, performance problems
  
- [ ] **Question 1.2:** Why staging should use exact SHA-tagged images?
  - Answer includes: image drift, test confidence, traceability
  
- [ ] **Question 1.3:** Why staging auto-deploys but production needs approval?
  - Answer includes: risk profiles, fast feedback, human oversight

---

## Part 2: Prepare Staging Environment ✅

- [ ] Evidence of staging directory created: `/home/deploy/netiks_store-staging`
- [ ] Screenshot showing both directories exist (`ls -la /home/deploy/`)
- [ ] `docker-compose.staging.yml` created with SHA-tagged images
- [ ] `docker-compose.yml` updated with port environment variables
- [ ] Staging `.env` file created with different credentials
- [ ] Verified staging uses different `POSTGRES_DB` name
- [ ] Verified staging uses different `JWT_SECRET`
- [ ] Configuration files committed to Git

---

## Part 3: Add Staging Deployment Job ✅

- [ ] Updated `.github/workflows/build-and-push.yml` with `deploy-staging` job
- [ ] Screenshot of successful `build-and-push` job
- [ ] Screenshot of automatic `deploy-staging` job running
- [ ] **Answer:** Why `deploy-staging` needs `build-and-push`
  - Answer includes: image availability, dependency chain, build failure protection

---

## Part 4: Configure GitHub Staging Environment ✅

- [ ] Screenshot of `staging` environment in GitHub
- [ ] Screenshot showing three secret names: `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`
- [ ] **Important:** Do NOT show secret values
- [ ] Verified no required reviewers configured for staging
- [ ] **Answer:** What prevents staging from changing production?
  - Answer includes: project name, directories, ports, networks, volumes

---

## Part 5: Configure Staging Access ✅

- [ ] Nginx staging configuration created (`/etc/nginx/sites-available/netiks_store_staging`)
- [ ] Successful `nginx -t` output screenshot
- [ ] Nginx reloaded successfully
- [ ] Azure NSG rule screenshot showing port 8080 allowed
- [ ] Staging endpoint accessible via `curl http://<VM_IP>:8080/api/v1/system/services`

---

## Part 6: Test Complete Flow ✅

### 6.1 - Deploy to Staging

- [ ] Screenshot of visible application change (version indicator)
- [ ] Screenshot of automatic staging deployment in GitHub Actions
- [ ] Screenshot of staging application showing the change (`http://<VM_IP>:8080/`)
- [ ] Screenshot of production showing NO change yet (`http://<VM_IP>/`)

### 6.2 - Promote to Production

- [ ] Screenshot of updated `docker-compose.prod.yml` with v1.3.0
- [ ] Screenshot of git commit for release
- [ ] Screenshot of production deployment waiting for approval
- [ ] Screenshot of approval dialog
- [ ] Screenshot of successful production deployment
- [ ] Screenshot of production now showing the change (`http://<VM_IP>/`)
- [ ] Screenshot of staging still running independently

### 6.3 - Verify Isolation

- [ ] Screenshot of `docker compose -p netiks_staging ps` output
- [ ] Screenshot of `docker compose ps` output (production)
- [ ] Screenshot showing staging web stopped
- [ ] Screenshot showing production still working
- [ ] Screenshot of staging restored

---

## Summary Verification ✅

- [ ] All 11 questions answered completely
- [ ] All placeholders replaced with actual screenshots
- [ ] All code blocks show actual values (not templates)
- [ ] Git commits show your actual repository
- [ ] Screenshots show your actual VM IP
- [ ] All images are clear and readable

---

## Document Format ✅

- [ ] Document saved as PDF
- [ ] Filename: `Week6_<FirstName>_<LastName>.pdf`
- [ ] Table of contents included (optional but recommended)
- [ ] Screenshots have captions/labels
- [ ] Code blocks are properly formatted
- [ ] Questions are clearly marked and answered

---

## Final Workflow Verification ✅

**Confirm this flow works:**

```
Push to main
    ↓
CI builds and pushes SHA images ✅
    ↓
Staging auto-deploys (no approval) ✅
    ↓
Test change in staging ✅
    ↓
Create version tag ✅
    ↓
Production requires approval ✅
    ↓
Production deploys after approval ✅
    ↓
Both environments run independently ✅
```

---

# 📧 SUBMISSION

## Before Submitting

- [ ] Review entire document for completeness
- [ ] Verify all screenshots are visible and clear
- [ ] Check all questions are answered
- [ ] Confirm code samples are accurate
- [ ] Test all URLs and commands shown in document
- [ ] Spell-check the document

---

## Submit To

**Email addresses:**
- **To:** shulammite.odde@cognetiks.com
- **CC:** flora.owhiroro@cognetiks.com

**Subject line:**
```
Week 6 Lab Submission - <Your Full Name>
```

**Email body:**
```
Dear Instructor,

Please find attached my Week 6 Lab submission:
Week6_<FirstName>_<LastName>.pdf

This lab demonstrates:
- Staging environment setup with complete isolation
- Automatic staging deployment on every main push
- Production deployment via version tags with approval
- Both environments running side-by-side on the same VM

All deliverables are included as per the checklist.

Best regards,
<Your Name>
```

**Attachment:**
- `Week6_<FirstName>_<LastName>.pdf`

**Deadline:** Friday, 25 September, 5:00 PM

---

# 🎯 WHAT YOU'VE ACCOMPLISHED

By completing Week 6, you have successfully:

## Technical Achievements

✅ **Staging Environment**
- Separate working directory for staging
- SHA-tagged images deployed automatically
- No manual approval needed
- Fast feedback loop for developers

✅ **Production Safety**
- Still requires human approval
- Uses version-tagged images
- Tested in staging first
- Controlled deployment timing

✅ **Complete Isolation**
- Separate Docker Compose projects
- Separate ports (3002 vs 3001, 8100 vs 8000)
- Separate databases (netiks_store_staging vs netiks_store)
- Separate networks
- Separate environment variables

✅ **CI/CD Pipeline**
- Automated staging on every commit
- Manual production on version tags
- Full traceability with SHA tags
- Rollback capability maintained

## Workflow Mastery

```
Developer Experience:
    Commit code → Staging auto-deploys (3 min) → Test immediately
    ↓
    Iterate rapidly
    ↓
    Create version tag → Production approval → Deploy

Result:
    - Fast iteration in staging
    - Thorough testing before production
    - Confidence in deployments
    - Happy users (fewer bugs!)
```

---

## Next Steps (Week 7+)

Future enhancements might include:
- Multiple staging environments (per-feature)
- Automated testing in staging
- Blue-green deployments
- Canary releases
- Pull-based deployment (GitOps)

---

**Congratulations on completing Week 6! You now have a production-grade staging environment! 🚀**

---

**End of Week 6 Implementation Guide**
