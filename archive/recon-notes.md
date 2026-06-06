# Reconciliation troubleshooting

## base commit

315ebf9

## reflog-bef7228 (315ebf9..bef7228)

- WASD controls are inverted, but not Q/E
- "pulses" 1 or 2 times per second. Like planets have a heart beat
- circle-now never completely settles: eccentricity, delta-v rad/tan, periapsis/apoapsis swing back and forth around zero
- when holding WASD to change attitude over a long period, the camera frame occasionally makes big jumps to adjust

## reflog-28f9351 (315ebf9..28f9351)

- fixed WASD inversion
- pulse is more noticeable, maybe more frequent
- circle now still oscillates

## reflog-2f3d7e3 (315ebf9..2f3d7e3)

- this is reflog-bef7228 + reflog-28f9351 but I still tested it to double check and yes, same symptoms

## reflog-7a38b9d (315ebf9..7a38b9d)

- pulse is less noticeable
- more time passes between big adjustments
- circle-now oscillates but much more closely to zero (still very annoying)

## reflog-80d1edc (315ebf9..80d1edc)

- fixed circle-now
- introduced bouncing at the end of pitch (release of W, S keys)
- mild bouncing at end of roll (Q, E)
- no bouncing at end of yaw
- noticeable adjustments every now and then

## reflog-7e25393 (315ebf9..7e25393)

- no noticeable improvements

## reflog-c196bc7 (315ebf9..c196bc7)

- no change

## main (315ebf9..2b4c1f8)

- this sits on top of `reflog-7a38b9d`
- fixed bouncing!
- fixed circle-now
- best commit so far
