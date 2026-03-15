import { describe, expect, test } from "vitest";
import { parseObjMesh } from "../obj.js";

describe(parseObjMesh.name, () => {
  test("parses vertices and triangulates faces", () => {
    const obj = `
# triangle and quad
v 0 0 0
v 1 0 0
v 0 1 0
v 1 1 0
f 1 2 3
f 1 2 4 3
`;

    const mesh = parseObjMesh(obj);
    expect(mesh.points).toHaveLength(4);
    expect(mesh.faces).toEqual([
      [0, 1, 2],
      [0, 1, 3],
      [0, 3, 2],
    ]);
  });

  test("supports v/vt/vn face tokens", () => {
    const obj = `
v 0 0 0
v 1 0 0
v 0 1 0
f 1/1/1 2/2/2 3/3/3
`;

    const mesh = parseObjMesh(obj);
    expect(mesh.faces).toEqual([[0, 1, 2]]);
  });
});

