# Problem Definition: FlagForge

## Problem
Deploying code changes directly to 100% of users introduces a high blast radius during production releases. 
Software teams lack a lightweight, self-hostable way to decouple code deployment from feature exposure, 
gradually roll out features to a target percentage of users, and instantly disable broken features in production without emergency hotfixes or redeployments.

## Users
Software engineers, product managers, and DevOps/SaaS engineering teams building B2B applications who need safe release mechanisms and controlled feature rollouts.

## Value
- **Zero-downtime & low-risk releases:** Features can be deployed silently to production and enabled gradually via percentage rollouts.
- **Instant kill-switch:** Turn off faulty features in <1 second without running CI/CD deployment pipelines.
- **Targeted exposure:** Test new capabilities on internal users, beta testers, or specific pricing plans before general release.
- **Lower cycle time:** Reduces fear of production deployments and shortens the feedback loop from code commit to user evaluation.

## Scope (v1)
- **Workspaces & Environments:** Basic workspace structure with Environment-scoped SDK Keys (`Development`, `Production`).
- **Feature Flag Management:** Boolean toggles, Percentage Rollouts (0–100%), and basic Targeting Rules (e.g., matching user attributes like `plan`, `country`).
- **High-Performance Evaluation Engine:** Stateless, deterministic evaluation API endpoint (`POST /api/v1/evaluate`) with zero database writes during evaluations.
- **Audit Logging:** Immutable record of flag configuration changes (who changed what, when, and previous/new state).
- **Web Dashboard:** Minimal React SPA for flag creation, targeting rule configuration, percentage rollout sliders, evaluation testing playground, and audit logs.

## Non-goals (v1)
- Multi-user RBAC hierarchy beyond basic workspace scope.
- Third-party webhooks and notifications (Jira, Slack, Teams integration).
- Complex A/B testing statistical analysis or multi-variate metrics tracking.
- Edge / CDN worker deployment (evaluation is served directly from the NestJS application).
- Automated scheduling of flag state toggles (e.g., "enable on Monday at 9:00 AM").

## Success Criteria
An engineer can run `docker compose up`, log in to the dashboard, create a feature flag with a 50% percentage rollout, and verify via a single `curl` command (or the provided `scripts/demo.sh`) that evaluation is 100% deterministic and takes <15ms per evaluation.