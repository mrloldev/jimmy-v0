export interface MissingEnvVar {
  name: string;
  description: string;
  example: string;
  required: boolean;
}

const PLACEHOLDERS = ["v0_sk_...", "your-secret-key-here", "your_v0_api_key_here"];

function isValid(value: string | undefined): boolean {
  const v = (value ?? "").trim();
  return !!v && !PLACEHOLDERS.includes(v);
}

export function checkRequiredEnvVars(): MissingEnvVar[] {
  const requiredVars: MissingEnvVar[] = [
    {
      name: "POSTGRES_URL",
      description: "PostgreSQL database connection string",
      example: "", // No example - user needs to provide their own
      required: true,
    },
  ];

  const missing = requiredVars.filter(
    (envVar) => !isValid(process.env[envVar.name]),
  );

  return missing;
}

export function hasAllRequiredEnvVars(): boolean {
  return checkRequiredEnvVars().length === 0;
}

export const hasEnvVars = !!isValid(process.env.POSTGRES_URL);
