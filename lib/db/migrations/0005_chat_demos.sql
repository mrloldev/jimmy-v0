-- Drop shared_uis table
DROP TABLE IF EXISTS "shared_uis";

-- Create chat_demos table (chat_id stores v0 chat ID from chat URLs)
CREATE TABLE IF NOT EXISTS "chat_demos" (
	"chat_id" varchar(255) PRIMARY KEY NOT NULL,
	"html" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
