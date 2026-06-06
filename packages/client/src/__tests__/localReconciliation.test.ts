import { localFrame, mat3, vec3 } from "@solitude/engine/math";
import type { RuntimeEntitySnapshot } from "@solitude/engine/runtime";
import type { ControlledBody } from "@solitude/engine/world";
import { describe, expect, it } from "vitest";
import {
  applyLocalVisualCorrection,
  captureLocalShipVisualState,
  createLocalReconciliationState,
  reconcileLocalShipVisualState,
  restoreLocalShipVisualState,
} from "../localReconciliation";

describe("local reconciliation", () => {
  it("records prediction error metrics when an authoritative state arrives", () => {
    const reconciliation = createLocalReconciliationState();
    const predicted = captureLocalShipVisualState(null, createBody(1000));
    const rendered = captureLocalShipVisualState(null, createBody(1000));
    const authoritative = createSnapshot(600);

    reconcileLocalShipVisualState(
      reconciliation,
      predicted,
      rendered,
      authoritative,
      1000,
    );

    expect(reconciliation.metrics.sampleCount).toBe(1);
    expect(reconciliation.metrics.lastPositionError).toBe(400);
    expect(reconciliation.metrics.maxPositionError).toBe(400);
    expect(reconciliation.correction.active).toBe(true);
    expect(reconciliation.correction.positionDelta.x).toBe(400);
    expect(reconciliation.metrics.correctionActiveStartCount).toBe(1);
  });

  it("smooths the rendered body from the previous visual state toward authority", () => {
    const reconciliation = createLocalReconciliationState();
    const rendered = captureLocalShipVisualState(null, createBody(1000));
    const authoritative = createSnapshot(600);
    const body = createBody(600);

    reconcileLocalShipVisualState(
      reconciliation,
      null,
      rendered,
      authoritative,
      1000,
    );

    applyLocalVisualCorrection(reconciliation, body, 1000);

    expect(body.position.x).toBe(1000);

    body.position.x = 600;
    applyLocalVisualCorrection(reconciliation, body, 1060);

    expect(body.position.x).toBe(700);

    body.position.x = 600;
    applyLocalVisualCorrection(reconciliation, body, 1120);

    expect(body.position.x).toBe(600);
    expect(reconciliation.correction.active).toBe(false);
  });

  it("skips tiny visual corrections", () => {
    const reconciliation = createLocalReconciliationState();

    reconcileLocalShipVisualState(
      reconciliation,
      null,
      captureLocalShipVisualState(null, createBody(10)),
      createSnapshot(6),
      1000,
    );

    expect(reconciliation.correction.active).toBe(false);
    expect(reconciliation.metrics.correctionSkippedCount).toBe(1);
  });

  it("does not restart an active correction for moderate incoming errors", () => {
    const reconciliation = createLocalReconciliationState();

    reconcileLocalShipVisualState(
      reconciliation,
      null,
      captureLocalShipVisualState(null, createBody(1000)),
      createSnapshot(600),
      1000,
    );
    reconcileLocalShipVisualState(
      reconciliation,
      null,
      captureLocalShipVisualState(null, createBody(1800)),
      createSnapshot(1200),
      1016,
    );

    expect(reconciliation.correction.startedAtMillis).toBe(1000);
    expect(reconciliation.correction.positionDelta.x).toBe(400);
    expect(reconciliation.metrics.correctionDeferredCount).toBe(1);
  });

  it("applies frame correction as a delta on top of the current predicted frame", () => {
    const reconciliation = createLocalReconciliationState();
    const authoritativeBody = createBody(0, 0);
    const renderedBody = createBody(0, Math.PI / 6);
    const currentPredictedBody = createBody(0, Math.PI / 3);

    reconcileLocalShipVisualState(
      reconciliation,
      null,
      captureLocalShipVisualState(null, renderedBody),
      createSnapshotFromBody(authoritativeBody),
      1000,
    );
    applyLocalVisualCorrection(reconciliation, currentPredictedBody, 1000);

    expect(currentPredictedBody.frame.right.x).toBeCloseTo(0);
    expect(currentPredictedBody.frame.right.y).toBeCloseTo(1);
  });

  it("restores the local ship state after visual-only correction", () => {
    const predictedBody = createBody(600, Math.PI / 8);
    predictedBody.angularVelocity.pitch = 0.5;
    const captured = captureLocalShipVisualState(null, predictedBody);

    predictedBody.position.x = 1000;
    predictedBody.frame = createFrame(Math.PI / 3);
    predictedBody.orientation = localFrame.intoMat3(
      mat3.zero(),
      predictedBody.frame,
    );
    predictedBody.angularVelocity.pitch = -0.5;

    restoreLocalShipVisualState(predictedBody, captured);

    expect(predictedBody.position.x).toBe(600);
    expect(predictedBody.frame.right.x).toBeCloseTo(Math.cos(Math.PI / 8));
    expect(predictedBody.angularVelocity.pitch).toBe(0.5);
  });
});

function createBody(x: number, yawRadians = 0): ControlledBody {
  const frame = createFrame(yawRadians);
  return {
    angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
    frame,
    id: "ship:test",
    orientation: localFrame.intoMat3(mat3.zero(), frame),
    position: vec3.create(x, 0, 0),
    velocity: vec3.zero(),
  };
}

function createSnapshot(x: number): RuntimeEntitySnapshot {
  const frame = createFrame();
  return {
    angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
    frame,
    id: "ship:test",
    orientation: localFrame.intoMat3(mat3.zero(), frame),
    position: vec3.create(x, 0, 0),
    velocity: vec3.zero(),
  };
}

function createSnapshotFromBody(body: ControlledBody): RuntimeEntitySnapshot {
  return {
    angularVelocity: { ...body.angularVelocity },
    frame: localFrame.clone(body.frame),
    id: body.id,
    orientation: mat3.copy(body.orientation, mat3.zero()),
    position: vec3.clone(body.position),
    velocity: vec3.clone(body.velocity),
  };
}

function createFrame(yawRadians = 0) {
  const c = Math.cos(yawRadians);
  const s = Math.sin(yawRadians);
  return {
    forward: vec3.create(-s, c, 0),
    right: vec3.create(c, s, 0),
    up: vec3.create(0, 0, 1),
  };
}
