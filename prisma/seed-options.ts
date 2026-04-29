type SeedEnv = Record<string, string | undefined>;

export function getSeedOptions(env: SeedEnv = process.env) {
  return {
    resetIngestData: env.ROLE_RADAR_RESET_INGEST_DATA === "1"
  };
}
