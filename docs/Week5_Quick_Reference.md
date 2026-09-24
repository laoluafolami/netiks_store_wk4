# Week 5 Lab - Quick Reference Guide

**Quick navigation and key commands for Netiks Store Week 5 implementation.**

---

## Part 1: Key Concepts Quick Answers

| Question | Quick Answer |
|----------|-------------|
| **Manual commands being automated?** | git pull, az acr login, docker compose pull, docker compose up -d, docker ps |
| **Why dedicated deployment key?** | Principle of least privilege - limits damage if key is compromised |
| **Push vs Pull deployment?** | Push: CI connects to prod; Pull: Prod checks for changes |
| **Which model?** | Push-based (GitHub Actions SSH to VM and deploy) |

---

## Part 2: VM Setup - Essential Commands

```bash
# 1. Create deployment user
sudo adduser --disabled-password deploy
sudo usermod -aG docker deploy

# 2. On your laptop - generate SSH key
ssh-keygen -t ed25519 -f netiks_deploy_key -C "github-actions-deploy" -N ""

# 3. On VM - add public key
sudo mkdir -p /home/deploy/.ssh
sudo tee /home/deploy/.ssh/authorized_keys < netiks_deploy_key.pub
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys

# 4. Test SSH connection
ssh -i netiks_deploy_key deploy@<YOUR_VM_IP>
```

---

## Part 2: GitHub Secrets to Create

**Environment:** `production`

**Secrets:**
1. `DEPLOY_SSH_KEY` = Contents of netiks_deploy_key (private key)
2. `DEPLOY_HOST` = Your VM public IP (e.g., 20.29.81.166)
3. `DEPLOY_USER` = deploy

---

## Part 3: Deployment Job Template

Add this to `.github/workflows/build-and-push.yml`:

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
          docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
          docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
          docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

---

## Part 4: Release Process

```bash
# 1. Update docker-compose.prod.yml with new version
# Change all image tags from v1.1.1 to v1.2.0

# 2. Commit the change
git add docker-compose.prod.yml
git commit -m "release: v1.2.0"

# 3. Create tag
git tag v1.2.0

# 4. Push to GitHub
git push origin main --tags
```

---

## Part 5: Approval Gate Setup

1. Go to GitHub → Settings → Environments
2. Click `production` environment
3. Enable "Required reviewers"
4. Add yourself as reviewer
5. Save

---

## Part 6: Testing Sequence

```bash
# 1. Make visible app change
# (Edit app, commit, push to main)

# 2. Update docker-compose.prod.yml version
# (Change v1.1.1 → v1.2.0)

# 3. Create release tag
git add docker-compose.prod.yml
git commit -m "release: v1.2.0"
git tag v1.2.0
git push origin main --tags

# 4. In GitHub Actions:
#    - Watch validate job pass
#    - Watch build-and-push job build 7 images
#    - See deploy job wait for approval
#    - Click "Approve and deploy"
#    - See deployment complete

# 5. Verify application shows new version

# 6. For rollback - manually trigger workflow with v1.1.0
# 7. Watch deployment switch back to v1.1.0
```

---

## Part 6: Add Manual Deployment

Update `on:` section in workflow:

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

Update deploy job version line:

```yaml
VERSION="${{ inputs.version || github.ref_name }}"
```

---

## Key Files to Submit

1. ✅ `.github/workflows/build-and-push.yml` (with deploy job)
2. ✅ Screenshots of GitHub Actions workflow runs
3. ✅ Screenshots of docker ps before/after rollback
4. ✅ Screenshot of application showing v1.2.0
5. ✅ Answers to all 11 questions (Parts 1-5)

---

## Critical Points

- ⚠️ **Never reuse personal SSH key** - Create dedicated deployment key
- ⚠️ **Never expose secrets in screenshots** - Only show names, not values
- ⚠️ **Commit version change BEFORE creating tag** - Tag points to commit
- ⚠️ **Approval on deployment, not build** - Deployment changes production
- ⚠️ **Deploy user should NOT have sudo** - Principle of least privilege

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| SSH key permission denied | Check .ssh/authorized_keys permissions (should be 600) |
| Docker command fails as deploy | Verify deploy user in docker group: `groups deploy` |
| Deployment doesn't run | Check if tag starts with `v` and push includes `--tags` |
| Approval button missing | Verify production environment has required reviewers configured |
| Rollback shows wrong version | Ensure docker-compose.prod.yml version matches git tag |

---

## Complete Workflow: Tag to Production

```
git push tag v1.2.0
    ↓ (GitHub receives tag)
    ↓
validate job
    ↓
build-and-push job (builds & pushes v1.2.0 images)
    ↓
deploy job (waits for approval, image: v1.2.0)
    ↓ (human approves)
    ↓
GitHub Actions SSH to VM as deploy user
    ↓
git checkout v1.2.0
    ↓
docker compose pull (pulls v1.2.0)
    ↓
docker compose up -d (starts v1.2.0)
    ↓
Production running v1.2.0 ✅
```

---

## Manual Rollback: Tag to Production

```
GitHub manually trigger workflow with v1.1.0
    ↓
deploy job (uses inputs.version = v1.1.0)
    ↓ (wait for approval)
    ↓
GitHub Actions SSH to VM
    ↓
git checkout v1.1.0
    ↓
docker compose pull (pulls v1.1.0)
    ↓
docker compose up -d (starts v1.1.0)
    ↓
Production running v1.1.0 ✅ (rolled back)
```

---

**Good luck with Week 5! You've got this! 🚀**
