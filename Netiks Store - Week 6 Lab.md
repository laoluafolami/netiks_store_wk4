# **Netiks Store \- Week 6 Lab**

## **Staging Environment and Pre-Production Deployment**

**Duration:** 1 week  
**Submission:** Friday, 25 September, 5:00 PM  
**Prerequisite:** Week 5 Lab. Your production deployment pipeline must already work.

# **Objective**

In Week 5, a version tag triggers the production deployment after manual approval.

The problem is that production approval happens without first deploying the new version to a separate environment for testing.

This week, introduce a **staging environment**.

By the end of the lab:

1. A push to `main` builds and pushes the application images.  
2. The exact SHA-tagged images are automatically deployed to staging.  
3. No approval is required for staging.  
4. Production remains unchanged.  
5. A version tag can still trigger the existing Week 5 production approval and deployment process.

The final flow should be:

```
Push to main
      ↓
Build & Push SHA Images
      ↓
Automatic Staging Deployment
      ↓
Test Staging
      ↓
Create Version Tag
      ↓
Production Approval
      ↓
Production Deployment
```

# **Part 1 \- Understand the Basics**

Answer briefly:

### **1.1** Why is a successful CI build not enough to know that an application is ready for production?

### **1.2** Why should staging deploy the exact SHA-tagged image produced by the build job instead of building another image?

### **1.3** Why should staging deploy automatically while production still requires approval?

# **Part 2 \- Prepare the Staging Environment**

Staging and production will run on the **same VM** for this lab.

The environments must still be separated using:

* Separate working directories.  
* Separate Docker Compose project names.  
* Separate ports.  
* Separate environment variables.  
* Separate database data.

## **2.1 Create the staging working directory**

The production repository is currently:

```
/home/deploy/netiks_store
```

Create a second clone for staging:

```sh
sudo -u deploy git clone <repository-url> /home/deploy/netiks_store-staging
```

You should now have:

```
/home/deploy/netiks_store
/home/deploy/netiks_store-staging
```

Production continues to use:

```
/home/deploy/netiks_store
```

Staging uses:

```
/home/deploy/netiks_store-staging
```

## **2.2 Create staging Compose configuration**

Create:

```
docker-compose.staging.yml
```

The staging configuration should use the same services as the existing application and use the SHA-tagged images produced by the `build-and-push` job.

**Important:** Do not override the `ports:` section in `docker-compose.staging.yml`. Docker Compose merges `ports` entries from multiple Compose files rather than replacing them. Adding a second port mapping for the same container would cause both the production and staging host ports to be present in the final configuration and can result in a port allocation error.

Instead, update the **base `docker-compose.yml`** so the host ports are controlled through environment variables:

```
services:
  web:
    ports:
      - "127.0.0.1:${WEB_EXPOSE_PORT:-3001}:3000"

  gateway:
    ports:
      - "127.0.0.1:${GATEWAY_EXPOSE_PORT:-8000}:8000"
```

The staging `.env` should then contain:

```
WEB_EXPOSE_PORT=3002
GATEWAY_EXPOSE_PORT=8100
```

Production does not need to change its existing values because the defaults remain:

```
WEB_EXPOSE_PORT=3001
GATEWAY_EXPOSE_PORT=8000
```

Your `docker-compose.staging.yml` should therefore contain the image overrides without defining another `ports:` section:

```
services:
  web:
    image: ${REGISTRY}/web:${IMAGE_TAG}

  gateway:
    image: ${REGISTRY}/gateway:${IMAGE_TAG}

  identity-service:
    image: ${REGISTRY}/identity-service:${IMAGE_TAG}

  vendor-service:
    image: ${REGISTRY}/vendor-service:${IMAGE_TAG}

  catalog-service:
    image: ${REGISTRY}/catalog-service:${IMAGE_TAG}

  media-service:
    image: ${REGISTRY}/media-service:${IMAGE_TAG}

  admin-service:
    image: ${REGISTRY}/admin-service:${IMAGE_TAG}
```

Adjust the service names to match your application.

The important part is:

```
IMAGE_TAG = Git commit SHA
```

Staging must not use `latest`.

## **2.3 Configure staging environment variables**

Create a staging `.env` in:

```
/home/deploy/netiks_store-staging
```

The staging environment must:

* Use different database credentials from production.  
* Use a different JWT secret from production.  
* Point to a staging database/data volume.  
* Never connect to the production database.

Do not commit the `.env` file.

# **Part 3 \- Add the Staging Deployment**

Update:

```
.github/workflows/build-and-push.yml
```

Add a `deploy-staging` job that:

* Runs after `build-and-push`.  
* Runs only when `main` is pushed.  
* Uses the existing deployment SSH credentials.  
* Connects to the VM.  
* Checks out the latest `main`.  
* Uses the SHA of the triggering commit.  
* Pulls the SHA-tagged images.  
* Starts/recreates the staging services.

Use this structure:

```
deploy-staging:
  needs: build-and-push

  if: github.ref == 'refs/heads/main'

  runs-on: ubuntu-latest
  environment: staging

  steps:
    - name: Deploy to staging
      uses: appleboy/ssh-action@v1
      with:
        host: ${{ secrets.DEPLOY_HOST }}
        username: ${{ secrets.DEPLOY_USER }}
        key: ${{ secrets.DEPLOY_SSH_KEY }}

        script: |
          set -e

          cd /home/deploy/netiks_store-staging

          git fetch origin main
          git checkout --force main
          git reset --hard origin/main

          export IMAGE_TAG="${{ github.sha }}"
          export REGISTRY="<your-ECR-or-ACR-registry>/netiks-store"

          docker compose \
            -p netiks_staging \
            -f docker-compose.yml \
            -f docker-compose.staging.yml \
            pull

          docker compose \
            -p netiks_staging \
            -f docker-compose.yml \
            -f docker-compose.staging.yml \
            up -d

          docker compose -p netiks_staging ps
```

Use the same registry configuration from Week 5\.

### **AWS**

Use your existing ECR configuration.

### **Azure**

Use your existing ACR configuration.

Do not create a second build process. Staging must use the image already produced by `build-and-push`.

### **Deliverables**

Submit:

* Updated `.github/workflows/build-and-push.yml`.  
* Screenshot of the successful `build-and-push` job.  
* Screenshot of the automatic `deploy-staging` job.

### **Answer**

Why does `deploy-staging` use:

```
needs: build-and-push
```

# **Part 4 \- Configure GitHub Staging Environment**

Create a GitHub Environment named:

```
staging
```

Do **not** configure a required reviewer.

Add:

```
DEPLOY_SSH_KEY
DEPLOY_HOST
DEPLOY_USER
```

You may use the same deployment credentials as production because both environments use the same VM and deployment account.

The isolation comes from the separate staging directory, Compose project, ports, configuration, and data.

### **Deliverables**

Provide:

* Screenshot of the `staging` environment.  
* Screenshot showing the three secret names only.

### **Answer**

What prevents the staging deployment from changing the production containers?

# **Part 5 \- Configure Staging Access**

Configure Nginx so staging is available on port `8080`.

For example:

```
server {
    listen 8080;
    server_name _;

    location /api/ {
        proxy_pass http://127.0.0.1:8100;
    }

    location / {
        proxy_pass http://127.0.0.1:3002;
    }
}
```

Test the configuration:

```sh
sudo nginx -t
```

Reload Nginx if the test succeeds:

```sh
sudo systemctl reload nginx
```

Allow TCP `8080` through the VM's cloud firewall:

* **AWS:** EC2 Security Group  
* **Azure:** Network Security Group

Restrict the source where practical.

### **Deliverables**

Provide:

* Nginx staging configuration.  
* Successful `nginx -t` output.  
* Screenshot of the AWS Security Group or Azure NSG rule.

# **Part 6 \- Test the Complete Flow**

## **6.1 Deploy to staging**

Make a small visible change to the application.

Commit and push it to `main`.

Confirm:

```
build-and-push
      ↓
deploy-staging
      ↓
staging updated
```

Open:

```
http://<vm-ip>:8080/
```

Confirm that the change is visible.

Then open production:

```
http://<vm-ip>/
```

Confirm that the change is **not** yet in production.

## **6.2 Promote to production**

Once staging has been tested, follow the existing Week 5 release process:

```
Update production version
        ↓
Commit
        ↓
Create version tag
        ↓
Push tag
        ↓
Production approval
        ↓
Production deployment
```

Do not redesign the production deployment process.

Confirm that:

* Production still requires approval.  
* Production deploys successfully.  
* The tested change is now present in production.  
* Staging continues running independently.

## **6.3 Verify isolation**

Run:

```sh
docker compose -p netiks_staging ps
```

and:

```sh
docker compose ps
```

Then stop only the staging web service:

```sh
docker compose -p netiks_staging stop web
```

Confirm production still works.

Restore staging:

```sh
docker compose -p netiks_staging start web
```

### **Deliverables**

Provide:

* Screenshot of automatic staging deployment.  
* Screenshot showing the change in staging.  
* Screenshot showing the change is not yet in production.  
* Screenshot of production approval and deployment.  
* `docker compose -p netiks_staging ps` output.  
* Production `docker compose ps` output.  
* Evidence from the isolation test.

# **Deliverables Checklist**

### **Part 1**

* Answers to the 3 questions.

### **Part 2**

* Staging directory evidence.  
* `docker-compose.staging.yml`.  
* Confirmation that staging uses separate configuration/data.

### **Part 3**

* Updated GitHub Actions workflow.  
* Successful staging deployment.  
* Answer explaining `needs: build-and-push`.

### **Part 4**

* Staging GitHub Environment screenshot.  
* Three secret names.  
* Answer explaining environment isolation.

### **Part 5**

* Nginx configuration.  
* `nginx -t` output.  
* AWS Security Group or Azure NSG screenshot.

### **Part 6**

* Automatic staging deployment.  
* Staging test result.  
* Production-before-staging comparison.  
* Production approval and deployment.  
* Compose output for both environments.  
* Isolation test.

# **What Good Looks Like**

At the end of the lab, you should be able to demonstrate:

```
Push to main
     ↓
Build & Push SHA Image
     ↓
Automatic Staging Deployment
     ↓
Test Change
     ↓
Version Tag
     ↓
Production Approval
     ↓
Production Deployment
```

The key concept is:

> **Every change can be tested in a running staging environment before it is deliberately promoted to production.**

# **Submission**

Submit:

```
Week6_<FirstName>_<LastName>.pdf
```

To: **shulammite.odde@cognetiks.com**

CC: **flora.owhiroro@cognetiks.com**