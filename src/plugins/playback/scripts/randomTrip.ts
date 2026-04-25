import type { PlaybackScript } from "../types";

export const playbackScript = {
  id: "random-trip",
  snapshot: {
    metadata: {
      label: "random-trip",
      capturedSimTimeMillis: 2221316.1119999997,
      dominantBodyId: "planet:earth",
    },
    ships: [
      {
        id: "ship:main",
        position: {
          x: -26568021149.576218,
          y: 144684647225.9827,
          z: -6445113.79684888,
        },
        velocity: {
          x: -22855.548239769974,
          y: -4199.548420805638,
          z: -3394.7132348665723,
        },
        frame: {
          right: {
            x: -0.18013842497028135,
            y: 0.9836412684995892,
            z: -0.00005247614129495884,
          },
          forward: {
            x: -0.9836412698878167,
            y: -0.18013842497028135,
            z: 0.000004765463187072116,
          },
          up: {
            x: -0.000004765463187072113,
            y: 0.00005247614129495884,
            z: 0.9999999986117726,
          },
        },
        orientation: [
          [-0.18013842497028135, -0.9836412698878167, -0.000004765463187072113],
          [0.9836412684995892, -0.18013842497028135, 0.00005247614129495884],
          [
            -0.00005247614129495884, 0.000004765463187072116,
            0.9999999986117726,
          ],
        ],
        angularVelocity: {
          pitch: 0,
          roll: 0,
          yaw: 0,
        },
      },
      {
        id: "ship:enemy",
        position: {
          x: -26568021148.967323,
          y: 144684647226.16068,
          z: 5223632.055837608,
        },
        velocity: {
          x: -22855.54781534864,
          y: -4199.548483195006,
          z: 3395.0884506910347,
        },
        frame: {
          right: {
            x: -0.18013842497028135,
            y: 0.9836412684995892,
            z: -0.00005247614129495884,
          },
          forward: {
            x: -0.9836412698878167,
            y: -0.18013842497028135,
            z: 0.000004765463187072116,
          },
          up: {
            x: -0.000004765463187072113,
            y: 0.00005247614129495884,
            z: 0.9999999986117726,
          },
        },
        orientation: [
          [-0.18013842497028135, -0.9836412698878167, -0.000004765463187072113],
          [0.9836412684995892, -0.18013842497028135, 0.00005247614129495884],
          [
            -0.00005247614129495884, 0.000004765463187072116,
            0.9999999986117726,
          ],
        ],
        angularVelocity: {
          pitch: 0,
          roll: 0,
          yaw: 0,
        },
      },
    ],
    planets: [
      {
        id: "planet:mercury",
        position: {
          x: -19379076969.855007,
          y: -66936720891.71733,
          z: -3689355637.609239,
        },
        velocity: {
          x: 37215.81214174275,
          y: -10525.849562802618,
          z: -4275.7316078835875,
        },
        orientation: [
          [0.9999962323771789, -0.002735926244666125, -0.00022347042979149184],
          [0.0027358697239269103, 0.9999962255377778, -0.0002528379894097402],
          [0.00022416133240182504, 0.00025222565082836453, 0.9999999430669522],
        ],
      },
      {
        id: "planet:venus",
        position: {
          x: -107452987612.02142,
          y: -4963112900.334825,
          z: 6134364509.148325,
        },
        velocity: {
          x: 1591.0964123383224,
          y: -35157.53901816872,
          z: -572.352503165285,
        },
        orientation: [
          [
            0.9999997791670215, -0.0006639382586747515,
            -0.000029187214710618714,
          ],
          [0.0006639377964050445, 0.9999997794677429, -0.000015844926205593107],
          [0.000029197728326672235, 0.00001582554421137832, 0.9999999994485258],
        ],
      },
      {
        id: "planet:earth",
        position: {
          x: -26565267949.975746,
          y: 144685151431.93076,
          z: -610740.939168002,
        },
        velocity: {
          x: -29816.379207352962,
          y: -5474.314824170566,
          z: 0.18775295801195502,
        },
        orientation: [
          [0.9888939546294906, -0.1475522960077527, 0.017806359541052107],
          [0.14838224015477924, 0.9869959972512048, -0.06181918971298919],
          [-0.00845324221314925, 0.06377477050497005, 0.9979285151468088],
        ],
      },
      {
        id: "planet:mars",
        position: {
          x: 208048727829.26416,
          y: -1948544165.8292832,
          z: -5155077704.367411,
        },
        velocity: {
          x: 260.7993402751368,
          y: 26339.68698408951,
          z: 545.3807170863646,
        },
        orientation: [
          [0.9878868041827299, -0.1405740519451415, -0.06571604097456565],
          [0.14209365959986708, 0.9896702999609944, 0.019028643584075033],
          [0.0623622804519138, -0.028135978654694187, 0.9976569113086843],
        ],
      },
      {
        id: "planet:jupiter",
        position: {
          x: 598549646202.6583,
          y: 439629174191.10364,
          z: -15226560688.481598,
        },
        velocity: {
          x: -8095.5591016277795,
          y: 11026.73988183101,
          z: 135.5610015895774,
        },
        orientation: [
          [0.9248501199727304, -0.38000906015644176, -0.015664283751085646],
          [0.3797391950838111, 0.9249238297983248, -0.01772153459163572],
          [0.021222613022799482, 0.010441420889973099, 0.9997202495829919],
        ],
      },
      {
        id: "planet:saturn",
        position: {
          x: 958369405039.4263,
          y: 982871863576.0331,
          z: -55212617661.3811,
        },
        velocity: {
          x: -7181.380242464324,
          y: 7011.518248717194,
          z: 163.02184705353505,
        },
        orientation: [
          [0.9503376187369347, -0.309593908757463, 0.031780844445799525],
          [0.3103489699309447, 0.935082922377034, -0.17118249075658026],
          [0.02327933152418215, 0.17254431297235448, 0.9847266284531406],
        ],
      },
      {
        id: "planet:uranus",
        position: {
          x: 2158984877847.576,
          y: -2054614982479.6995,
          z: -35625592600.320435,
        },
        velocity: {
          x: 4519.240633499817,
          y: 4749.519694955352,
          z: -40.938559568452526,
        },
        orientation: [
          [0.9753533171521869, -0.025907846285436447, -0.21912254612675328],
          [0.03383404979102773, 0.9988989940772958, 0.032497026111680476],
          [0.21803936294843496, -0.03910988535159833, 0.9751560147344756],
        ],
      },
      {
        id: "planet:neptune",
        position: {
          x: 2515056508341.298,
          y: -3738707786850.182,
          z: 19031847082.529236,
        },
        velocity: {
          x: 4502.613687920105,
          y: 3028.0960770852407,
          z: -166.12303230868025,
        },
        orientation: [
          [0.9740916376160461, -0.21322894428312622, -0.07535846897580413],
          [0.20677595750647346, 0.9746818682753877, -0.08508207245050026],
          [0.09159249381775007, 0.06729541570638152, 0.9935200763452924],
        ],
      },
      {
        id: "planet:moon",
        position: {
          x: -26820342590.042427,
          y: 144376787177.9026,
          z: 34141144.54307055,
        },
        velocity: {
          x: -29067.480287272905,
          y: -6095.988049424077,
          z: -22.826578872817066,
        },
        orientation: [
          [0.9999831398913099, -0.0058025794794472774, 0.00022361682394969406],
          [0.005802824604535946, 0.9999825456504817, -0.0011115849030709794],
          [-0.00021716286111521455, 0.00111286377083671, 0.9999993571870563],
        ],
      },
      {
        id: "planet:phobos",
        position: {
          x: 208050856505.3028,
          y: -1957606870.7590911,
          z: -5155229651.355101,
        },
        velocity: {
          x: 2357.4613224328496,
          y: 26823.892558459265,
          z: 523.4881646567358,
        },
        orientation: [
          [0.874652075795186, -0.48472666357373906, -0.004879336824973751],
          [0.4846804591106546, 0.8746520757951852, -0.008282443085579499],
          [0.008282443085579528, 0.004879336824973764, 0.9999537955369158],
        ],
      },
      {
        id: "planet:deimos",
        position: {
          x: 208027000414.40207,
          y: -1939699051.3437507,
          z: -5154347387.7906475,
        },
        velocity: {
          x: -248.51095799492873,
          y: 25088.941577844995,
          z: 539.588943672055,
        },
        orientation: [
          [0.9918582838184616, -0.12733412405446173, -0.0017792335317838724],
          [0.12732716219998622, 0.9918542643899088, -0.0035933240374895477],
          [0.002222293134603272, 0.0033375234565347113, 0.99999196114289],
        ],
      },
    ],
    stars: [
      {
        id: "planet:sun",
        position: {
          x: 0.4147718171647888,
          y: 0.4002436184896762,
          z: -0.010335838490283536,
        },
        velocity: {
          x: 0.00037344397896040037,
          y: 0.00036036054420335664,
          z: -0.00000930636089100313,
        },
        orientation: [
          [0.9999792075328465, -0.006397047735095265, -0.0008138072596738314],
          [0.006397047735095293, 0.9999795386774094, -0.000002603009005124759],
          [0.000813807259673829, -0.00000260300900512474, 0.9999996688554361],
        ],
      },
    ],
  },
  fixedDtMillis: 16.666666666666668,
  timeScale: 1024,
  phases: [
    {
      durationMs: 2999.000000000002,
      controls: {
        thrustLevel: 1,
      },
    },
    {
      durationMs: 83.19999999999709,
      controls: {
        thrustLevel: 1,
        yawLeft: true,
      },
    },
    {
      durationMs: 33.400000000001455,
      controls: {
        thrustLevel: 1,
      },
    },
    {
      durationMs: 483.2000000000007,
      controls: {
        thrustLevel: 1,
        pitchUp: true,
      },
    },
    {
      durationMs: 283.2000000000007,
      controls: {
        thrustLevel: 1,
      },
    },
    {
      durationMs: 183.29999999999927,
      controls: {
        thrustLevel: 1,
        burnForward: true,
      },
    },
    {
      durationMs: 249.89999999999782,
      controls: {
        thrustLevel: 1,
      },
    },
    {
      durationMs: 299.8000000000029,
      controls: {
        thrustLevel: 1,
        pitchUp: true,
      },
    },
    {
      durationMs: 150.09999999999854,
      controls: {
        thrustLevel: 1,
      },
    },
    {
      durationMs: 316.5,
      controls: {
        thrustLevel: 1,
        pitchUp: true,
      },
    },
    {
      durationMs: 166.59999999999854,
      controls: {
        thrustLevel: 1,
      },
    },
    {
      durationMs: 1732.7000000000007,
      controls: {
        thrustLevel: 1,
        pitchUp: true,
      },
    },
    {
      durationMs: 33.400000000001455,
      controls: {
        thrustLevel: 1,
      },
    },
    {
      durationMs: 1249.5,
      controls: {
        thrustLevel: 1,
        pitchUp: true,
      },
    },
    {
      durationMs: 299.8999999999978,
      controls: {
        thrustLevel: 1,
      },
    },
    {
      durationMs: 166.60000000000218,
      controls: {
        thrustLevel: 1,
        pitchDown: true,
      },
    },
    {
      durationMs: 33.39999999999782,
      controls: {
        thrustLevel: 1,
      },
    },
    {
      durationMs: 133.20000000000073,
      controls: {
        thrustLevel: 1,
        yawRight: true,
      },
    },
    {
      durationMs: 966.4000000000015,
      controls: {
        thrustLevel: 1,
      },
    },
    {
      durationMs: 499.7999999999993,
      controls: {
        thrustLevel: 1,
        pitchDown: true,
      },
    },
    {
      durationMs: 399.7999999999993,
      controls: {
        thrustLevel: 1,
      },
    },
    {
      durationMs: 366.7000000000007,
      controls: {
        thrustLevel: 1,
        pitchUp: true,
      },
    },
    {
      durationMs: 83.29999999999927,
      controls: {
        thrustLevel: 1,
        pitchUp: true,
        yawLeft: true,
      },
    },
    {
      durationMs: 133.20000000000073,
      controls: {
        thrustLevel: 1,
        pitchUp: true,
      },
    },
    {
      durationMs: 50.099999999998545,
      controls: {
        thrustLevel: 1,
        rollLeft: true,
        pitchUp: true,
      },
    },
    {
      durationMs: 183.20000000000073,
      controls: {
        thrustLevel: 1,
        rollLeft: true,
      },
    },
    {
      durationMs: 183.29999999999927,
      controls: {
        thrustLevel: 1,
      },
    },
    {
      durationMs: 249.90000000000146,
      controls: {
        thrustLevel: 1,
        pitchDown: true,
      },
    },
    {
      durationMs: 799.7000000000007,
      controls: {
        thrustLevel: 1,
        burnForward: true,
      },
    },
    {
      durationMs: 100.09999999999854,
      controls: {
        thrustLevel: 1,
        burnForward: true,
        yawRight: true,
      },
    },
    {
      durationMs: 183.20000000000073,
      controls: {
        thrustLevel: 1,
        burnForward: true,
        pitchUp: true,
        yawRight: true,
      },
    },
    {
      durationMs: 399.90000000000146,
      controls: {
        thrustLevel: 1,
      },
    },
    {
      durationMs: 600.0999999999985,
      controls: {
        thrustLevel: 1,
        yawRight: true,
      },
    },
    {
      durationMs: 116.29999999999927,
      controls: {
        thrustLevel: 1,
      },
    },
    {
      durationMs: 99.90000000000146,
      controls: {
        thrustLevel: 1,
        pitchUp: true,
      },
    },
    {
      durationMs: 33.39999999999782,
      controls: {
        thrustLevel: 1,
      },
    },
    {
      durationMs: 199.90000000000146,
      controls: {
        thrustLevel: 1,
        yawLeft: true,
      },
    },
    {
      durationMs: 416.40000000000146,
      controls: {
        thrustLevel: 1,
        pitchDown: true,
        yawLeft: true,
      },
    },
    {
      durationMs: 250,
      controls: {
        thrustLevel: 1,
        yawLeft: true,
      },
    },
    {
      durationMs: 49.89999999999782,
      controls: {
        thrustLevel: 1,
        pitchDown: true,
        yawLeft: true,
      },
    },
    {
      durationMs: 83.40000000000146,
      controls: {
        thrustLevel: 1,
        yawLeft: true,
      },
    },
    {
      durationMs: 1282.8999999999978,
      controls: {
        thrustLevel: 1,
      },
    },
    {
      durationMs: 166.5,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 300.1000000000022,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
    },
    {
      durationMs: 266.5,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 16.700000000000728,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 183.1999999999971,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
        yawRight: true,
      },
    },
    {
      durationMs: 683.1000000000022,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 83.20000000000073,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 116.79999999999927,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
        yawRight: true,
      },
    },
    {
      durationMs: 33.20000000000073,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
      },
    },
    {
      durationMs: 1016.2999999999956,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 166.70000000000437,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 50,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 216.59999999999854,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 866.4000000000015,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 1699.4000000000015,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 316.5,
      controls: {
        thrustLevel: 9,
        pitchDown: true,
        yawRight: true,
      },
    },
    {
      durationMs: 3565.5,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 299.8999999999942,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
        yawRight: true,
      },
    },
    {
      durationMs: 66.70000000000437,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 783,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 100,
      controls: {
        thrustLevel: 9,
        yawLeft: true,
      },
    },
    {
      durationMs: 99.79999999999563,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
        yawLeft: true,
      },
    },
    {
      durationMs: 33.400000000001455,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
      },
    },
    {
      durationMs: 83.40000000000146,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 133.3000000000029,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
    },
    {
      durationMs: 383.09999999999854,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 216.59999999999854,
      controls: {
        thrustLevel: 9,
        yawLeft: true,
      },
    },
    {
      durationMs: 783.0999999999985,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 166.70000000000437,
      controls: {
        thrustLevel: 9,
        yawLeft: true,
      },
    },
    {
      durationMs: 983,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 216.5,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
      },
    },
    {
      durationMs: 266.59999999999854,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 300,
      controls: {
        thrustLevel: 9,
        yawLeft: true,
      },
    },
    {
      durationMs: 133.09999999999854,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 66.69999999999709,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
    },
    {
      durationMs: 1699.5,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 133.3000000000029,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
      },
    },
    {
      durationMs: 1432.800000000003,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 50,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
    },
    {
      durationMs: 816.3999999999942,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 83.10000000000582,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 216.79999999999563,
      controls: {
        thrustLevel: 9,
        pitchDown: true,
        yawRight: true,
      },
    },
    {
      durationMs: 183.3000000000029,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 533.0999999999985,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 200,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 466.40000000000146,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 133.29999999999563,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
      },
    },
    {
      durationMs: 266.6000000000058,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 83.39999999999418,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
      },
    },
    {
      durationMs: 199.90000000000146,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 333.20000000000437,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 116.5,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
        yawRight: true,
      },
    },
    {
      durationMs: 50.099999999998545,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 66.5,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
    },
    {
      durationMs: 383.40000000000146,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 133.29999999999563,
      controls: {
        thrustLevel: 9,
        pitchDown: true,
      },
    },
    {
      durationMs: 399.8000000000029,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 83.29999999999563,
      controls: {
        thrustLevel: 9,
        pitchDown: true,
      },
    },
    {
      durationMs: 83.30000000000291,
      controls: {
        thrustLevel: 9,
        pitchDown: true,
        yawRight: true,
      },
    },
    {
      durationMs: 50,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 299.90000000000146,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 66.5,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
    },
    {
      durationMs: 300,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 66.69999999999709,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 83.20000000000437,
      controls: {
        thrustLevel: 9,
        pitchDown: true,
        yawRight: true,
      },
    },
    {
      durationMs: 33.39999999999418,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 616.4000000000015,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 83.30000000000291,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
      },
    },
    {
      durationMs: 366.59999999999854,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 33.30000000000291,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 233.29999999999563,
      controls: {
        thrustLevel: 9,
        pitchDown: true,
        yawRight: true,
      },
    },
    {
      durationMs: 16.599999999998545,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 333.20000000000437,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 499.79999999999563,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 16.80000000000291,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 100,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
    },
    {
      durationMs: 616.4000000000015,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 15344.799999999996,
      controls: {
        thrustLevel: 9,
        circleNow: true,
      },
    },
    {
      durationMs: 366.40000000000873,
      controls: {
        thrustLevel: 9,
        rollRight: true,
        circleNow: true,
      },
    },
    {
      durationMs: 166.6999999999971,
      controls: {
        thrustLevel: 9,
        circleNow: true,
      },
    },
    {
      durationMs: 599.8000000000029,
      controls: {
        thrustLevel: 9,
        yawRight: true,
        circleNow: true,
      },
    },
    {
      durationMs: 866.2999999999884,
      controls: {
        thrustLevel: 9,
        circleNow: true,
      },
    },
    {
      durationMs: 250,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 1249.6000000000058,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 233.3000000000029,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 6381.099999999991,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 383.3000000000029,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 66.60000000000582,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
    },
    {
      durationMs: 233.09999999999127,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 83.40000000000873,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
    },
    {
      durationMs: 1782.800000000003,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 12912.199999999997,
      controls: {
        thrustLevel: 9,
        circleNow: true,
      },
    },
  ],
  endBehavior: "pause",
  metadata: {
    capturedSimTimeMillis: 2221316.1119999997,
    recordingStartedRuntimeMs: 14120.9,
    recordingEndedRuntimeMs: 98492.3,
  },
} satisfies PlaybackScript;
