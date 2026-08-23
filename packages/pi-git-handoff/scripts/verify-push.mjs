#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import {
  errorResult,
  HandoffError,
  jsonText,
  parseArguments,
  pushVerified,
  verifyExternal,
} from "./core.mjs";

const HELP = `Usage:
  node scripts/verify-push.mjs --external \\
    --adapter <project-adapter.json> --artifact <outbox-directory> \\
    [--attempt-id <id>] [--interactive | --confirm-token <token>] \\
    [--authority-ref <ref>] [--confirmation-quote <text>]

Runs only in the authorized external environment. It verifies the immutable
artifact and prints the exact preview before push. Without interactive input
or a matching confirmation token, it stops at push authorization required.
`;

async function askForToken(expected) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new HandoffError("INTERACTIVE_TTY_REQUIRED", "--interactive requires a TTY");
  }
  const ui = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await ui.question(`Type confirmation token ${expected}: `);
  } finally {
    ui.close();
  }
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (process.env.PI_SANDBOX_SESSION === "1") {
    throw new HandoffError("SANDBOX_EXTERNAL_FORBIDDEN", "verify-push cannot run in a Pi WSL sandbox session");
  }
  if (!args.external) {
    throw new HandoffError("EXTERNAL_ROLE_REQUIRED", "verify-push requires explicit --external role acknowledgement");
  }
  if (!args.adapter || !args.artifact) {
    throw new HandoffError("INVALID_ARGUMENT", "--adapter and --artifact are required");
  }
  const verification = await verifyExternal({
    adapterPath: args.adapter,
    artifactPath: args.artifact,
    attemptId: args["attempt-id"],
  });
  process.stdout.write(jsonText({
    state: verification.state,
    preview: verification.preview,
    confirmationToken: verification.confirmationToken,
  }));

  let token = args["confirm-token"];
  if (!token && args.interactive) token = await askForToken(verification.confirmationToken);
  if (!token) {
    process.stdout.write(jsonText({
      state: "push-authorization-required",
      message: "Review the preview and provide the exact confirmation token in the authorized external environment.",
    }));
    return 0;
  }
  const result = await pushVerified(verification, {
    confirmToken: token,
    authorityRef: args["authority-ref"],
    confirmationQuote: args["confirmation-quote"],
  });
  process.stdout.write(jsonText({
    state: result.state,
    remoteResult: result.pushReceipt["remote-result"],
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
