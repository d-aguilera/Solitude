import type { PlaybackScript } from "../types";

export const playbackScript = {
  id: "moon-circle-long",
  snapshot: {
    metadata: {
      label: "moon-circle-long",
      capturedSimTimeMillis: 84238.39999999982,
      dominantBodyId: "planet:earth",
    },
    ships: [
      {
        id: "ship:main",
        position: {
          x: -26568263168.91254,
          y: 144614772739.18878,
          z: 14288876.762979733,
        },
        velocity: {
          x: -984909.5566456264,
          y: -1179186.7977938163,
          z: 121108.75137470853,
        },
        frame: {
          right: {
            x: -0.7681050105194456,
            y: 0.6401804063021044,
            z: -0.01355508029467887,
          },
          forward: {
            x: -0.6390773126678561,
            y: -0.7651175894108047,
            z: 0.07858284041335657,
          },
          up: {
            x: 0.039935964344861435,
            y: 0.06902261775006953,
            z: 0.9968154277451637,
          },
        },
        orientation: [
          [-0.7681050105194456, -0.6390773126678561, 0.039935964344861435],
          [0.6401804063021044, -0.7651175894108047, 0.06902261775006953],
          [-0.01355508029467887, 0.07858284041335657, 0.9968154277451637],
        ],
        angularVelocity: {
          roll: 0,
          pitch: 0,
          yaw: 0,
        },
      },
      {
        id: "ship:enemy",
        position: {
          x: -26502194772.030575,
          y: 144696717723.7054,
          z: -7048387.707579854,
        },
        velocity: {
          x: -37498.89733979257,
          y: -6867.860802817651,
          z: 800.7447644009017,
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
          roll: 0,
          pitch: 0,
          yaw: 0,
        },
      },
    ],
    planets: [
      {
        id: "planet:mercury",
        position: {
          x: -19458592720.25355,
          y: -66914166555.584625,
          z: -3680214774.4936438,
        },
        velocity: {
          x: 37199.58053892163,
          y: -10581.789755101789,
          z: -4278.811545363423,
        },
        orientation: [
          [
            0.9999999945816254, -0.00010375292794374617,
            -0.000008487226061077618,
          ],
          [
            0.00010375284665896832, 0.9999999945717907,
            -0.000009577151735501063,
          ],
          [0.00000848821967627258, 0.000009576271106437138, 0.9999999999181329],
        ],
      },
      {
        id: "planet:venus",
        position: {
          x: -107456361832.61421,
          y: -4887977308.705778,
          z: 6135586182.198828,
        },
        velocity: {
          x: 1566.6927840751384,
          y: -35158.657878424136,
          z: -570.9592203674907,
        },
        orientation: [
          [
            0.9999999996824448, -0.000025178353359383663,
            -0.0000011070511166145496,
          ],
          [0.00002517835269464239, 0.9999999996829143, -6.005295346459213e-7],
          [0.000001107066235123688, 6.005016634686649e-7, 0.9999999999992195],
        ],
      },
      {
        id: "planet:earth",
        position: {
          x: -26501545544.100853,
          y: 144696836619.5881,
          z: -611136.133154844,
        },
        velocity: {
          x: -29818.705212817695,
          y: -5461.354436377677,
          z: 0.18207385687585328,
        },
        orientation: [
          [0.9999839930943477, -0.0056353055925787935, 0.0005068392937237729],
          [0.005636501773327404, 0.9999812576089568, -0.00239045574381576],
          [-0.0004933588457600482, 0.002393274280586024, 0.9999970144131783],
        ],
      },
      {
        id: "planet:mars",
        position: {
          x: 208048163476.76154,
          y: -2004834056.9357905,
          z: -5156243051.78367,
        },
        velocity: {
          x: 267.3541256852516,
          y: 26339.62409059279,
          z: 545.2182846295121,
        },
        orientation: [
          [0.9999825435467561, -0.005380892015739793, -0.002441024977365448],
          [0.0053830819382323205, 0.9999851137612289, 0.0008914510265061249],
          [0.0024361918379819545, -0.0009045757023769738, 0.9999966233503961],
        ],
      },
      {
        id: "planet:jupiter",
        position: {
          x: 598566946598.4757,
          y: 439605608865.6947,
          z: -15226850381.612944,
        },
        velocity: {
          x: -8095.1443904078,
          y: 11027.044391716056,
          z: 135.5504607219696,
        },
        orientation: [
          [0.9998905429909276, -0.014778126980334262, -0.0007134423907188483],
          [0.014777733917515107, 0.9998906503505036, -0.0005531019370846239],
          [0.0007215381867061348, 0.0005424983343810203, 0.9999995925389947],
        ],
      },
      {
        id: "planet:saturn",
        position: {
          x: 958384752094.5496,
          y: 982856879300.8312,
          z: -55212966045.23139,
        },
        velocity: {
          x: -7181.274921754701,
          y: 7011.626432170812,
          z: 163.01576066496358,
        },
        orientation: [
          [0.9999277934350262, -0.012015239123957976, 0.00020480442118235416],
          [0.012016336944324666, 0.9999056138860354, -0.006661153482998121],
          [-0.00012474973855503062, 0.006663133502919088, 0.9999777932982086],
        ],
      },
      {
        id: "planet:uranus",
        position: {
          x: 2158975219853.8267,
          y: -2054625132549.1497,
          z: -35625505111.02585,
        },
        velocity: {
          x: 4519.263811133342,
          y: 4749.497626384653,
          z: -40.938942049592015,
        },
        orientation: [
          [0.9999644045209519, -0.0011367000576941392, -0.008360478699005093],
          [0.001148147318678624, 0.9999984098941923, 0.0013645390431736865],
          [0.008358914333350518, -0.001374089532953508, 0.9999641195708391],
        ],
      },
      {
        id: "planet:neptune",
        position: {
          x: 2515046885897.123,
          y: -3738714258114.6934,
          z: 19032202100.287548,
        },
        velocity: {
          x: 4502.621503597213,
          y: 3028.0844507256834,
          z: -166.12297294324995,
        },
        orientation: [
          [0.9999625599834494, -0.008045909256162135, -0.00318464683507705],
          [0.008036584084329154, 0.9999634129222165, -0.0029302104302626397],
          [0.0032081065253612155, 0.0029045070410862192, 0.999990635901853],
        ],
      },
      {
        id: "planet:moon",
        position: {
          x: -26758216966.710724,
          y: 144389805264.57666,
          z: 34189435.129127175,
        },
        velocity: {
          x: -29073.246850176096,
          y: -6087.081701885491,
          z: -22.366416473921646,
        },
        orientation: [
          [
            0.9999999757527009, -0.00022005548213337669,
            0.000008362476832558246,
          ],
          [
            0.00022005583465775042, 0.9999999748981823,
            -0.000042177923463871425,
          ],
          [
            -0.000008353195125511265, 0.000042179762655736284,
            0.9999999990756324,
          ],
        ],
      },
      {
        id: "planet:phobos",
        position: {
          x: 208045737473.2485,
          y: -2013812706.8011527,
          z: -5156332018.005471,
        },
        velocity: {
          x: 2346.642189489528,
          y: 25777.81689012253,
          z: 509.3597545227668,
        },
        orientation: [
          [0.9998158405322922, -0.0191890187437401, -0.00025803170738987463],
          [0.0191889508607706, 0.9998158405322891, -0.0002630315048854129],
          [0.0002630315048854122, 0.000258031707389874, 0.999999932117027],
        ],
      },
      {
        id: "planet:deimos",
        position: {
          x: 208027685868.046,
          y: -1993389545.6267467,
          z: -5155505905.187979,
        },
        velocity: {
          x: -391.5010657281344,
          y: 25160.77175018137,
          z: 544.6261872758279,
        },
        orientation: [
          [0.9999882752056526, -0.004841870632908782, -0.00007576185597397879],
          [0.004841860607220078, 0.9999882694173278, -0.00013196013492897498],
          [0.00007639990114832386, 0.00013159175937580976, 0.999999988423355],
        ],
      },
    ],
    stars: [
      {
        id: "planet:sun",
        position: {
          x: 0.0005965066403903965,
          y: 0.0005756214997638913,
          z: -0.00001486336742143921,
        },
        velocity: {
          x: 0.000014162340756233722,
          y: 0.000013666478884532433,
          z: -3.528886183878517e-7,
        },
        orientation: [
          [0.999999970097528, -0.00024259527607884923, -0.00003086201713838161],
          [0.00024259527607885776, 0.9999999705737193, -3.743490614020988e-9],
          [0.00003086201713838079, -3.743490614020815e-9, 0.9999999995238087],
        ],
      },
    ],
  },
  fixedDtMillis: 16.666666666666668,
  timeScale: 32,
  phases: [
    {
      durationMs: 2865.5999999999985,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
    },
    {
      durationMs: 16.599999999998545,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
        alignToVelocity: true,
      },
    },
    {
      durationMs: 283.3000000000029,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
      },
    },
    {
      durationMs: 216.59999999999854,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 383.09999999999854,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
      },
    },
    {
      durationMs: 699.8000000000029,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 250,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
      },
    },
    {
      durationMs: 733.0999999999985,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 483.09999999999854,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
      },
    },
    {
      durationMs: 2449.2000000000044,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 133.1999999999971,
      controls: {
        thrustLevel: 9,
        yawLeft: true,
      },
    },
    {
      durationMs: 2249.4000000000015,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 99.80000000000291,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
      },
    },
    {
      durationMs: 1083.199999999997,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 99.90000000000146,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
      },
    },
    {
      durationMs: 1249.4000000000015,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 5914.799999999996,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
    },
    {
      durationMs: 1832.5999999999985,
      controls: {
        thrustLevel: 9,
      },
    },
    {
      durationMs: 449.8000000000029,
      controls: {
        thrustLevel: 5,
      },
    },
    {
      durationMs: 50.10000000000582,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
    },
    {
      durationMs: 1133,
      controls: {
        thrustLevel: 5,
      },
    },
    {
      durationMs: 83.19999999999709,
      controls: {
        thrustLevel: 5,
        pitchUp: true,
      },
    },
    {
      durationMs: 166.5,
      controls: {
        thrustLevel: 5,
      },
    },
    {
      durationMs: 83.5,
      controls: {
        thrustLevel: 5,
        pitchUp: true,
      },
    },
    {
      durationMs: 149.89999999999418,
      controls: {
        thrustLevel: 5,
      },
    },
    {
      durationMs: 100,
      controls: {
        thrustLevel: 5,
        pitchUp: true,
      },
    },
    {
      durationMs: 200,
      controls: {
        thrustLevel: 5,
      },
    },
    {
      durationMs: 133.10000000000582,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
    },
    {
      durationMs: 616.5999999999913,
      controls: {
        thrustLevel: 5,
      },
    },
    {
      durationMs: 33.30000000000291,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
    },
    {
      durationMs: 283.1000000000058,
      controls: {
        thrustLevel: 5,
      },
    },
    {
      durationMs: 100.09999999999127,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
    },
    {
      durationMs: 1066.300000000003,
      controls: {
        thrustLevel: 5,
      },
    },
    {
      durationMs: 4648.5,
      controls: {
        thrustLevel: 5,
        alignToVelocity: true,
      },
    },
    {
      durationMs: 16.60000000000582,
      controls: {
        thrustLevel: 5,
        yawRight: true,
        alignToVelocity: true,
      },
    },
    {
      durationMs: 66.69999999999709,
      controls: {
        thrustLevel: 5,
        yawRight: true,
      },
    },
    {
      durationMs: 299.8000000000029,
      controls: {
        thrustLevel: 5,
      },
    },
    {
      durationMs: 50,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
    },
    {
      durationMs: 783.0999999999913,
      controls: {
        thrustLevel: 5,
      },
    },
    {
      durationMs: 99.90000000000873,
      controls: {
        thrustLevel: 5,
        yawRight: true,
      },
    },
    {
      durationMs: 350,
      controls: {
        thrustLevel: 5,
      },
    },
    {
      durationMs: 33.30000000000291,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
    },
    {
      durationMs: 999.5999999999913,
      controls: {
        thrustLevel: 5,
      },
    },
    {
      durationMs: 83.19999999999709,
      controls: {
        thrustLevel: 5,
        yawRight: true,
      },
    },
    {
      durationMs: 183.40000000000873,
      controls: {
        thrustLevel: 5,
      },
    },
    {
      durationMs: 66.69999999999709,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
    },
    {
      durationMs: 716.3000000000029,
      controls: {
        thrustLevel: 5,
      },
    },
    {
      durationMs: 2315.899999999994,
      controls: {
        thrustLevel: 5,
        alignToVelocity: true,
      },
    },
    {
      durationMs: 16.60000000000582,
      controls: {
        thrustLevel: 5,
        yawRight: true,
        alignToVelocity: true,
      },
    },
    {
      durationMs: 150.09999999999127,
      controls: {
        thrustLevel: 5,
        yawRight: true,
      },
    },
    {
      durationMs: 366.5,
      controls: {
        thrustLevel: 5,
      },
    },
    {
      durationMs: 116.60000000000582,
      controls: {
        thrustLevel: 5,
        yawRight: true,
      },
    },
    {
      durationMs: 683,
      controls: {
        thrustLevel: 5,
      },
    },
    {
      durationMs: 50,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
    },
    {
      durationMs: 699.8000000000029,
      controls: {
        thrustLevel: 5,
      },
    },
    {
      durationMs: 3982,
      controls: {
        thrustLevel: 5,
        alignToVelocity: true,
      },
    },
    {
      durationMs: 28540.5,
      controls: {
        thrustLevel: 5,
        circleNow: true,
      },
    },
  ],
  endBehavior: "pause",
  metadata: {
    capturedSimTimeMillis: 84238.39999999982,
    recordingStartedRuntimeMs: 44052.5,
    recordingEndedRuntimeMs: 115061.8,
  },
} satisfies PlaybackScript;
