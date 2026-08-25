#!/usr/bin/env node
/**
 * Read-only Pi session audit.
 *
 * Usage:
 *   node scripts/analyze-agent-stops.mjs --input /path/session.jsonl
 *   node scripts/analyze-agent-stops.mjs --input /path/session.jsonl --out .pi/diagnostics/stops
 *
 * Produces <out>.json (complete normalized event record) and <out>.md
 * (human-readable timeline plus stop-candidate findings). It never writes the
 * input session and does not require Pi APIs.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const argv = process.argv.slice(2);
const valueOf = (flag) => {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
};
const input = valueOf("--input") ?? process.env.PI_SESSION_FILE;
const output = valueOf("--out") ?? ".pi/diagnostics/agent-stop-audit";
if (!input) {
  console.error("Usage: node scripts/analyze-agent-stops.mjs --input <session.jsonl> [--out <base-path>]");
  process.exitCode = 2;
} else {
  const raw = await readFile(input, "utf8");
  const entries = raw.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`Invalid JSONL at line ${index + 1}: ${error.message}`); }
  });
  const textOf = (content) => typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.filter((part) => part?.type === "text").map((part) => part.text ?? "").join("\n")
      : "";
  const normalized = entries.map((entry, index) => {
    const message = entry.message;
    const role = message?.role ?? entry.type;
    const toolCalls = role === "assistant" && Array.isArray(message.content)
      ? message.content.filter((part) => part?.type === "toolCall").map((part) => ({ id: part.id, name: part.name }))
      : [];
    return {
      index: index + 1,
      id: entry.id ?? null,
      parentId: entry.parentId ?? null,
      timestamp: entry.timestamp ?? message?.timestamp ?? null,
      entryType: entry.type,
      role,
      text: textOf(message?.content ?? entry.summary ?? ""),
      stopReason: message?.stopReason ?? null,
      toolCalls,
      toolName: message?.toolName ?? null,
      toolError: message?.isError === true || message?.cancelled === true,
      toolExitCode: message?.exitCode ?? null,
      model: message?.model ?? entry.modelId ?? null,
      provider: message?.provider ?? entry.provider ?? null,
    };
  });
  const continuePattern = /(?:\bcontinue\b|继续|一直.*(?:做|跑|干)|不要.*(?:停|暂停)|别.*停|不允许汇报)/iu;
  const findings = [];
  for (let i = 0; i < normalized.length; i += 1) {
    const event = normalized[i];
    if (event.role !== "assistant" || event.stopReason !== "stop" || event.toolCalls.length > 0) continue;
    const prior = normalized.slice(0, i).reverse();
    const lastUser = prior.find((candidate) => candidate.role === "user");
    const nextUser = normalized.slice(i + 1).find((candidate) => candidate.role === "user");
    const nearbyToolFailure = prior.slice(0, 4).some((candidate) => candidate.role === "toolResult" && candidate.toolError);
    const requestedContinuation = lastUser !== undefined && continuePattern.test(lastUser.text);
    const userHadToContinue = nextUser !== undefined && continuePattern.test(nextUser.text);
    const emptyFinal = event.text.trim().length === 0;
    if (!emptyFinal && !requestedContinuation && !userHadToContinue && !nearbyToolFailure) continue;
    findings.push({
      assistantEntry: event.index,
      timestamp: event.timestamp,
      requestedContinuation,
      userHadToContinue,
      nearbyToolFailure,
      emptyFinal,
      classification: emptyFinal
        ? "empty-final-stop"
        : userHadToContinue
          ? "premature-stop-candidate"
          : nearbyToolFailure
            ? "tool-failure-stop-candidate"
            : "continuation-rule-stop-candidate",
      evidence: {
        priorUser: lastUser?.text ?? null,
        assistantText: event.text,
        nextUser: nextUser?.text ?? null,
      },
    });
  }
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    input: resolve(input),
    summary: {
      entries: normalized.length,
      userMessages: normalized.filter((event) => event.role === "user").length,
      assistantMessages: normalized.filter((event) => event.role === "assistant").length,
      toolResults: normalized.filter((event) => event.role === "toolResult").length,
      toolErrors: normalized.filter((event) => event.role === "toolResult" && event.toolError).length,
      compactions: normalized.filter((event) => event.entryType === "compaction").length,
      stopCandidates: findings.length,
    },
    findings,
    timeline: normalized,
  };
  const clip = (text, maximum = 260) => text.replace(/\s+/g, " ").trim().slice(0, maximum) || "—";
  const markdown = [
    "# Pi agent stop audit",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Input: \`${report.input}\``,
    `- Entries: ${report.summary.entries}`,
    `- Assistant messages: ${report.summary.assistantMessages}`,
    `- Tool errors: ${report.summary.toolErrors}`,
    `- Compactions: ${report.summary.compactions}`,
    `- Stop candidates: ${report.summary.stopCandidates}`,
    "",
    "## Findings",
    "",
    findings.length === 0 ? "No rule-based stop candidates found." : findings.map((finding) => [
      `### Entry ${finding.assistantEntry}: ${finding.classification}`,
      `- Requested continuation before reply: ${finding.requestedContinuation}`,
      `- User subsequently requested continuation: ${finding.userHadToContinue}`,
      `- Nearby tool failure: ${finding.nearbyToolFailure}`,
      `- Prior user: ${clip(finding.evidence.priorUser ?? "")}`,
      `- Assistant final: ${clip(finding.evidence.assistantText)}`,
      `- Next user: ${clip(finding.evidence.nextUser ?? "")}`,
      "",
    ].join("\n")).join("\n"),
    "## Complete timeline",
    "",
    ...normalized.map((event) =>
      `- [${event.index}] ${event.timestamp ?? "no-time"} \`${event.role}\` ` +
      `${event.stopReason ? `stop=${event.stopReason} ` : ""}` +
      `${event.toolName ? `tool=${event.toolName} error=${event.toolError} ` : ""}` +
      `${event.toolCalls.length ? `calls=${event.toolCalls.map((call) => call.name).join(",")} ` : ""}` +
      `— ${clip(event.text)}`),
    "",
    "Full normalized text and all event fields are in the sibling JSON report.",
  ].join("\n");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(`${output}.json`, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(`${output}.md`, `${markdown}\n`);
  console.log(JSON.stringify({ output: [`${output}.json`, `${output}.md`], summary: report.summary }, null, 2));
}
