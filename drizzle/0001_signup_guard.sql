ALTER TABLE "signup_attempts" ADD COLUMN "fp" text;--> statement-breakpoint
ALTER TABLE "signup_attempts" ADD COLUMN "hw" text;--> statement-breakpoint
ALTER TABLE "signup_attempts" ADD COLUMN "hosting" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "signup_attempts" ADD COLUMN "method" text DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "signup_fp" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "signup_asn" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "signup_hosting" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "bonus_decided_at" timestamp;--> statement-breakpoint
CREATE INDEX "signup_attempts_fp_idx" ON "signup_attempts" USING btree ("fp","created_at");--> statement-breakpoint
CREATE INDEX "signup_attempts_asn_idx" ON "signup_attempts" USING btree ("asn","created_at");--> statement-breakpoint
CREATE INDEX "signup_attempts_email_idx" ON "signup_attempts" USING btree ("email_hash");--> statement-breakpoint
CREATE INDEX "signup_attempts_created_idx" ON "signup_attempts" USING btree ("created_at");