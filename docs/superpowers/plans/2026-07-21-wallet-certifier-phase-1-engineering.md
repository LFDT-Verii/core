# Wallet Certifier Phase One Engineering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision and deploy isolated devnet and testnet Wallet Certifier static, API, monitor, Mongo-user, SES, WAF, secret, alarm, and DNS resources from the engineering repository.

**Architecture:** A dedicated Terraform root creates a private S3/CloudFront SPA with `/api/*` routed to an API Gateway HTTP API and Fastify Lambda, plus a scheduled monitor Lambda using the same artifact. Both Lambdas run in existing private subnets, load secrets from Secrets Manager, and use SES. Atlas receives distinct least-privilege users/databases for devnet and testnet. A deployment workflow downloads artifacts from `LFDT-Verii/core`.

**Tech Stack:** Terraform 1.5.1, AWS provider 6.x, API Gateway v2, Lambda Node.js 24, S3, CloudFront, WAFv2, EventBridge, SES, Secrets Manager, CloudWatch, MongoDB Atlas provider, Cloudflare DNS, GitHub Actions.

## Global Constraints

- Only engineering-repository infrastructure/configuration changes belong here.
- Deploy only workspace `dev` (devnet) and `staging` (testnet).
- Dev points only to dev Hub/Registrar/tenant/services; staging points only to staging dependencies.
- Create distinct Atlas database users and database names per environment.
- Do not commit secret values; workflows obtain them from protected GitHub environments.
- API and monitor use the same immutable core artifact.
- Support email defaults to `support@velocitynetwork.foundation` and remains configurable.
- Run `terraform fmt` on every modified `.tf` file and validate every changed Terraform root.
- Use signed conventional commits; never amend.

---

## File map

- Modify `tf/16-atlas-mongodb/main.tf`, `variables.tf`, and `outputs.tf` for least-privilege application users.
- Modify `.github/workflows/deploy-mongodb.workflow.yml` to pass protected application-user input.
- Create `tf/22-wallet-certifier/main.tf`, `variables.tf`, `outputs.tf`, `versions.tf`, `common.auto.tfvars`, `dev.tfvars`, and `staging.tfvars`.
- Create focused modules under `tf/22-wallet-certifier/modules/` for web/API, Lambda, and alarms only when a resource group cannot stay readable in the root.
- Create `.github/workflows/deploy-wallet-certifier.workflow.yml`.
- Modify `.github/dependabot.yml` to include the new Terraform root.
- Create `tf/22-wallet-certifier/README.md` with prerequisites, secret names, apply order, smoke tests, and rollback.

---

### Task 1: Isolated engineering worktree and Atlas users

**Files:**

- Modify: `tf/16-atlas-mongodb/main.tf`
- Modify: `tf/16-atlas-mongodb/variables.tf`
- Modify: `tf/16-atlas-mongodb/outputs.tf`
- Modify: `.github/workflows/deploy-mongodb.workflow.yml`

**Interfaces:**

- Consumes protected `TF_VAR_database_users` JSON.
- Produces one `readWrite` user scoped to `wallet_certifier_dev` and one scoped to `wallet_certifier_staging` in the nonproduction Atlas project.

- [x] **Step 1: Create a sibling worktree from `origin/main`**

```bash
git worktree add ../engineering-codex-wallet-certifier -b codex/wallet-certifier origin/main
```

- [x] **Step 2: Add a typed `database_users` input**

```hcl
variable "database_users" {
  sensitive = true
  type = map(object({
    username = string
    password = string
    database = string
  }))
  default = {}
}
```

- [x] **Step 3: Create scoped Atlas users**

```hcl
resource "mongodbatlas_database_user" "application" {
  for_each           = var.database_users
  username           = each.value.username
  password           = each.value.password
  project_id         = mongodbatlas_project.main.id
  auth_database_name = "admin"

  roles {
    role_name     = "readWrite"
    database_name = each.value.database
  }
}
```

Expose only usernames/database names as a sensitive output; never output passwords.

- [x] **Step 4: Pass the protected JSON input in the Mongo deploy workflow**

Use `TF_VAR_database_users: ${{ secrets.DATABASE_USERS }}` in plan only. The encrypted Terraform plan remains the source for apply.

- [x] **Step 5: Format, validate, and commit**

```bash
terraform -chdir=tf/16-atlas-mongodb fmt -recursive
terraform -chdir=tf/16-atlas-mongodb init -backend=false
terraform -chdir=tf/16-atlas-mongodb validate
git add tf/16-atlas-mongodb .github/workflows/deploy-mongodb.workflow.yml
git commit -s -m "feat(mongodb): add wallet certifier users"
```

### Task 2: Wallet Certifier Terraform stack

**Files:**

- Create: `tf/22-wallet-certifier/versions.tf`
- Create: `tf/22-wallet-certifier/variables.tf`
- Create: `tf/22-wallet-certifier/main.tf`
- Create: `tf/22-wallet-certifier/outputs.tf`
- Create: `tf/22-wallet-certifier/common.auto.tfvars`
- Create: `tf/22-wallet-certifier/dev.tfvars`
- Create: `tf/22-wallet-certifier/staging.tfvars`

**Interfaces:**

- Consumes `wallet-certifier-app.zip`, `wallet-certifier-lambda.zip`, certificate ARN, Cloudflare token, and protected secret values.
- Produces CloudFront URL, API endpoint, bucket name, Lambda names, and secret ARNs.

- [x] **Step 1: Define typed environment inputs**

The environment object must include fixed values for `hub_url`, `registrar_url`, `tenant_id`, `issuer_service_id`, `relying_party_service_id`, `app_hostname`, `database_name`, `support_email`, `sender_email`, registration URL, logo URL, and badge metadata URLs. Secret values are a separate sensitive map containing Mongo URI, Hub operator token, and capability pepper.

- [x] **Step 2: Add static site and CloudFront resources**

Use a private bucket, origin access control, TLS 1.2+, SPA 403 fallback to `/index.html`, no caching for `/api/*`, and long immutable caching only for hashed assets. Route `/api/*` to the API Gateway origin and forward cookies, query strings, and required headers.

- [x] **Step 3: Add API and monitor Lambdas**

Both use `wallet-certifier-lambda.zip`, Node.js 24, existing private subnets/security group remote state, 512 MiB, module-scoped Mongo reuse, 30-second timeout, and reserved concurrency suitable for low volume. Handlers are `src/lambda-api.handler` and `src/lambda-monitor.handler`.

- [x] **Step 4: Add API Gateway and EventBridge**

Create a `$default` HTTP API integration and an explicit IAM-authorized `GET /api/support/runs/{runId}` route. Create a one-minute EventBridge rule and permission for the monitor Lambda.

- [x] **Step 5: Add secrets, SES, IAM, WAF, logs, and alarms**

Create versioned Secrets Manager entries from the sensitive input map; grant both functions only `GetSecretValue` for those ARNs and `ses:SendEmail` for the configured sender. Add WAF managed rules, an IP rate rule, and a higher suspicious threshold using CAPTCHA. Add alarms for Lambda errors/throttles, API 5xx, EventBridge failed invocation, and monitor duration.

- [x] **Step 6: Add dev/staging configuration**

`dev.tfvars` uses the existing dev Hub/Registrar endpoints and `wallet_certifier_dev`. `staging.tfvars` uses the existing staging Hub/Registrar endpoints and `wallet_certifier_staging`. The workflow passes the matching preconfigured Hub identifiers from protected GitHub environment variables named `WALLET_CERTIFIER_TENANT_ID`, `WALLET_CERTIFIER_ISSUER_SERVICE_ID`, and `WALLET_CERTIFIER_RELYING_PARTY_SERVICE_ID`; no empty or guessed identifiers are committed.

- [x] **Step 7: Format and validate**

```bash
terraform -chdir=tf/22-wallet-certifier fmt -recursive
terraform -chdir=tf/22-wallet-certifier init -backend=false
terraform -chdir=tf/22-wallet-certifier validate
```

Expected: formatting produces no diff on a second run and validation succeeds.

- [x] **Step 8: Commit**

```bash
git add tf/22-wallet-certifier
git commit -s -m "feat(wallet-certifier): provision serverless stacks"
```

### Task 3: Artifact deployment workflow

**Files:**

- Create: `.github/workflows/deploy-wallet-certifier.workflow.yml`
- Modify: `.github/dependabot.yml`

**Interfaces:**

- Consumes a successful `build-wallet-certifier.workflow.yml` run ID from `LFDT-Verii/core`.
- Deploys only `dev` or `staging` after validate/plan approval.

- [x] **Step 1: Add workflow dispatch inputs**

Inputs are `environment` (`dev` or `staging`) and `core_run_id`. Use protected environments `wallet-certifier-dev` and `wallet-certifier-staging`.

- [x] **Step 2: Download and verify core artifacts**

Download both named artifacts from `LFDT-Verii/core`, calculate SHA-256 checksums, unzip only the app artifact for S3 sync, and place the Lambda ZIP in `tf/22-wallet-certifier/` before Terraform planning.

- [x] **Step 3: Plan/apply and deploy static assets safely**

Validate Terraform without a backend, plan with the environment tfvars and protected secret JSON, encrypt the plan as existing workflows do, apply the downloaded plan, sync the SPA with `--delete`, then invalidate CloudFront. Apply infrastructure before the static sync so new distributions work on first deployment.

- [x] **Step 4: Add the Terraform root to Dependabot and validate workflow syntax**

Run the repository's GitHub workflow lint job after the PR opens, and perform local static checks with:

```bash
git diff --check
terraform fmt -check -recursive tf/22-wallet-certifier tf/16-atlas-mongodb
```

- [x] **Step 5: Commit**

```bash
git add .github/workflows/deploy-wallet-certifier.workflow.yml .github/dependabot.yml
git commit -s -m "ci(wallet-certifier): deploy core artifacts"
```

### Task 4: Operations documentation and final engineering verification

**Files:**

- Create: `tf/22-wallet-certifier/README.md`

**Interfaces:**

- Produces an operator runbook for prerequisites, initial secrets, Atlas apply order, stack apply, SES sandbox behavior, smoke tests, alarms, rollback, and deletion safeguards.

- [x] **Step 1: Write the runbook**

Document the exact protected secret keys `DATABASE_USERS`, `WALLET_CERTIFIER_SECRET_VALUES`, AWS credentials, Cloudflare token, and artifact run ID flow without including values. Document that Hub tenant/service IDs must refer to the existing VNF tenant in the matching environment.

- [x] **Step 2: Validate both Terraform roots and workflows**

```bash
terraform fmt -check -recursive tf/16-atlas-mongodb tf/22-wallet-certifier
terraform -chdir=tf/16-atlas-mongodb init -backend=false
terraform -chdir=tf/16-atlas-mongodb validate
terraform -chdir=tf/22-wallet-certifier init -backend=false
terraform -chdir=tf/22-wallet-certifier validate
git diff --check origin/main...HEAD
```

Expected: all commands exit zero.

- [x] **Step 3: Commit final documentation**

```bash
git add tf/22-wallet-certifier/README.md
git commit -s -m "docs(wallet-certifier): add deployment runbook"
```
