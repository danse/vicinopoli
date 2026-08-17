import { execSync } from "node:child_process";

/**
 * Runs once before the test suite, after the webServer is up.
 *
 * The e2e suite must start from a cleared database so every run is
 * deterministic: the CI bootstrap boots a fresh Postgres volume, and local runs
 * would otherwise accumulate posts across runs (which silently changes feed
 * reach, pagination and heatmap expectations). We truncate the app tables —
 * keeping the schema, the PostGIS extension tables and alembic_version.
 */
export default function globalSetup() {
  execSync(
    [
      "docker compose exec -T db psql -U vicinopoli -d vicinopoli",
      `-c "TRUNCATE activity_cells, analytics_events, devices, locations, media, posts, reports RESTART IDENTITY CASCADE"`,
    ].join(" "),
    {
      cwd: "..",
      stdio: "inherit",
    },
  );
}
