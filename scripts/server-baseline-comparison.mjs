import { summarizeNumbers } from "./server-load-helpers.mjs";

export function selectReferenceEntry({
  candidate,
  pointer,
  pointerPath = "reference pointer",
  topology,
}) {
  if (!pointer || pointer.schemaVersion !== 2) {
    throw new Error(`${pointerPath} must be a version-2 reference pointer`);
  }
  if (!Array.isArray(pointer.references) || pointer.references.length === 0) {
    throw new Error(`${pointerPath}.references must be a non-empty array`);
  }
  for (const entry of pointer.references) {
    for (const field of ["machine", "purpose", "result", "topology"]) {
      if (typeof entry?.[field] !== "string" || entry[field].length === 0) {
        throw new Error(
          `${pointerPath}.references entries need a non-empty ${field}`,
        );
      }
    }
  }
  const available = pointer.references.map((entry) => entry.topology);
  const wanted = topology ?? candidate?.environment?.topology;
  if (!wanted) {
    throw new Error(
      "Candidate has no environment.topology; pass --reference-topology or --reference",
    );
  }
  const selected = pointer.references.filter(
    (entry) => entry.topology === wanted,
  );
  if (selected.length === 0) {
    throw new Error(
      `No reference recorded for topology ${wanted}; ${pointerPath} has ${available.join(", ")}`,
    );
  }
  if (selected.length > 1) {
    throw new Error(`${pointerPath} has duplicate references for ${wanted}`);
  }
  return selected[0];
}

export const comparisonMetrics = Object.freeze([
  metric(
    "processCpuUtilizationPercentP50",
    "Process CPU p50",
    "percent",
    "lower",
    "median-run",
    (run) => run.server.processCpuUtilizationPercent.p50,
  ),
  metric(
    "simulationThroughputRatio",
    "Simulation throughput ratio",
    "ratio",
    "higher",
    "median-run",
    (run) => run.analysis.minimumPerGameMedianSimulationThroughputRatio,
  ),
  metric(
    "snapshotRateHz",
    "Snapshot cadence",
    "hertz",
    "higher",
    "median-run",
    (run) => run.analysis.minimumPerGameMedianSnapshotRateHz,
  ),
  metric(
    "simulationBacklogMillisP95",
    "Simulation backlog p95",
    "milliseconds",
    "lower",
    "median-run",
    (run) => run.server.simulationBacklogMillis.p95,
  ),
  metric(
    "processHeapUsedBytesP50",
    "Heap used p50",
    "bytes",
    "lower",
    "median-run",
    (run) => run.server.processHeapUsedBytes.p50,
  ),
  metric(
    "processRssBytesP50",
    "RSS p50",
    "bytes",
    "lower",
    "median-run",
    (run) => run.server.processRssBytes.p50,
  ),
  metric(
    "snapshotWireBytesPerSecondP50",
    "Snapshot wire throughput p50",
    "bytes-per-second",
    "neutral",
    "median-run",
    (run) => run.server.snapshotWireBytesPerSecond.p50,
  ),
  metric(
    "broadcastLoopDurationMillisP95",
    "Broadcast loop p95",
    "milliseconds",
    "lower",
    "worst-run",
    (run) => run.server.broadcastLoopDurationMillis.p95.max,
  ),
  metric(
    "broadcastLoopDurationMillisP99",
    "Broadcast loop p99",
    "milliseconds",
    "lower",
    "worst-run",
    (run) => run.server.broadcastLoopDurationMillis.p99.max,
  ),
  metric(
    "snapshotStepDurationMillisP95",
    "Snapshot step p95",
    "milliseconds",
    "lower",
    "worst-run",
    (run) => run.server.snapshotStepDurationMillis.p95.max,
  ),
  metric(
    "snapshotStepDurationMillisP99",
    "Snapshot step p99",
    "milliseconds",
    "lower",
    "worst-run",
    (run) => run.server.snapshotStepDurationMillis.p99.max,
  ),
  metric(
    "snapshotSerializeDurationMillisP95",
    "Snapshot serialization p95",
    "milliseconds",
    "lower",
    "worst-run",
    (run) => run.server.snapshotSerializeDurationMillis.p95.max,
  ),
  metric(
    "snapshotSerializeDurationMillisP99",
    "Snapshot serialization p99",
    "milliseconds",
    "lower",
    "worst-run",
    (run) => run.server.snapshotSerializeDurationMillis.p99.max,
  ),
  metric(
    "eventLoopDelayMillisP95",
    "Event-loop delay p95",
    "milliseconds",
    "lower",
    "worst-run",
    (run) => run.server.eventLoopDelayMillis.p95.max,
  ),
  metric(
    "eventLoopDelayMillisP99",
    "Event-loop delay p99",
    "milliseconds",
    "lower",
    "worst-run",
    (run) => run.server.eventLoopDelayMillis.p99.max,
  ),
  metric(
    "inputAckLatencyMillisP95",
    "Input acknowledgement p95",
    "milliseconds",
    "lower",
    "worst-run",
    (run) => run.client.inputAckLatencyMillis.p95,
  ),
  metric(
    "inputAckLatencyMillisP99",
    "Input acknowledgement p99",
    "milliseconds",
    "lower",
    "worst-run",
    (run) => run.client.inputAckLatencyMillis.p99,
  ),
  metric(
    "snapshotInterArrivalMillisP95",
    "Snapshot inter-arrival p95",
    "milliseconds",
    "lower",
    "worst-run",
    (run) => run.client.snapshotInterArrivalMillis.p95,
  ),
  metric(
    "snapshotInterArrivalMillisP99",
    "Snapshot inter-arrival p99",
    "milliseconds",
    "lower",
    "worst-run",
    (run) => run.client.snapshotInterArrivalMillis.p99,
  ),
]);

export function compareServerBaselines({
  candidate,
  candidatePath,
  reference,
  referencePath,
}) {
  validateBaseline(reference, "reference");
  validateBaseline(candidate, "candidate");
  const environmentMismatches = compareEnvironment(reference, candidate);
  const referenceWorkloads = indexWorkloads(reference);
  const candidateWorkloads = indexWorkloads(candidate);
  const referenceOnly = [];
  const candidateOnly = [];
  const workloads = [];

  for (const [key, referenceWorkload] of referenceWorkloads) {
    const candidateWorkload = candidateWorkloads.get(key);
    if (!candidateWorkload) {
      referenceOnly.push(describeWorkload(referenceWorkload));
      continue;
    }
    workloads.push(compareWorkload(referenceWorkload, candidateWorkload));
  }
  for (const [key, candidateWorkload] of candidateWorkloads) {
    if (!referenceWorkloads.has(key)) {
      candidateOnly.push(describeWorkload(candidateWorkload));
    }
  }

  const compatibleWorkloads = workloads.filter(
    (workload) => workload.compatible,
  );
  const comparisons = compatibleWorkloads.flatMap(
    (workload) => workload.metrics,
  );
  return {
    schemaVersion: 1,
    blocking: false,
    candidate: describeBaseline(candidate, candidatePath),
    coverage: {
      candidateOnly,
      comparedWorkloads: compatibleWorkloads.length,
      incompatibleWorkloads: workloads
        .filter((workload) => !workload.compatible)
        .map((workload) => workload.name),
      referenceOnly,
    },
    environment: {
      matches: environmentMismatches.length === 0,
      mismatches: environmentMismatches,
    },
    generatedAt: new Date().toISOString(),
    reference: describeBaseline(reference, referencePath),
    summary: {
      candidateConfirmedSaturationWorkloads: compatibleWorkloads.filter(
        (workload) => workload.candidateConfirmedSaturation,
      ).length,
      candidateFirstCapacitySaturationGames:
        candidate.firstCapacitySaturation?.games ?? null,
      comparedMetrics: comparisons.length,
      metricsOutsideReferenceRange: comparisons.filter(
        (comparison) => comparison.candidateOutsideReferenceRange,
      ).length,
      referenceConfirmedSaturationWorkloads: compatibleWorkloads.filter(
        (workload) => workload.referenceConfirmedSaturation,
      ).length,
      referenceFirstCapacitySaturationGames:
        reference.firstCapacitySaturation?.games ?? null,
    },
    workloads,
  };
}

export function renderServerBaselineComparisonMarkdown(comparison) {
  const lines = [
    "# Server baseline comparison",
    "",
    `This report is **non-blocking**. It compares measurements and does not enforce performance gates.`,
    "",
    `- Reference: \`${comparison.reference.commit}\` (${comparison.reference.machine}, ${comparison.reference.path})`,
    `- Candidate: \`${comparison.candidate.commit}\` (${comparison.candidate.machine}, ${comparison.candidate.path})`,
    `- Compared workloads: ${comparison.coverage.comparedWorkloads}`,
    `- Metrics outside the reference run range: ${comparison.summary.metricsOutsideReferenceRange}/${comparison.summary.comparedMetrics}`,
    `- First capacity saturation: reference ${formatGames(comparison.summary.referenceFirstCapacitySaturationGames)}; candidate ${formatGames(comparison.summary.candidateFirstCapacitySaturationGames)}`,
    "",
    "## Environment and coverage",
    "",
  ];

  if (comparison.environment.matches) {
    lines.push(
      "Environment, runtime, plugin, protocol, and analysis identities match.",
    );
  } else {
    lines.push(
      "| Field | Reference | Candidate |",
      "| --- | --- | --- |",
      ...comparison.environment.mismatches.map(
        (mismatch) =>
          `| ${escapeMarkdown(mismatch.field)} | ${escapeMarkdown(formatIdentity(mismatch.reference))} | ${escapeMarkdown(formatIdentity(mismatch.candidate))} |`,
      ),
    );
  }
  appendList(
    lines,
    "Reference-only workloads",
    comparison.coverage.referenceOnly,
  );
  appendList(
    lines,
    "Candidate-only workloads",
    comparison.coverage.candidateOnly,
  );
  appendList(
    lines,
    "Scenario-incompatible workloads",
    comparison.coverage.incompatibleWorkloads,
  );

  lines.push("", "## Workloads");
  for (const workload of comparison.workloads) {
    lines.push("", `### ${workload.kind}: ${workload.name}`, "");
    if (!workload.compatible) {
      lines.push(
        "Scenario parameters differ, so metrics were not compared.",
        "",
        "| Field | Reference | Candidate |",
        "| --- | --- | --- |",
        ...workload.scenarioMismatches.map(
          (mismatch) =>
            `| ${mismatch.field} | ${formatIdentity(mismatch.reference)} | ${formatIdentity(mismatch.candidate)} |`,
        ),
      );
      continue;
    }
    lines.push(
      `Saturation: reference **${formatSaturation(workload.referenceConfirmedSaturation, workload.referenceSaturationCount, workload.referenceRepetitions)}**; candidate **${formatSaturation(workload.candidateConfirmedSaturation, workload.candidateSaturationCount, workload.candidateRepetitions)}**.`,
      "",
      "| Metric | Reference | Reference spread | Candidate | Candidate spread | Absolute delta | Delta | Outside ref range |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: | :---: |",
      ...workload.metrics.map(
        (entry) =>
          `| ${entry.label} | ${formatMetric(entry.referenceValue, entry.unit)} | ${formatSpread(entry.referenceSpread, entry.unit)} | ${formatMetric(entry.candidateValue, entry.unit)} | ${formatSpread(entry.candidateSpread, entry.unit)} | ${formatSignedMetric(entry.absoluteDelta, entry.unit)} | ${formatPercent(entry.percentDelta)} | ${entry.candidateOutsideReferenceRange ? "yes" : "no"} |`,
      ),
    );
  }

  lines.push(
    "",
    "Percent deltas are relative to the reference representative value. A missing percent delta means the reference value was zero. Spread is min/p50/p95/max across successful repetitions. Values outside the reference range are diagnostic observations, not failures.",
    "",
  );
  return lines.join("\n");
}

function compareWorkload(referenceWorkload, candidateWorkload) {
  const scenarioMismatches = compareFields(
    referenceWorkload.scenario,
    candidateWorkload.scenario,
    [
      "clientsPerGame",
      "games",
      "inputHzPerClient",
      "simulationMillisPerWallMillis",
    ],
  );
  const compatible = scenarioMismatches.length === 0;
  return {
    candidateConfirmedSaturation: candidateWorkload.summary.confirmedSaturation,
    candidateRepetitions: candidateWorkload.runs.length,
    candidateSaturationCount: candidateWorkload.summary.saturationCount,
    compatible,
    kind: candidateWorkload.kind,
    metrics: compatible
      ? comparisonMetrics.map((definition) =>
          compareMetric(definition, referenceWorkload, candidateWorkload),
        )
      : [],
    name: candidateWorkload.scenario.name,
    referenceConfirmedSaturation: referenceWorkload.summary.confirmedSaturation,
    referenceRepetitions: referenceWorkload.runs.length,
    referenceSaturationCount: referenceWorkload.summary.saturationCount,
    scenarioMismatches,
  };
}

function compareMetric(definition, referenceWorkload, candidateWorkload) {
  const referenceValues = successfulValues(referenceWorkload, definition);
  const candidateValues = successfulValues(candidateWorkload, definition);
  const referenceValue = representativeValue(
    referenceWorkload,
    definition,
    referenceValues,
  );
  const candidateValue = representativeValue(
    candidateWorkload,
    definition,
    candidateValues,
  );
  const referenceSpread = compactSummary(referenceValues);
  const candidateSpread = compactSummary(candidateValues);
  const absoluteDelta = candidateValue - referenceValue;
  return {
    absoluteDelta,
    aggregation: definition.aggregation,
    candidateOutsideReferenceRange:
      candidateValue < referenceSpread.min ||
      candidateValue > referenceSpread.max,
    candidateSpread,
    candidateValue,
    direction: definition.direction,
    label: definition.label,
    name: definition.name,
    percentDelta:
      referenceValue === 0 ? null : (absoluteDelta / referenceValue) * 100,
    referenceSpread,
    referenceValue,
    unit: definition.unit,
  };
}

function representativeValue(workload, definition, values) {
  if (definition.aggregation === "worst-run") return Math.max(...values);
  const selected = workload.runs.find(
    (run) => run.repetition === workload.summary.medianRunRepetition,
  );
  if (selected && selected.errors.length === 0)
    return definition.read(selected);
  return summarizeNumbers(values).p50;
}

function successfulValues(workload, definition) {
  const values = workload.runs
    .filter((run) => run.errors.length === 0)
    .map(definition.read)
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) {
    throw new Error(
      `${workload.kind} ${workload.scenario.name} has no successful metric samples`,
    );
  }
  return values;
}

function compactSummary(values) {
  const summary = summarizeNumbers(values);
  return {
    count: summary.count,
    max: summary.max,
    min: summary.min,
    p50: summary.p50,
    p95: summary.p95,
  };
}

function compareEnvironment(reference, candidate) {
  return [
    ...compareFields(reference, candidate, [
      "profile",
      "dirty",
      "machine",
      "cpu",
      "platform",
      "nodeVersion",
      "warmupSeconds",
      "measurementSeconds",
    ]),
    ...compareFields(
      reference.environment,
      candidate.environment,
      ["cpuAffinity", "loadGenerator", "nodeOptions"],
      "environment",
    ),
    ...compareFields(
      reference.environment,
      candidate.environment,
      ["loadGeneratorEnvironment", "serverEnvironment", "topology"],
      "environment",
    ),
    ...compareFields(
      reference.protocol,
      candidate.protocol,
      [
        "productionBuildCreatedOnce",
        "repetitions",
        "serverEntry",
        "serverRestartedBetweenRepetitions",
      ],
      "protocol",
    ),
    ...compareFields(
      reference.protocol,
      candidate.protocol,
      ["restartStrategy", "serverArtifactSha256", "serverMode", "serverUrl"],
      "protocol",
    ),
    ...compareFields(
      reference.pluginIdentity,
      candidate.pluginIdentity,
      ["artifactSha256", "packs", "schemaVersion"],
      "pluginIdentity",
    ),
    ...compareFields(reference, candidate, [
      "analysisPolicy",
      "provisionalThresholds",
    ]),
  ];
}

function compareFields(reference, candidate, fields, prefix = "") {
  return fields.flatMap((field) => {
    const referenceValue = reference?.[field];
    const candidateValue = candidate?.[field];
    return stableStringify(referenceValue) === stableStringify(candidateValue)
      ? []
      : [
          {
            candidate: candidateValue,
            field: prefix ? `${prefix}.${field}` : field,
            reference: referenceValue,
          },
        ];
  });
}

function indexWorkloads(baseline) {
  return new Map([
    ...baseline.scenarios.map((workload) => [
      `scenario:${workload.scenario.name}`,
      { ...workload, kind: "scenario" },
    ]),
    ...baseline.capacitySweep.map((workload) => [
      `capacity:${workload.scenario.name}`,
      { ...workload, kind: "capacity" },
    ]),
  ]);
}

function describeBaseline(baseline, path) {
  return {
    commit: baseline.commit,
    dirty: baseline.dirty,
    machine: baseline.machine,
    path,
    pluginArtifactSha256: baseline.pluginIdentity.artifactSha256,
    profile: baseline.profile,
  };
}

function describeWorkload(workload) {
  return `${workload.kind}:${workload.scenario.name}`;
}

function validateBaseline(baseline, role) {
  if (!baseline || baseline.schemaVersion !== 3) {
    throw new Error(`${role} must be a version-3 server baseline`);
  }
  for (const field of [
    "commit",
    "machine",
    "pluginIdentity",
    "protocol",
    "scenarios",
    "capacitySweep",
  ]) {
    if (baseline[field] === undefined) {
      throw new Error(`${role} baseline is missing ${field}`);
    }
  }
  if (
    !Array.isArray(baseline.scenarios) ||
    !Array.isArray(baseline.capacitySweep)
  ) {
    throw new Error(`${role} baseline workloads must be arrays`);
  }
}

function metric(name, label, unit, direction, aggregation, read) {
  return { aggregation, direction, label, name, read, unit };
}

function appendList(lines, label, values) {
  if (values.length > 0) lines.push("", `- ${label}: ${values.join(", ")}`);
}

function formatSaturation(confirmed, count, repetitions) {
  return `${confirmed ? "confirmed" : "not confirmed"} (${count}/${repetitions})`;
}

function formatGames(value) {
  return value === null ? "not observed" : `${value} games`;
}

function formatSpread(spread, unit) {
  return `${formatMetric(spread.min, unit)} / ${formatMetric(spread.p50, unit)} / ${formatMetric(spread.p95, unit)} / ${formatMetric(spread.max, unit)}`;
}

function formatMetric(value, unit) {
  if (unit === "bytes") return `${formatNumber(value / 1_048_576)} MiB`;
  if (unit === "bytes-per-second") {
    return `${formatNumber(value / 1_048_576)} MiB/s`;
  }
  if (unit === "percent") return `${formatNumber(value)}%`;
  if (unit === "milliseconds") return `${formatNumber(value)} ms`;
  if (unit === "hertz") return `${formatNumber(value)} Hz`;
  return formatNumber(value);
}

function formatSignedMetric(value, unit) {
  const formatted = formatMetric(Math.abs(value), unit);
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatted}`;
}

function formatPercent(value) {
  if (value === null) return "n/a";
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatNumber(Math.abs(value))}%`;
}

function formatNumber(value) {
  if (value === 0) return "0";
  const absolute = Math.abs(value);
  if (absolute >= 1000) return value.toFixed(0);
  if (absolute >= 100) return value.toFixed(1);
  if (absolute >= 10) return value.toFixed(2);
  if (absolute >= 1) return value.toFixed(3);
  if (absolute >= 0.01) return value.toFixed(4);
  if (absolute >= 0.0001) return value.toFixed(5);
  return value.toExponential(2);
}

function formatIdentity(value) {
  if (typeof value === "string") return value;
  return stableStringify(value);
}

function stableStringify(value) {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function escapeMarkdown(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}
