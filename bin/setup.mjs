#!/usr/bin/env node
import { runFlightSetup } from "../src/cli.mjs";

const result = await runFlightSetup();
process.exitCode = result.exitCode;
