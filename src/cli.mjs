import { loadSharedInstaller } from "./sharedTool.mjs";
import { DEFAULT_FLIGHT_BOOTSTRAP } from "./bootstrap.mjs";

/** The shared CLI owns options, full default/selection, diagnostics and mutation. */
export async function runFlightSetup({ args, bootstrap = DEFAULT_FLIGHT_BOOTSTRAP, write } = {}) {
  const { runCli } = await loadSharedInstaller();
  return runCli({ args, bootstrap, write });
}
