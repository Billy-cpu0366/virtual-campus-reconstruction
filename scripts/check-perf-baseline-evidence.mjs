import { readFile } from "node:fs/promises";

const evidencePath =
  process.argv[2] ??
  "task-todos/evidence/WI-PARALLEL-MAP-RECON-001/window-d-perf-baseline-results.json";

const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
const errors = [];
const cases = [];

if (evidence.sampling?.note !==
    "Observed baseline only; no final performance threshold is inferred.") {
  errors.push("baseline limitation note is missing or changed");
}

if (!Array.isArray(evidence.results)) {
  errors.push("results must be an array");
} else {
  for (const result of evidence.results) {
    const label = `${result.viewport?.name ?? "unknown"}/zoom=${result.zoom}`;
    if (result.error !== undefined) {
      errors.push(`${label}: ${result.error}`);
      continue;
    }
    if (!Array.isArray(result.cases) || result.cases.length !== 3) {
      errors.push(`${label}: expected 3 position cases`);
      continue;
    }
    if ((result.events?.failures?.length ?? 0) !== 0) {
      errors.push(`${label}: network failures were recorded`);
    }
    if ((result.events?.exceptions?.length ?? 0) !== 0) {
      errors.push(`${label}: runtime exceptions were recorded`);
    }

    for (const sample of result.cases) {
      const sampleLabel = `${label}/${sample.position?.name ?? "unknown"}`;
      cases.push(sample);
      if (sample.settle?.stable !== true) {
        errors.push(`${sampleLabel}: target set did not stabilize`);
      }
      if (sample.targetMatchesExpected !== true) {
        errors.push(`${sampleLabel}: targets differ from independent recomputation`);
      }
      if (sample.renderedEqualsTargets !== true) {
        errors.push(`${sampleLabel}: rendered set differs from targets`);
      }
      if (sample.cacheContainsTargets !== true) {
        errors.push(`${sampleLabel}: cache does not contain all targets`);
      }
      if (sample.renderedContainsOnlyCached !== true) {
        errors.push(`${sampleLabel}: rendered set contains uncached chunks`);
      }
      if ((sample.requestingKeys?.length ?? 0) !== 0) {
        errors.push(`${sampleLabel}: requests remained in flight`);
      }
      if ((sample.failed?.length ?? 0) !== 0) {
        errors.push(`${sampleLabel}: failed chunk records remained`);
      }
      if ((sample.runtimeExceptions?.length ?? 0) !== 0) {
        errors.push(`${sampleLabel}: runtime exceptions were recorded`);
      }
    }
  }
}

if (evidence.results?.length !== 9) {
  errors.push(`expected 9 viewport/zoom groups, got ${evidence.results?.length ?? 0}`);
}
if (cases.length !== 27) {
  errors.push(`expected 27 samples, got ${cases.length}`);
}

if (errors.length > 0) {
  console.error(`FAIL performance baseline evidence\n- ${errors.join("\n- ")}`);
  process.exitCode = 1;
} else {
  const fpsValues = cases
    .map((sample) => sample.fps?.raf?.rafFps)
    .filter((value) => Number.isFinite(value));
  const heapValues = cases
    .map((sample) => sample.memory?.runtimeHeap?.usedSize)
    .filter((value) => Number.isFinite(value));
  console.log(
    `PASS performance baseline evidence: ${evidence.results.length} groups, ` +
      `${cases.length} samples, FPS ${Math.min(...fpsValues).toFixed(1)}-` +
      `${Math.max(...fpsValues).toFixed(1)}, JS heap ` +
      `${(Math.min(...heapValues) / 1_000_000).toFixed(1)}-` +
      `${(Math.max(...heapValues) / 1_000_000).toFixed(1)} MB`,
  );
}
