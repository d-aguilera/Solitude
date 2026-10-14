import { EPS_SPEED_FINE, vec3 } from "@solitude/plugin-api/math";
import {
  createOrbitReadout,
  type ExternalOrbitReadoutProvider,
} from "@solitude/plugin-api/telemetry";
import {
  getDominantBodyPrimaryInto,
  type ExternalControlledBody,
  type ExternalGravityPrimary,
} from "@solitude/plugin-api/world";
import { computeOrbitReadoutForPrimaryInto } from "./orbitReadout";

export function createOrbitObservationProvider(): ExternalOrbitReadoutProvider {
  const readout = createOrbitReadout();
  const relativeVelocity = vec3.zero();
  const relativePosition = vec3.zero();
  const angularMomentum = vec3.zero();
  const primary: ExternalGravityPrimary = {
    id: "",
    mass: 0,
    radius: 0,
    body: { id: "", position: vec3.zero(), velocity: vec3.zero() },
  };
  return {
    readoutInto: (out, world, entityId) => {
      out.primaryId = "";
      out.primaryRadius = 0;
      out.altitudeMeters = null;
      for (const body of world.controllableBodies) {
        if (body.id === entityId) {
          if (!getDominantBodyPrimaryInto(primary, world, body.position))
            return false;
          const distance = vec3.length(
            vec3.subInto(
              relativePosition,
              body.position,
              primary.body.position,
            ),
          );
          if (Number.isFinite(primary.radius) && primary.radius > 0)
            out.altitudeMeters = distance - primary.radius;
          return computeOrbitReadoutForPrimaryInto(out, body, primary);
        }
      }
      return false;
    },
    sampleInto: (out, world, entityId) => {
      out.entityId = entityId;
      out.primaryId = null;
      out.orbitValid = false;
      out.isBound = false;
      out.altitudeMeters = null;
      out.periapsisAltitudeMeters = null;
      out.apoapsisAltitudeMeters = null;
      out.radialSpeedMetersPerSecond = null;
      out.progradeAlignmentCosine = null;
      let body: ExternalControlledBody | undefined;
      for (const candidate of world.controllableBodies) {
        if (candidate.id === entityId) {
          body = candidate;
          break;
        }
      }
      if (!body || !getDominantBodyPrimaryInto(primary, world, body.position))
        return;
      out.primaryId = primary.id;
      if (
        !Number.isFinite(primary.mass) ||
        primary.mass <= 0 ||
        !Number.isFinite(primary.radius) ||
        primary.radius <= 0
      )
        return;
      vec3.subInto(relativePosition, body.position, primary.body.position);
      vec3.subInto(relativeVelocity, body.velocity, primary.body.velocity);
      vec3.crossInto(angularMomentum, relativePosition, relativeVelocity);
      const h = vec3.length(angularMomentum);
      if (
        !(Number.isFinite(h) && h > 0) ||
        !computeOrbitReadoutForPrimaryInto(readout, body, primary)
      )
        return;
      if (
        !(
          Number.isFinite(readout.distance) &&
          readout.distance > 0 &&
          Number.isFinite(readout.speed) &&
          Number.isFinite(readout.eccentricity) &&
          readout.eccentricity >= 0 &&
          Number.isFinite(readout.periapsis) &&
          readout.periapsis >= 0 &&
          Number.isFinite(readout.radialSpeed)
        ) ||
        (readout.isBound && !Number.isFinite(readout.apoapsis))
      )
        return;
      out.orbitValid = true;
      out.isBound = readout.isBound;
      out.altitudeMeters = readout.distance - primary.radius;
      out.periapsisAltitudeMeters = readout.periapsis - primary.radius;
      out.apoapsisAltitudeMeters = readout.isBound
        ? readout.apoapsis - primary.radius
        : null;
      out.radialSpeedMetersPerSecond = readout.radialSpeed;
      const forwardLength = vec3.length(body.frame.forward);
      if (
        readout.speed > EPS_SPEED_FINE &&
        Number.isFinite(forwardLength) &&
        forwardLength > 0
      ) {
        const cosine =
          vec3.dot(body.frame.forward, relativeVelocity) /
          (forwardLength * readout.speed);
        if (Number.isFinite(cosine))
          out.progradeAlignmentCosine = Math.max(-1, Math.min(1, cosine));
      }
    },
  };
}
