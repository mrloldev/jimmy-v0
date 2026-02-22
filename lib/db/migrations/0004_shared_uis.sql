CREATE TABLE "shared_uis" (
	"id" varchar(12) PRIMARY KEY NOT NULL,
	"html" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
