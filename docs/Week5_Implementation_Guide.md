# 🚀 Netiks Store - Week 5 Lab: CI/CD Deployment Pipeline
## Complete Step-by-Step Implementation Guide

**Date:** September 2026  
**Lab Duration:** 1 week  
**Submission Deadline:** Friday, 18 September, 5:00 PM  
**Prerequisite:** Week 4 Lab (OIDC setup with working CI/CD pipeline)

---

## Executive Summary

In Week 4, your CI/CD pipeline built and pushed Docker images to Azure Container Registry. However, deployment to production was still manual—you had to SSH into the VM and run Docker Compose commands.

**Week 5 Goal:** Fully automate the deployment pipeline so that pushing a version tag triggers a complete, approved deployment to production with the ability to rollback to previous versions.

**What you'll build:**
- Dedicated deployment account on VM (security best practice)
- GitHub Environment with approval gates
- Automated SSH deployment from GitHub Actions
- Manual rollback capability through `workflow_dispatch`

---

# PART 1: Understand the Basics

## Question 1: Which manual commands from Week 4 Part 6 are being replaced by automation this week?

### Answer

The following manual commands from Week 4 Part 6 that you had to execute on the VM are being automated:

```bash
# Manual commands you had to SSH and run
git pull origin main

az acr login --name netiksstoreacr

docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  pull

docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d

docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  ps
```

**Automation this week:** GitHub Actions will SSH into the VM and execute these exact commands automatically when a version tag is pushed and approved. This eliminates the need for manual SSH access to deploy new versions.

---

## Question 2: SSH does not support OIDC. Why is storing a dedicated CI deployment key safer than reusing your personal SSH key? What should you do if the deployment key is ever leaked?

### Answer

#### Why a Dedicated Deployment Key is Safer:

1. **Principle of Least Privilege:** The deployment key only has permissions to pull the repository and run Docker Compose on the VM. Your personal SSH key has full administrative access to the VM.

2. **Scope Limitation:** If the deployment key is compromised, the attacker can only deploy applications. They cannot access your personal files, change system configurations, or perform administrative tasks.

3. **Auditability:** You can track which deployments were made with the deployment key versus your personal key.

4. **Revocation:** You can delete the deployment key from the VM without affecting your personal SSH access.

5. **Credential Rotation:** It's easier and safer to rotate a single-purpose key than to replace your main access method.

#### If the Deployment Key Is Leaked:

1. **Immediately delete** the compromised key from `/home/deploy/.ssh/authorized_keys`:
   ```bash
   sudo sed -i '/github-actions-deploy/d' /home/deploy/.ssh/authorized_keys
   ```

2. **Generate a new deployment key:**
   ```bash
   ssh-keygen -t ed25519 -f netiks_deploy_key -C "github-actions-deploy" -N ""
   ```

3. **Add the new public key** to the VM:
   ```bash
   sudo tee -a /home/deploy/.ssh/authorized_keys < netiks_deploy_key.pub
   ```

4. **Update the GitHub secret:**
   - Go to Repository → Settings → Environments → production → Secrets
   - Update `DEPLOY_SSH_KEY` with the contents of the new `netiks_deploy_key`

5. **Verify the new key works** by testing SSH access:
   ```bash
   ssh -i netiks_deploy_key deploy@<DEPLOY_HOST>
   ```

---

## Question 3: What is the difference between a push-based deployment and a pull-based deployment?

### Answer

#### Push-Based Deployment

**How it works:**
- CI/CD system (GitHub Actions) **actively connects** to the production environment
- CI/CD system **pushes changes** to the VM
- CI/CD system has credentials to access production

**Characteristics:**
- ✅ Deployment happens immediately when triggered
- ✅ Fast feedback loop
- ❌ CI/CD system needs production credentials
- ❌ Production environment must be accessible from CI/CD runner
- ❌ If CI/CD credentials are compromised, production is exposed

**Example:** GitHub Actions SSH into VM and run Docker Compose

#### Pull-Based Deployment

**How it works:**
- Production environment (VM) **actively checks** for new versions
- VM **pulls changes** from a source (Git repository, registry, configuration)
- VM has credentials to access the repository/registry
- Typically uses a controller (e.g., ArgoCD, Flux)

**Characteristics:**
- ✅ Production credentials never leave the production environment
- ✅ CI/CD system only needs to publish artifacts
- ✅ More secure for production
- ❌ Deployment has a delay (polling interval)
- ❌ Requires running a controller daemon on production

**Example:** GitOps with ArgoCD watching repository for changes

#### Comparison Table

| Factor | Push-Based | Pull-Based |
|--------|-----------|-----------|
| **Initiator** | CI/CD system | Production environment |
| **Speed** | Immediate | Delayed (polling interval) |
| **Security** | Requires CI → Prod access | No outbound access needed |
| **Credentials** | Stored in CI system | Stored on production |
| **Complexity** | Simpler setup | Requires controller |
| **Use Case** | Week 5 (Netiks) | Week 6+ (staging/prod) |

---

## Question 4: Which model are we building this week - push-based deployment or pull-based deployment?

### Answer

**We are building a PUSH-BASED deployment model.**

**Why:**
- GitHub Actions (CI/CD system) will SSH into the VM
- GitHub Actions will execute Docker Compose commands on the VM
- The VM is passive and only receives deployment commands
- This is simpler to implement for a first automated deployment

**How it works for Netiks Store:**
1. Developer pushes version tag (e.g., `v1.2.0`)
2. GitHub Actions builds and pushes images
3. GitHub Actions **pushes** deployment command to VM via SSH
4. VM executes the command and updates services

**Why not pull-based for Week 5:**
- Push-based is simpler and clearer for learning
- Pull-based will be introduced in Week 6 with staging environments
- Push-based provides immediate deployment feedback

---

---

# PART 2: Prepare the VM for Remote Deployment

## Step 1: Create Deployment User on VM

This section creates a dedicated, unprivileged deployment account for GitHub Actions to use instead of your personal account.

### Action: Create the Deployment User

SSH into your VM and execute:

```bash
# Create user without password login
sudo adduser --disabled-password deploy

# Add deploy user to docker group (allows Docker commands without sudo)
sudo usermod -aG docker deploy
```

### Expected Output:

```
[PLACEHOLDER: Screenshot showing command output]
- User deploy created successfully
- User added to docker group
```

### Verify Creation:

```bash
# Check user exists
id deploy

# Verify docker group membership
groups deploy
```

---

## Step 2: Generate Dedicated SSH Key Pair

Create a new SSH key specifically for CI/CD deployment. **Never reuse your personal SSH key.**

### Action: On Your Laptop

```bash
# Generate new SSH key pair
ssh-keygen -t ed25519 -f netiks_deploy_key -C "github-actions-deploy" -N ""
```

### What This Does:
- `-t ed25519`: Uses the Ed25519 algorithm (modern, secure)
- `-f netiks_deploy_key`: Saves key to `netiks_deploy_key` (private) and `netiks_deploy_key.pub` (public)
- `-C "github-actions-deploy"`: Adds comment for identification
- `-N ""`: No passphrase (required for CI/CD automation)

### Expected Output:

```
Generating public/private ed25519 key pair.
Your identification has been saved in netiks_deploy_key
Your public key has been saved in netiks_deploy_key.pub
```

### Verify Keys Were Created:

```bash
# Check files exist
ls -la netiks_deploy_key*

# Output should show:
# -rw------- netiks_deploy_key       (private key - readable only by you)
# -rw-r--r-- netiks_deploy_key.pub   (public key - readable by anyone)
```

---

## Step 3: Add Public Key to VM Deployment User

Add your new public key to the deployment user's `authorized_keys` file.

### Action: Copy Public Key to VM

```bash
# Create .ssh directory with proper permissions
sudo mkdir -p /home/deploy/.ssh

# Copy your public key to authorized_keys
sudo tee /home/deploy/.ssh/authorized_keys < netiks_deploy_key.pub

# Set proper ownership (deploy user owns the directory)
sudo chown -R deploy:deploy /home/deploy/.ssh

# Set proper permissions
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

### Expected Output:

```
[PLACEHOLDER: Screenshot showing command execution]
- .ssh directory created
- authorized_keys populated with public key
- Permissions set correctly
```

### Verify Permissions:

```bash
# Check directory ownership and permissions
ls -la /home/deploy/.ssh/

# Output should show:
# drwx------ deploy deploy .ssh
# -rw------- deploy deploy authorized_keys
```

[PLACEHOLDER: Screenshot of authorized_keys verification]

---

## Step 4: Verify Repository Exists for Deploy User

The deployment user needs access to the repository to check out code.

### Action: Check Repository

```bash
# Check if repository exists
ls -la /home/deploy/netiks_store

# If it doesn't exist, clone it:
sudo -u deploy git clone <your-repository-url> /home/deploy/netiks_store

# Verify deploy user owns it:
sudo chown -R deploy:deploy /home/deploy/netiks_store
```

### Expected Output:

```
[PLACEHOLDER: Screenshot showing repository exists and is owned by deploy user]
```

---

## Step 5: Test SSH Connection

Verify that you can SSH into the VM as the deployment user.

### Action: Test SSH

```bash
# Test SSH connection with the new key
ssh -i netiks_deploy_key deploy@<YOUR_VM_PUBLIC_IP>

# You should get a prompt like:
# deploy@netiks-vm:~$

# Run a test command
docker ps

# Should show running containers without sudo

# Exit the SSH session
exit
```

### Expected Output:

```
[PLACEHOLDER: Screenshot showing successful SSH login as deploy user]
[PLACEHOLDER: Screenshot showing docker ps output without sudo]
```

---

## Step 6: Configure GitHub Environment and Secrets

Create a GitHub Environment named `production` with deployment secrets.

### Action 6a: Create GitHub Environment

1. Go to GitHub → Your Repository
2. Click **Settings** (top navigation)
3. Click **Environments** (left sidebar)
4. Click **New environment**
5. Enter name: `production`
6. Click **Configure environment**

### Expected Output:

[PLACEHOLDER: Screenshot of GitHub Environments page showing "production" environment created]

---

### Action 6b: Add Environment Secrets

Now add three secrets to the `production` environment:

**Secret 1: DEPLOY_SSH_KEY**
1. Click **Add secret** under "Secrets"
2. Name: `DEPLOY_SSH_KEY`
3. Value: Contents of your `netiks_deploy_key` file (the **private** key)
   ```bash
   # On your laptop, display the private key
   cat netiks_deploy_key
   # Copy entire output (including -----BEGIN and END lines)
   ```
4. Click **Add secret**

**Secret 2: DEPLOY_HOST**
1. Click **Add secret**
2. Name: `DEPLOY_HOST`
3. Value: Your VM's public IP or domain (e.g., `20.29.81.166` or `netiks.example.com`)
4. Click **Add secret**

**Secret 3: DEPLOY_USER**
1. Click **Add secret**
2. Name: `DEPLOY_USER`
3. Value: `deploy`
4. Click **Add secret**

### Expected Output:

[PLACEHOLDER: Screenshot showing three secrets in production environment - showing only names, NOT values]

---

## Part 2 Answer: Why Shouldn't the Deployment User Have `sudo` Access?

### Answer: Why No `sudo` for Deployment User

1. **Principle of Least Privilege:** The deployment user only needs to:
   - Pull Docker images
   - Run Docker Compose commands
   - These don't require `sudo`

2. **Security Boundary:** If the SSH key is compromised:
   - Attacker can deploy applications
   - Attacker **cannot** modify system files, kernels, or network configs
   - Attacker **cannot** access your personal files
   - Damage is limited to application deployments

3. **Separation of Concerns:** 
   - Your personal account: Full admin access for maintenance
   - Deployment account: Only deployment permissions
   - This separation makes security auditing easier

4. **Audit Trail:** 
   - Commands run as `deploy` user are clearly for deployments
   - Commands run as your user are clearly personal/admin
   - Easier to track who did what

---

## Part 2 Answer: Why Does the Deployment User Need Docker Access?

### Answer: Why Docker Access is Required

1. **Pulling Images:** Docker Compose needs to pull images from Azure Container Registry:
   ```bash
   docker compose pull
   ```
   This requires Docker daemon access.

2. **Running Services:** Docker Compose creates and runs containers:
   ```bash
   docker compose up -d
   ```
   This requires Docker daemon access.

3. **Status Checking:** Deployment verification checks running containers:
   ```bash
   docker compose ps
   ```
   This requires Docker daemon access.

4. **Why Not `sudo`:** 
   - Granting `sudo` would allow running ANY command as root
   - Adding to `docker` group restricts access to only Docker operations
   - This is the more secure approach

5. **Security Consideration:**
   - The Docker group provides significant privileges but not system-wide root
   - This is why the lab emphasizes: "should not be treated as equivalent to fully unprivileged"
   - It's acceptable because the deployment account is single-purpose
   - If compromised, the scope is limited to Docker/application changes only

---

---

# PART 3: Add a Deployment Job to the Workflow

## Step 1: Update the Workflow File

Extend your `.github/workflows/build-and-push.yml` with a new `deploy` job that runs after successful builds.

### Action: Add Deployment Job

Open `.github/workflows/build-and-push.yml` and add this new job at the end (after the `build-and-push` job):

```yaml
  deploy:
    name: 🚀 Deploy to Production
    needs: build-and-push
    
    if: startsWith(github.ref, 'refs/tags/v') || github.event_name == 'workflow_dispatch'

    runs-on: ubuntu-latest
    environment: production

    steps:
    - name: 🚀 Deploy over SSH
      uses: appleboy/ssh-action@v1
      with:
        host: ${{ secrets.DEPLOY_HOST }}
        username: ${{ secrets.DEPLOY_USER }}
        key: ${{ secrets.DEPLOY_SSH_KEY }}
        script: |
          set -e

          cd ~/netiks_store

          VERSION="${{ inputs.version || github.ref_name }}"

          git fetch --tags origin
          git checkout --force "$VERSION"

          docker compose \
            -f docker-compose.yml \
            -f docker-compose.prod.yml \
            pull

          docker compose \
            -f docker-compose.yml \
            -f docker-compose.prod.yml \
            up -d

          docker compose \
            -f docker-compose.yml \
            -f docker-compose.prod.yml \
            ps
```

### What This Job Does:

- **`name`**: Descriptive name for the workflow
- **`needs: build-and-push`**: Waits for build-and-push to succeed before starting
- **`if` condition**: Only runs for version tags (v*) or manual workflow_dispatch triggers
- **`environment: production`**: Uses production environment with approval gate and secrets
- **`appleboy/ssh-action@v1`**: GitHub Action that SSH into the VM
- **SSH credentials**: Uses secrets from the production environment
- **Script**: Executes deployment commands on the VM

### File Location:

Add this to the end of `.github/workflows/build-and-push.yml`

### Expected Output After Adding:

[PLACEHOLDER: Screenshot of updated .github/workflows/build-and-push.yml showing the deploy job]

---

## Part 3 Answer: Why Does the `if` Condition Prevent Deployment on Every Push?

### Answer: The `if` Condition Logic

```yaml
if: startsWith(github.ref, 'refs/tags/v') || github.event_name == 'workflow_dispatch'
```

This condition means: **Run the deploy job ONLY IF one of these is true:**

1. **`startsWith(github.ref, 'refs/tags/v')`** - The push is a Git tag that starts with `v`
   - Example: ✅ `v1.2.0` matches
   - Example: ❌ `feature-branch` doesn't match
   - Example: ❌ Push to `main` branch doesn't match

2. **`github.event_name == 'workflow_dispatch'`** - The workflow was manually triggered
   - Used for rollbacks (we'll add this in Part 6c)

#### Why This Prevents Unwanted Deployments:

**Without this condition:**
- Every push to `main` would trigger deployment
- Every commit would deploy immediately (before code review!)
- Would create chaos and instability

**With this condition:**
- Only intentional releases deploy (when you create a tag)
- Only manual rollbacks deploy (when you manually trigger)
- Deployments are planned and controlled

#### Examples:

```
git push origin main
→ Triggers: validate job ✅
→ Triggers: build-and-push job ✅
→ Triggers: deploy job ❌ (not a tag)

git tag v1.2.0 && git push origin v1.2.0
→ Triggers: validate job ✅
→ Triggers: build-and-push job ✅
→ Triggers: deploy job ✅ (is a tag)

Manually trigger workflow with v1.1.0
→ Triggers: deploy job ✅ (workflow_dispatch)
```

---

## Part 3 Answer: Why `needs: build-and-push` Instead of Parallel?

### Answer: Dependency Chain

```yaml
needs: build-and-push
```

This means: **Wait for the build-and-push job to complete successfully before starting the deploy job.**

#### Why This Is Required:

1. **Image Availability:** The deploy job pulls Docker images from ACR:
   ```bash
   docker compose pull
   ```
   These images don't exist until build-and-push creates them.

2. **Deployment Validity:** If builds fail, you don't want to deploy old images:
   - Build fails → Deploy doesn't run → Production stays at previous version ✅
   - Build succeeds → Deploy runs → Production gets new images ✅

3. **Logical Sequence:**
   ```
   1. Code changes pushed
   2. Validation runs (linting, tests)
   3. Build images
   4. Push images to registry
   5. Wait for images to be available
   6. Deploy images to production
   ```

4. **If Jobs Ran in Parallel:**
   ```
   build-and-push starts... (building images)
   deploy starts immediately... (images don't exist yet!)
   deploy fails trying to pull non-existent images
   build-and-push finishes (too late)
   ```

#### Dependency Flow:

```
GitHub Push (version tag)
    ↓
validate job
    ↓
build-and-push job (builds all 7 images)
    ↓
deploy job waits for approval (needs: build-and-push)
    ↓
Human approves
    ↓
deploy job runs
    ↓
Production updated
```

---

---

# PART 4: Release Checklist Becomes a Habit

## Understanding the Release Process

Before creating a release tag, you must ensure `docker-compose.prod.yml` has the correct version for your release.

### Why This Matters:

The deployment job checks out the tag commit:
```bash
git checkout --force "$VERSION"  # e.g., v1.2.0
```

At this commit, the `docker-compose.prod.yml` file must have the matching version:
```yaml
services:
  web:
    image: netiksstoreregistry.azurecr.io/web:v1.2.0  # ← Must match tag
```

---

## Step 1: Update `docker-compose.prod.yml`

Before creating a release tag, update all service versions in `docker-compose.prod.yml`.

### Action: Prepare Release v1.2.0

1. Open `docker-compose.prod.yml` in your editor
2. Update all service image versions from current version (e.g., `v1.1.1`) to new version (`v1.2.0`)
3. Save the file

### Before (Current):

```yaml
services:
  web:
    image: netiksstoreregistry.azurecr.io/web:v1.1.1
    pull_policy: always
  
  gateway:
    image: netiksstoreregistry.azurecr.io/gateway:v1.1.1
    pull_policy: always
  
  # ... all other services with v1.1.1
```

### After (Prepare for v1.2.0):

```yaml
services:
  web:
    image: netiksstoreregistry.azurecr.io/web:v1.2.0
    pull_policy: always
  
  gateway:
    image: netiksstoreregistry.azurecr.io/gateway:v1.2.0
    pull_policy: always
  
  # ... all other services with v1.2.0
```

### Expected Output After Edit:

[PLACEHOLDER: Screenshot of docker-compose.prod.yml with updated versions]

---

## Step 2: Commit the Version Update

Commit this change to Git before creating the tag.

### Action: Commit the Change

```bash
git add docker-compose.prod.yml
git commit -m "release: v1.2.0"
```

### Expected Output:

```
[main 7a2c4d9] release: v1.2.0
 1 file changed, 7 insertions(+), 7 deletions(-)
```

### View the Commit Diff:

```bash
git show HEAD
```

This shows exactly what changed in the commit.

### Expected Output:

[PLACEHOLDER: Screenshot of git show output showing version changes from v1.1.1 to v1.2.0]

---

## Step 3: Create Git Tag

Now create the Git tag that points to this commit.

### Action: Tag the Release

```bash
git tag v1.2.0
```

### Verify Tag Points to Correct Commit:

```bash
# Show tag information
git show v1.2.0

# Should display the commit you just created with the version update
```

### Expected Output:

```
tag v1.2.0
Tagger: Your Name <email@example.com>
Date:   ...

release: v1.2.0

[Shows the commit hash and changes]
```

---

## Step 4: Push Tag to GitHub

Push the tag to trigger the CI/CD pipeline.

### Action: Push Tag

```bash
git push origin main --tags

# Or push specific tag:
git push origin v1.2.0
```

### Expected Output:

```
Enumerating objects: 1, done.
Counting objects: 100% (1/1), done.
Total 1 (delta 0), reused 0 (delta 0), reused pack 0 (delta 0)
To github.com:your-org/netiks_store.git
 * [new tag]         v1.2.0 -> v1.2.0
```

---

## Part 4 Answer: What Happens If You Push the Tag Before Committing Version Changes?

### Answer: The Tag Points to Wrong Commit

#### Scenario: You push tag before committing version change

```bash
# ❌ WRONG - Tag not yet committed
git tag v1.2.0

# ❌ WRONG - Commit version change after tag
git add docker-compose.prod.yml
git commit -m "release: v1.2.0"

git push origin v1.2.0
```

#### What Goes Wrong:

1. **Tag points to old commit:**
   ```
   v1.2.0 tag → points to commit with v1.1.1 in docker-compose.prod.yml
   ```

2. **Deployment gets wrong images:**
   - GitHub Actions checks out `v1.2.0` tag
   - `docker-compose.prod.yml` still has `v1.1.1` images
   - Deployment pulls old images instead of new ones
   - Users see old version (bug fix doesn't deploy!)

3. **Version mismatch:**
   ```
   Git tag: v1.2.0
   Image tag: v1.1.1
   Docker compose image pull: v1.1.1 ❌
   ```

#### Consequences:

- Release version doesn't match deployed images
- Debugging is confusing (version numbers don't align)
- Rollback is difficult (can't trust version tags)
- CI/CD pipeline integrity is compromised

#### Correct Sequence:

```bash
# ✅ CORRECT - Version change committed first
git add docker-compose.prod.yml
git commit -m "release: v1.2.0"

# ✅ CORRECT - Tag points to this commit
git tag v1.2.0

# ✅ CORRECT - Push both
git push origin main --tags
```

Result:
```
v1.2.0 tag → points to commit with v1.2.0 in docker-compose.prod.yml ✅
```

---

### Release Checklist

Before creating a release, verify:

- [ ] All changes committed to `main` branch
- [ ] `docker-compose.prod.yml` updated with new version
- [ ] Version in `docker-compose.prod.yml` matches release version (e.g., both are `v1.2.0`)
- [ ] Changes committed with message "release: v1.2.0"
- [ ] Git tag created AFTER commit
- [ ] Tag pushed to GitHub

---

---

# PART 5: Add a Production Approval Gate

## Step 1: Configure Environment Protection Rule

GitHub Environments can require approval before a workflow can proceed. This ensures a human must approve each production deployment.

### Action: Add Required Reviewer

1. Go to GitHub → Your Repository → Settings
2. Click **Environments** (left sidebar)
3. Click on **production** environment
4. Under "Deployment branches and secrets", click **Add deployment branch rule** (if not already added)
5. Scroll down to "Required reviewers"
6. Check the box: **Require reviewers**
7. Add reviewers:
   - Type your GitHub username (yourself)
   - Or add colleagues who should approve deployments
8. Click **Save protection rules**

### Expected Output:

[PLACEHOLDER: Screenshot of production environment showing:
- Deployment branches rule
- Required reviewers checkbox enabled
- Your username listed as reviewer]

---

## Step 2: Verify Approval Flow in Workflow

When a workflow runs and references the `production` environment, GitHub will pause at the deployment job and wait for reviewer approval.

### Expected Behavior During Release:

1. Developer pushes version tag → GitHub Actions starts
2. Validate job runs
3. Build-and-push job runs and pushes images
4. Deploy job hits the `production` environment
5. GitHub pauses the workflow and sends approval request
6. Required reviewer gets notification
7. Reviewer clicks "Approve and run" in GitHub Actions
8. Deployment job resumes and deploys
9. Services updated on VM

### Expected Output When Waiting for Approval:

[PLACEHOLDER: Screenshot of GitHub Actions showing:
- Deploy job with status "Waiting for approval"
- "Approve and run" button visible
- Required reviewer indicated]

---

## Part 5 Answer: Why Should Approval Be on Deployment, Not Build?

### Answer: Separate Concerns

#### Build Job vs. Deployment Job

**Build-and-Push Job:**
- Creates Docker images
- Produces artifact
- Can be built speculatively
- Doesn't change production

**Deployment Job:**
- Changes production environment
- Affects users
- Should be carefully controlled
- Requires explicit approval

#### Why Not Require Approval on Build:

1. **Not a Production Change:**
   - Building an image doesn't affect production
   - Image just sits in registry unused
   - No risk to users yet

2. **Multiple Uses for Same Image:**
   - Same image might deploy to staging, testing, production
   - Approving once blocks all uses
   - Inefficient

3. **Artifact vs. Change:**
   - **Artifact:** Docker image (no impact until deployed)
   - **Change:** Deployment to production (affects users NOW)
   - Approval should be on the actual change

#### Why Require Approval on Deploy:

1. **Direct Production Impact:**
   - Deployment immediately changes what users see
   - Needs human oversight
   - Is the actual "point of no return"

2. **Risk Assessment:**
   - Reviewer can ask: "Is this safe to deploy?"
   - Reviewer can delay if ongoing incidents
   - Reviewer can halt if bugs discovered

3. **Accountability:**
   - Clear record of who approved each deployment
   - Audit trail shows when changes went to production

#### Real-World Example:

```
1:00 PM - Developer pushes tag v2.0.0 (build job runs immediately)
1:02 PM - Build succeeds, images ready in registry
1:05 PM - Production manager sees deployment waiting for approval
1:06 PM - Manager checks application dashboard, all metrics healthy
1:06 PM - Manager approves deployment
1:06 PM - Deployment starts
1:07 PM - Users see new features of v2.0.0

vs.

Approval on build (wrong):
1:00 PM - Build job waits for approval (delays artifact creation)
1:05 PM - Manager approves build
1:05 PM - Build runs (why wait if just creating artifact?)
1:07 PM - Deployment happens (no final approval!)
```

#### Summary:

| Aspect | Build-Push | Deploy |
|--------|-----------|--------|
| **Affects users?** | No | Yes |
| **Change production?** | No | Yes |
| **Reversible?** | Yes (delete image) | No (immediate) |
| **Needs approval?** | No | YES |
| **Should require reviewer?** | No | YES |

---

---

# PART 6: Test the Pipeline End-to-End

## 6a: Release - Trigger Full Deployment Pipeline

### Step 1: Make Visible Application Change

Make a small, observable change to one of your services so you can verify the deployment worked.

### Option 1: Change Frontend Text

Edit `apps/web/src/app/page.tsx` and add a visible marker:

```tsx
// Add this somewhere visible on the home page
<p>Version: v1.2.0 - Deployed at {new Date().toLocaleString()}</p>
```

Save and commit:
```bash
git add apps/web/src/app/page.tsx
git commit -m "feat: Add version display for Week 5 testing"
git push origin main
```

### Option 2: Change an Environment Variable

Edit `.env` and add:
```bash
DEPLOYMENT_VERSION=v1.2.0
```

Commit:
```bash
git add .env
git commit -m "chore: Mark deployment for Week 5 testing"
git push origin main
```

---

### Step 2: Update `docker-compose.prod.yml` for Release

Update the version in `docker-compose.prod.yml` to match your release version.

### Current File (Example):

```yaml
services:
  web:
    image: netiksstoreregistry.azurecr.io/web:v1.1.1
  gateway:
    image: netiksstoreregistry.azurecr.io/gateway:v1.1.1
  identity-service:
    image: netiksstoreregistry.azurecr.io/identity-service:v1.1.1
  vendor-service:
    image: netiksstoreregistry.azurecr.io/vendor-service:v1.1.1
  catalog-service:
    image: netiksstoreregistry.azurecr.io/catalog-service:v1.1.1
  media-service:
    image: netiksstoreregistry.azurecr.io/media-service:v1.1.1
  admin-service:
    image: netiksstoreregistry.azurecr.io/admin-service:v1.1.1
```

### Updated File for v1.2.0:

```yaml
services:
  web:
    image: netiksstoreregistry.azurecr.io/web:v1.2.0
  gateway:
    image: netiksstoreregistry.azurecr.io/gateway:v1.2.0
  identity-service:
    image: netiksstoreregistry.azurecr.io/identity-service:v1.2.0
  vendor-service:
    image: netiksstoreregistry.azurecr.io/vendor-service:v1.2.0
  catalog-service:
    image: netiksstoreregistry.azurecr.io/catalog-service:v1.2.0
  media-service:
    image: netiksstoreregistry.azurecr.io/media-service:v1.2.0
  admin-service:
    image: netiksstoreregistry.azurecr.io/admin-service:v1.2.0
```

### Commit and Tag:

```bash
# Commit the version change
git add docker-compose.prod.yml
git commit -m "release: v1.2.0"

# Create tag
git tag v1.2.0

# Push both main and tags
git push origin main --tags
```

### Expected Output:

```
Enumerating objects: 5, done.
Counting objects: 100% (5/5), done.
Total 3 (delta 2), reused 0 (delta 0), reused pack 0 (delta 0)
To github.com:your-org/netiks_store.git
   abc1234..def5678  main -> main
 * [new tag]         v1.2.0 -> v1.2.0
```

---

### Step 3: Monitor GitHub Actions Workflow

Go to GitHub → Your Repository → Actions

Watch the workflow execute in this sequence:

#### 1️⃣ Validate Job Runs

```
🔍 Validate Code Quality
├─ Lint Python code
├─ Lint web application  
├─ Validate Docker Compose
└─ ✅ All checks pass
```

[PLACEHOLDER: Screenshot of validate job passing]

---

#### 2️⃣ Build-and-Push Job Runs

```
🐳 Build and Push Images
├─ Build web image... [latest-commit-sha]
├─ Build gateway image... [latest-commit-sha]
├─ Build identity-service... [latest-commit-sha]
├─ Build vendor-service... [latest-commit-sha]
├─ Build catalog-service... [latest-commit-sha]
├─ Build media-service... [latest-commit-sha]
├─ Build admin-service... [latest-commit-sha]
└─ ✅ All images pushed to ACR
```

[PLACEHOLDER: Screenshot of build-and-push job showing all 7 services building]

---

#### 3️⃣ Deploy Job Waits for Approval

```
🚀 Deploy to Production
└─ ⏳ Waiting for approval from required reviewers
```

[PLACEHOLDER: Screenshot of deploy job in "Waiting" status]

---

### Step 4: Approve the Deployment

GitHub sends an approval notification. You (as the required reviewer) must approve.

#### Option 1: Approve from GitHub Actions Page

1. Go to GitHub Actions → Latest workflow run
2. Click **Review deployments** button
3. Select the `production` environment
4. Click **Approve and deploy**

#### Option 2: Approve from Notification

If you received a GitHub notification:
1. Click the notification
2. Click **View deployment**
3. Click **Approve and deploy**

### Expected Output:

[PLACEHOLDER: Screenshot showing:
- "Review deployments" button highlighted
- Production environment selected
- Approval confirmation message]

---

### Step 5: Deployment Proceeds

After approval, the deployment job executes:

```
🚀 Deploy over SSH
├─ SSH into VM as deploy user
├─ Change to ~/netiks_store
├─ Fetch latest tags: git fetch --tags origin
├─ Checkout v1.2.0: git checkout --force "v1.2.0"
├─ Pull images: docker compose pull
├─ Start services: docker compose up -d
├─ Show status: docker compose ps
└─ ✅ Deployment complete
```

### Expected Output:

[PLACEHOLDER: Screenshot of successful deployment job showing:
- All steps executed
- docker compose ps showing all 7 services running with v1.2.0 images]

---

## 6b: Verify - Confirm the Deployment

### Step 1: Access the Application

Open your application in a web browser:

```
http://<YOUR_VM_PUBLIC_IP>/
```

or if you configured a domain:

```
http://netiks.example.com/
```

### Step 2: Check for Your Visible Change

If you added version display to the frontend:
- Look for "Version: v1.2.0" on the home page
- Verify the deployed timestamp is recent

If you added environment variables:
- Check the application dashboard or API for the new version

### Expected Output:

[PLACEHOLDER: Screenshot of application showing:
- Your visible change is present
- Application is fully functional
- Version indicator shows v1.2.0]

---

### Step 3: Verify Docker Images on VM

SSH into the VM and check that correct images are running:

```bash
# SSH into VM as deploy user (optional verification)
ssh -i netiks_deploy_key deploy@<YOUR_VM_IP>

# Check running containers
docker ps

# Should show v1.2.0 images
```

### Expected Output:

```
CONTAINER ID  IMAGE                                                    STATUS
abc123...     netiksstoreregistry.azurecr.io/web:v1.2.0               Up 5 minutes
def456...     netiksstoreregistry.azurecr.io/gateway:v1.2.0           Up 5 minutes
ghi789...     netiksstoreregistry.azurecr.io/identity-service:v1.2.0  Up 5 minutes
...
```

[PLACEHOLDER: Screenshot of docker ps showing v1.2.0 images]

---

## 6c: Rollback - Test Manual Deployment

### Step 1: Add Manual Workflow Trigger

Update `.github/workflows/build-and-push.yml` to support manual deployment.

Find the `on:` section at the top of the workflow and update it:

### Before:

```yaml
on:
  push:
    branches: [main]
    tags: ['v*']
```

### After:

```yaml
on:
  push:
    branches: [main]
    tags: ['v*']

  workflow_dispatch:
    inputs:
      version:
        description: "Tag to deploy, e.g. v1.1.0"
        required: true
        type: string
```

### What This Does:

- `workflow_dispatch:` Allows manual workflow triggering
- `inputs:` Lets you specify which version to deploy
- Used for rollbacks to previous versions

---

### Step 2: Update Deployment Job for Manual Trigger

Find the `deploy` job and update the version variable to use manual input:

### Before:

```yaml
deploy:
  script: |
    VERSION="${{ github.ref_name }}"
```

### After:

```yaml
deploy:
  script: |
    VERSION="${{ inputs.version || github.ref_name }}"
```

### What This Does:

- For tagged push: Uses `github.ref_name` (e.g., `v1.2.0`)
- For manual trigger: Uses `inputs.version` (e.g., `v1.1.0` for rollback)
- The `||` means: use inputs.version if provided, otherwise use github.ref_name

---

### Step 3: Commit Workflow Changes

```bash
git add .github/workflows/build-and-push.yml
git commit -m "feat: Add manual deployment for rollbacks"
git push origin main
```

---

### Step 4: Manually Deploy Previous Version

Now test the manual deployment by rolling back to a previous version.

#### Via GitHub Web Interface:

1. Go to GitHub → Your Repository → Actions
2. Click **All workflows** (left sidebar)
3. Click on **🐳 Build and Push Docker Images** workflow
4. Click **Run workflow** (blue button)
5. A dropdown appears: "Use workflow from [Branch selector]"
6. Enter the version you want to deploy: `v1.1.0` (or your previous version)
7. Click **Run workflow** green button

### Expected Output:

[PLACEHOLDER: Screenshot showing:
- "Run workflow" button clicked
- Version input field showing "v1.1.0"
- Workflow triggered]

---

### Step 5: Monitor Rollback Workflow

Go to Actions → Latest workflow run

You should see:

```
🔍 Validate Code Quality
└─ ✅ Skipped (workflow_dispatch, no code changes)

🐳 Build and Push Images
└─ ✅ Skipped (images already built)

🚀 Deploy to Production
├─ git checkout --force "v1.1.0"
├─ docker compose pull (pulls v1.1.0 images)
├─ docker compose up -d (restarts with old images)
└─ ✅ Rollback complete
```

### Expected Output:

[PLACEHOLDER: Screenshot showing:
- Deploy job running with v1.1.0 version
- All steps executing successfully]

---

### Step 6: Verify Rollback Success

#### Check GitHub Actions:

The workflow should complete successfully with v1.1.0 deployed.

[PLACEHOLDER: Screenshot of successful workflow_dispatch deployment]

---

#### Check Docker Images on VM:

```bash
ssh -i netiks_deploy_key deploy@<YOUR_VM_IP>

# Show images before rollback
docker ps --before-rollback

# Show images after rollback
docker ps
```

### Expected Output Before Rollback:

```
CONTAINER ID  IMAGE                                        STATUS
abc123...     netiksstoreregistry.azurecr.io/web:v1.2.0   Up 30 minutes
def456...     netiksstoreregistry.azurecr.io/gateway:v1.2.0  Up 30 minutes
...
```

### Expected Output After Rollback:

```
CONTAINER ID  IMAGE                                        STATUS
xyz789...     netiksstoreregistry.azurecr.io/web:v1.1.0   Up 2 minutes
uvw012...     netiksstoreregistry.azurecr.io/gateway:v1.1.0  Up 2 minutes
...
```

[PLACEHOLDER: Screenshot showing docker ps with v1.1.0 images after rollback]

---

#### Check Application:

Visit your application in browser - if you had a version display, it should show the previous version.

[PLACEHOLDER: Screenshot of application showing v1.1.0 deployed]

---

### Step 7: Verify Image Version Changed

Compare docker ps outputs before and after rollback:

**Before Rollback (v1.2.0):**
```
web:v1.2.0
gateway:v1.2.0
identity-service:v1.2.0
```

**After Rollback (v1.1.0):**
```
web:v1.1.0
gateway:v1.1.0
identity-service:v1.1.0
```

Show both outputs in your submission.

[PLACEHOLDER: Side-by-side comparison of docker ps outputs showing version difference]

---

---

# DELIVERABLES CHECKLIST

Use this checklist to ensure you have all required materials for submission.

## Part 1: Understand the Basics

**Question 1:** Which manual commands from Week 4 Part 6 are being replaced?
- [ ] Answer provided (git pull, az acr login, docker compose pull, docker compose up -d, docker ps)

**Question 2:** Why is dedicated deployment key safer?
- [ ] Explanation of principle of least privilege
- [ ] Actions to take if key is leaked

**Question 3:** Difference between push-based and pull-based deployment?
- [ ] Push-based explanation (CI connects to production)
- [ ] Pull-based explanation (Production checks for changes)
- [ ] Comparison table or summary

**Question 4:** Which model are we building?
- [ ] Answer: Push-based deployment
- [ ] Brief explanation why

---

## Part 2: Prepare the VM for Remote Deployment

**Deploy User Creation:**
- [ ] Command output showing deploy user created
- [ ] Command output showing authorized_keys ownership/permissions
  - Example: `drwx------ deploy deploy .ssh`
  - Example: `-rw------- deploy deploy authorized_keys`
- [ ] Verification that deploy user has docker group access

**GitHub Configuration:**
- [ ] Screenshot of `production` environment in GitHub
- [ ] Screenshot showing three secret names: `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`
- [ ] **IMPORTANT:** Do NOT show secret values in screenshots

**Answers:**
- [ ] Why deploy user shouldn't have sudo (principle of least privilege, security boundary, scope limitation)
- [ ] Why deploy user needs Docker access (pull images, run containers, status checking)

---

## Part 3: Add Deployment Job to Workflow

**Updated Workflow File:**
- [ ] `.github/workflows/build-and-push.yml` with new `deploy` job added
- [ ] Deploy job includes all steps: SSH, git fetch, git checkout, docker pull, docker compose up, docker ps

**Answers:**
- [ ] Explain why `if: startsWith(github.ref, 'refs/tags/v') || github.event_name == 'workflow_dispatch'` prevents deployment on every push
- [ ] Explain why `needs: build-and-push` is required (images must exist before deployment)

---

## Part 4: Release Checklist Becomes a Habit

**Commit Diff:**
- [ ] `git show` output or diff showing `docker-compose.prod.yml` version update (e.g., v1.1.1 → v1.2.0)
- [ ] Git tag information showing v1.2.0
- [ ] Confirmation that tag points to commit with matching version

**Answer:**
- [ ] What happens if tag is pushed before committing version change
- [ ] Explanation: Tag points to wrong commit with old images

---

## Part 5: Add Production Approval Gate

**GitHub Environment Setup:**
- [ ] Screenshot of `production` environment
- [ ] Screenshot showing "Required reviewers" enabled
- [ ] Screenshot showing protection rules configured

**Workflow Approval:**
- [ ] Screenshot of workflow run waiting for approval
- [ ] Shows "Review deployments" or approval button

**Answer:**
- [ ] Why approval should be on deployment, not build
- [ ] Explain: Build creates artifact (no impact), deploy changes production (needs approval)
- [ ] Distinguish between artifact production vs. production environment change

---

## Part 6: Test End-to-End

**6a - Release/Full Deployment:**
- [ ] Screenshot of GitHub Actions validate job passing
- [ ] Screenshot of build-and-push job showing all 7 services building
- [ ] Screenshot of deploy job waiting for approval
- [ ] Screenshot of approval confirmation
- [ ] Screenshot of successful deployment showing all steps and final `docker compose ps`

**6b - Verify Application:**
- [ ] Screenshot of application showing deployed change and v1.2.0 version
- [ ] Screenshot or output showing docker ps with v1.2.0 images running

**6c - Rollback:**
- [ ] Screenshot of workflow_dispatch manual trigger with v1.1.0 input
- [ ] Screenshot of successful rollback deployment
- [ ] Screenshot of docker ps BEFORE rollback (v1.2.0 images)
- [ ] Screenshot of docker ps AFTER rollback (v1.1.0 images)
- [ ] Side-by-side comparison showing image version difference

---

## Summary Checklist

- [ ] All 4 Part 1 questions answered
- [ ] All Part 2 deploy user setup confirmed with output
- [ ] GitHub production environment and secrets created
- [ ] Part 2 answers provided
- [ ] Updated workflow file with deploy job
- [ ] Part 3 answers provided
- [ ] Part 4 release checklist with git output
- [ ] Part 4 answer provided
- [ ] Part 5 GitHub environment protection rules configured
- [ ] Part 5 approval screenshots captured
- [ ] Part 5 answer provided
- [ ] Part 6a full release and deployment screenshots
- [ ] Part 6b application verification screenshot
- [ ] Part 6c rollback before/after comparison

---

---

# SUMMARY

By completing Week 5, you have built:

1. ✅ **Dedicated deployment account** - Secure, single-purpose credentials
2. ✅ **Automated SSH deployment** - GitHub Actions connects and deploys
3. ✅ **Production approval gate** - Human oversight before changes
4. ✅ **Versioned releases** - Clean tagging and deployment
5. ✅ **Rollback capability** - Manual deployment of previous versions

### The Complete Pipeline:

```
Developer pushes version tag
    ↓
GitHub Actions validates code
    ↓
GitHub Actions builds all 7 images
    ↓
GitHub Actions pushes to ACR
    ↓
GitHub waits for production approval
    ↓
Required reviewer approves
    ↓
GitHub Actions SSH into VM
    ↓
GitHub Actions checks out exact version
    ↓
Docker Compose pulls images
    ↓
Docker Compose starts services
    ↓
Production updated with zero downtime
    ↓
Humans can rollback to previous version anytime
```

### Security Achievements:

- ✅ No personal SSH keys exposed
- ✅ No shared credentials
- ✅ Principle of least privilege enforced
- ✅ Human approval before production changes
- ✅ Full audit trail of deployments
- ✅ Easy rollback for incidents

---

## Submission

**Format:** PDF document named `Week5_<FirstName>_<LastName>.pdf`

**Contents:**
1. All questions answered (Parts 1-5)
2. All required screenshots with [PLACEHOLDER] replaced by actual images
3. Command outputs showing setup (Part 2)
4. Git diffs and outputs (Part 4)
5. Workflow run screenshots (Part 6)
6. Before/after docker ps comparison (Part 6c)

**Submit to:**
- **To:** shulammite.odde@cognetiks.com
- **CC:** flora.owhiroro@cognetiks.com

**Deadline:** Friday, 18 September, 5:00 PM

---

**Next Week:** Week 6 introduces a staging environment for pre-production validation!

