import type { PlaybackScript } from "../types";

export const playbackScript = {
  id: "race-to-the-moon",
  snapshot: {
    metadata: {
      label: "race-to-the-moon",
      capturedSimTimeMillis: 128140,
      dominantBodyId: "planet:earth",
      focusEntityId: "ship:enemy",
    },
    entities: [
      {
        id: "planet:sun",
        position: {
          x: 0.0013802710159233028,
          y: 0.0013319439760406066,
          z: -0.00003439275840812239,
        },
        velocity: {
          x: 0.00002154316202240717,
          y: 0.0000207888679739346,
          z: -5.3680076233312e-7,
        },
        orientation: [
          [
            0.9999999308079296, -0.00036902598185175944,
            -0.00004694603440141362,
          ],
          [0.0003690259818517884, 0.9999999319097522, -8.662155010655248e-9],
          [0.000046946034401413976, -8.662155010655332e-9, 0.9999999988981774],
        ],
      },
      {
        id: "planet:mercury",
        position: {
          x: -19456959591.81501,
          y: -66914631087.86463,
          z: -3680402619.7795153,
        },
        velocity: {
          x: 37199.91465032679,
          y: -10580.64077592842,
          z: -4278.748351653711,
        },
        orientation: [
          [
            0.999999987462266, -0.00015782473158389062,
            -0.000012910026392687811,
          ],
          [
            0.00015782454349679996, 0.9999999874395064,
            -0.000014568719554752404,
          ],
          [
            0.000012912325546312167, 0.000014566681842855171,
            0.9999999998105662,
          ],
        ],
      },
      {
        id: "planet:venus",
        position: {
          x: -107456293041.28978,
          y: -4889520829.539669,
          z: 6135561115.5470915,
        },
        velocity: {
          x: 1567.1941110778375,
          y: -35158.63506554824,
          z: -570.9878451136026,
        },
        orientation: [
          [
            0.999999999265238, -0.000038300278984604586,
            -0.000001683994773087072,
          ],
          [0.00003830027744649275, 0.999999999266225, -9.135119507167386e-7],
          [0.0000016840297550648428, 9.134474609648244e-7, 0.9999999999981745],
        ],
      },
      {
        id: "planet:earth",
        position: {
          x: -26502854631.922104,
          y: 144696596851.54614,
          z: -611128.1356235131,
        },
        velocity: {
          x: -29818.65748313449,
          y: -5461.620695063385,
          z: 0.18221611634228516,
        },
        orientation: [
          [0.9999629613787906, -0.008571650815855326, 0.00077632021897496],
          [0.0085744186765871, 0.9999566316977251, -0.0036351159880321977],
          [-0.0007451276064796666, 0.003641637842907771, 0.9999930916054709],
        ],
      },
      {
        id: "planet:mars",
        position: {
          x: 208048175211.07724,
          y: -2003677705.2660282,
          z: -5156219115.755336,
        },
        velocity: {
          x: 267.2194720032235,
          y: 26339.62540045537,
          z: 545.2216218208796,
        },
        orientation: [
          [0.9999596072397376, -0.00818426022193443, -0.00371507384016306],
          [0.00818932751784424, 0.9999655544992548, 0.0013508257266191457],
          [0.003703890363345056, -0.001381195119408991, 0.9999921867176896],
        ],
      },
      {
        id: "planet:jupiter",
        position: {
          x: 598566591208.6414,
          y: 439606092970.442,
          z: -15226844430.726702,
        },
        velocity: {
          x: -8095.152909868108,
          y: 11027.038136395338,
          z: 135.55067726311867,
        },
        orientation: [
          [0.9997467308032292, -0.02247895744267244, -0.001081998106601914],
          [0.022478047946741124, 0.9997469792192796, -0.0008455187762842983],
          [0.0011007307191956486, 0.000820983427091196, 0.99999905718853],
        ],
      },
      {
        id: "planet:saturn",
        position: {
          x: 958384436825.2693,
          y: 982857187122.0194,
          z: -55212958888.58339,
        },
        velocity: {
          x: -7181.277085367755,
          y: 7011.624209798308,
          z: 163.01588569725686,
        },
        orientation: [
          [0.9998329229003823, -0.0182758982488466, 0.00034326011286888694],
          [0.01827843846998806, 0.9997816021552969, -0.010131469747074243],
          [-0.0001580234354054303, 0.01013605126934714, 0.999948616426593],
        ],
      },
      {
        id: "planet:uranus",
        position: {
          x: 2158975418255.3254,
          y: -2054624924039.4377,
          z: -35625506908.30353,
        },
        velocity: {
          x: 4519.263335002906,
          y: 4749.49807972829,
          z: -40.93893419238515,
        },
        orientation: [
          [0.9999176354010476, -0.0017245363209459606, -0.01271803398924213],
          [0.001751024208883256, 0.9999963206443389, 0.0020718619510404616],
          [0.012714414193885777, -0.00209396088836519, 0.9999169760531981],
        ],
      },
      {
        id: "planet:neptune",
        position: {
          x: 2515047083568.3,
          y: -3738714125177.623,
          z: 19032194807.204834,
        },
        velocity: {
          x: 4502.62134304826,
          y: 3028.084689563526,
          z: -166.12297416241452,
        },
        orientation: [
          [0.9999133674122002, -0.01224258011062889, -0.004834966620192362],
          [0.012221002562294006, 0.9999153410302941, -0.004467423026927026],
          [0.004889250081141513, 0.0044079478631159, 0.9999783323799196],
        ],
      },
      {
        id: "planet:moon",
        position: {
          x: -26759493326.161232,
          y: 144389538027.92676,
          z: 34188453.00001337,
        },
        velocity: {
          x: -29073.128234581207,
          y: -6087.2648477126695,
          z: -22.37587595743369,
        },
        orientation: [
          [0.9999999438934795, -0.0003347392329280646, 0.000012724335840976426],
          [0.00033474004864337056, 0.9999999419162389, -0.00006415859799376816],
          [
            -0.000012702858658511215, 0.00006416285374749215,
            0.9999999978611596,
          ],
        ],
      },
      {
        id: "planet:phobos",
        position: {
          x: 208045840614.4927,
          y: -2012680558.5118582,
          z: -5156309651.634895,
        },
        velocity: {
          x: 2352.0684139672794,
          y: 25798.822490265964,
          z: 509.5727691899427,
        },
        orientation: [
          [0.9995738860492027, -0.02918722054723446, -0.0003904936802585689],
          [0.029187063477491046, 0.9995738860491936, -0.00040206236847565647],
          [0.00040206236847565343, 0.0003904936802585637, 0.9999998429302387],
        ],
      },
      {
        id: "planet:deimos",
        position: {
          x: 208027668742.9519,
          y: -1992284983.931806,
          z: -5155481997.506348,
        },
        velocity: {
          x: -388.65628482491985,
          y: 25159.11283179342,
          z: 544.5223488499686,
        },
        orientation: [
          [0.9999728697784744, -0.007365221196651865, -0.00011499232578953863],
          [0.007365197998022757, 0.9999728563847745, -0.00020087733294658718],
          [0.00011646871048143728, 0.0002000249418472943, 0.9999999732125848],
        ],
      },
      {
        id: "ship:main",
        position: {
          x: -26508239153.724125,
          y: 144690901047.7558,
          z: 6288419.48934459,
        },
        velocity: {
          x: -91122.18398541733,
          y: -74124.02797704583,
          z: 5175.36788870548,
        },
        orientation: [
          [-0.7818277885780953, -0.6202517668263785, -0.06350633634402919],
          [0.6234944327569367, -0.7777676145017708, -0.07957531120473699],
          [-0.00003644435354566811, -0.10181003673990498, 0.9948038575974805],
        ],
        frame: {
          right: {
            x: -0.7818277885780953,
            y: 0.6234944327569367,
            z: -0.00003644435354566811,
          },
          forward: {
            x: -0.6202517668263785,
            y: -0.7777676145017708,
            z: -0.10181003673990498,
          },
          up: {
            x: -0.06350633634402919,
            y: -0.07957531120473699,
            z: 0.9948038575974805,
          },
        },
        angularVelocity: {
          pitch: 0,
          roll: 0,
          yaw: 0,
        },
      },
      {
        id: "ship:enemy",
        position: {
          x: -26506904163.76239,
          y: 144686621960.73758,
          z: 11107802.691486413,
        },
        velocity: {
          x: 61145.19227169822,
          y: 25726.223727795623,
          z: 146731.1477243664,
        },
        orientation: [
          [-0.8873003873999716, -0.22287500055405748, -0.4037632433096023],
          [0.1312713825597143, 0.7172141007053635, -0.6843769121399828],
          [0.4421151961205601, -0.6602504584454488, -0.6071272399438632],
        ],
        frame: {
          right: {
            x: -0.8873003873999716,
            y: 0.1312713825597143,
            z: 0.4421151961205601,
          },
          forward: {
            x: -0.22287500055405748,
            y: 0.7172141007053635,
            z: -0.6602504584454488,
          },
          up: {
            x: -0.4037632433096023,
            y: -0.6843769121399828,
            z: -0.6071272399438632,
          },
        },
        angularVelocity: {
          pitch: 0,
          roll: 0,
          yaw: 0,
        },
      },
    ],
  },
  fixedDtMillis: 16.666666666666668,
  timeScale: 1,
  phases: [
    {
      durationMs: 1332.8999999999942,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 200,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 316.6000000000058,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 266.6000000000058,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 149.89999999999418,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 149.89999999999418,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 266.6000000000058,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 349.79999999998836,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 1216.5,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 149.70000000001164,
      controls: {
        thrustLevel: 5,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 383.20000000001164,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 183.39999999999418,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 266.5,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 299.8999999999942,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 433.1000000000058,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 233.39999999999418,
      controls: {
        thrustLevel: 5,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 1249.3999999999942,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 716.6000000000058,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 1132.8999999999942,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 216.70000000001164,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 133.19999999998254,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 849.7000000000116,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 416.5,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 133.29999999998836,
      controls: {
        thrustLevel: 5,
        pitchUp: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 3848.7000000000116,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 149.89999999999418,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 266.6000000000058,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 499.79999999998836,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 133.30000000001746,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 149.89999999999418,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 233.39999999999418,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 516.3999999999942,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 483.20000000001164,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 133.39999999999418,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 616.3000000000175,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 233.29999999998836,
      controls: {
        thrustLevel: 5,
        pitchUp: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 2499.2000000000116,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 233.19999999998254,
      controls: {
        thrustLevel: 5,
        pitchUp: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 83.30000000001746,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 333.29999999998836,
      controls: {
        thrustLevel: 5,
        burnBackwards: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 266.5,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 299.8999999999942,
      controls: {
        thrustLevel: 5,
        burnBackwards: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 216.60000000000582,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 666.5,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 116.60000000000582,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 283.19999999998254,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 699.9000000000233,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 2699.0999999999767,
      controls: {
        thrustLevel: 5,
        burnBackwards: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 284.30000000001746,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 498.69999999998254,
      controls: {
        thrustLevel: 5,
        burnBackwards: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 16.60000000000582,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 66.70000000001164,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 449.8999999999942,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
        yawLeft: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 33.29999999998836,
      controls: {
        thrustLevel: 5,
        yawLeft: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 216.60000000000582,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 349.80000000001746,
      controls: {
        thrustLevel: 5,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 184.5,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 581.8999999999942,
      controls: {
        thrustLevel: 5,
        rollRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 349.79999999998836,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 133.5,
      controls: {
        thrustLevel: 5,
        rollRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 199.80000000001746,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 333.19999999998254,
      controls: {
        thrustLevel: 5,
        pitchUp: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 200,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 499.70000000001164,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 1849.5,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 216.60000000000582,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 449.8999999999942,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 766.2999999999884,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 233.30000000001746,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 383.0999999999767,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 166.60000000000582,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 250,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 316.6000000000058,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 283.20000000001164,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 949.6999999999825,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 100,
      controls: {
        thrustLevel: 5,
        yawLeft: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 66.60000000000582,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
        yawLeft: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 116.70000000001164,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 516.5,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 283.0999999999767,
      controls: {
        thrustLevel: 5,
        pitchUp: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 500.1000000000058,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 216.39999999999418,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 66.60000000000582,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 250.10000000000582,
      controls: {
        thrustLevel: 5,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 283.20000000001164,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 1149.5,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 66.69999999998254,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 299.8999999999942,
      controls: {
        thrustLevel: 5,
        pitchUp: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 216.5,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 583.1000000000058,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 733.2000000000116,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 266.5,
      controls: {
        thrustLevel: 5,
        yawLeft: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 233.19999999998254,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 116.80000000001746,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 783,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 1949.3999999999942,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 299.79999999998836,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 549.8000000000175,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 1233,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 699.6999999999825,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 549.9000000000233,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 83.19999999998254,
      controls: {
        thrustLevel: 5,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 166.60000000000582,
      controls: {
        thrustLevel: 5,
        pitchUp: true,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 16.70000000001164,
      controls: {
        thrustLevel: 5,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 316.5,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 83.39999999999418,
      controls: {
        thrustLevel: 5,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 83.19999999998254,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 16.800000000017462,
      controls: {
        thrustLevel: 5,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 433.19999999998254,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 199.80000000001746,
      controls: {
        thrustLevel: 5,
        yawLeft: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 166.60000000000582,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 67.89999999999418,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 98.79999999998836,
      controls: {
        thrustLevel: 5,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 383.20000000001164,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 83.29999999998836,
      controls: {
        thrustLevel: 5,
        yawLeft: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 299.8999999999942,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 66.60000000000582,
      controls: {
        thrustLevel: 5,
        pitchUp: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 383.20000000001164,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 5514.899999999994,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 166.5,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 1049.7000000000116,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 266.5999999999767,
      controls: {
        thrustLevel: 5,
        yawLeft: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 199.90000000002328,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 583.1999999999825,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 283.20000000001164,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 216.5,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 599.8999999999942,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 99.89999999999418,
      controls: {
        thrustLevel: 5,
        yawRight: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 1549.5,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 249.89999999999418,
      controls: {
        thrustLevel: 5,
        yawRight: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 433.20000000001164,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 66.70000000001164,
      controls: {
        thrustLevel: 5,
        yawRight: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 1666,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 316.69999999998254,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 299.80000000001746,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 266.5,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 116.69999999998254,
      controls: {
        thrustLevel: 9,
        yawLeft: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 149.89999999999418,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 233.20000000001164,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 516.6000000000058,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 283.19999999998254,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 316.6000000000058,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 116.60000000000582,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 200.10000000000582,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 133.19999999998254,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 349.80000000001746,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 133.29999999998836,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 716.5,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 16.60000000000582,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 699.7999999999884,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 116.60000000000582,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 100,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 133.20000000001164,
      controls: {
        thrustLevel: 5,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 466.5,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 16.699999999982538,
      controls: {
        thrustLevel: 5,
        yawLeft: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 66.60000000000582,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
        yawLeft: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 66.70000000001164,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 449.79999999998836,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 116.70000000001164,
      controls: {
        thrustLevel: 5,
        yawLeft: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 149.89999999999418,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 683.1000000000058,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 100,
      controls: {
        thrustLevel: 5,
        burnForward: true,
        pitchUp: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 133.29999999998836,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 249.89999999999418,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 183.30000000001746,
      controls: {
        thrustLevel: 5,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 216.69999999998254,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 249.80000000001746,
      controls: {
        thrustLevel: 5,
        pitchDown: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 150,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 149.89999999999418,
      controls: {
        thrustLevel: 5,
        yawLeft: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 116.60000000000582,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 1766.1999999999825,
      controls: {
        thrustLevel: 5,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 99.90000000002328,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 283.19999999998254,
      controls: {
        thrustLevel: 5,
        pitchUp: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 1282.8999999999942,
      controls: {
        thrustLevel: 5,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 199.90000000002328,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 16.699999999982538,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 216.60000000000582,
      controls: {
        thrustLevel: 9,
        pitchDown: true,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 16.70000000001164,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 333.19999999998254,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 166.60000000000582,
      controls: {
        thrustLevel: 9,
        yawLeft: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 183.29999999998836,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 383.1000000000058,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 166.70000000001164,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 283.19999999998254,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 583.2000000000116,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 249.79999999998836,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 783.2000000000116,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 3482.100000000006,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 1066.1999999999825,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 116.70000000001164,
      controls: {
        thrustLevel: 9,
        yawLeft: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 849.7000000000116,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 133.29999999998836,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 749.7000000000116,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 2116.0999999999767,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 1566.1000000000058,
      controls: {
        thrustLevel: 9,
        burnForward: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 216.5,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 949.6000000000058,
      controls: {
        thrustLevel: 9,
        burnForward: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 4265.399999999994,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 66.60000000000582,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 316.5,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 66.79999999998836,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 483,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 66.70000000001164,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 283.29999999998836,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 66.5,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 249.90000000002328,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 66.79999999998836,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 266.6000000000058,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 99.89999999999418,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 83.39999999999418,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 166.5,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 83.20000000001164,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 166.69999999998254,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 83.30000000001746,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 116.69999999998254,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 83.20000000001164,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 83.5,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 116.39999999999418,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 66.70000000001164,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 216.79999999998836,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 66.5,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 100,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 99.80000000001746,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 66.69999999998254,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 400,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 433.1000000000058,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 83.29999999998836,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 116.70000000001164,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 66.5,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 116.70000000001164,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 49.89999999999418,
      controls: {
        thrustLevel: 9,
        burnBackwards: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 2182.600000000006,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 16.79999999998836,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 999.6000000000058,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 50,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 66.60000000000582,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
        yawRight: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 33.39999999999418,
      controls: {
        thrustLevel: 9,
        yawRight: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 816.3999999999942,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 199.89999999999418,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 33.30000000001746,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 83.29999999998836,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 366.5,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 166.79999999998836,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 616.4000000000233,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 2782.2999999999884,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 216.60000000000582,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 166.60000000000582,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 499.79999999998836,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 100,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 316.6000000000058,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 66.5,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 116.79999999998836,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 149.80000000001746,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 533.2999999999884,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 1482.7999999999884,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 16.70000000001164,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 1699.3999999999942,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 316.5,
      controls: {
        thrustLevel: 9,
        burnForward: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 333.20000000001164,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 333.3999999999942,
      controls: {
        thrustLevel: 9,
        burnForward: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 6814.200000000012,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 16.599999999976717,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 766.5,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 266.5,
      controls: {
        thrustLevel: 9,
        burnForward: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 549.9000000000233,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 166.5,
      controls: {
        thrustLevel: 9,
        burnForward: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 966.3999999999942,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 16.60000000000582,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 4098.6999999999825,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 83.30000000001746,
      controls: {
        thrustLevel: 9,
        burnForward: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 983,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 233.19999999998254,
      controls: {
        thrustLevel: 9,
        burnForward: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 2965.6999999999825,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 133.30000000004657,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 266.5,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 183.29999999998836,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 400,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 299.79999999998836,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 133.29999999998836,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 466.6000000000349,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 99.79999999998836,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 549.8999999999651,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 100,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 766.4000000000233,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 2899,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 16.70000000001164,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 1132.899999999965,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 283.20000000001164,
      controls: {
        thrustLevel: 9,
        burnForward: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 316.6000000000349,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 166.59999999997672,
      controls: {
        thrustLevel: 9,
        burnForward: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 366.70000000001164,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 16.5,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 2099.2999999999884,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 16.70000000001164,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 1099.5,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 16.70000000001164,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 350,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 83.39999999996508,
      controls: {
        thrustLevel: 9,
        burnForward: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 349.70000000001164,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 66.70000000001164,
      controls: {
        thrustLevel: 9,
        burnForward: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 8463.799999999988,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 466.4000000000233,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 100,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 233.29999999998836,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 116.59999999997672,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 249.90000000002328,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 99.89999999996508,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 366.6000000000349,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 66.70000000001164,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 666.5,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 4981.599999999977,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 16.599999999976717,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 916.5,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 49.90000000002328,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 483.20000000001164,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 216.70000000001164,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 183.19999999995343,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 183.20000000001164,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 116.60000000003492,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 283.3999999999651,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 199.79999999998836,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 2182.5,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 1582.9000000000233,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 16.70000000001164,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 1499.5,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 16.70000000001164,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 1282.7999999999884,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 133.29999999998836,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
        yawRight: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 16.70000000001164,
      controls: {
        thrustLevel: 9,
        yawRight: true,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 933,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 233.20000000001164,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 16.699999999953434,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 233.20000000001164,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 16.79999999998836,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 233.10000000003492,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 316.5999999999767,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 599.9000000000233,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 2382.399999999965,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 16.70000000001164,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 1432.7999999999884,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 549.9000000000233,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 33.29999999998836,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 183.20000000001164,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
        yawRight: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 83.40000000002328,
      controls: {
        thrustLevel: 9,
        yawRight: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 533.0999999999767,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 116.59999999997672,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 216.60000000003492,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 299.8999999999651,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 300,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 149.80000000004657,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 399.8999999999651,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 3765.600000000035,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 266.5999999999767,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 249.79999999998836,
      controls: {
        thrustLevel: 9,
        pitchUp: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 116.5,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 283.20000000001164,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 400,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 66.59999999997672,
      controls: {
        thrustLevel: 9,
        burnForward: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 366.6000000000349,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 1049.5999999999767,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 16.70000000001164,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 2065.9000000000233,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 16.699999999953434,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 1549.4000000000233,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 16.70000000001164,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 2016,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 399.8999999999651,
      controls: {
        thrustLevel: 9,
        circleNow: true,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 16.600000000034925,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 1416.2000000000116,
      controls: {
        thrustLevel: 9,
        alignToVelocity: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 5431.5,
      controls: {
        thrustLevel: 9,
        circleNow: true,
      },
      focusEntityId: "ship:main",
    },
    {
      durationMs: 16.699999999953434,
      controls: {
        thrustLevel: 9,
      },
      focusEntityId: "ship:enemy",
    },
    {
      durationMs: 5431.5,
      controls: {
        thrustLevel: 9,
        circleNow: true,
      },
      focusEntityId: "ship:enemy",
    },
  ],
  endBehavior: "pause",
  metadata: {
    capturedSimTimeMillis: 128140,
    recordingStartedRuntimeMs: 129552,
    recordingEndedRuntimeMs: 335549.1,
  },
} satisfies PlaybackScript;
