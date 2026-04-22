# Attitude Autopilot Memory (Spin-Off)

## Purpose

- Preserve the current understanding of Solitude's attitude autopilot model, especially the `C` / align-to-body feature.
- Clarify what is idealized, what is physically plausible, and what is not currently modeled.
- Keep this separate from the circle-now bug doc so the attitude-control insight is not lost inside one investigation.

## Feature Overview

- User-facing commands:
  - `C`: align the ship's nose to the dominant body.
  - `V`: align the ship's nose to velocity.
  - `X`: circle-now, which uses the same attitude-control machinery plus roll alignment and propulsion.
- The attitude autopilot changes the ship's orientation only. It does not directly apply main thrust or translational RCS.
- The key design idea: attitude autopilot is an idealized closed-loop attitude-control system.

## How It Works Now

- Input mapping:
  - `KeyC` toggles `alignToBody` in `src/plugins/autopilot/input.ts`.
  - `KeyV` toggles `alignToVelocity`.
  - `KeyX` toggles `circleNow`.
- Attitude command generation:
  - `getAutopilotAttitudeCommand` in `src/plugins/autopilot/logic.ts` checks the active autopilot mode.
  - `alignToBody` computes direction from the ship to the dominant body.
  - `alignToVelocity` computes direction from the ship's velocity.
  - Both call `computeAlignToDirectionCommand`.
- `computeAlignToDirectionCommand`:
  - Computes the rotation axis from the current forward vector to the target direction.
  - Computes a PD-style desired angular velocity along that axis.
  - Clamps the desired angular speed.
  - Converts the world-space angular command into ship-local roll/pitch/yaw rates.
- Angular control application:
  - `updateShipAngularVelocityFromInput` in `src/app/controls.ts` receives the autopilot attitude command.
  - `applyAttitudeCommand` changes `ship.angularVelocity` gradually with `maxAngularAccel`.
  - `applyShipRotation` in `src/app/physics.ts` integrates angular velocity into the ship frame and orientation matrix.

## Important Clarification

- `C` is non-propulsive, but it is not an instant snap.
- It does not teleport the nose to the planet.
- It computes an attitude command, changes angular velocity through the normal acceleration-limited control path, and lets rotation integration update the ship orientation over time.
- It does not consume modeled propellant, invoke modeled attitude jets, or apply modeled torques.

## Physical Interpretation

- The current model can be interpreted as a simplified spacecraft attitude-control system.
- One plausible physical analog:
  - The ship has three pairs of attitude-control jets, one pair for each rotational axis.
  - To start a roll, one side's jet briefly fires to create torque.
  - To stop that roll, the opposite jet fires at the required time.
  - Pitch and yaw work the same way around their axes.
  - A controller coordinates these firings to drive angular velocity and orientation toward the target.
- Under that interpretation, `C` is not magic in concept. It is an idealized controller sitting on top of physical attitude actuators.

## What Is Idealized / Not Physical Yet

- Solitude does not currently model:
  - discrete attitude jets,
  - torque generated from thruster placement,
  - rotational inertia or mass distribution,
  - propellant consumption for attitude control,
  - coupling between attitude jets and unwanted linear translation,
  - actuator-specific saturation beyond simple angular-rate and angular-acceleration caps,
  - reaction wheels, control moment gyros, or other explicit attitude hardware.
- The existing abstraction treats attitude control as direct authority over angular velocity targets subject to simple limits.
- This is physically plausible at a gameplay/system level, but not physically detailed.

## Relation To Circle-Now

- The manual circle-now procedure depends heavily on `C`.
- That dependence does not invalidate the manual procedure: a capable attitude-control system is a reasonable spacecraft abstraction.
- Circle-now currently inherits this model:
  - Point inward using the align-to-body attitude command.
  - Roll to align the right axis with the tangential direction.
  - Project circularization thrust/RCS onto the ship's forward and right axes.
- The circle-now bug is probably not that attitude control exists. The risk is that the current implementation may use the attitude controller too literally, chasing instantaneous inward/tangent geometry without the human pilot's judgment about "good enough" alignment.

## Open Design Questions

- Should attitude control eventually consume a resource or expose explicit torque limits derived from ship configuration?
- Should the sim model attitude jets as force pairs with small translational side effects, or keep the idealized controller for playability?
- Should circle-now preserve the current user-facing assumption that the ship has a strong idealized attitude controller?
- If explicit attitude physics is ever added, should it be optional, ship-specific, or hidden behind the same `AttitudeCommand` abstraction?

## Current Working Position

- Keep the current attitude autopilot abstraction for now.
- Treat it as an idealized, physically plausible attitude-control system rather than a fully physical one.
- Do not conflate the idealization of `C` with the circle-now rolling bug.
- For circle-now, first investigate whether the controller should better imitate human use of `C`: stabilize the view, accept good-enough alignment, and avoid chasing fast-moving target-frame changes.
