# **Netiks Store \- Week 5 Lab**

## **CI/CD Deployment Pipeline**

**Prerequisite:** Week 4 Lab. Your build-and-push workflow must already produce SHA, version-tag, and `latest` images when a Git version tag is pushed.

## **Objective**

In Week 4, the pipeline stopped at the container registry. A human still had to SSH into the VM and run the Docker Compose deployment commands manually.

This week, remove that final manual deployment step.

By the end of the lab, pushing a version tag such as `v1.2.0` should:

1. Build and push the images using the Week 4 pipeline.  
2. Wait for a manual production approval.  
3. SSH into the VM using a dedicated deployment account.  
4. Deploy the tagged version automatically.  
5. Allow a previous version to be redeployed through a manual rollback workflow.

# **Part 1 \- Understand the Basics**

Answer briefly:

1. Which manual commands from Week 4 Part 6 are being replaced by automation this week?  
2. SSH does not support OIDC. Why is storing a dedicated CI deployment key safer than reusing your personal SSH key? What should you do if the deployment key is ever leaked?  
3. What is the difference between:  
   * a **push-based deployment**, where CI connects to the VM and deploys the application; and  
   * a **pull-based deployment**, where the VM checks for new versions and deploys them itself?  
4. Which model are we building this week \- **push-based deployment or pull-based deployment**?

# **Part 2 \- Prepare the VM for Remote Deployment**

Create a dedicated deployment account instead of using your personal VM account.

> **Important:** Membership in the Docker group provides significant privileges and should not be treated as equivalent to a fully unprivileged Linux account. The purpose here is to avoid giving the CI account direct `sudo` access and to separate deployment credentials from your personal login.

Create the deployment user:

```shell
sudo adduser --disabled-password deploy
sudo usermod -aG docker deploy
```

Generate a new SSH key pair on your laptop specifically for CI.

**Never reuse your personal SSH private key.**

```shell
ssh-keygen -t ed25519 -f netiks_deploy_key -C "github-actions-deploy" -N ""
```

Add the public key to the deployment user on the VM:

```shell
sudo mkdir -p /home/deploy/.ssh

sudo tee /home/deploy/.ssh/authorized_keys < netiks_deploy_key.pub

sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

Confirm that the repository exists under the deployment user's home directory:

```
~/netiks_store
```

If it does not exist, clone the repository there and ensure the `deploy` user owns the working tree.

For example:

```shell
sudo -u deploy git clone <repository-url> /home/deploy/netiks_store
```

The deployment account needs to be able to perform Git operations and run Docker Compose, but it should not be granted `sudo`.

## **Configure GitHub**

Create a GitHub Environment named:

```
production
```

In the `production` environment, create these secrets:

```
DEPLOY_SSH_KEY
DEPLOY_HOST
DEPLOY_USER
```

Where:

* `DEPLOY_SSH_KEY` \= contents of `netiks_deploy_key`  
* `DEPLOY_HOST` \= VM public IP or domain  
* `DEPLOY_USER` \= `deploy`

Do not expose the private key anywhere in screenshots or workflow logs.

### **Deliverables**

Provide:

* Command output showing that the `deploy` user was created.  
* Output showing `authorized_keys` ownership and permissions.  
* Screenshot showing the three secret names only. **Never show secret values.**

### **Answer**

Why should the deployment user not have `sudo` access?

Why does it still need access to Docker?

# **Part 3 \- Add a Deployment Job to the Workflow**

Extend:

```
.github/workflows/build-and-push.yml
```

with a deployment job that:

* runs only after `build-and-push` succeeds;  
* runs only for version tags;  
* targets the `production` environment;  
* connects to the VM using the dedicated deployment account;  
* checks out the exact version being deployed on the VM;  
* pulls the corresponding images;  
* recreates the services.

Your deployment job should follow this structure:

```
deploy:
  needs: build-and-push
  
  if: startsWith(github.ref, 'refs/tags/v') || github.event_name     == 'workflow_dispatch'

  runs-on: ubuntu-latest
  environment: production

  steps:
    - name: Deploy over SSH
      uses: appleboy/ssh-action@v1
      with:
        host: ${{ secrets.DEPLOY_HOST }}
        username: ${{ secrets.DEPLOY_USER }}
        key: ${{ secrets.DEPLOY_SSH_KEY }}
        script: |
          set -e

          cd ~/netiks_store

     VERSION="${{ github.ref_name }}"


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

> **Security note:** For production workflows, third-party GitHub Actions should ideally be pinned to a full commit SHA rather than a mutable tag such as `@v1`. GitHub recommends this as a supply-chain security measure. For this lab, understanding the principle is sufficient unless your instructor provides a specific SHA to use.

### **Important**

Do **not** add a `sed` step to modify the compose file in the GitHub runner.

The version in `docker-compose.prod.yml` must already be committed to the Git repository before the release tag is created. The deployment job should deploy the exact tagged commit.

### **Deliverables**

Submit:

* Updated `.github/workflows/build-and-push.yml`.  
* Explanation of why:

```

if: startsWith(github.ref, 'refs/tags/v') || github.event_name == 'workflow_dispatch'
```

prevents deployment from running on every push to `main`.

### **Answer**

Why does the deploy job declare:

```
needs: build-and-push
```

instead of running in parallel with it?

# **Part 4 \- Release Checklist Becomes a Habit**

Before creating a release tag, the version in `docker-compose.prod.yml` must match the version you are about to release.

For example, if releasing:

```
v1.2.0
```

update the appropriate service image in:

```
docker-compose.prod.yml
```

to:

```
v1.2.0
```

Then commit the change and create the tag:

```shell
git add docker-compose.prod.yml
git commit -m "release: v1.2.0"
git tag v1.2.0
git push origin main --tags
```

The tag must point to the commit containing the compose-file version change.

### **Deliverables**

Provide:

* The commit diff showing the version bump.  
* Confirmation that the Git tag and compose-file version match.

### **Answer**

What can happen if you push the Git tag before committing the `docker-compose.prod.yml` version change?

# **Part 5 \- Add a Production Approval Gate**

Create a GitHub Environment named:

```
production
```

Configure a required reviewer for the environment.

If your repository and GitHub plan support required reviewers, add yourself and/or your designated reviewer.

The deployment job already references the environment:

```
environment: production
```

Therefore, the deployment job must wait for the environment protection rule before it can run.

GitHub environments can require approval before a job referencing the environment proceeds. Environment secrets are also protected by the environment rules.

### **Deliverables**

Provide:

* Screenshot of the `production` environment protection rule.  
* Screenshot of a workflow run waiting for approval.

### **Answer**

Why should the approval gate be placed on the deployment job rather than the build-and-push job?

Think about the difference between:

* producing an artifact; and  
* changing the production environment.

# **Part 6 \- Test the Pipeline End to End**

## **6a. Release**

Make a small visible change to one service.

Update the service version in:

```
docker-compose.prod.yml
```

Commit the change and create a new version tag, for example:

```shell
git add docker-compose.prod.yml
git commit -m "release: v1.2.0"
git tag v1.2.0
git push origin main --tags
```

Confirm the following sequence:

1. `build-and-push` starts.  
2. Validation succeeds.  
3. All required images are built.  
4. Images are pushed to the registry.  
5. The deployment job waits for production approval.  
6. You approve the deployment.  
7. GitHub Actions connects to the VM.  
8. The VM checks out the tagged release.  
9. Docker Compose pulls the new images.  
10. Docker Compose recreates the required services.

You should not manually SSH into the VM to perform the deployment.

## **6b. Verify**

Open the application using the VM's public IP or configured domain.

Confirm that the visible change introduced in the release is present.

## **6c. Rollback**

Add a manual workflow trigger.

The workflow should support:

```
on:
  push:
    tags:
      - "v*.*.*"

  workflow_dispatch:
    inputs:
      version:
        description: "Tag to deploy, e.g. v1.1.0"
        required: true
        type: string
```

GitHub makes `workflow_dispatch` inputs available through the `inputs` context. The workflow file must exist on the default branch for the manual trigger to be available.

Update the deployment job so that it determines the version as follows:

```
VERSION="${{ inputs.version || github.ref_name }}"
```

For a normal tag deployment:

```
github.ref_name
```

will be the release tag.

For a manual rollback:

```
inputs.version
```

will contain the requested previous tag.

The deployment script must then explicitly check out that version:

```shell
git fetch --tags origin
git checkout --force "$VERSION"
```

Then redeploy:

```shell
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  pull

docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d
```

Run the manual workflow once against a previous release, for example:

```
v1.1.0
```

Confirm that the VM returns to the previous version.

### **Deliverables**

Provide:

* Screenshot of the successful tagged release workflow.  
* Screenshot showing the production approval and successful deployment.  
* Screenshot showing the application after deployment.  
* Screenshot of the manual `workflow_dispatch` rollback run.  
* `docker ps` output before and after the rollback showing the image version change.

# **Deliverables Checklist**

## **Part 1**

* Answers to the 3 questions.

## **Part 2**

* Deploy user creation output.  
* `authorized_keys` ownership and permission output.  
* Screenshot showing the three secret names only.  
* Answer explaining why the deploy user should not have `sudo`.  
* Answer explaining why it requires Docker access.

## **Part 3**

* Updated `.github/workflows/build-and-push.yml`.  
* Answer explaining the tag-only `if` condition.  
* Answer explaining `needs: build-and-push`.

## **Part 4**

* Commit diff showing the `docker-compose.prod.yml` version change.  
* Confirmation that the Git tag and compose-file version agree.  
* Answer explaining what happens if the tag is pushed before the compose change.

## **Part 5**

* Screenshot of the `production` environment protection rule.  
* Screenshot of a workflow waiting for approval.  
* Answer explaining why approval belongs on deployment.

## **Part 6**

* Screenshot of successful tagged release.  
* Screenshot showing production approval and deployment.  
* Screenshot showing the application change.  
* Screenshot of successful manual rollback.  
* `docker ps` output before and after rollback.

# **What Good Looks Like**

At the end of this lab, you should be able to explain:

> **A release tag is pushed → GitHub Actions validates and builds the application → images are pushed to the registry → a human approves the production deployment → GitHub Actions connects to the VM → the VM checks out the exact tagged release → Docker Compose pulls and starts the released images → a previous tagged release can be redeployed when required.**

You should also understand the distinction between:

* CI artifact creation  
* production deployment  
* deployment approval  
* deployment credentials  
* versioned releases  
* rollback

Week 6 will introduce a staging environment so a change can be validated before it reaches the production approval gate.

**Submit:** `Week5_<FirstName>_<LastName>.pdf` to shulammite.odde@cognetiks.com, cc flora.owhiroro@cognetiks.com.