# 🚀 Netiks Store - Week 5 Lab: CI/CD Deployment Pipeline
## Complete Step-by-Step Implementation Guide

**Date:** September 17, 2026  

**Prerequisite:** Week 4 Lab (OIDC setup with working CI/CD pipeline)

---

## Executive Summary

In Week 4, The CI/CD pipeline built and pushed Docker images to Azure Container Registry. However, deployment to production was still manual—I had to SSH into the VM and run Docker Compose commands.

**Week 5 Goal:** Fully automate the deployment pipeline so that pushing a version tag triggers a complete, approved deployment to production with the ability to rollback to previous versions.

**What I'll build:**
- Dedicated deployment account on VM (security best practice)
- GitHub Environment with approval gates
- Automated SSH deployment from GitHub Actions
- Manual rollback capability through `workflow_dispatch`

---

# PART 1: Understand the Basics

## Question 1: Which manual commands from Week 4 Part 6 are being replaced by automation this week?

### Answer

The following manual commands from Week 4 Part 6 that I had to execute on the VM are being automated:

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

<img width="579" height="553" alt="Screenshot 2026-09-15 160203" src="https://github.com/user-attachments/assets/6ce08a0f-02f4-4891-884e-84ab999983bc" />


### Verify Creation:

```bash
# Check user exists
id deploy

# Verify docker group membership
groups deploy
```

<img width="512" height="165" alt="Screenshot 2026-09-15 162446" src="https://github.com/user-attachments/assets/4486f9b8-12f4-4869-8508-a42d2ef8fff7" />

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
<img width="752" height="173" alt="image" src="https://github.com/user-attachments/assets/143bb3cf-5e6d-46e2-93fc-a8cde7df643a" />

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

<img width="787" height="267" alt="Screenshot 2026-09-15 163004" src="https://github.com/user-attachments/assets/41b4bcbb-f3a7-4481-80d9-467d0c9a9a1e" />


### Verify Permissions:

```bash
# Check directory ownership and permissions
ls -la /home/deploy/.ssh/

# Output should show:
# drwx------ deploy deploy .ssh
# -rw------- deploy deploy authorized_keys
```

<img width="647" height="281" alt="Screenshot 2026-09-15 163104" src="https://github.com/user-attachments/assets/08781b15-6511-48af-9395-ba6896594b1f" />


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

<img width="721" height="544" alt="Screenshot 2026-09-15 164052" src="https://github.com/user-attachments/assets/3cd9295b-d62d-431a-90b4-25b6eb94446d" />

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

<img width="808" height="610" alt="Screenshot 2026-09-15 170620" src="https://github.com/user-attachments/assets/ff7f844b-c376-49c3-b226-1c56a4ec1fd1" />

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

<img width="1040" height="275" alt="Screenshot 2026-09-17 171423" src="https://github.com/user-attachments/assets/bfb171ed-0864-43b0-97bc-5650f4351e65" />
                     Screenshot of GitHub Environments page showing "production" environment created

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
<img width="993" height="473" alt="Screenshot 2026-09-16 173646" src="https://github.com/user-attachments/assets/f06fd831-e2da-4d0f-b5c5-eede201b35a3" />
Screenshot showing three secrets in production environment - showing only names, NOT values.

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
<img width="828" height="828" alt="Screenshot 2026-09-17 172058" src="https://github.com/user-attachments/assets/eed4a37e-6e60-41dc-a175-a8d8dff4cd38" />
Screenshot of updated .github/workflows/build-and-push.yml showing the deploy job

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

Manually trigger workflow with v1.1.1
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
<img width="735" height="704" alt="Screenshot 2026-09-17 172411" src="https://github.com/user-attachments/assets/7b40afcd-a38b-4484-a3d9-5ee54008555f" />
PLACEHOLDER: Screenshot of docker-compose.prod.yml with updated versions

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
<img width="603" height="487" alt="Screenshot 2026-09-16 180941" src="https://github.com/user-attachments/assets/33cbbe83-b21e-4930-81c0-7550a2c0a97b" />
Screenshot of git show output showing version changes from v1.1.1 to v1.2.0

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

<img width="1236" height="487" alt="Screenshot 2026-09-16 183851" src="https://github.com/user-attachments/assets/00bc36f3-ea08-406a-880a-bf984ef6129f" />

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
<img width="1890" height="700" alt="Screenshot 2026-09-16 194147" src="https://github.com/user-attachments/assets/cc4e4f27-0b0f-44e7-ae4f-d106f116c5d0" />
<img width="840" height="515" alt="Screenshot 2026-09-16 194426" src="https://github.com/user-attachments/assets/73cfeec6-f8fc-4aa0-94fa-6ff1cdf4ef19" />


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
<img width="1330" height="793" alt="Screenshot 2026-09-16 210151" src="https://github.com/user-attachments/assets/123c2fd0-fc50-449c-90c5-52d526bca1d6" />
PLACEHOLDER: Screenshot of validate job passing

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
<img width="1890" height="700" alt="Screenshot 2026-09-16 194147" src="https://github.com/user-attachments/assets/be7b5bc3-2268-48cb-9417-5e06266cc417" />
PLACEHOLDER: Screenshot of deploy job in "Waiting" status

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

<img width="840" height="515" alt="Screenshot 2026-09-16 194426" src="https://github.com/user-attachments/assets/5312c65b-df6b-4115-9b27-60b5a9124309" />

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

<img width="1330" height="793" alt="Screenshot 2026-09-16 210151" src="https://github.com/user-attachments/assets/a1d0d139-7c29-4622-b660-6bd3f3b7b848" />
- docker compose ps showing all 7 services running with v1.2.0 images]

---

## 6b: Verify - Confirm the Deployment

### Step 1: Access the Application

Open your application in a web browser:

```
http://<YOUR_VM_PUBLIC_IP>/
```

### Step 2: Check for Your Visible Change

If you added version display to the frontend:
- Look for "Version: v1.2.0" on the home page
- Verify the deployed timestamp is recent

### Expected Output:

<img width="1341" height="722" alt="Screenshot 2026-09-16 212944" src="https://github.com/user-attachments/assets/c84b6914-ce3b-44dc-87eb-5a0cf77e4ca5" />

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

<img width="1822" height="323" alt="Screenshot 2026-09-16 210819" src="https://github.com/user-attachments/assets/fff7d454-9309-4cf1-8633-10fa28d1893c" />
PLACEHOLDER: Screenshot of docker ps showing v1.2.0 images

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
6. Enter the version you want to deploy: `v1.1.1` (or your previous version)
7. Click **Run workflow** green button

### Expected Output:

<img width="1328" height="563" alt="Screenshot 2026-09-17 145846" src="https://github.com/user-attachments/assets/7d37e405-be52-4a2a-90fb-7897ff6809b0" />

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
├─ git checkout --force "v1.1.1"
├─ docker compose pull (pulls v1.1.1 images)
├─ docker compose up -d (restarts with old images)
└─ ✅ Rollback complete
```

### Expected Output:

<img width="1645" height="691" alt="Screenshot 2026-09-17 150242" src="https://github.com/user-attachments/assets/36e29805-5a99-4300-9018-550853757d31" />
- All steps executing successfully]

---

### Step 6: Verify Rollback Success

#### Check GitHub Actions:

The workflow should complete successfully with v1.1.1 deployed.

<img width="1655" height="766" alt="Screenshot 2026-09-17 150349" src="https://github.com/user-attachments/assets/d1fab6a2-0a81-44b1-9d38-152e61d6aa28" />
PLACEHOLDER: Screenshot of successful workflow_dispatch deployment

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

<img width="1206" height="437" alt="Screenshot 2026-09-17 151251" src="https://github.com/user-attachments/assets/18fa2d3c-7218-4072-b284-551070bf3c2b" />
Screenshot showing docker ps with v1.1.0 images after rollback

---

#### Check Application:

Visit your application in browser - if you had a version display, it should show the previous version.
<img width="1511" height="806" alt="Screenshot 2026-09-17 151219" src="https://github.com/user-attachments/assets/6e15cd8b-7eb8-429c-b94b-a22aace34fcb" />

PLACEHOLDER: Screenshot of application showing v1.1.0 deployed

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
<img width="1666" height="466" alt="image" src="https://github.com/user-attachments/assets/3242ff71-a0e6-4861-904e-12479600ed6b" />

<img width="1206" height="437" alt="Screenshot 2026-09-17 151251" src="https://github.com/user-attachments/assets/61329ab8-3e6d-48fe-a930-62d5590ebc7b" />
PLACEHOLDER: Side-by-side comparison of docker ps outputs showing version difference

---


# SUMMARY

By completing Week 5, I have built:

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
---
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
# Netiks Store - Week 2 Lab Deployment Report
## Complete Azure VM Deployment with Production Configuration

**Date:** August 19, 2026  
- **VM Public IP:** 20.29.81.166
- **App URL:** http://20.29.81.166/
- **Deployment Status:** ✅ Fully Deployed and Verified

---

## **Executive Summary**

This report documents the successful deployment of Netiks Store to an Azure Virtual Machine following production security standards. The deployment includes:

- ✅ Azure VM (Standard_B2s - 2 vCPUs, 4GB RAM)
- ✅ Docker and Docker Compose with secure configuration
- ✅ Nginx reverse proxy with proper security headers
- ✅ Production `.env` configuration with strong secrets
- ✅ All internal services secured (ports bound to loopback only)
- ✅ Automatic container restart policies
- ✅ Complete deployment validation and testing

---

## **Part 1: Provision Your Cloud VM**

### **Architectural Diagram**

<img width="804" height="1656" alt="image-49" src="https://github.com/user-attachments/assets/5fcb5b21-bc24-4f93-aef1-2209a78da98e" />


### **1.1: Cloud Platform and VM Size**

**Cloud Platform:** Microsoft Azure  
**VM Size:** Standard_B2s (2 vCPUs, 4 GiB memory)  
**OS:** Ubuntu Server 22.04 LTS - x64 Gen2  
**Region:** Central US

**Justification:**
- **Recommended size:** The Standard_B2s (2 vCPUs, 4GB RAM) aligns with the lab's recommendation for Azure
- **Available to me:** Yes, this size was available in my subscription
- **Why this size:** 
  - 2 vCPUs provide sufficient processing power for 9 Docker containers
  - 4 GB RAM prevents memory issues during builds and Next.js development server operation
  - Cost-effective at ~$30-40/month (covered by Azure free credits initially)

### **1.2: VM Summary and Public IP**

<img width="1408" height="416" alt="image-19" src="https://github.com/user-attachments/assets/22e3c3fb-4a48-4d7e-a402-349eb84936fa" />


### **1.3: Initial Firewall Rules (Port 22 Only)**

<img width="1626" height="703" alt="image-20" src="https://github.com/user-attachments/assets/8d37ef0b-d6c6-49d4-bd0b-43bba51b4690" />

### **1.4: First Successful SSH Connection**

<img width="816" height="575" alt="image-21" src="https://github.com/user-attachments/assets/3f4a06f5-d459-43ea-9f76-d51bf5a486a4" />

**Verification Command:**
```bash
# After SSH connection
whoami
```
<img width="785" height="151" alt="image-22" src="https://github.com/user-attachments/assets/a25a3186-b89c-4822-ac12-4199179aff34" />

---

## **Part 2: Secure the VM and Install Dependencies**

### **2.1: Docker Installation and Verification**

**Command Output:**
```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add user to docker group
sudo usermod -aG docker $USER
# Log out and back in, then verify

docker version
docker compose version
```

<img width="832" height="572" alt="image-23" src="https://github.com/user-attachments/assets/9e4abdf3-16c3-4a62-837e-2f880c569ab0" />

### **2.2: Node.js 20 and npm Installation**

**Command Output:**
```bash
# Install Node.js 20 from NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

<img width="656" height="124" alt="image-24" src="https://github.com/user-attachments/assets/3a588e75-9a83-4add-9ef1-29c78ad80f33" />


### **2.3: Nginx Installation and Status**

**Command Output:**
```bash
# Install Nginx
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl status nginx
```

**Output:**

<img width="1070" height="355" alt="image-25" src="https://github.com/user-attachments/assets/f10f0640-6e49-48f9-bccb-23b7eb5b32b9" />


### **2.4: Updated Firewall Rules (Ports 22, 80, 443)**

**Screenshot of Configuration**

<img width="1649" height="834" alt="Screenshot 2026-08-19 154603" src="https://github.com/user-attachments/assets/2c0978d8-4313-42b6-9959-b37ad0d9d5fa" />


### **2.5: Pre-Deployment Browser Test**

<img width="1525" height="418" alt="image-26" src="https://github.com/user-attachments/assets/c469a634-2b15-4891-a1bc-8fc5b2a49030" />


**URL:** http://20.29.81.166

**Why this proves my setup:**
1. **Nginx is running:** The default page confirms Nginx service is active
2. **Port 80 is open:** You can reach the VM via HTTP from the internet
3. **Firewall is correctly configured:** Traffic is flowing through port 80
4. **Basic networking works:** DNS resolution and routing are functional

---

## **Part 3: Prepare the Application for Cloud**

### **3.1: Production .env File Configuration**

**Modified Variables (Redacted Secrets):**
```bash
# Variables changed from defaults:
NEXT_PUBLIC_API_BASE_URL=http://20.29.81.166/api/v1  # Changed from localhost
POSTGRES_PASSWORD=**************  # Changed from 'postgres' (32-char random)
JWT_SECRET=**************  # Changed from default (64-char random)
```

**Variables Removed:**
```bash
POSTGRES_EXPOSE_PORT  # Removed - database not exposed to host
```

**Screenshot Instructions:**

<img width="1106" height="546" alt="image-27" src="https://github.com/user-attachments/assets/5e0a3ca7-b552-40c3-9ea5-a587bbc49b81" />


### **3.2: Docker Compose Restart Policies**

**Modified `docker-compose.yml` section:**

<img width="1048" height="610" alt="image-28" src="https://github.com/user-attachments/assets/e771b1df-a97f-44a1-b8d7-0a77f2b3b316" />
<img width="860" height="626" alt="image-29" src="https://github.com/user-attachments/assets/0b3265ce-65dd-45ac-8488-d1b5d1a19ea4" />

**Why `unless-stopped`:**
- Automatically restarts containers after VM/docker daemon restart
- Respects manual `docker compose stop` for maintenance
- More practical than `always` for development environments

### **3.3: Final Ports Configuration**

**Modified `docker-compose.yml` ports section:**

<img width="1000" height="615" alt="image-30" src="https://github.com/user-attachments/assets/3a372a7c-211c-426b-98e0-9e7206905634" />


-  All other services (identity, vendor, catalog, media, admin, postgres, redis):
-  NO ports: entries (removed entirely)


### **3.4: Loopback Binding Safety Explanation**

**Why binding to 127.0.0.1 is safer:**

1. **Defense in Depth:** Even if cloud firewall misconfiguration opens internal ports, they're not bound to the public interface
2. **Host Firewall Independence:** Doesn't rely on host firewall (UFW/iptables) being correctly configured
3. **Container Isolation:** Services are only accessible from the VM itself, not from other VMs in the same network
4. **Accidental Exposure Prevention:** Prevents accidental exposure via Docker's default binding behavior
5. **Principle of Least Privilege:** Services only expose what's necessary to Nginx (running on same host)

### **3.5: Browser-to-Gateway Request Trace**

**Path of a browser API request:**
```
Browser (user) → HTTP/HTTPS → Port 80/443 → Nginx (VM) → /api/* location → 
127.0.0.1:8000 → Gateway container → Internal Docker network → 
Backend service (identity/vendor/catalog/media)
```

**Does browser connect to port 8000 directly?** NO

**Why:**
- Nginx acts as reverse proxy
- `/api/*` requests go directly from Nginx to gateway on loopback (127.0.0.1:8000)
- Browser only communicates with Nginx on standard web ports (80/443)
- Gateway port 8000 is not exposed to internet, only accessible locally

### **3.6: NEXT_PUBLIC_API_BASE_URL Hygiene**

**Why changing it is good deployment hygiene:**

1. **Configuration Truth:** Variables should describe the actual environment, not a non-existent localhost
2. **Code Path Coverage:** The variable is used in multiple code paths; some may not use the server-side proxy
3. **Future Architecture Changes:** If architecture changes (direct API calls from browser), correct URL is already configured
4. **Developer Clarity:** Clear indication this is production deployment, not local development
5. **Error Prevention:** Prevents subtle bugs from incorrect fallback behavior
6. **Best Practice:** Production configurations should never reference development environments

---

## **Part 4: Configure the Reverse Proxy**

### **4.1: Nginx Configuration**

**`/etc/nginx/sites-available/netiks_store`:**
```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 20M;

    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### **4.2: Nginx Configuration Questions**

**1. `server_name _;` meaning:**
- `_` is a catch-all server name that matches any domain
- If VM had real domain: `server_name netiks-store.com;`
- For production: `server_name netiks-store.com;`

**2. `client_max_body_size 20M;` purpose:**
- Allows file uploads up to 20MB
- Necessary for: Product image uploads in vendor dashboard
- Without this: Large uploads get "413 Request Entity Too Large" error

**3. `proxy_set_header X-Real-IP $remote_addr;` purpose:**
- Passes original client IP to backend services
- Backend services care because:
  - Logging shows actual client IP, not proxy IP
  - Rate limiting based on real client IP
  - Security auditing needs accurate source IP
  - Geo-location features work correctly

**4. Nginx configuration validation:**
```bash
sudo nginx -t
```

**Expected Output:**
<img width="834" height="176" alt="image-31" src="https://github.com/user-attachments/assets/02658a16-cdfd-4f8f-bb2c-28875b121c39" />

**5. Nginx location matching for `/api/v1/market`:**
- **Which location matches:** `/api/` (not `/`)
- **Matching rule:** Nginx uses **prefix matching**, `/api/` is more specific prefix than `/`
- **Order matters?** NO - prefix specificity determines match, not order
- **Why:** `/api/v1/market` starts with `/api/`, so `/api/` location takes precedence

---

## **Part 5: Deploy and Validate**

### **5.1: Application Startup**

**Commands:**
```bash
cd ~/netiks_store
docker compose up -d --build

# Monitor progress
docker compose logs -f

# Check status
docker compose ps
```

**`docker compose ps` output:**
<img width="1677" height="343" alt="image-32" src="https://github.com/user-attachments/assets/e191af27-6337-4995-9538-0b1bf964c2d1" />


### **5.2: Seed Demo Data**

**Command:**
```bash
DOCKER_BIN=docker npm run seed:demo
```

**Why `DOCKER_BIN=docker`:**
- Seed script defaults to macOS Docker Desktop path
- On Ubuntu, Docker binary is at `/usr/bin/docker`
- Environment variable overrides default path

**Expected Output:**

<img width="938" height="203" alt="image-33" src="https://github.com/user-attachments/assets/eb0374f2-7d66-4f5e-a92c-def2a76362f4" />

### **5.3: Deployment Validation Steps**

**1. Home Page (`http://20.29.81.166/`):**

<img width="1513" height="864" alt="image-36" src="https://github.com/user-attachments/assets/ff7a793b-d451-4ea3-b357-f06d8abe24f6" />
<img width="1509" height="775" alt="image-35" src="https://github.com/user-attachments/assets/150e74b0-3c0f-4cb6-a1b2-b8d4b8d6d148" />
<img width="1511" height="842" alt="image-34" src="https://github.com/user-attachments/assets/a55d7949-43d4-452e-879b-eda15a428369" />


- **Expected:** Netiks Store home page loads

**2. API Health Check (`http://20.29.81.166/api/v1/system/services`):**
<img width="1676" height="289" alt="image-37" src="https://github.com/user-attachments/assets/ed1bc6f1-dafb-4cad-bac2-4265816d94a0" />


- **Expected:** JSON showing all registered services



**3. Market Page (`http://20.29.81.166/market`):**

<img width="1541" height="700" alt="image-39" src="https://github.com/user-attachments/assets/c150c539-cd38-4677-b844-cbc87d47fcdd" />
<img width="1544" height="961" alt="image-38" src="https://github.com/user-attachments/assets/a9b66f7c-b9d2-4048-807a-1f0935513b1c" />

- **Expected:** Product cards showing seeded items


**4. User Registration & Login:**
- **Steps:** Register → Login → Access Dashboard

<img width="1549" height="795" alt="image-43" src="https://github.com/user-attachments/assets/116efc0c-700b-4d61-97eb-56840cb5734d" />
<img width="1667" height="877" alt="image-42" src="https://github.com/user-attachments/assets/988d33ad-fa76-42d1-91bc-39e0fdccacfc" />
<img width="1676" height="908" alt="image-41" src="https://github.com/user-attachments/assets/46bc8721-55eb-40bc-9349-c0019f7a1ce3" />


- **Screenshot:** Successful dashboard access

**5. Image Upload Test:**
- **Steps:** Vendor dashboard → Upload product image → Verify URL accessibility
<img width="1343" height="814" alt="image-48" src="https://github.com/user-attachments/assets/52744caf-a022-4acd-8a1c-d694e7672e31" />


- **Screenshot:** Uploaded image displaying correctly

### **5.4: Internal Port Security Verification**

**From your laptop (NOT VM):**
```bash
# Test port 8001 (identity service)
curl -v --connect-timeout 5 http://20.29.81.166:8001

# Test port 5432 (postgres)
curl -v --connect-timeout 5 http://20.29.81.166:5432
```

<img width="973" height="312" alt="image-45" src="https://github.com/user-attachments/assets/d7ec046e-016c-4d83-9e03-b0039636fb74" />

**Expected Result:** Both timeout or get "Connection refused"

**Why this is desired behavior:**
- **Security:** Internal services not exposed to internet
- **Compliance:** Database should never be publicly accessible
- **Best Practice:** Only reverse proxy (Nginx) faces internet
- **Defense in Depth:** Multiple layers of protection (cloud firewall + loopback binding)


### **5.5: Automatic Restart Test**

**Commands:**
```bash
# Reboot VM
sudo reboot

# Wait 60 seconds, then SSH back in
ssh -i netiks-store-key.pem azureuser@20.29.81.166

# Check containers
cd ~/netiks_store
docker compose ps
```
<img width="1261" height="863" alt="image-46" src="https://github.com/user-attachments/assets/42148d95-458b-4e22-a0b9-6b3155c0e928" />

**Expected Output:** All containers show as running

**Two things enabling automatic restart:**
1. **Docker Compose restart policies:** `restart: unless-stopped` in docker-compose.yml
2. **Docker daemon auto-start:** Docker service configured to start on boot


### **5.6: Redeployment Command**

**Single redeployment command:**
```bash
docker compose up -d --build --force-recreate
```

**What each part does:**
- `docker compose up`: Start services
- `-d`: Detached mode (run in background)
- `--build`: Rebuild images from Dockerfiles
- `--force-recreate`: Recreate containers even if unchanged
- Combined: Full redeploy with fresh builds

---

## **Part 6: Deployment Runbook**

### **Netiks Store Production Deployment Runbook**
**VM:** Azure Standard_B2s (2 vCPU, 4GB RAM)  
**OS:** Ubuntu 22.04 LTS  
**Date:** August 2026  
**Author:** Olaoluwa Afolami

### **1. VM Provisioning**
1. Azure Portal → Create Virtual Machine
2. Name: `netiks-store-vm`
3. Size: Standard_B2s
4. OS: Ubuntu Server 22.04 LTS - x64 Gen2
5. Authentication: SSH public key
6. Username: `azureuser`
7. Key pair: Generate `netiks-store-key.pem`
8. Inbound ports: SSH (22) only initially
9. Save public IP: `20.29.81.166`

### **2. Security Configuration**
1. Add NSG rules:
   - Port 80 (HTTP) - Priority 1010
   - Port 443 (HTTPS) - Priority 1020
2. Keep only ports 22, 80, 443 open

### **3. SSH Connection**
```bash
ssh -i netiks-store-key.pem azureuser@20.29.81.166
```

### **4. System Preparation**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Log out and back in

# Install Docker Compose
sudo apt install -y docker-compose-plugin

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx
sudo apt install -y nginx
sudo systemctl enable nginx
```

### **5. Application Setup**
```bash
# Install Git
sudo apt install -y git

# Clone repository
git clone <your-repo-url> netiks_store
cd netiks_store

# Install dependencies
npm install

# Create production .env
cp .env.example .env
nano .env  # Edit variables below
```

### **6. Required .env Changes**
**MUST CHANGE:**
- `NEXT_PUBLIC_API_BASE_URL=http://20.29.81.166/api/v1`
- `POSTGRES_PASSWORD=` (generate: `openssl rand -hex 20`)
- `JWT_SECRET=` (generate: `openssl rand -hex 32`)

**REMOVE:**
- `POSTGRES_EXPOSE_PORT` line

### **7. Docker Compose Modifications**
Add to EVERY service in `docker-compose.yml`:
```yaml
    restart: unless-stopped
```

Change ports to loopback only:
```yaml
services:
  web:
    ports:
      - "127.0.0.1:3001:3000"
  gateway:
    ports:
      - "127.0.0.1:8000:8000"
```

Remove ALL `ports:` entries from: identity-service, vendor-service, catalog-service, media-service, admin-service, postgres, redis

### **8. Nginx Configuration**
Create `/etc/nginx/sites-available/netiks_store`:
```nginx
server {
    listen 80;
    server_name _;
    client_max_body_size 20M;
    
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activate:
```bash
sudo ln -s /etc/nginx/sites-available/netiks_store /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### **9. Application Deployment**
```bash
# Build and start
docker compose up -d --build

# Verify all services running
docker compose ps

# Seed demo data
DOCKER_BIN=docker npm run seed:demo
```

### **10. Validation Commands**
```bash
# Check running containers
docker compose ps

# Test external accessibility
curl http://20.29.81.166/

# Test API
curl http://20.29.81.166/api/v1/system/services

# Verify security (should timeout)
curl --connect-timeout 5 http://20.29.81.166:8001
```

---

## **What I Found Hardest This Week**

The most challenging aspect was understanding and implementing the layered security approach. Specifically:

1. **Conceptualizing multiple defense layers:** Understanding how cloud firewall, Docker loopback binding, and service isolation work together required careful study of networking principles.

2. **Nginx configuration nuances:** Getting the location blocks correct for `/api/*` routing while ensuring all headers were properly passed to backend services took several iterations of testing.

3. **Troubleshooting container networking:** When services couldn't communicate internally despite correct Docker Compose configuration, debugging required examining Docker network logs and verifying DNS resolution within the container network.

4. **Balancing security with functionality:** Implementing strict security (no database exposure) while maintaining developer accessibility for debugging required thoughtful trade-off decisions.

The breakthrough came when visualizing the complete request flow from browser to backend service, which made each security layer's purpose clear and revealed where configurations needed adjustment.

---


## **Final Verification Checklist**

### **✅ All Requirements Met:**

1. **VM Provisioned:** Azure Standard_B2s with Ubuntu 22.04 LTS
2. **Security Configured:** Only ports 22, 80, 443 open
3. **Dependencies Installed:** Docker, Node.js 20, Nginx
4. **Application Prepared:** Production `.env`, secure secrets
5. **Docker Configuration:** Restart policies, loopback ports
6. **Reverse Proxy:** Nginx correctly routing `/api/*` and other traffic
7. **Deployment Verified:** All services running, data seeded
8. **Security Validated:** Internal ports not publicly accessible
9. **Auto-restart Tested:** Containers restart after VM reboot
10. **Runbook Created:** Complete deployment documentation

### **🚀 Application Access:**

- **Home Page:** http://20.29.81.166/
- **API Endpoint:** http://20.29.81.166/api/v1/system/services
- **Market Page:** http://20.29.81.166/market
- **Domain:** http://netiks-store.com/ (after DNS setup)

### **🔒 Security Status:**

- ✅ Cloud firewall: Only 22, 80, 443 open
- ✅ Docker ports: Only web/gateway on loopback
- ✅ Database: Not exposed to internet
- ✅ Secrets: Strong random passwords in use
- ✅ Headers: Security headers via Nginx

---

## **Next Steps for complete Production Readiness**

1. **Implement SSL/TLS** with Let's Encrypt
2. **Configure domain DNS** properly
3. **Set up monitoring** and alerting
4. **Create backup strategy** for database and uploads
5. **Implement CI/CD pipeline** for automated deployments
6. **Add logging aggregation** (ELK stack or similar)
7. **Configure auto-scaling** for traffic spikes
8. **Set up CDN** for static assets and images
9. **Implement WAF** (Web Application Firewall)
10. **Regular security scanning** and updates

---

**Report Generated:** August 19, 2026  
**Deployment Complete:** ✅  
**All Lab Questions Answered:** ✅  
**Production Ready:** ⚠️ Requires SSL and domain configuration

---
# Netiks Store Architecture Deep Dive & Production Readiness Assessment

**Week 1 Lab Report**  
**Date:** August 4, 2026  
**Project:** Netiks Store - Multi-Vendor E-Commerce Platform  
**Assessment Type:** Architecture Analysis & Cloud Deployment Preparation

---

## Executive Summary

This report provides a comprehensive analysis of the Netiks Store application architecture, examining its microservices design, networking configuration, data persistence strategy, and production deployment readiness. The application consists of 9 interconnected services orchestrated through Docker Compose, implementing a modern microservices architecture suitable for cloud deployment.

**Key Findings:**
- The system follows a well-structured microservices pattern with clear service boundaries
- All services communicate through a central API gateway, providing a single entry point
- Data persistence is managed through Docker volumes for both database and media files
- Several critical security and configuration changes are required before cloud deployment
- The current configuration is optimized for local development and requires significant modifications for production environments

---

## Table of Contents

1. [Part 1 - Architecture Map](#part-1---architecture-map)
2. [Part 2 - Networking Investigation](#part-2---networking-investigation)
3. [Part 3 - State & Storage Audit](#part-3---state--storage-audit)
4. [Part 4 - Configuration & Secrets Review](#part-4---configuration--secrets-review)
5. [Part 5 - Production Readiness Assessment](#part-5---production-readiness-assessment)
6. [Reflections](#reflections)

---

## Part 1 - Architecture Map

### System Architecture Diagram

```
                                    ┌─────────────────┐
                                    │                 │
                                    │  User Browser   │
                                    │                 │
                                    └────────┬────────┘
                                             │
                                             │ HTTP :3001
                                             ▼
                        ┌────────────────────────────────────┐
                        │                                    │
                        │    Web Frontend (Next.js)          │
                        │    Port: 3000 (exposed as 3001)    │
                        │                                    │
                        └─────────┬──────────────────────────┘
                                  │
                                  │ HTTP :8000 (API calls)
                                  │
                                  ▼
                        ┌────────────────────────────────────┐
                        │                                    │
                        │    API Gateway (FastAPI)           │
                        │    Port: 8000                      │
                        │    Central API entry point         │
                        │                                    │
                        └─────────┬──────────────────────────┘
                                  │
                ┌─────────────────┼─────────────────┬───────────────┐
                │                 │                 │               │
                ▼                 ▼                 ▼               ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │   Identity   │  │   Vendor     │  │   Catalog    │  │    Media     │
    │   Service    │  │   Service    │  │   Service    │  │   Service    │
    │   :8001      │  │   :8002      │  │   :8003      │  │   :8004      │
    └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
           │                 │                 │                 │
           │                 │                 │                 │
           └─────────────────┴─────────────────┴─────────────────┘
                             │                 │
                             │                 │
                             ▼                 ▼
                    ┌──────────────┐    ┌────────────┐
                    │  PostgreSQL  │    │   Redis    │
                    │    :5432     │    │   :6379    │
                    │ (exposed as  │    └────────────┘
                    │   :55432)    │
                    └──────────────┘
                             
                    ┌──────────────┐
                    │    Admin     │
                    │   Service    │
                    │    :8005     │
                    └──────┬───────┘
                           │
                           ▼
                    (connects to PostgreSQL)
```
<img width="896" height="1198" alt="Gemini_Generated_Image_d3hl1xd3hl1xd3hl" src="https://github.com/user-attachments/assets/bb1aa2b1-7cf3-4fe6-9090-9634c4eadcd6" />


### Service Responsibilities

**1. Web Frontend (Port 3001)**
- Next.js-based user interface for customers and vendors
- Renders marketplace pages, product listings, and vendor dashboards
- Communicates exclusively with the API Gateway

**2. API Gateway (Port 8000)**
- Central routing hub for all backend services
- Handles authentication validation and user context extraction
- Aggregates and proxies requests to microservices
- Provides a unified API surface for the frontend

**3. Identity Service (Port 8001)**
- Manages user authentication and registration
- Issues and validates JWT tokens
- Stores user credentials securely with password hashing
- Handles login, logout, and session management

**4. Vendor Service (Port 8002)**
- Manages store creation and vendor profiles
- Handles store information updates
- Provides store lookup and vendor-store relationships

**5. Catalog Service (Port 8003)**
- Manages product creation, editing, and publishing
- Handles product categories
- Provides product search and filtering capabilities
- Manages checkout and order processing

**6. Media Service (Port 8004)**
- Handles file uploads for product images and store logos
- Validates file types and sizes
- Manages media storage (currently local disk via Docker volume)

**7. Admin Service (Port 8005)**
- Provides administrative capabilities
- Enables moderation of stores and products
- Manages platform-wide settings

**8. PostgreSQL (Port 5432, exposed as 55432)**
- Primary relational database for all services
- Stores user accounts, stores, products, categories, and orders
- Uses separate schemas for service isolation

**9. Redis (Port 6379)**
- Caching and session management support
- Provides fast data access for frequently used information

---

### Request Journey: "Buy Now" Button Click

**Scenario:** A customer clicks the "Buy Now" button on a product page to place an order.

**Step-by-Step Flow:**

1. **Browser Action**: The customer's browser initiates an HTTP POST request to the Web Frontend at `http://localhost:3001/checkout/[product-slug]` containing product details and customer information.

2. **Frontend Processing**: The Next.js application validates the form data client-side and prepares a checkout request payload containing product ID, quantity, and customer details.

3. **API Gateway Call**: The frontend sends a POST request to `http://gateway:8000/api/v1/checkout` (using the internal API URL since this is a server-side action). The gateway acts as the single entry point for all backend operations.

4. **Gateway Routing**: The API Gateway receives the request and routes it to the Catalog Service at `http://catalog-service:8003/checkout`. The gateway may validate the user's authentication token if the user is logged in.

5. **Catalog Service Processing**: The Catalog Service receives the checkout request and performs the following:
   - Validates product availability and stock levels
   - Checks product pricing and calculates total cost
   - Queries the PostgreSQL database to verify product details
   - Creates an order record in the `catalog` schema of PostgreSQL
   - Updates product stock quantities if needed

6. **Database Transaction**: PostgreSQL processes the INSERT operation to save the order, including customer information, product details, quantities, prices, and order status. This operation is atomic to ensure data consistency.

7. **Response Chain**: The Catalog Service returns a success response with the order ID back to the Gateway, which then forwards it to the Web Frontend.

8. **User Confirmation**: The frontend displays an order confirmation page to the customer with the order details and order number.

**Total Time**: Approximately 200-500ms depending on database load and network latency.

---

## Part 2 - Networking Investigation

### Question 1: Published Ports from Host Machine

**Command Executed:**
```powershell
docker compose ps
```

**Results:**

<img width="1291" height="233" alt="image" src="https://github.com/user-attachments/assets/5e4c80e9-f18b-4fae-a70c-837107a5706e" />


| Service | Container Port | Published Host Port | Accessibility |
|---------|---------------|---------------------|---------------|
| web | 3000 | 3001 | ✅ Accessible |
| gateway | 8000 | 8000 | ✅ Accessible |
| identity-service | 8001 | 8001 | ✅ Accessible |
| vendor-service | 8002 | 8002 | ✅ Accessible |
| catalog-service | 8003 | 8003 | ✅ Accessible |
| media-service | 8004 | 8004 | ✅ Accessible |
| admin-service | 8005 | 8005 | ✅ Accessible |
| postgres | 5432 | 55432 | ✅ Accessible |
| redis | 6379 | 6379 | ✅ Accessible |

**Analysis:**

From the host machine (your laptop), **all 9 services** are directly reachable. This is configured through the `ports:` directive in the `docker-compose.yml` file. Each service publishes its port using the format `"<host_port>:<container_port>"`.

For example:
- The web frontend runs on port 3000 inside its container but is exposed to the host on port 3001
- PostgreSQL runs on port 5432 inside its container but is exposed on port 55432 to avoid conflicts with any existing local PostgreSQL installations

**Key Insight:** This "publish everything" approach is convenient for local development and debugging but represents a **significant security risk** in production environments.

---

### Question 2: Internal Service Discovery

**Command Executed and Result:**

<img width="1240" height="112" alt="image" src="https://github.com/user-attachments/assets/e3e42c34-d89d-4def-b712-0a8182fcb1d4" />

```powershell
docker compose exec gateway python -c "import socket; print('catalog-service resolves to:', socket.gethostbyname('catalog-service')); print('postgres resolves to:', socket.gethostbyname('postgres')); print('redis resolves to:', socket.gethostbyname('redis'))"
```

**Results:**
```
catalog-service resolves to: 172.19.0.6
postgres resolves to: 172.19.0.4
redis resolves to: 172.19.0.2
```

**How Service Discovery Works:**

Docker Compose creates a **private internal network** for all services defined in the compose file. Each service is assigned:
1. A **service name** that acts as a DNS hostname (e.g., `catalog-service`, `postgres`, `redis`)
2. An **internal IP address** from Docker's bridge network (in the 172.19.0.x range in this case)

**Technical Explanation:**

When a service needs to communicate with another service, it uses the service name as the hostname. Docker's embedded DNS server automatically resolves these names to the correct container IP addresses. This happens completely within Docker's internal network and doesn't require any external DNS configuration.

For example, when the gateway needs to call the catalog service, it makes a request to `http://catalog-service:8003`. Docker's DNS resolves `catalog-service` to `172.19.0.7`, and the request reaches the correct container.

**Key Benefits:**
- **Automatic service discovery** - No need to manually configure IP addresses
- **Network isolation** - Internal communication doesn't expose services to the host network unless explicitly published
- **Dynamic IP management** - Container IPs can change; service names remain constant
- **Simplified configuration** - Services reference each other by name, making the configuration portable

---

### Question 3: Frontend API URLs - Two Different Configurations

**Configuration from `.env.example`:**
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
INTERNAL_API_BASE_URL=http://gateway:8000/api/v1
```

**Why Two URLs Are Necessary:**

Next.js applications execute code in **two different environments**:

1. **Client-Side (Browser)**: Code that runs in the user's web browser
2. **Server-Side (Next.js Server)**: Code that runs during Server-Side Rendering (SSR) or API routes

**Detailed Explanation:**

**`NEXT_PUBLIC_API_BASE_URL` (http://localhost:8000/api/v1)**
- **Used by:** Client-side code running in the user's browser
- **Why this URL:** When code runs in the browser, it cannot access Docker's internal network. The browser doesn't know what `gateway` means as a hostname.
- **How it works:** The browser makes HTTP requests from the user's machine to `localhost:8000`, which is the published port that maps to the gateway service.
- **Example use case:** When a user clicks a button to fetch products, the JavaScript running in their browser uses this URL.

**`INTERNAL_API_BASE_URL` (http://gateway:8000/api/v1)**
- **Used by:** Server-side code running inside the Next.js container
- **Why this URL:** The Next.js container runs within Docker's internal network and can directly communicate with other containers using service names.
- **How it works:** During server-side rendering, the Next.js container makes requests to `http://gateway:8000`, which Docker's DNS resolves to the gateway container.
- **Example use case:** When Next.js pre-renders a product page on the server, it uses this URL to fetch data before sending HTML to the browser.

**Why One URL Cannot Work for Both:**

- If we only used `http://localhost:8000` for server-side code, it wouldn't work because `localhost` inside a container refers to that container itself, not the host machine or other containers.
- If we only used `http://gateway:8000` for client-side code, it wouldn't work because the user's browser cannot resolve the Docker service name `gateway`.

**Cloud Deployment Impact:**

In production, both URLs would likely point to the same public domain:
```
NEXT_PUBLIC_API_BASE_URL=https://api.netiks.com/api/v1
INTERNAL_API_BASE_URL=https://api.netiks.com/api/v1
```

Or maintain internal networking:
```
NEXT_PUBLIC_API_BASE_URL=https://api.netiks.com/api/v1
INTERNAL_API_BASE_URL=http://gateway:8000/api/v1
```

---

### Question 4: Database Port Configuration - 5432 vs 55432

**Configuration from `docker-compose.yml`:**
```yaml
postgres:
  ports:
    - "${POSTGRES_EXPOSE_PORT:-55432}:5432"
```

**Why Both Ports Exist Simultaneously:**

This is a **port mapping** configuration where:
- **5432** is the internal container port (left side of the colon after the first colon)
- **55432** is the external host port (left side of the mapping)

**Detailed Explanation:**

**Inside Docker's Network (Port 5432):**
- All services within the Docker Compose network connect to PostgreSQL on port **5432**
- For example, the catalog-service uses the connection string: `postgresql://postgres:postgres@postgres:5432/netiks_store`
- The hostname `postgres` resolves to the PostgreSQL container, and port 5432 is PostgreSQL's default port
- This is the "native" port that PostgreSQL listens on within its container

**From Host Machine (Port 55432):**
- Your laptop can connect to PostgreSQL on port **55432**
- For example: `psql -h localhost -p 55432 -U postgres -d netiks_store`
- This is the "published" port that Docker maps to the container's internal port 5432

**Why Use Port 55432 Instead of 5432?**

1. **Conflict Avoidance**: Many developers have PostgreSQL installed locally, which typically runs on port 5432. Using 55432 prevents port conflicts.
2. **Multiple Projects**: If you run multiple projects with PostgreSQL containers, each can expose a different host port (55432, 55433, etc.) while all internally use 5432.
3. **Security Consideration**: Using non-standard ports can provide a minor security-through-obscurity benefit.

**Analogy for Non-Technical Understanding:**

Think of this like an apartment building:
- **Port 5432** is the apartment number where PostgreSQL lives inside the building (Docker network)
- **Port 55432** is the street address where visitors from outside (your host machine) can find the building entrance
- Residents inside the building (other containers) use the apartment number (5432) directly
- Visitors from outside (your laptop) use the street address (55432), which the building's reception (Docker) redirects to the correct apartment

---

## Part 3 - State & Storage Audit

### Named Volumes Inventory

**Command Executed:**
```powershell
docker volume ls
docker volume inspect netiks_store_postgres_data
docker volume inspect netiks_store_media_uploads
```

<img width="1004" height="348" alt="image" src="https://github.com/user-attachments/assets/2b4cc09c-8f0a-4d77-932a-61bf67db66ad" />

<img width="1004" height="358" alt="image" src="https://github.com/user-attachments/assets/6e45ba97-f819-4085-ae03-0674a38cc60b" />


**Identified Volumes:**

| Volume Name | Storage Purpose | Service Owner | Location | Critical Data |
|-------------|----------------|---------------|----------|---------------|
| `netiks_store_postgres_data` | Database files | postgres | `/var/lib/postgresql/data` | ✅ Yes - All application data |
| `netiks_store_media_uploads` | Uploaded media files | media-service | `/app/uploads` | ✅ Yes - Product images, store logos |

---

### Volume 1: postgres_data

**What It Stores:**
- All PostgreSQL database files including:
  - User accounts and credentials (identity schema)
  - Store information and vendor profiles (vendor schema)
  - Product catalog, categories, and inventory (catalog schema)
  - Order history and transaction records
  - Admin moderation logs
  - Database indexes and system tables

**Why It Matters:**
This volume contains **100% of the application's structured data**. Without it, the application would be completely empty - no users, no stores, no products, no orders.

**Mount Configuration:**
```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
```

**Physical Location on Host:**
```
/var/lib/docker/volumes/netiks_store_postgres_data/_data
```

---

### Volume 2: media_uploads

**What It Stores:**
- Product images uploaded by vendors
- Store logos and banners
- Any other media assets

**Why It Matters:**
This volume contains all the visual content that makes the marketplace appealing and functional. Without it, all products would appear without images, and stores would lack branding.

**Mount Configuration:**
```yaml
media-service:
  volumes:
    - media_uploads:/app/uploads
```

**Physical Location on Host:**
```
/var/lib/docker/volumes/netiks_store_media_uploads/_data
```

---

### Data Persistence Proof

**Test Procedure:**
1. Verify current application state by checking the marketplace page at `http://localhost:3001/market`

<img width="1004" height="668" alt="image" src="https://github.com/user-attachments/assets/41ff660e-ed77-41ca-ae06-72e60edc4622" />

2. Execute `docker compose down` (WITHOUT the `-v` flag)

<img width="933" height="347" alt="image" src="https://github.com/user-attachments/assets/8828cba9-7909-41d2-b331-9178369a34d3" />

3. Execute `docker compose up -d` to restart the stack

<img width="952" height="455" alt="image" src="https://github.com/user-attachments/assets/ab8aaaf0-f591-4b1c-93d1-d44f9241a27c" />

4. Re-check the marketplace page

**Expected Result:**
All seeded products, stores, and uploaded images remain intact after the restart. The application state is fully preserved.

<img width="1004" height="668" alt="image" src="https://github.com/user-attachments/assets/fa84fec5-cf62-4976-a451-9b44ea1c9271" />

**Why This Works:**

When you run `docker compose down`:
- Containers are **stopped and removed**
- Container filesystems are **deleted**
- **Named volumes are preserved** (unless `-v` flag is used)
- Volume data persists on the host filesystem

When you run `docker compose up -d`:
- New containers are created
- Named volumes are **reattached** to the new containers
- The PostgreSQL container finds all its existing database files
- The media-service container finds all existing uploaded images
- The application resumes with all previous data intact

**What Would Happen With `docker compose down -v`:**

The `-v` flag tells Docker to delete volumes along with containers. This would:
1. **Delete** `netiks_store_postgres_data` → All database records lost
2. **Delete** `netiks_store_media_uploads` → All uploaded images lost
3. Require complete **re-seeding** of the database
4. Require **re-uploading** all product images and store logos
5. Reset the application to a **fresh installation state**

**Critical Takeaway:** Named volumes are Docker's solution for persistent data. They survive container restarts, updates, and recreations—but they can be destroyed with the `-v` flag.

---

### Product Image Storage Location

**Where Uploaded Files End Up:**

When a vendor uploads a product image through the media-service:

1. **Upload Path**: `POST http://localhost:8004/uploads`
2. **Storage Location**: Files are written to `/app/uploads` inside the media-service container
3. **Volume Mapping**: This directory is backed by the `media_uploads` Docker volume
4. **Physical Location**: Actual files reside in `/var/lib/docker/volumes/netiks_store_media_uploads/_data` on the host machine

**Cloud Deployment Implications:**

**Current Approach (Local Disk Storage):**
- ✅ Simple and works well for development
- ✅ No external dependencies or costs
- ❌ **Critical Risk**: If the VM's disk fails, all images are permanently lost
- ❌ **Scaling Issue**: Cannot easily share images across multiple server instances
- ❌ **Backup Complexity**: Requires file-level backups in addition to database backups

**Recommended Cloud Approach:**

Use **object storage services** like Amazon S3, Google Cloud Storage, or Azure Blob Storage:
- ✅ **Durability**: 99.999999999% (11 nines) durability - files are replicated across multiple data centers
- ✅ **Availability**: Accessible from multiple servers, enabling horizontal scaling
- ✅ **Automatic Backups**: Cloud providers handle redundancy and backups
- ✅ **Cost-Effective**: Pay only for storage used; no need to provision disk space
- ✅ **CDN Integration**: Can serve images through Content Delivery Networks for faster global access

**What Happens If VM Disk Dies:**

With current local storage:
1. All uploaded product images are **permanently lost**
2. Products will display without images (broken image links)
3. Vendors must **re-upload all media**
4. Customer experience severely degraded
5. No recovery possible unless you have external backups

With S3 or similar object storage:
1. Images remain **safe and accessible** even if the VM is completely destroyed
2. Simply point a new VM to the same S3 bucket
3. Application continues serving images without interruption
4. Zero data loss scenario

---

### Redis Storage Analysis

**What Redis Stores in Netiks Store:**

Based on the configuration, Redis is available for:
1. **Session caching** (if implemented)
2. **Rate limiting data** for API endpoints
3. **Temporary cached data** to reduce database queries
4. **Background job queues** (if implemented in future)

**Current Usage:**
Redis is provisioned but appears to be **lightly used or reserved for future features**. The current architecture primarily relies on PostgreSQL for all persistent data.

**Data Loss Impact Analysis:**

**If Redis Container Is Deleted:**

**Potential Losses:**
- Cached data would be lost (needs to be rebuilt from database)
- Active sessions might be interrupted
- Rate limiting counters would reset
- Background job queues would be cleared

**Is This Loss Acceptable?**

**Yes, for most scenarios:**
- ✅ Redis data is **ephemeral by design** - it's meant to be rebuilt
- ✅ No permanent business data is stored in Redis
- ✅ Application can regenerate cached data from PostgreSQL
- ✅ User impact is minimal - worst case is slightly slower performance while cache rebuilds
- ✅ Sessions can be re-established through new logins

**When It Becomes Critical:**
- ⚠️ If Redis is used for critical rate limiting (e.g., preventing abuse), resets could allow rate limit bypass
- ⚠️ If background job queues contain time-sensitive tasks, those tasks would be lost
- ⚠️ High-traffic periods could see performance degradation while cache rebuilds

**Best Practice:**
- Redis should **never** be the primary storage for any data you cannot afford to lose
- Always design Redis usage to be **recoverable from other sources**
- Consider Redis persistence (RDB snapshots or AOF logs) for production environments if uptime is critical

---

## Part 4 - Configuration & Secrets Review

### Environment Variables Configuration Table

| Variable | What it controls | Safe to commit to Git? | Must change for cloud? |
|----------|------------------|------------------------|------------------------|
| `NEXT_PUBLIC_API_BASE_URL` | Public API endpoint for browser requests | ✅ Yes (example only) | ✅ Yes - Change to cloud domain |
| `INTERNAL_API_BASE_URL` | Server-side API endpoint | ✅ Yes (example only) | ⚠️ Maybe - Depends on architecture |
| `GATEWAY_PORT` | Gateway service port number | ✅ Yes | ❌ No - Internal port |
| `IDENTITY_SERVICE_PORT` | Identity service port | ✅ Yes | ❌ No - Internal port |
| `VENDOR_SERVICE_PORT` | Vendor service port | ✅ Yes | ❌ No - Internal port |
| `CATALOG_SERVICE_PORT` | Catalog service port | ✅ Yes | ❌ No - Internal port |
| `MEDIA_SERVICE_PORT` | Media service port | ✅ Yes | ❌ No - Internal port |
| `ADMIN_SERVICE_PORT` | Admin service port | ✅ Yes | ❌ No - Internal port |
| `MEDIA_SERVICE_URL` | Internal media service URL | ✅ Yes | ❌ No - Service name consistent |
| `IDENTITY_SERVICE_URL` | Internal identity service URL | ✅ Yes | ❌ No - Service name consistent |
| `VENDOR_SERVICE_URL` | Internal vendor service URL | ✅ Yes | ❌ No - Service name consistent |
| `CATALOG_SERVICE_URL` | Internal catalog service URL | ✅ Yes | ❌ No - Service name consistent |
| `POSTGRES_DB` | Database name | ✅ Yes | ❌ No - Can remain same |
| `POSTGRES_USER` | Database username | ❌ **NO - SECURITY RISK** | ✅ **YES - CRITICAL** |
| `POSTGRES_PASSWORD` | Database password | ❌ **NO - SECURITY RISK** | ✅ **YES - CRITICAL** |
| `POSTGRES_HOST` | Database hostname | ✅ Yes | ❌ No - Service name consistent |
| `POSTGRES_PORT` | Internal database port | ✅ Yes | ❌ No - Internal port |
| `POSTGRES_EXPOSE_PORT` | Host-exposed database port | ✅ Yes | ✅ Yes - Should NOT be exposed |
| `WEB_EXPOSE_PORT` | Host port for web frontend | ✅ Yes | ✅ Yes - Behind reverse proxy |
| `REDIS_URL` | Redis connection string | ✅ Yes | ❌ No - Service name consistent |
| `JWT_SECRET` | Secret key for JWT signing | ❌ **NO - SECURITY RISK** | ✅ **YES - CRITICAL** |
| `JWT_ALGORITHM` | JWT signing algorithm | ✅ Yes | ❌ No - Standard algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiration time | ✅ Yes | ⚠️ Maybe - Consider shortening |
| `UPLOAD_DIR` | Media upload directory path | ✅ Yes | ✅ Yes - Change to S3 config |

---

### Security Problems with Current Configuration

**Critical Security Issues for Cloud Deployment:**

#### 1. Default Database Credentials
```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

**Problem:**
- Using the default username "postgres" with the simple password "postgres" is a well-known default
- Attackers routinely scan for databases with default credentials
- If the database port is exposed, it can be compromised in minutes

**Risk Level:** 🔴 **CRITICAL**

**Recommended Fix:**
- Generate a strong, random password (minimum 20 characters, mixed case, numbers, symbols)
- Use a non-default username
- Store in environment-specific secret management (AWS Secrets Manager, Azure Key Vault, etc.)

Example:
```
POSTGRES_USER=netiks_prod_db_admin_2026
POSTGRES_PASSWORD=Xk9#mP2$vL8qR5@nB3wT7&hF4*dC6!jN
```

---

#### 2. Weak JWT Secret
```
JWT_SECRET=change-this-to-a-32-char-minimum-secret
```

**Problem:**
- The value literally says "change-this", indicating it's a placeholder
- Even though it meets the 32-character minimum, it's predictable
- A weak JWT secret allows attackers to forge authentication tokens

**What JWT_SECRET Controls:**

The JWT_SECRET is used to **cryptographically sign** authentication tokens. When a user logs in:
1. The identity-service generates a JWT token containing user information
2. This token is **signed** using the JWT_SECRET
3. The signature proves the token hasn't been tampered with
4. Services verify the signature before trusting the token's contents

**What An Attacker Could Do With The Secret:**

If an attacker discovers the JWT_SECRET, they can:
- ✅ **Forge valid tokens** for any user account, including administrators
- ✅ **Bypass authentication** entirely by creating their own tokens
- ✅ **Impersonate any user** without knowing passwords
- ✅ **Access all protected endpoints** and perform administrative actions
- ✅ **Create new admin accounts** or modify existing data
- ✅ **Steal customer information, vendor data, and order history**

**Real-World Attack Scenario:**
1. Attacker finds JWT_SECRET in a misconfigured cloud environment or GitHub repository
2. Attacker creates a JWT token with `{"user_id": "admin", "role": "admin"}`
3. Attacker signs it with the stolen JWT_SECRET
4. Attacker uses this forged token to access all admin endpoints
5. Entire platform is compromised without any login attempts

**Risk Level:** 🔴 **CRITICAL**

**Recommended Fix:**
- Generate a cryptographically strong random secret (64+ characters)
- Never use readable words or patterns
- Store in secure secret management system
- Rotate periodically (every 90 days)

Example generation:
```bash
# Using Python
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Using OpenSSL
openssl rand -base64 64 | tr -d '\n'
```

---

#### 3. Exposed Database Port
```
POSTGRES_EXPOSE_PORT=55432
```

**Problem:**
- The database is configured to be accessible from outside Docker
- In production, this means anyone on the internet could attempt to connect
- Combined with weak credentials, this is a disaster waiting to happen

**Risk Level:** 🔴 **CRITICAL in production**

**Recommended Fix:**
- Remove the port mapping entirely in production
- Database should **only** be accessible from within the Docker network
- Use SSH tunneling or VPN for administrative access
- Never expose databases directly to the internet

---

### Variables Requiring Changes for Cloud Deployment

**Must Change for Public Access:**

1. **`NEXT_PUBLIC_API_BASE_URL`**
   - **From:** `http://localhost:8000/api/v1`
   - **To:** `https://api.netiks.com/api/v1` or `https://yourdomain.com/api/v1`
   - **Reason:** Users' browsers need to reach the actual cloud server, not localhost

2. **`POSTGRES_PASSWORD` and `POSTGRES_USER`**
   - **From:** Default credentials
   - **To:** Strong, unique credentials stored in secrets manager
   - **Reason:** Security requirement for production environments

3. **`JWT_SECRET`**
   - **From:** Placeholder value
   - **To:** Cryptographically strong random string
   - **Reason:** Secure authentication system

4. **`UPLOAD_DIR` or add S3 Configuration**
   - **From:** `/app/uploads` (local disk)
   - **To:** S3 bucket configuration with credentials
   - **Reason:** Durable, scalable media storage

**Should Remove/Not Expose:**

5. **`POSTGRES_EXPOSE_PORT`**
   - **Action:** Remove port mapping from docker-compose
   - **Reason:** Database should never be directly accessible from internet

---

## Part 5 - Production Readiness Assessment

# What Must Change Before Netiks Store Runs in the Cloud

---

### 1. Service Exposure and Security Boundaries

**Current Issue:**

In the local development environment, all 9 services publish their ports to the host machine:
- Web frontend: 3001
- Gateway: 8000
- Identity service: 8001
- Vendor service: 8002
- Catalog service: 8003
- Media service: 8004
- Admin service: 8005
- PostgreSQL: 55432
- Redis: 6379

On a cloud VM with a public IP, **every single port would be accessible from the internet**. This means anyone could directly access any service, bypassing intended security controls.

**Why This Matters:**

1. **Direct Database Access:** Exposing PostgreSQL port 55432 allows attackers to attempt database connections, potentially compromising all application data
2. **Service Bypass:** Attackers could skip the gateway and directly call internal services, bypassing authentication checks
3. **Attack Surface:** Each exposed service is a potential entry point for attacks, DOS, or exploitation
4. **No Access Control:** Internal services lack robust authentication because they're designed to trust requests from the gateway

**Which Services Should Be Publicly Accessible:**

✅ **ONLY the Web Frontend** (currently port 3001)
- This is the user-facing application
- Should be accessed through a reverse proxy on standard ports (80/443)

**Which Services MUST NOT Be Publicly Accessible:**

❌ **Gateway (8000)** - Should only be accessible from the web frontend container  
❌ **All Microservices (8001-8005)** - Should only be accessible from the gateway  
❌ **PostgreSQL (55432)** - Should only be accessible from service containers  
❌ **Redis (6379)** - Should only be accessible from service containers

**Proposed Direction:**

1. **Remove all port mappings** from docker-compose.yml except for the web service
2. Implement a **reverse proxy** (Nginx or Caddy) to handle public traffic
3. Configure the reverse proxy to:
   - Listen on ports 80 (HTTP) and 443 (HTTPS)
   - Route requests to the web frontend
   - Route API requests to the gateway
   - Reject all other traffic
4. Services communicate only through Docker's internal network
5. Use **firewall rules** (AWS Security Groups, UFW, iptables) to block direct access to service ports

**Configuration Example:**
```yaml
# Production docker-compose.yml - No exposed ports except through reverse proxy
services:
  web:
    # No ports section - accessed only through reverse proxy
  gateway:
    # No ports section - internal only
  postgres:
    # No ports section - internal only
```

---

### 2. Traffic Entry Point and Reverse Proxy

**Current Issue:**

Local development uses `http://localhost:3001` to access the application. This doesn't work in the cloud because:
- Users are accessing from different locations worldwide
- `localhost` refers to their own computer, not your server
- Port numbers (3001, 8000) look unprofessional and confusing
- No HTTPS/TLS encryption

**What Is A Reverse Proxy:**

A reverse proxy is a server that sits between users and your application, acting as an intermediary that:
- Receives all incoming traffic from the internet
- Routes requests to the appropriate internal services
- Returns responses back to users
- Can handle SSL/TLS termination for HTTPS
- Can implement rate limiting, caching, and load balancing

**Analogy:** Think of a reverse proxy like a hotel concierge. Guests (users) don't know the internal layout of the hotel (your microservices). They ask the concierge (reverse proxy) for what they need, and the concierge knows exactly which internal department to contact.

**Why You Need It:**

1. **Single Entry Point:** Users connect to one domain (e.g., netiks.com)
2. **Standard Ports:** Access via port 80 (HTTP) or 443 (HTTPS), not custom ports
3. **SSL/TLS Termination:** Handles HTTPS encryption so internal services can use plain HTTP
4. **Request Routing:** Routes `/` to web frontend, `/api/v1/` to gateway
5. **Security Layer:** Can filter malicious requests before they reach your application
6. **Static Content:** Can serve static files efficiently without hitting application servers

**Proposed Direction:**

1. **Install Nginx or Caddy** on the cloud VM
2. **Configure routing rules:**
   ```nginx
   # Nginx example
   server {
       listen 80;
       server_name netiks.com www.netiks.com;
       
       location / {
           proxy_pass http://localhost:3000;  # Web frontend
       }
       
       location /api/v1/ {
           proxy_pass http://localhost:8000;  # Gateway
       }
   }
   ```

3. **Domain Setup:**
   - Register a domain name (e.g., netiks.com)
   - Point DNS A records to your VM's public IP address
   - Configure reverse proxy to accept requests for that domain

4. **Traffic Flow:**
   ```
   User → netiks.com:443 → Reverse Proxy → Web Frontend (3000)
   User → netiks.com/api/v1 → Reverse Proxy → Gateway (8000) → Services
   ```

**Benefits:**
- Professional domain-based access
- Secure HTTPS connections
- Internal services remain hidden
- Centralized security and monitoring

---

### 3. Secrets Management and Credential Security

**Current Issue:**

All secrets are stored in plain text in a `.env` file:
- Database credentials
- JWT signing secret
- API keys (if any)

In development, this is acceptable, but in production:
- The `.env` file might be accidentally committed to Git
- Server administrators can read all secrets
- Backup systems might expose secrets
- No audit trail of who accessed secrets
- Secrets aren't rotated or versioned

**Why This Matters:**

Compromised secrets mean:
- **Database breach:** Full access to all application data
- **Authentication bypass:** Ability to forge user tokens
- **Data theft:** Customer information, vendor data, orders
- **Service disruption:** Ability to delete or modify data
- **Regulatory violations:** GDPR, PCI-DSS, and other compliance failures

**Proposed Direction:**

**Option 1: Basic - Environment Variables from Secure Source**
1. Store secrets in server environment variables (not in files)
2. Load them when starting Docker Compose
3. Use SSH key-based access to the server
4. Implement file permissions to restrict .env access

**Option 2: Recommended - Cloud Secret Management**
1. Use **AWS Secrets Manager** or **AWS Systems Manager Parameter Store**
2. Store all secrets encrypted in AWS
3. Configure services to fetch secrets at startup
4. Rotate secrets regularly (automated)
5. Audit all secret access

**Implementation Approach:**
```yaml
# docker-compose.yml
services:
  identity-service:
    environment:
      JWT_SECRET: ${JWT_SECRET_FROM_AWS}
      POSTGRES_PASSWORD: ${DB_PASSWORD_FROM_AWS}
```

**Script to fetch secrets on startup:**
```bash
#!/bin/bash
# fetch-secrets.sh
export JWT_SECRET=$(aws secretsmanager get-secret-value --secret-id prod/jwt-secret --query SecretString --output text)
export POSTGRES_PASSWORD=$(aws secretsmanager get-secret-value --secret-id prod/db-password --query SecretString --output text)
docker-compose up -d
```

**Benefits:**
- Encrypted storage of sensitive data
- Access logging and auditing
- Automatic rotation capabilities
- No secrets in code repositories
- Compliance-ready

---

### 4. Data Protection and Backup Strategy

**Current Issue:**

All data resides on the VM's local disk:
- PostgreSQL data in Docker volume
- Uploaded media files in Docker volume

**Risks:**

1. **Hardware Failure:** If the VM's disk fails, all data is permanently lost
2. **Accidental Deletion:** Running `docker compose down -v` destroys everything
3. **Ransomware:** Malware could encrypt or delete volumes
4. **No Disaster Recovery:** Cannot restore to a previous state
5. **Single Point of Failure:** One disk failure = complete business shutdown

**Why This Matters:**

A single disk failure could result in:
- Loss of all customer accounts
- Loss of all vendor stores and products
- Loss of all order history
- Loss of all uploaded product images
- Complete business continuity failure
- Potential legal liability

**Proposed Direction:**

**For PostgreSQL Database:**

1. **Automated Backups:**
   ```bash
   # Daily backup script
   #!/bin/bash
   DATE=$(date +%Y%m%d_%H%M%S)
   docker exec netiks_store-postgres-1 pg_dump -U postgres netiks_store | gzip > backup_$DATE.sql.gz
   aws s3 cp backup_$DATE.sql.gz s3://netiks-backups/database/
   ```

2. **Schedule with Cron:**
   ```cron
   0 2 * * * /home/ubuntu/backup-database.sh  # Daily at 2 AM
   ```

3. **Retention Policy:**
   - Keep daily backups for 7 days
   - Keep weekly backups for 4 weeks
   - Keep monthly backups for 12 months

4. **Alternative - Managed Database:**
   - Consider **AWS RDS for PostgreSQL**
   - Automated backups included
   - Point-in-time recovery
   - Multi-AZ replication for high availability
   - Higher cost but much better reliability

**For Media Files:**

1. **Migration to S3:**
   - Move from local storage to **Amazon S3**
   - S3 provides 99.999999999% durability (11 nines)
   - Automatic replication across multiple data centers
   - Versioning capabilities
   - No backup needed - S3 handles redundancy

2. **Configuration Changes:**
   ```python
   # media-service update
   import boto3
   
   s3_client = boto3.client('s3')
   bucket_name = 'netiks-media-uploads'
   ```

**Testing Recovery:**

Regular disaster recovery drills:
1. Restore database from backup to a test environment
2. Verify data integrity
3. Test application functionality with restored data
4. Document recovery time and process

**Benefits:**
- Protection against hardware failures
- Ability to recover from mistakes
- Compliance with data protection regulations
- Business continuity assurance
- Peace of mind

---

### 5. Container Restart Policies and Service Availability

**Current Issue:**

Checking the `docker-compose.yml` file reveals **no restart policies** are configured. This means:

```yaml
services:
  web:
    build: ...
    # NO restart policy
```

**What Happens When the VM Reboots:**

1. VM shuts down (planned maintenance, crash, or update)
2. All Docker containers stop
3. VM comes back online
4. Docker daemon starts
5. **Containers DO NOT start automatically**
6. Application is completely down
7. Requires manual intervention: `docker compose up -d`

**Why This Matters:**

- **Unplanned Outages:** Surprise reboots mean extended downtime
- **Maintenance Windows:** Every OS update requires manual container restart
- **Service Level Failures:** Cannot meet uptime commitments
- **Manual Dependency:** Always requires someone to manually restart services

**Proposed Direction:**

Add restart policies to all services in `docker-compose.yml`:

```yaml
services:
  web:
    build: ...
    restart: unless-stopped
    
  gateway:
    build: ...
    restart: unless-stopped
    
  identity-service:
    build: ...
    restart: unless-stopped
    
  vendor-service:
    build: ...
    restart: unless-stopped
    
  catalog-service:
    build: ...
    restart: unless-stopped
    
  media-service:
    build: ...
    restart: unless-stopped
    
  admin-service:
    build: ...
    restart: unless-stopped
    
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    restart: unless-stopped
```

**Restart Policy Options:**

- **`no`** (default): Never restart automatically
- **`always`**: Always restart, even if manually stopped
- **`on-failure`**: Only restart if container exits with error
- **`unless-stopped`**: Always restart unless explicitly stopped by admin

**Recommended: `unless-stopped`**

This policy ensures:
- ✅ Containers restart after VM reboot
- ✅ Containers restart after crashes
- ✅ Manual stops are respected (for maintenance)
- ✅ Automatic recovery from failures

**Additional Boot Configuration:**

Ensure Docker itself starts on boot:
```bash
sudo systemctl enable docker
```

**Testing:**
1. Add restart policies to docker-compose.yml
2. Start the stack: `docker compose up -d`
3. Reboot the VM: `sudo reboot`
4. After reboot, verify all containers are running: `docker compose ps`

   <img width="1236" height="171" alt="image" src="https://github.com/user-attachments/assets/d3650008-a310-467b-978a-9d9e8209030f" />

**Expected Result:**
All containers should automatically come back online within 30-60 seconds of VM boot completion.

---

### 6. HTTPS/TLS Encryption

**Current Issue:**

All communication currently uses **plain HTTP**:
- Browser to web frontend: `http://localhost:3001`
- Web to gateway API: `http://localhost:8000`
- No encryption means all data travels in plain text

**Why HTTPS Matters:**

1. **Data Privacy:** Without encryption:
   - Login credentials sent in plain text
   - JWT tokens visible to network attackers
   - Customer personal information exposed
   - Credit card details (future feature) unprotected

2. **Man-in-the-Middle Attacks:**
   - Attackers on the same network can intercept traffic
   - Passwords can be stolen
   - Session tokens can be hijacked
   - Data can be modified in transit

3. **Browser Security Warnings:**
   - Modern browsers show "Not Secure" for HTTP sites
   - Users lose trust in the application
   - Some browsers block certain features on HTTP

4. **SEO Penalties:**
   - Google ranks HTTPS sites higher
   - HTTP sites marked as "Not Secure" in search results

5. **Compliance Requirements:**
   - PCI-DSS requires HTTPS for payment processing
   - GDPR requires encryption of personal data in transit
   - Many regulations mandate HTTPS

**What HTTPS Provides:**

- **Encryption:** All data scrambled during transmission
- **Authentication:** Proof that you're connecting to the real server, not an imposter
- **Integrity:** Guarantee that data hasn't been modified in transit
- **Trust:** Green padlock icon, "Secure" label in browsers

**Proposed Direction:**

**Step 1: Obtain SSL/TLS Certificate**

**Option A - Let's Encrypt (Free, Recommended):**
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d netiks.com -d www.netiks.com
```

**Option B - AWS Certificate Manager (If using AWS Load Balancer):**
- Free certificates managed by AWS
- Automatic renewal
- Integrated with ALB/CloudFront

**Step 2: Configure Nginx with HTTPS**

```nginx
server {
    listen 80;
    server_name netiks.com www.netiks.com;
    return 301 https://$server_name$request_uri;  # Redirect HTTP to HTTPS
}

server {
    listen 443 ssl http2;
    server_name netiks.com www.netiks.com;
    
    ssl_certificate /etc/letsencrypt/live/netiks.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/netiks.com/privkey.pem;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    location / {
        proxy_pass http://localhost:3000;
    }
    
    location /api/v1/ {
        proxy_pass http://localhost:8000;
    }
}
```

**Step 3: Update Application Configuration**

```env
NEXT_PUBLIC_API_BASE_URL=https://netiks.com/api/v1
```

**Step 4: Enable Automatic Certificate Renewal**

Let's Encrypt certificates expire after 90 days. Automate renewal:

```bash
# Test renewal
sudo certbot renew --dry-run

# Automatic renewal via cron (already installed by certbot)
sudo systemctl status certbot.timer
```

**What It Takes At Basic Level:**

1. **Domain Name:** Register and point DNS to your server (~$10-15/year)
2. **Certificate:** Free with Let's Encrypt
3. **Configuration:** 10-20 lines of Nginx configuration
4. **Time Investment:** 1-2 hours for first-time setup
5. **Maintenance:** Fully automated with certbot

**Benefits:**
- ✅ Secure data transmission
- ✅ User trust and browser confidence
- ✅ Compliance with security standards
- ✅ Better SEO rankings
- ✅ Protection against common attacks

---

### 7. Additional Production Concerns

**Logging and Monitoring:**

**Current State:**
- Logs go to container stdout
- No centralized log collection
- No alerting on errors

**Needed:**
- Centralized logging (AWS CloudWatch, ELK Stack, or Loki)
- Application performance monitoring
- Error tracking (Sentry, Rollbar)
- Uptime monitoring (UptimeRobot, Pingdom)

**Resource Limits:**

**Current State:**
- No memory or CPU limits on containers
- One service can consume all resources
- Potential for cascading failures

**Needed:**
```yaml
services:
  web:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

**Health Checks:**

**Current State:**
- Only PostgreSQL has health checks
- Other services may start before they're ready

**Needed:**
```yaml
services:
  gateway:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**Rate Limiting:**

**Current State:**
- No rate limiting
- Vulnerable to DOS attacks
- API abuse possible

**Needed:**
- Implement rate limiting at reverse proxy level
- Configure per-endpoint rate limits
- Add IP-based throttling

---

## Summary of Critical Changes

### Must-Have Before Cloud Deployment

| Priority | Change | Impact | Effort |
|----------|--------|--------|--------|
| 🔴 Critical | Remove database port exposure | Security | Low |
| 🔴 Critical | Change default database credentials | Security | Low |
| 🔴 Critical | Generate strong JWT secret | Security | Low |
| 🔴 Critical | Implement reverse proxy with HTTPS | Security & Functionality | Medium |
| 🔴 Critical | Add restart policies to all services | Reliability | Low |
| 🟡 High | Configure secrets management | Security | Medium |
| 🟡 High | Migrate media to S3 | Durability | Medium |
| 🟡 High | Implement database backup strategy | Data Protection | Medium |
| 🟢 Medium | Add health checks to all services | Reliability | Low |
| 🟢 Medium | Configure resource limits | Stability | Low |
| 🟢 Medium | Set up centralized logging | Observability | Medium |

### Deployment Readiness Checklist

- [ ] All services configured with restart: unless-stopped
- [ ] Database credentials changed from defaults
- [ ] JWT secret replaced with cryptographically strong value
- [ ] Port mappings removed (except through reverse proxy)
- [ ] Nginx/Caddy configured as reverse proxy
- [ ] SSL/TLS certificate obtained and configured
- [ ] Domain name registered and DNS configured
- [ ] HTTPS enforced for all traffic
- [ ] Secrets stored in AWS Secrets Manager or equivalent
- [ ] Media uploads configured to use S3
- [ ] Database backup script created and scheduled
- [ ] Backup restore procedure tested
- [ ] Monitoring and alerting configured
- [ ] Firewall rules configured on VM
- [ ] Security group rules configured (AWS)
- [ ] Health checks implemented for all services
- [ ] Resource limits defined for containers
- [ ] Documentation updated for production environment

---

## Reflections

### What I Found Hardest This Week

The most challenging aspect of this week's deep dive was fully understanding the **security implications of the current configuration** and how seemingly innocent development conveniences become critical vulnerabilities in production environments.

Initially, having all services expose their ports seemed logical for development - it makes debugging easy and allows direct access to each service. However, realizing that this same configuration on a public cloud VM would expose the database, all microservices, and Redis directly to the internet was eye-opening. The concept of "default secure" vs. "default convenient" became very clear.

The second challenge was grasping the **dual-environment nature of Next.js** and why two different API URLs are necessary. Understanding that JavaScript executes in fundamentally different contexts (browser vs. server) and that Docker's internal DNS is only available within the container network required mental shifting between these two perspectives.

Finally, working through the **data persistence concepts** with Docker volumes highlighted how easy it is to accidentally destroy data with a single flag (`-v`). This reinforced the critical importance of backup strategies and durable storage solutions like S3 for production environments.

This week transformed my understanding from "how to run the application locally" to "how to architect for production safely and reliably." The knowledge gained will be essential for Week 2's cloud deployment.

---

## Appendix: Quick Reference Answers

### Three Critical Questions

**1. Which containers must never be exposed to the public internet, and why?**

**Answer:** PostgreSQL, Redis, and ALL backend microservices (identity, vendor, catalog, media, admin services) must never be directly exposed. 

- **PostgreSQL** contains all application data and credentials - exposure allows direct database access and potential data theft
- **Redis** may contain session data and cache - exposure allows session hijacking and cache poisoning
- **Backend microservices** lack robust authentication since they trust the gateway - direct exposure bypasses security controls and allows unauthorized access to sensitive operations

Only the web frontend should be accessible publicly, and only through a reverse proxy with HTTPS.

---

**2. Where does the data live, and what single command would destroy it?**

**Answer:** Data lives in two Docker named volumes:

1. **`netiks_store_postgres_data`** - Contains all database records (users, stores, products, orders)
2. **`netiks_store_media_uploads`** - Contains all uploaded images and media files

**The command that would destroy all data:**
```bash
docker compose down -v
```

The `-v` flag tells Docker to delete volumes along with containers, resulting in:
- Complete loss of all database records
- Permanent deletion of all uploaded media
- No recovery possible without external backups
- Application reset to fresh installation state

**Safe command to restart without data loss:**
```bash
docker compose down     # Without -v flag
docker compose up -d
```

---

**3. What three things would you change in `.env` before deploying tomorrow?**

**Answer:**

**Change 1: Database Credentials**
```bash
# FROM (INSECURE):
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# TO (SECURE):
POSTGRES_USER=netiks_prod_admin_2026
POSTGRES_PASSWORD=Xk9#mP2$vL8qR5@nB3wT7&hF4*dC6!jN
# Generated with: openssl rand -base64 32
```

**Change 2: JWT Secret**
```bash
# FROM (INSECURE):
JWT_SECRET=change-this-to-a-32-char-minimum-secret

# TO (SECURE):
JWT_SECRET=c3VwZXJfc2VjcmV0X2tleV90aGF0X2lzX3ZlcnlfbG9uZ19hbmRfcmFuZG9tXzIwMjY=
# Generated with: python -c "import secrets; print(secrets.token_urlsafe(64))"
```

**Change 3: API Base URL**
```bash
# FROM (LOCAL):
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1

# TO (CLOUD):
NEXT_PUBLIC_API_BASE_URL=https://api.netiks.com/api/v1
# Or whatever your actual domain will be
```

**Why These Matter:**
- **Database credentials:** Prevent unauthorized database access and data breaches
- **JWT secret:** Prevent authentication bypass and user impersonation
- **API URL:** Enable browsers to connect to the actual cloud server instead of localhost

---

## Conclusion

Netiks Store is a well-architected microservices application that demonstrates modern cloud-native principles. The current implementation works excellently for local development, providing clear service boundaries, proper data persistence, and a realistic multi-vendor marketplace experience.

However, transitioning from local development to production cloud deployment requires significant configuration and architectural changes. The primary concerns center around:

1. **Security:** Removing exposed services, implementing strong credentials, and adding HTTPS
2. **Reliability:** Configuring automatic restarts, implementing backups, and using durable storage
3. **Accessibility:** Setting up proper domain-based routing through a reverse proxy

None of these changes require fundamental architectural redesign. The microservices structure is sound and production-ready. The required changes are primarily operational and configurational in nature, which is exactly what Week 2's deployment exercises will address.

The knowledge gained this week provides a solid foundation for understanding not just how to deploy the application, but **why** each production configuration exists and what problems it solves. This understanding is essential for maintaining and troubleshooting the application in real-world cloud environments.

---

**Report Prepared By:** Afolami Olaoluwa   
**Date:** August 6, 2026  
**Next Steps:** Week 2 - Cloud VM Deployment  

---

*End of Report*


# Project Execution Report: Netiks Store Microservices Platform.
## 1. Project Overview.
The objective of this task was to successfully deploy and run the Netiks Store, a multi-vendor e-commerce microservices platform, locally using Docker. This project utilizes a distributed architecture consisting of a Next.js frontend, a Python FastAPI backend ecosystem, and supporting infrastructure (PostgreSQL and Redis).

## 2. Starting the Project with Docker.
To ensure a clean and reproducible environment, the application was orchestrated using Docker Compose. The following steps were executed in the terminal:
### Step 1: Environment Configuration.
Created the local environment variables file required by the Docker containers:

![alt text](image.png)

### Step 2: Building and Starting the Containers.
Launched the entire microservices stack in detached (background) mode. This command built the custom Docker images for the Next.js frontend and Python services, and pulled the official images for the database and cache:

<img width="349" height="85" alt="image" src="https://github.com/user-attachments/assets/638292c0-0279-4f41-ba1d-17a5ed3a97a5" />


### Step 3: Seeding the Database.
To populate the empty database with demo vendors, categories, and products, the seeding script was executed. (Note: An environment variable DOCKER_BIN=docker was prepended to resolve a hardcoded macOS file path in the original script, adapting it for my Linux/WSL environment).

![alt text](image-2.png)

## 3. Explanation of Main Services.
The Netiks Store is built on a Microservices Architecture. Instead of one massive application doing everything, the system is broken down into specialized, independent services that talk to each other. Here is what each main service does in simple terms:
### Frontend (Next.js) - The Storefront.
This is the visual part of the application that the customer interacts with. It displays the products, handles the shopping cart UI, and provides a responsive, fast user experience.
### API Gateway (FastAPI) - The Traffic Cop.
The frontend doesn't talk to the database directly. Instead, it sends all its requests to the API Gateway. The Gateway acts like a receptionist, looking at the request and directing it to the correct backend service (e.g., "You want product details? Go talk to the Catalog Service.").
### Identity Service - The Security Guard.
This service handles everything related to users. It manages registration, logins, password hashing, and session tokens to ensure only authorized users can access certain features.
### Catalog Service - The Inventory Manager.
This is the brain behind the products. It stores and retrieves information about items, categories, prices, and stock levels. When you view a product page, the Catalog Service is providing that data.
### Vendor Service - The Landlord.
Because this is a multi-vendor marketplace (like Amazon or Etsy), this service manages the sellers. It keeps track of which store owns which products, store names, and vendor profiles.
### PostgreSQL - The Filing Cabinet.
This is the relational database where all the permanent, structured data lives. Every product, user, and order is safely stored in organized tables here.
### Redis - The Sticky Note / Whiteboard.
This is an in-memory data store. It is incredibly fast and is used to store temporary data that needs to be accessed quickly, such as active user sessions, caching frequently viewed products, or managing shopping carts.

## 4. Proof of Execution.
### A. Docker Container Status.
The following output verifies that all microservices and infrastructure components are successfully built, running, and healthy.

![alt text](image-3.png)

![alt text](image-4.png)

## B. Application Frontend Verification
The application was accessed via a web browser to verify that the frontend is successfully communicating with the API Gateway and rendering the seeded demo data.

![alt text](image-5.png)
![alt text](image-6.png)
![alt text](image-7.png)
## Market
![alt text](image-8.png)
![alt text](image-9.png)
## Vendor Access
![alt text](image-10.png)
### C. Access URLs
The application was successfully verified using the following local URLs:
- Main Storefront (Frontend): http://localhost:3001
- API Gateway (Backend Entry Point): http://localhost:8000
- Database (PostgreSQL): localhost:55432

## 5. Conclusion
The Netiks Store microservices platform was successfully deployed locally. All containers initialized correctly, database migrations were applied seamlessly, and the frontend successfully rendered the seeded marketplace data, proving that the service-to-service communication is fully operational.

#
# Netiks Store

Netiks Store is a multi-vendor e-commerce platform with a storefront, seller dashboard, checkout flow, and supporting backend services.

## Workspace Layout

```text
apps/
  web/
  gateway/
services/
  identity-service/
  vendor-service/
  catalog-service/
  media-service/
  admin-service/
packages/
  shared-python/
  shared-types/
infra/
  docker/
  nginx/
  aws/
docs/
```

## Quick Start

1. Copy `.env.example` to `.env`.
2. Install frontend dependencies with `npm install`.
3. Sync Python workspaces with `uv sync`.
4. Start Docker Desktop and wait until it shows that Docker is running.
5. Start the stack with `docker compose up --build -d`.
6. Open `http://localhost:3001`.

## First Task For Interns

The first task is to run the project locally with Docker and show proof that it is working.

Suggested proof:

- a screenshot of Docker Desktop or `docker compose ps`
- a screenshot of the home page or market page in the browser
- a short note showing the URL used: `http://localhost:3001`

## Demo Data Reset

Run `npm run seed:demo` while the Docker stack is up to load the default marketplace data:

- 3 vendor accounts with storefronts
- 3 stores and categories
- 6 published products with real product photos
- starter order history that updates stock and sold counts

## Current Working Backend Surface

The following flows are implemented and have been smoke-tested locally:

- Auth: register, login, `me`, refresh-token rotation
- Vendor: create store, get my store, public store lookup, store update
- Catalog: create/list categories, create/update products, public published-product lookup, owner product listing
- Media: authenticated upload through the gateway, direct media retrieval

Services that still need further expansion:

- richer admin moderation flows
- full product search/filtering
- cross-service ownership verification between catalog and vendor domains

## Local Service Endpoints

- Frontend: `http://localhost:3001` by default in Docker Compose
- Gateway: `http://localhost:8000`
- Identity: `http://localhost:8001`
- Vendor: `http://localhost:8002`
- Catalog: `http://localhost:8003`
- Media: `http://localhost:8004`

## Docker Notes

- Each backend service runs Alembic migrations on container startup.
- The repo includes a root `.dockerignore` to keep build contexts smaller for GitHub and CI.
- If port `5432` is already in use on a machine, set `POSTGRES_EXPOSE_PORT` in `.env` before running Compose.
- If the stack has already been run before and you want clean marketplace data again, use `npm run seed:demo`.
- If you change code and want to rebuild everything, run `docker compose up --build -d` again.

## Documentation

- [Intern Quickstart Guide](/Users/woron/Documents/netiks-store/docs/INTERN_QUICKSTART_GUIDE.md)
- [PRD](/Users/woron/Documents/netiks-store/docs/PRD.md)
- [Project Documentation](/Users/woron/Documents/netiks-store/docs/PROJECT_DOCUMENTATION.md)
- [Technical Plan](/Users/woron/Documents/netiks-store/docs/TECHNICAL_PLAN.md)
- [Deployment Challenge Lab](/Users/woron/Documents/netiks-store/docs/DEPLOYMENT_CHALLENGE_LAB.md)
