ALTER TABLE "projects" ADD COLUMN "github_repo" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "github_branch" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "github_pushed_at" timestamp;