#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { StringDecoder } from "node:string_decoder";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const recoveryExtension = resolve(
  root,
  "tools/pi-extensions/empty-final-recovery.ts",
);
const fixtureExtension = resolve(
  root,
  "tools/pi-extensions/fixtures/empty-final-provider.ts",
);

function textOf(message) {
  if (!Array.isArray(message?.content)) return "";
  return message.content
    .filter((part) => part?.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

function attachJsonl(stream, onRecord) {
  const decoder = new StringDecoder("utf8");
  let buffer = "";

  stream.on("data", (chunk) => {
    buffer += decoder.write(chunk);
    while (true) {
      const newline = buffer.indexOf("\n");
      if (newline < 0) break;
      let line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line !== "") onRecord(JSON.parse(line));
    }
  });

  stream.on("end", () => {
    buffer += decoder.end();
    if (buffer !== "") onRecord(JSON.parse(buffer));
  });
}

async function runCase(mode, expectedFinalText) {
  const home = await mkdtemp(`${tmpdir()}/pi-empty-final-test-`);
  const records = [];
  let stderr = "";
  let expectedFinalEnded = false;
  let settledAfterExpectedFinal = false;

  const child = spawn(process.env.PI_BIN ?? "pi", [
    "--mode", "rpc",
    "--no-session",
    "--offline",
    "--approve",
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--no-context-files",
    "--no-builtin-tools",
    "--extension", recoveryExtension,
    "--extension", fixtureExtension,
    "--model", "empty-final-fixture/empty-final-fixture-model",
  ], {
    cwd: root,
    env: {
      ...process.env,
      HOME: home,
      EMPTY_FINAL_FIXTURE_MODE: mode,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const completed = new Promise((resolveCase, rejectCase) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      rejectCase(new Error(
        `Timed out in ${mode} case. stderr: ${stderr}\n` +
        `records: ${JSON.stringify(records, null, 2)}`,
      ));
    }, 10_000);

    attachJsonl(child.stdout, (record) => {
      records.push(record);
      if (
        record.type === "message_end" &&
        record.message?.role === "assistant" &&
        textOf(record.message) === expectedFinalText
      ) {
        expectedFinalEnded = true;
      }
      if (record.type === "agent_settled" && expectedFinalEnded) {
        settledAfterExpectedFinal = true;
        child.stdin.end();
      }
    });

    child.once("error", (error) => {
      clearTimeout(timer);
      rejectCase(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (code !== 0 || signal !== null) {
        rejectCase(new Error(
          `Pi exited with code=${code} signal=${signal}. stderr: ${stderr}`,
        ));
        return;
      }
      resolveCase();
    });
  });

  child.stdin.write(`${JSON.stringify({
    id: `prompt-${mode}`,
    type: "prompt",
    message: "Run the fixture response.",
  })}\n`);

  await completed;
  assert.equal(settledAfterExpectedFinal, true, `${mode}: run did not settle`);

  const assistantMessages = records
    .filter((record) =>
      record.type === "message_end" &&
      record.message?.role === "assistant",
    )
    .map((record) => record.message);
  const recoveryMessages = records.filter((record) =>
    record.type === "message_end" &&
    record.message?.role === "custom" &&
    record.message.customType === "empty-final-recovery",
  );
  const recoveryNotices = records.filter((record) =>
    record.type === "extension_ui_request" &&
    record.method === "notify" &&
    record.message === "Recovered an empty terminal model response.",
  );
  const extensionErrors = records.filter((record) =>
    record.type === "extension_error",
  );

  assert.deepEqual(extensionErrors, [], `${mode}: extension error emitted`);
  if (mode === "empty-then-recover") {
    assert.equal(assistantMessages.length, 2, "expected exactly two model turns");
    assert.equal(textOf(assistantMessages[0]), "", "first final was not empty");
    assert.equal(textOf(assistantMessages[1]), "RECOVERED");
    assert.equal(recoveryMessages.length, 1, "recovery message count mismatch");
    assert.equal(recoveryNotices.length, 1, "recovery notice count mismatch");
  } else {
    assert.equal(assistantMessages.length, 1, "normal final triggered another turn");
    assert.equal(textOf(assistantMessages[0]), "NORMAL");
    assert.equal(recoveryMessages.length, 0, "normal final triggered recovery");
    assert.equal(recoveryNotices.length, 0, "normal final emitted recovery notice");
  }

  return {
    mode,
    assistantTurns: assistantMessages.length,
    recoveryMessages: recoveryMessages.length,
    recoveryNotices: recoveryNotices.length,
  };
}

const results = [];
results.push(await runCase("empty-then-recover", "RECOVERED"));
results.push(await runCase("normal", "NORMAL"));
console.log(JSON.stringify({ status: "PASS", results }, null, 2));
