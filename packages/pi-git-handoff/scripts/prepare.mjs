#!/usr/bin/env node
import {
  errorResult,
  HandoffError,
  jsonText,
  parseArguments,
  prepareDelivery,
} from "./core.mjs";

const HELP = `Usage:
  node scripts/prepare.mjs --adapter <project-adapter.json> \\
    --profile <name> --authority-ref <verification-ref> \\
    [--project-root <path>] [--delivery-id <id>]

Creates an immutable local bundle outbox from an already committed, clean
sandbox result. It never fetches, pulls, pushes, clones, or accesses the
external repository path.
`;

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (!args.adapter || !args.profile || !args["authority-ref"]) {
    throw new HandoffError("INVALID_ARGUMENT", "--adapter, --profile, and --authority-ref are required");
  }
  const result = await prepareDelivery({
    adapterPath: args.adapter,
    profile: args.profile,
    projectRoot: args["project-root"],
    deliveryId: args["delivery-id"],
    authorityRef: args["authority-ref"],
  });
  process.stdout.write(jsonText({
    state: result.state,
    deliveryId: result.deliveryId,
    directory: result.directory,
    commit: result.manifest.delivery.commit,
    tree: result.manifest.delivery.tree,
    targetBranch: result.manifest["target-branch"],
    artifactIndexSha256: result.artifactIndexSha256,
  }));
  return 0;
}

main().then(
  (code) => { process.exitCode = code; },
  (error) => {
    process.stderr.write(jsonText(errorResult(error)));
    process.exitCode = 1;
  },
);
