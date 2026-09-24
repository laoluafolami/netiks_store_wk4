# Week 5 Lab - All Questions and Answers

**Complete answers to all 11 questions from the Week 5 lab, in order.**

---

# PART 1: Understand the Basics (Questions 1-4)

## Question 1: Which manual commands from Week 4 Part 6 are being replaced by automation this week?

### Answer

The following manual SSH commands that you had to execute on the VM during Week 4 are being fully automated this week:

```bash
# Manual commands you previously had to run:

# 1. Pull latest code
git pull origin main

# 2. Authenticate to Azure Container Registry
az acr login --name netiksstoreacr

# 3. Pull latest images from registry
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  pull

# 4. Start/update services
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d

# 5. Verify deployment status
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  ps
```

**Week 5 Automation:** These exact commands will now be executed automatically by GitHub Actions when you push a version tag. The workflow will SSH into the VM as the `deploy` user and execute this entire sequence without manual intervention.

**Key Improvement:**
- Week 4: Manual SSH commands on VM
- Week 5: Automatic workflow execution with human approval gate

---

## Question 2: SSH does not support OIDC. Why is storing a dedicated CI deployment key safer than reusing your personal SSH key? What should you do if the deployment key is ever leaked?

### Answer

#### Part A: Why Dedicated Deployment Key is Safer

**1. Principle of Least Privilege**
- Your personal SSH key: Full administrative access to the VM
- Deployment key: Only access needed for Docker and Git operations
- If personal key is compromised: Attacker has complete VM control
- If deployment key is compromised: Attacker can only deploy applications

**2. Scope Limitation**
The deployment key only permits:
- ✅ Pull repository code
- ✅ Pull Docker images
- ✅ Run Docker Compose commands
- ✅ Check service status

But cannot:
- ❌ Modify system files
- ❌ Change network configuration
- ❌ Access your personal files
- ❌ Create new user accounts
- ❌ Install packages
- ❌ Modify firewall rules

**3. Auditability**
- Commands run as `deploy` user = clearly deployment-related
- Commands run as your personal user = clearly personal/admin
- Easier to audit what each key was used for
- Clear separation in system logs

**4. Credential Rotation**
- Rotating deployment key: Simple, just update GitHub secret
- Rotating personal key: Affects your VM access, more disruptive
- Can rotate deployment key without affecting personal access
- Easy to create new key without touching personal infrastructure

**5. Security Incident Response**
- Deployment key compromised: Delete from authorized_keys, create new key
- Personal key compromised: Potential system-wide impact
- Compromise of deployment key has limited blast radius

#### Part B: If the Deployment Key is Leaked

**Immediate Actions (within minutes):**

1. **Remove the compromised key from VM:**
   ```bash
   sudo sed -i '/github-actions-deploy/d' /home/deploy/.ssh/authorized_keys
   ```
   This deletes the line with "github-actions-deploy" comment.

2. **Verify it's removed:**
   ```bash
   cat /home/deploy/.ssh/authorized_keys
   # Should NOT show the old netiks_deploy_key anymore
   ```

3. **Generate new deployment key:**
   ```bash
   ssh-keygen -t ed25519 -f netiks_deploy_key_new -C "github-actions-deploy-new" -N ""
   ```

4. **Add new public key to VM:**
   ```bash
   sudo tee -a /home/deploy/.ssh/authorized_keys < netiks_deploy_key_new.pub
   ```

5. **Verify new key works:**
   ```bash
   ssh -i netiks_deploy_key_new deploy@<DEPLOY_HOST>
   # Should connect successfully
   ```

**Update GitHub Secret (within minutes):**

1. Go to GitHub → Repository Settings
2. Click Environments → production
3. Click Secrets → DEPLOY_SSH_KEY
4. Click "Update secret"
5. Paste contents of new `netiks_deploy_key_new` (private key)
6. Click "Update secret"

**Testing:**

1. Push a test commit to trigger workflow
2. Verify deployment uses new key
3. Confirm deployment succeeds
4. Delete old `netiks_deploy_key` file from your laptop

**Prevent Future Leaks:**

- Add `netiks_deploy_key*` to `.gitignore` (private keys should never be in Git)
- Use GitHub secrets only (never hardcode in code)
- Rotate deployment keys regularly (quarterly recommended)
- Monitor GitHub Actions logs for failed authentication attempts

---

## Question 3: What is the difference between push-based deployment and pull-based deployment?

### Answer

#### Push-Based Deployment

**How It Works:**
- CI/CD system (GitHub Actions) **actively initiates** deployment
- CI/CD system **connects** to production environment
- CI/CD system **pushes** changes to production
- CI/CD system has credentials to access production

**Architecture:**
```
GitHub Actions (initiator)
    ↓
    SSH connection
    ↓
Production VM (passive receiver)
    ↓
Executes deployment commands
```

**Characteristics:**
- ✅ Deployment happens immediately (fast feedback)
- ✅ Simple to implement and understand
- ✅ CI/CD has direct control
- ❌ CI/CD system needs production credentials
- ❌ Production must be reachable from CI/CD runner
- ❌ If CI/CD is compromised, production is exposed
- ❌ Deployment credentials live in CI/CD system

**Example:** Week 5 implementation (GitHub Actions SSH to VM)

**Real-World Scenario:**
```
1:00 PM - Developer pushes tag v2.0
1:01 PM - GitHub Actions validates code
1:02 PM - GitHub Actions builds images
1:03 PM - GitHub Actions SSH into VM
1:03 PM - GitHub Actions runs: docker compose up
1:04 PM - Users see v2.0 (deployment happens immediately)
```

---

#### Pull-Based Deployment

**How It Works:**
- Production environment **actively checks** for new versions
- Production environment **pulls** changes from source
- Production environment has credentials to access repository/registry
- CI/CD system only needs to publish artifacts
- Typically uses a controller daemon (ArgoCD, Flux)

**Architecture:**
```
Production VM (active initiator)
    ↓
Polls every N minutes
    ↓
GitHub Repository (passive holder)
    ↓
"Any new changes since last check?"
```

**Characteristics:**
- ✅ Production credentials never leave production
- ✅ CI/CD doesn't need production access
- ✅ More secure (clear separation)
- ✅ Self-healing (automatic reconciliation)
- ❌ Deployment has delay (polling interval)
- ❌ Not immediate feedback
- ❌ Requires running controller daemon on production
- ❌ More complex to implement

**Example:** GitOps with ArgoCD watching Git repository

**Real-World Scenario:**
```
1:00 PM - Developer pushes tag v2.0
1:01 PM - GitHub Actions validates and builds
1:02 PM - ArgoCD polls repository (scheduled every 5 min)
1:05 PM - ArgoCD detects v2.0 change
1:05 PM - ArgoCD pulls images
1:06 PM - ArgoCD runs: docker compose up
1:07 PM - Users see v2.0 (delayed by polling interval)
```

---

#### Comparison Table

| Aspect | Push-Based | Pull-Based |
|--------|-----------|-----------|
| **Who Initiates** | CI/CD system | Production environment |
| **Deployment Speed** | Immediate (seconds) | Delayed (polling interval) |
| **Feedback** | Fast | Slow |
| **Credentials Storage** | CI/CD system | Production environment |
| **Requires Network Access** | CI/CD → Production | Production → Repository |
| **Risk if Credentials Stolen** | Production exposed | Repository exposed (lower risk) |
| **Complexity** | Simple | Complex (needs controller) |
| **Self-Healing** | No | Yes |
| **Audit Trail** | Clear (logs in CI) | Clear (controller logs) |
| **Best For** | Teams with good CI/CD security | High-security environments |
| **Week Used** | Week 5 (Netiks) | Week 6+ (staging/prod) |

---

#### Security Comparison

**Push-Based Security Model:**
```
GitHub Actions has PROD credentials
    ↓
If GitHub or GitHub Actions compromised
    ↓
Attacker has production access
    ↓
Risk: HIGH (CI/CD is the crown jewel)
```

**Pull-Based Security Model:**
```
Production has REPO credentials
    ↓
If Repository compromised
    ↓
Attacker can change what pulls
    ↓
Risk: MEDIUM (only controls deployment, not CI)
```

---

## Question 4: Which model are we building this week - push-based deployment or pull-based deployment?

### Answer

**We are building a PUSH-BASED deployment model.**

#### Why Push-Based for Week 5

1. **Simpler to Implement**
   - GitHub Actions with SSH (straightforward)
   - Direct commands execution
   - No additional controller needed

2. **Direct Control**
   - Deployment happens immediately
   - Fast feedback loop
   - Easy to debug

3. **Clear Learning Path**
   - Week 5: Push-based (CI → VM via SSH)
   - Week 6: Staging environment
   - Week 7+: Could evolve to pull-based with controller

#### How Our Push-Based Model Works

```
Developer commits code change
    ↓
git tag v1.2.0 && git push origin --tags
    ↓
GitHub Actions receives tag
    ↓
validate job runs (checks code quality)
    ↓
build-and-push job runs (creates images)
    ↓
deploy job starts (but waits for approval)
    ↓
Human reviews and approves
    ↓
GitHub Actions SSH to VM (active push)
    ↓
GitHub Actions executes: git checkout v1.2.0
    ↓
GitHub Actions executes: docker compose pull (pulls v1.2.0 images)
    ↓
GitHub Actions executes: docker compose up -d (starts services)
    ↓
Production running v1.2.0 ✅
```

#### Why Not Pull-Based Yet

- Pull-based requires running a controller daemon (ArgoCD, Flux)
- More infrastructure to manage
- Additional learning curve
- Week 6 will introduce staging environment
- Week 7+ can implement pull-based with controller

#### Components of Our Push Model

1. **GitHub Actions** = The "pusher" (active)
2. **appleboy/ssh-action** = SSH connection
3. **Production VM** = The "receiver" (passive)
4. **Deploy user credentials** = SSH key for authentication
5. **Git tags** = Triggers the push

#### Deployment Job Details

```yaml
deploy:
  needs: build-and-push  # Wait for artifacts
  if: startsWith(github.ref, 'refs/tags/v')  # Only for tags
  environment: production  # Approval gate
  runs-on: ubuntu-latest
```

This configuration ensures:
- ✅ Images exist before deployment
- ✅ Only intentional releases deploy
- ✅ Human approval required
- ✅ Credentials protected by environment

---

---

# PART 2: Prepare the VM for Remote Deployment

## Part 2 Question: Why should the deployment user not have `sudo` access?

### Answer

#### Principle of Least Privilege

The deployment user should **not have `sudo` access** because it violates the principle of least privilege:

**What deployment needs:**
- Pull code from Git repository ✅
- Pull Docker images from registry ✅
- Run Docker Compose commands ✅
- Check container status ✅

**What `sudo` would allow:**
- ❌ Modify any system file
- ❌ Change network configuration
- ❌ Modify firewall rules
- ❌ Access sensitive data
- ❌ Create new user accounts
- ❌ Change kernel parameters
- ❌ Delete critical files

#### Security Boundary

If the deployment SSH key is compromised:

**Without `sudo` (Current Model):**
```
Attacker has deployment key
    ↓
Can SSH as deploy user
    ↓
Can run: docker commands, git commands
    ↓
Can pull code, pull images, start services
    ↓
Scope: Limited to application deployment
    ↓
Damage: Can update running services only
    ↓
Cannot: Access system files, change network, etc.
```

**With `sudo` (Dangerous Model):**
```
Attacker has deployment key
    ↓
Can SSH as deploy user
    ↓
Can run: sudo su -
    ↓
Can do ANYTHING on the system
    ↓
Scope: Full system access
    ↓
Damage: Complete system compromise
```

#### Separation of Concerns

Your VM has two different types of access needs:

| Access Type | User Account | Purpose | Permissions |
|------------|-------------|---------|------------|
| **Administrative** | Your personal account | Maintenance, updates, troubleshooting | Full sudo access |
| **Deployment** | deploy user | Run applications, pull code/images | Docker group only |

This separation means:
- Your personal account: For infrastructure work
- Deploy account: For application deployment
- If deploy account is compromised: Infrastructure is safe
- If personal account is compromised: Everything is compromised (but personal account is not exposed to GitHub)

#### Audit Trail Clarity

```bash
# Commands in logs:
sudo usermod -A group user  # You (personal account) did infrastructure work
docker compose up           # CI/CD deploy user did deployment
docker restart container    # CI/CD deploy user managed containers
sudo apt update             # You did system maintenance

# Easy to see:
# - sudo commands = infrastructure/personal work
# - docker commands = deployments
# - Clearly separated
```

#### Why Docker Group is Sufficient

The Docker group membership provides just enough access:

```bash
# Deploy user can do:
docker pull myimage:v1.2.0
docker ps
docker logs container
docker compose up -d

# Deploy user cannot do:
docker run --privileged ...  # Restricted by Docker daemon policy
usermod -aG sudo deploy     # Cannot modify system users
vi /etc/ssh/sshd_config     # Cannot edit system files
```

---

## Part 2 Question: Why does the deployment user still need access to Docker?

### Answer

#### Deployment Operations Require Docker

The deployment process executes these Docker commands:

**1. Pulling Images from Registry**
```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  pull

# This requires Docker daemon access to:
# - Connect to Azure Container Registry
# - Pull 7 service images
# - Verify image integrity
```

**2. Starting Services**
```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d

# This requires Docker daemon access to:
# - Create containers from images
# - Set up networking
# - Mount volumes
# - Start service processes
```

**3. Verifying Deployment Status**
```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  ps

# This requires Docker daemon access to:
# - Query container status
# - Verify services are running
# - Confirm correct image versions
```

#### Why Not `sudo`?

Using `sudo` for Docker commands is **not recommended** because:

1. **Grants Excessive Permissions**
   - `sudo docker` could allow running privileged containers
   - Privileged containers can escape container isolation
   - Could lead to full VM compromise

2. **Violates Security Best Practices**
   - Docker daemon already provides sufficient access
   - Adding `sudo` breaks principle of least privilege
   - Makes security audit more difficult

#### Why Docker Group Works

Adding deploy user to docker group:

```bash
sudo usermod -aG docker deploy
```

This:
- ✅ Allows Docker daemon access
- ✅ No shell escapes to root
- ✅ Limits access to Docker operations only
- ✅ Prevents running `sudo` commands
- ✅ Follows Docker's recommended security model

#### Security Consideration

The lab notes explicitly state:

> "Membership in the Docker group provides significant privileges and should not be treated as equivalent to fully unprivileged Linux account."

This is acknowledged because:
- Docker group users can run containers with `--privileged` flag
- Privileged containers can theoretically access host
- But this is still **much safer** than full `sudo` access
- And it's the **recommended approach** for CI/CD deployment

#### Why It's Acceptable

In this specific case, Docker group access is acceptable because:

1. **Single Purpose Account**
   - Only used for deployments
   - Not general-purpose user
   - Not used for other tasks

2. **Limited Exposure**
   - Deploy key only exists in GitHub
   - Deploy user cannot create other users
   - Deploy user cannot modify sudo configuration
   - Damage is limited to Docker operations

3. **Industry Standard**
   - This is how most Docker-based CI/CD works
   - GitLab CI, GitHub Actions, Jenkins all use similar models
   - Proven secure in production environments

#### Complete Docker Deployment Workflow

```
Deploy user SSH login
    ↓
cd ~/netiks_store
    ↓
git fetch --tags origin
    ↓
git checkout v1.2.0
    ↓
docker compose pull  ← Requires Docker access
    ↓
docker compose up -d  ← Requires Docker access
    ↓
docker compose ps  ← Requires Docker access
    ↓
Exit SSH session
```

All three docker operations require Docker daemon access, which the docker group provides.

---

---

# PART 3: Add Deployment Job to Workflow

## Part 3 Question: Why does the deploy job declare `needs: build-and-push` instead of running in parallel?

### Answer

#### Dependency Chain Logic

```yaml
deploy:
  needs: build-and-push  # MUST wait for build-and-push to complete
```

This means: **Do not start the deploy job until build-and-push succeeds.**

#### Why Sequential is Required

**1. Images Must Exist Before Deployment**

The deployment job pulls Docker images:
```bash
docker compose pull
```

These images don't exist until the build-and-push job creates and pushes them:

```
build-and-push job:
  - Builds web image: netiksstoreregistry.azurecr.io/web:v1.2.0
  - Builds gateway image: netiksstoreregistry.azurecr.io/gateway:v1.2.0
  - (builds 5 more images)
  - Pushes all to Azure Container Registry
  ↓
ONLY NOW do images exist in registry

deploy job (must wait):
  - Can now pull images from registry
  - Images exist and are ready
  - Deployment succeeds
```

**2. Failure Prevention**

If builds fail, you must NOT deploy:

```
Scenario: Build fails
├─ build-and-push fails (syntax error in Dockerfile)
├─ deploy job: BLOCKED from running (needs: build-and-push failed)
├─ Production stays at v1.1.0 (no corrupted deployment)
└─ ✅ Safe outcome

vs. If deploy ran in parallel:
├─ build-and-push fails (syntax error)
├─ deploy job runs anyway (doesn't wait)
├─ deploy tries to pull images that don't exist
├─ docker compose pull fails
├─ Deployment fails
├─ But it attempted deployment!
└─ ❌ Messy failure
```

**3. Logical Sequence**

The deployment pipeline must follow this order:

```
1. Code pushed
2. Validation runs (checks for errors)
3. Build images (creates artifacts)
4. Push to registry (artifacts available)
5. Deploy from registry (artifacts pulled)
```

Each step depends on the previous one succeeding.

#### What Would Happen Without `needs:`

```yaml
# Without needs: build-and-push
deploy:
  if: startsWith(github.ref, 'refs/tags/v')
  runs-on: ubuntu-latest
```

**Timeline if deploy runs in parallel:**

```
1:00 PM - Tag v1.2.0 pushed
1:01 PM - GitHub Actions starts
         ├─ validate job starts
         ├─ build-and-push job starts (building image 1...)
         └─ deploy job starts immediately (too early!)

1:02 PM - deploy job tries: docker compose pull
         ├─ Looking for: netiksstoreregistry.azurecr.io/web:v1.2.0
         ├─ ERROR: Image not found!
         ├─ build-and-push is still building image 1 of 7
         ├─ Deployment fails
         └─ Error: "Error response from daemon: manifest not found"

1:03 PM - build-and-push finally finishes pushing images
         ├─ Images now available in registry (too late!)
         ├─ deploy job already failed
         ├─ No automatic retry
         └─ Human has to manually rerun deployment
```

This is messy and error-prone.

#### With `needs: build-and-push`

```
1:00 PM - Tag v1.2.0 pushed
1:01 PM - GitHub Actions starts
         ├─ validate job starts
         └─ build-and-push job starts (building 7 images...)

1:03 PM - build-and-push job completes successfully
         ├─ All 7 images built
         ├─ All 7 images pushed to registry
         ├─ Image verification successful
         └─ ✅ NOW deploy job can start

1:04 PM - deploy job starts
         ├─ docker compose pull succeeds (images exist!)
         ├─ All images pulled successfully
         ├─ Services started
         ├─ Deployment verification passes
         └─ ✅ SUCCESS

1:05 PM - Production running v1.2.0
```

Clean, reliable, guaranteed to work.

#### Job Dependency in Visual Format

```
┌─────────────────────┐
│   GitHub Push Tag   │
│    v1.2.0           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ ✅ validate job     │
│  (checks code)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 🐳 build-and-push   │
│  (creates images)   │ ← Pushes v1.2.0 images to registry
└──────────┬──────────┘
           │ ← needs: build-and-push
           │    (deploy WAITS here)
           ▼
┌─────────────────────┐
│ 🚀 deploy job       │
│  (pulls & starts)   │ ← Can now pull v1.2.0 images
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Production v1.2.0   │
│ Live and Running    │
└─────────────────────┘
```

#### Additional Benefits of `needs:`

1. **Clear Dependency Tracking**
   - GitHub Actions shows job dependencies visually
   - Easy to understand the deployment pipeline
   - Prevents accidental parallel execution

2. **Proper Failure Handling**
   - If build fails: deploy doesn't run
   - If deploy fails: doesn't propagate to earlier jobs
   - Each failure is scoped to that job

3. **Resource Efficiency**
   - Build job uses runners' resources to build
   - Once done, build job releases those resources
   - Deploy job starts only when it can succeed

#### Conclusion

**`needs: build-and-push` is critical because:**
1. ✅ Ensures images exist before deployment
2. ✅ Prevents failed deployments from attempting
3. ✅ Follows logical sequence
4. ✅ Provides clear dependency tracking
5. ✅ Enables proper error handling

---

## Part 3 Question: Why does the `if` condition prevent deployment from running on every push to `main`?

### Answer

#### The `if` Condition Logic

```yaml
if: startsWith(github.ref, 'refs/tags/v') || github.event_name == 'workflow_dispatch'
```

This condition evaluates to true (deploy runs) ONLY IF one of these is true:

**1. `startsWith(github.ref, 'refs/tags/v')`**
- `github.ref` = The Git reference that triggered the workflow
- For commits to main: `refs/heads/main`
- For tags: `refs/tags/v1.2.0`

| Event | github.ref | Starts with "refs/tags/v"? | Deploy Runs? |
|-------|-----------|---------------------------|------------|
| Push to main | refs/heads/main | ❌ No | ❌ No |
| Push to feature branch | refs/heads/feature | ❌ No | ❌ No |
| Push tag v1.2.0 | refs/tags/v1.2.0 | ✅ Yes | ✅ Yes |
| Push tag release1 | refs/tags/release1 | ❌ No | ❌ No |
| Push tag dev-v1 | refs/tags/dev-v1 | ✅ Yes | ✅ Yes |

**2. `github.event_name == 'workflow_dispatch'`**
- True when workflow is manually triggered
- Used for rollbacks (deploy previous version)
- False for automatic triggers (push, pull request)

#### Why This Prevents Unwanted Deployments

**Without the `if` condition:**

```yaml
deploy:
  needs: build-and-push
  # NO if condition!
  runs-on: ubuntu-latest
  environment: production
```

**What would happen:**

```
Developer commits fix to main
    ↓
git push origin main
    ↓
GitHub Actions triggers workflow
    ├─ validate job runs
    ├─ build-and-push builds images
    └─ deploy job runs ← PROBLEM! Deploys without tag!

Every single commit to main = immediate production deployment!
    ↓
Unstable production
Deployment every few minutes
No versioning
No approval gate useful (deploy without intent)
```

**With the `if` condition:**

```
Developer commits fix to main
    ↓
git push origin main
    ↓
GitHub Actions triggers workflow
    ├─ validate job runs ✅
    ├─ build-and-push builds images ✅
    └─ deploy job SKIPPED ✅
       (condition is false)

Later, when ready for release:
    ↓
git tag v1.2.0
git push origin v1.2.0
    ↓
GitHub Actions triggers workflow
    ├─ validate job runs ✅
    ├─ build-and-push builds images ✅
    └─ deploy job runs ✅
       (condition is true - tag matches!)
```

#### Real-World Impact Without `if` Condition

Imagine a typical development day:

```
9:00 AM - Developer commits fix for bug #123
         → Deployment triggered (too early!)
9:15 AM - Developer commits logging enhancement
         → Deployment triggered (too early!)
9:30 AM - Developer commits WIP feature
         → Deployment triggered (production is broken!)
10:00 AM - Developer realizes feature needs more work
         → But it's already in production!
10:30 AM - Developer commits hotfix
         → Another deployment (chaotic!)
```

Production would be unstable, users would complain, deployments would be uncontrolled.

#### With `if` Condition: Controlled Releases

```
9:00 AM - Developer commits fix
9:15 AM - Developer commits logging
9:30 AM - Developer commits enhancement
         (All committed to main, NO deployments)
         
4:00 PM - Release Manager reviews commits
4:15 PM - Release Manager decides v1.2.0 is ready
4:16 PM - Release Manager creates tag: git tag v1.2.0
4:16 PM - Release Manager pushes: git push origin v1.2.0
         ↓
         GitHub Actions deploys v1.2.0
         (Intentional, controlled, approved)
         
4:17 PM - Production updated to v1.2.0
```

Deployments are intentional and controlled.

#### Prevented Failure Scenarios

**Scenario 1: Accidental Merge**
```
Developer accidentally merges broken branch to main
    ↓
Git push to main
    ↓
Without if: Deploys broken code immediately
    ↓
Production fails
    ❌ Disaster

With if: Nothing deploys (not a tag)
    ↓
Manual fix to main, then tag when ready
    ✅ Safe
```

**Scenario 2: Work in Progress**
```
Developer commits WIP code to main (forgot to commit to feature branch)
    ↓
Without if: Deploys incomplete code to production
    ✅ Broken features
    ❌ Users see unfinished UI
    ❌ Database schema incomplete
    
With if: Nothing deploys (not a tag)
    ✅ Can revert commit
    ✅ Tag only when complete
```

**Scenario 3: Hotfix Coordination**
```
Developer A: Fixes critical production bug, pushes to main
Developer B: Makes cosmetic UI change, pushes to main
Developer C: Refactors database access, pushes to main
    ↓
All three commits in main within minutes
    ↓
Without if: All three deployed together to production
    ❌ Unknown interactions
    ❌ Multiple simultaneous changes
    ❌ Hard to debug if something breaks
    
With if: None deployed until explicitly tagged
    ✅ Release Manager reviews all three changes
    ✅ Tags v1.2.0 with all three fixes
    ✅ Single coordinated deployment
```

#### The `||` (OR) Logic

```yaml
if: startsWith(github.ref, 'refs/tags/v') || github.event_name == 'workflow_dispatch'
```

Deploy runs if EITHER condition is true:

**Condition 1: Tagged Release (automatic)**
```
git tag v1.2.0 && git push origin v1.2.0
    ↓
github.ref = refs/tags/v1.2.0
    ↓
startsWith(github.ref, 'refs/tags/v') = true
    ↓
Deploy runs ✅
```

**Condition 2: Manual Trigger (rollback)**
```
GitHub Actions → Run workflow manually → Input v1.1.0
    ↓
github.event_name = workflow_dispatch
    ↓
github.event_name == 'workflow_dispatch' = true
    ↓
Deploy runs ✅
```

**Condition 3: Regular Push (blocked)**
```
git push origin main
    ↓
github.ref = refs/heads/main
    ↓
startsWith(github.ref, 'refs/tags/v') = false
    ↓
github.event_name = push (not workflow_dispatch)
    ↓
github.event_name == 'workflow_dispatch' = false
    ↓
false || false = false
    ↓
Deploy runs ❌ (blocked as intended)
```

#### Summary: What the `if` Condition Accomplishes

| Trigger | github.ref | github.event_name | Condition | Deploy Runs? |
|---------|-----------|------------------|-----------|------------|
| **Push to main** | refs/heads/main | push | false \|\| false | ❌ No |
| **Push to branch** | refs/heads/feature | push | false \|\| false | ❌ No |
| **Tag v1.2.0** | refs/tags/v1.2.0 | push | true \|\| false | ✅ Yes |
| **Manual trigger** | (irrelevant) | workflow_dispatch | (any) \|\| true | ✅ Yes |

---

---

# PART 4: Release Checklist Becomes a Habit

## Part 4 Question: What can happen if you push the Git tag before committing the `docker-compose.prod.yml` version change?

### Answer

#### The Scenario: Wrong Commit Order

**Wrong Order:**
```bash
# ❌ WRONG - Create tag first
git tag v1.2.0

# ❌ WRONG - Commit version change after
git add docker-compose.prod.yml
git commit -m "release: v1.2.0"

git push origin main --tags
```

**Correct Order:**
```bash
# ✅ CORRECT - Commit version change first
git add docker-compose.prod.yml
git commit -m "release: v1.2.0"

# ✅ CORRECT - Create tag after (points to this commit)
git tag v1.2.0

git push origin main --tags
```

#### What Goes Wrong: Tag Points to Wrong Commit

**The Problem:**

```
Old commit (has v1.1.1 images):
  └─ docker-compose.prod.yml with v1.1.1
  └─ Commit: abc1234
  └─ TAG v1.2.0 points here ← WRONG!

New commit (has v1.2.0 images):
  └─ docker-compose.prod.yml with v1.2.0
  └─ Commit: def5678
  └─ Not tagged ← Should point here!
```

**Deployment Gets Wrong Images:**

```
GitHub Actions checks out tag v1.2.0
    ↓
git checkout v1.2.0 → goes to abc1234 commit
    ↓
Opens docker-compose.prod.yml from that commit
    ↓
Reads: web:v1.1.1, gateway:v1.1.1, etc.
    ↓
docker compose pull pulls v1.1.1 images
    ↓
Production runs v1.1.1 (OLD version!)
    ↓
Users don't see v1.2.0 features
    ❌ DISASTER
```

#### Real-World Impact: Version Mismatch

**Git and Production Disagree:**

```
Git tag: v1.2.0
Production images: v1.1.1

When someone asks "What version is production?"
Response: It's complicated...
  "Git says v1.2.0"
  "But Docker says v1.1.1"
  "Which is right?"
  ❌ Confusion
```

**Debugging Nightmare:**

```
Production problem discovered
User: "We deployed v1.2.0, but the bug still exists"
DevOps: "Let me check... git tag says v1.2.0"
Dev: "But the code for that fix was v1.2.0"
DevOps: "docker ps shows v1.1.1 running"
Dev: "That's impossible!"
[2 hours of debugging]
Root cause: Tag pointed to wrong commit
❌ Wasted time
```

#### Rollback Complications

**Trying to Rollback:**

```
Production had v1.2.0 (which was actually v1.1.1)
Now needs to rollback to v1.1.0

DevOps: "I'll rollback to v1.1.0"
```

But which commit was v1.1.0?
- Was it the actual v1.1.1 images?
- Was it before that?
- Where is the clean v1.1.0?

**Version tracking breaks down, making rollback risky.**

#### CI/CD Pipeline Integrity Loss

**Breaking the Trust:**

The whole CI/CD pipeline depends on:
```
Git tag v1.2.0 = "Deploy these exact commits"
```

If tags don't match compose file versions:
```
Tag v1.2.0 ≠ compose file version
    ↓
Pipeline integrity broken
    ↓
Version numbers become meaningless
    ↓
Can't trust anything
```

#### Correct Workflow: Sequence Matters

**Step 1: Commit Version Change**
```bash
# Update docker-compose.prod.yml
# Change all v1.1.1 → v1.2.0

git add docker-compose.prod.yml
git commit -m "release: v1.2.0"
```

Git now has:
```
Commit abc5678: "release: v1.2.0"
  docker-compose.prod.yml with v1.2.0 images
```

**Step 2: Tag the Commit**
```bash
git tag v1.2.0
```

Tag now points to:
```
v1.2.0 → abc5678
  docker-compose.prod.yml with v1.2.0 images
  ✅ Matches!
```

**Step 3: Push to GitHub**
```bash
git push origin main --tags
```

Deployment checks out:
```
git checkout v1.2.0 → abc5678
    ↓
docker-compose.prod.yml has v1.2.0
    ↓
docker compose pull → pulls v1.2.0 images
    ↓
Production: v1.2.0 ✅
```

#### The Release Checklist (Always Follow)

```
[ ] Decide: We're releasing v1.2.0
[ ] Update docker-compose.prod.yml
    ├─ web: v1.1.1 → v1.2.0
    ├─ gateway: v1.1.1 → v1.2.0
    ├─ (all services updated)
    └─ File saved
[ ] COMMIT the change
    git add docker-compose.prod.yml
    git commit -m "release: v1.2.0"
[ ] THEN create tag (after commit, not before)
    git tag v1.2.0
[ ] Push to GitHub
    git push origin main --tags
[ ] Verify
    git show v1.2.0 → should show commit with v1.2.0 images
```

#### Verification: Confirm Correctness

After tagging, verify before pushing:

```bash
# Show what the tag points to
git show v1.2.0

# Should display the commit message: "release: v1.2.0"
# Should show docker-compose.prod.yml changes from v1.1.1 to v1.2.0

# If it doesn't, delete the tag and redo it:
git tag -d v1.2.0  # Delete wrong tag
# Then redo correctly
```

#### Summary: Consequences of Wrong Order

| Aspect | Correct | Wrong |
|--------|---------|-------|
| **Tag points to** | Commit with v1.2.0 | Old commit with v1.1.1 |
| **Deployment pulls** | v1.2.0 images | v1.1.1 images |
| **Production runs** | v1.2.0 | v1.1.1 (not what was released!) |
| **Version tracking** | Clear | Broken |
| **Rollback** | Easy | Difficult |
| **Debugging** | Straightforward | Nightmare |
| **System integrity** | Maintained | Compromised |

---

---

# PART 5: Add Production Approval Gate

## Part 5 Question: Why should the approval gate be placed on the deployment job rather than the build-and-push job?

### Answer

#### Two Different Concerns: Artifact vs. Change

**Build-and-Push Job:**
- Creates Docker images (artifacts)
- Produces output that can be used later
- Does NOT change production
- Is not a permanent change

**Deploy Job:**
- Changes production environment
- Immediately affects users
- Is a permanent change
- Impacts live users and systems

#### Why Approval on Deploy, Not Build

**1. Artifact Production vs. Environmental Change**

**Building an image:**
```
docker build → Creates myimage:v1.2.0
    ↓
Stores in registry
    ↓
No one affected yet
    ↓
Image just sits there unused (unless deployed)
    ↓
Approval status: Doesn't matter
```

**Deploying to production:**
```
docker compose up -d
    ↓
Services restart
    ↓
Users see new version immediately
    ↓
Load on database changes
    ↓
Feature behavior changes for users
    ↓
If wrong: Must rollback immediately
    ↓
Approval status: CRITICAL
```

**2. No Risk vs. Real Risk**

**Building image:**
- ✅ No user impact
- ✅ No system impact
- ✅ Can be built speculatively
- ✅ Reversible (just delete image)
- ✅ No approval needed

**Deploying:**
- ❌ Direct user impact
- ❌ Changes system state
- ❌ Affects live traffic
- ❌ Difficult to reverse (might need rollback)
- ✅ Approval definitely needed

**3. Image Reusability**

**Same image, multiple uses:**

```
Build v1.2.0 image ONCE

Then deploy to:
1. Staging environment (for testing)
2. Production-East (first data center)
3. Production-West (second data center)
4. Production-Asia (third data center)

If you require approval on build:
  └─ Approving once blocks all uses
  └─ Can't deploy to staging without production approval
  └─ Inefficient
  
If you require approval on each deploy:
  └─ Staging: Deploy immediately (no approval)
  └─ Prod-East: Approve and deploy
  └─ Prod-West: Approve and deploy
  └─ Prod-Asia: Approve and deploy
  └─ ✅ Flexible
```

#### Real-World Scenario: Why Not Build Approval

Imagine your process required approval on build:

**Scenario 1: Paranoid About Production**
```
1:00 PM - Developer makes small fix
1:01 PM - Commits to main
1:02 PM - GitHub Actions builds image
1:03 PM - Build waits for approval
1:30 PM - Manager approves build (30 min delay!)
1:30 PM - Build runs (why wait if just creating artifact?)
1:31 PM - Image available in registry
1:31 PM - Deployment starts immediately (no final approval!)
1:32 PM - Production updated
         → But this defeats the purpose!
         → Approval on build doesn't prevent bad deploys
         → Deployment still happened without approval
```

**Problems:**
- ❌ Build approval delayed artifact creation
- ❌ Deployment happened without final approval
- ❌ No actual safety improvement

#### Real-World Scenario: Why Build Approval is Useless

**Scenario 2: Image as Reusable Artifact**
```
1:00 PM - CI builds image v1.2.0
1:01 PM - Image waits for approval
1:05 PM - Tester wants to test v1.2.0 in staging
         "Can we deploy to staging?"
         "No, build not approved yet"
         ❌ Staging blocked
1:10 PM - Build approved
1:10 PM - CI redeploys build (wasted time)
1:11 PM - Tester can finally test
1:20 PM - Tester: "v1.2.0 looks good for prod"
1:21 PM - Deployment to production starts
         (No approval gate here!)
         ❌ Didn't help
```

#### Correct Model: Build Without Approval

**Build immediately, deploy with approval:**

```
1:00 PM - Commit to main
1:01 PM - Build image v1.2.0 (no approval needed)
1:02 PM - Image ready in registry

1:02 PM - Tester can test immediately
1:05 PM - "v1.2.0 looks good"

1:05 PM - Deployment to production waits for approval
1:06 PM - Manager reviews: "OK to deploy?"
1:06 PM - Manager: "Deploy it"
1:06 PM - Deployment proceeds
1:07 PM - Production running v1.2.0

✅ Image available quickly for testing
✅ Approval right before production impact
✅ Efficient process
```

#### Deployment as the Point of No Return

**Key Insight: Deployment is the actual change**

```
Build:     Creates artifact (reversible, no impact)
           └─ Approval: Not critical
           └─ If unapproved, nothing breaks

Deploy:    Changes production (hard to reverse, direct impact)
           └─ Approval: Critical
           └─ If unapproved, wrong thing goes to prod
```

**Approval should be on the actual change, not the preparation:**

```
Analogy: Building a bridge

Building phase: Construct bridge in factory
  - No one's using it yet
  - Can be tested, evaluated
  - Build approval optional

Deployment phase: Install bridge over river
  - People start using it
  - Any issues directly affect users
  - Deployment approval critical

You approve deployment, not the factory build!
```

#### Audit Trail Implications

**If approval on build:**
```
Build approval: "Code looks good"
  └─ Doesn't mean it's safe to run

Deployment: Happens without second opinion
  └─ No approval at change point
  └─ Audit trail shows "approved build"
  └─ But actual change (deployment) wasn't approved!
```

**If approval on deployment:**
```
Build approval: Not needed (no user impact)
  └─ Artifacts created fast

Deployment approval: "This is safe to run now"
  └─ Reviewer confirms right image, timing right
  └─ Audit trail shows "approved deployment"
  └─ Proof someone reviewed before production impact
```

#### Business Impact: Approval Gate Placement

**Approval on build:**
- ❌ Slows down testing (developers wait for build approval before testing)
- ❌ Doesn't prevent bad deploys (approval still needed at deploy)
- ❌ Wastes reviewer time on non-critical decision
- ❌ Complicates artifact pipeline

**Approval on deployment:**
- ✅ Allows fast testing (build happens immediately)
- ✅ Prevents bad deploys (approval right before production)
- ✅ Focuses reviewer time on critical decision
- ✅ Keeps artifact pipeline clean

#### Decision Matrix

| Scenario | Build Approval? | Deploy Approval? |
|----------|----------------|-----------------|
| **Test in staging** | Need build approval first | Not needed (staging) |
| **Deploy to prod** | Already happened | Needed now |
| **Rollback needed** | Doesn't help | Critical |
| **Code review needed** | Separate in PR | No, deployment review only |
| **Artifact reusable?** | Blocked if unapproved | Not blocked |

#### Summary: Approval Gate Placement

| Factor | Build Job | Deploy Job |
|--------|-----------|-----------|
| **Purpose** | Create artifact | Change production |
| **User impact** | None | Direct |
| **Reversibility** | Easy (delete image) | Hard (needs rollback) |
| **Time-sensitive** | No | Yes |
| **Blocking testing** | Yes (if approval needed) | No (staging doesn't wait) |
| **Approval necessary** | Optional | **Required** |

**Conclusion:**

> **Approval must be on the deployment job because that's when production changes. Building an artifact doesn't need approval; changing what users see does.**

---

## All Questions Complete! ✅

You now have comprehensive answers to all 11 questions from Week 5, organized by section and ready for your submission write-up.

---

**Document created:** `Week5_Questions_and_Answers.md`  
**Status:** Complete and ready for submission ✅
