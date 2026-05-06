import type { HudGrid } from "@solitude/engine/app/hudPorts";
import type { RGB } from "@solitude/engine/app/scenePorts";
import type {
  Rasterizer,
  RenderedBodyLabel,
  RenderedFace,
  RenderedPolyline,
  RenderedSegment,
  TextMetrics,
} from "@solitude/engine/render/renderPorts";
import type { ScreenPoint } from "@solitude/engine/render/scrn";

export class WebGLRasterizer implements Rasterizer {
  private gl: WebGL2RenderingContext;

  // Face program and buffers
  private faceProgram: WebGLProgram;
  private faceVAO: WebGLVertexArrayObject;
  private faceVBO: WebGLBuffer;
  private uFaceResolution: WebGLUniformLocation | null;

  // Line program (for polylines + segments) and buffers
  private lineProgram: WebGLProgram;
  private lineVAO: WebGLVertexArrayObject;
  private lineVBO: WebGLBuffer;
  private uLineResolution: WebGLUniformLocation | null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.initGLState();

    const faceVBO = this.gl.createBuffer();
    if (!faceVBO) throw new Error("Failed to create face VBO");
    this.faceVBO = faceVBO;

    const lineVBO = this.gl.createBuffer();
    if (!lineVBO) throw new Error("Failed to create line VBO");
    this.lineVBO = lineVBO;

    this.faceProgram = this.createFaceProgram();
    this.faceVAO = this.createFaceVAO();
    this.uFaceResolution = this.gl.getUniformLocation(
      this.faceProgram,
      "uResolution",
    );

    this.lineProgram = this.createLineProgram();
    this.lineVAO = this.createLineVAO();
    this.uLineResolution = this.gl.getUniformLocation(
      this.lineProgram,
      "uResolution",
    );
  }

  private initGLState(): void {
    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
  }

  // --- Shader / program helpers ---

  private compileShader(type: GLenum, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error("Failed to create shader");
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) ?? "Unknown";
      gl.deleteShader(shader);
      throw new Error("Shader compile failed: " + info);
    }

    return shader;
  }

  private linkProgram(vs: WebGLShader, fs: WebGLShader): WebGLProgram {
    const gl = this.gl;
    const program = gl.createProgram();
    if (!program) {
      throw new Error("Failed to create program");
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) ?? "Unknown";
      gl.deleteProgram(program);
      throw new Error("Program link failed: " + info);
    }

    gl.detachShader(program, vs);
    gl.detachShader(program, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    return program;
  }

  // --- Face pipeline: triangles ---

  private createFaceProgram(): WebGLProgram {
    const vsSource = `#version 300 es
      precision highp float;

      // Per-vertex attributes
      in vec3 aPosition;  // screen-space x,y in pixels, z = (camera-space depth)
      in vec3 aColor;     // RGB in [0,1]

      // Canvas resolution (pixels)
      uniform vec2 uResolution;

      // Pass-through color
      out vec3 vColor;

      void main() {
        // Convert from screen-space (pixels) to clip space [-1,1].
        float ndcX = (aPosition.x / uResolution.x) * 2.0 - 1.0;
        float ndcY = 1.0 - (aPosition.y / uResolution.y) * 2.0;

        // Map depth to a 0..1 range via a simple non-linear transform.
        // We assume aPosition.z is positive camera-space depth.
        float depth = aPosition.z;
        float ndcZ = (depth / (depth + 1.0)) * 2.0 - 1.0;

        gl_Position = vec4(ndcX, ndcY, ndcZ, 1.0);
        vColor = aColor;
      }
    `;

    const fsSource = `#version 300 es
      precision highp float;

      in vec3 vColor;
      out vec4 outColor;

      void main() {
        outColor = vec4(vColor, 1.0);
      }
    `;

    const vs = this.compileShader(this.gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(this.gl.FRAGMENT_SHADER, fsSource);
    return this.linkProgram(vs, fs);
  }

  private createFaceVAO(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error("Failed to create face VAO");
    gl.bindVertexArray(vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.faceVBO);

    const program = this.faceProgram;
    const aPositionLoc = gl.getAttribLocation(program, "aPosition");
    const aColorLoc = gl.getAttribLocation(program, "aColor");

    const stride = (3 + 3) * 4; // 6 floats * 4 bytes

    // aPosition: vec3 (x,y,z)
    gl.enableVertexAttribArray(aPositionLoc);
    gl.vertexAttribPointer(aPositionLoc, 3, gl.FLOAT, false, stride, 0);

    // aColor: vec3 (r,g,b)
    gl.enableVertexAttribArray(aColorLoc);
    gl.vertexAttribPointer(aColorLoc, 3, gl.FLOAT, false, stride, 3 * 4);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return vao;
  }

  // --- Line pipeline: polylines & segments ---

  private createLineProgram(): WebGLProgram {
    const vsSource = `#version 300 es
      precision highp float;

      in vec3 aPosition;
      in vec3 aColor;

      uniform vec2 uResolution;

      out vec3 vColor;

      void main() {
        float ndcX = (aPosition.x / uResolution.x) * 2.0 - 1.0;
        float ndcY = 1.0 - (aPosition.y / uResolution.y) * 2.0;

        float depth = aPosition.z;
        float ndcZ = (depth / (depth + 1.0)) * 2.0 - 1.0;

        gl_Position = vec4(ndcX, ndcY, ndcZ, 1.0);
        vColor = aColor;
      }
    `;

    const fsSource = `#version 300 es
      precision highp float;

      in vec3 vColor;
      out vec4 outColor;

      void main() {
        outColor = vec4(vColor, 1.0);
      }
    `;

    const vs = this.compileShader(this.gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(this.gl.FRAGMENT_SHADER, fsSource);
    return this.linkProgram(vs, fs);
  }

  private createLineVAO(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error("Failed to create line VAO");
    gl.bindVertexArray(vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVBO);

    const program = this.lineProgram;
    const aPositionLoc = gl.getAttribLocation(program, "aPosition");
    const aColorLoc = gl.getAttribLocation(program, "aColor");

    const stride = (3 + 3) * 4; // 6 floats

    gl.enableVertexAttribArray(aPositionLoc);
    gl.vertexAttribPointer(aPositionLoc, 3, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(aColorLoc);
    gl.vertexAttribPointer(aColorLoc, 3, gl.FLOAT, false, stride, 3 * 4);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return vao;
  }

  // --- Rasterizer interface implementation ---

  clear(color: string): void {
    const gl = this.gl;
    const surface = gl.canvas;

    // Very small CSS rgb() parser for "rgb(r, g, b)"
    let r = 0,
      g = 0,
      b = 0;
    const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) {
      r = Number(m[1]) / 255;
      g = Number(m[2]) / 255;
      b = Number(m[3]) / 255;
    }

    gl.viewport(0, 0, surface.width, surface.height);
    gl.clearColor(r, g, b, 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  drawFaces(faces: RenderedFace[], count: number): void {
    if (count === 0) return;

    const gl = this.gl;
    const surface = gl.canvas;

    gl.viewport(0, 0, surface.width, surface.height);

    gl.useProgram(this.faceProgram);
    if (this.uFaceResolution) {
      gl.uniform2f(this.uFaceResolution, surface.width, surface.height);
    }

    // Flatten faces into an interleaved vertex array
    // 3 vertices per face; each vertex: [x, y, depth, r, g, b]
    const vertexCount = count * 3;
    const data = new Float32Array(vertexCount * 6);

    let offset = 0;
    let face: RenderedFace;
    let p0: ScreenPoint, p1: ScreenPoint, p2: ScreenPoint;
    let color: RGB;
    for (let i = 0; i < count; i++) {
      face = faces[i];
      p0 = face.p0;
      p1 = face.p1;
      p2 = face.p2;
      color = face.color;
      const r = color.r / 255;
      const g = color.g / 255;
      const b = color.b / 255;
      offset = this.writeFaceVertex(
        data,
        offset,
        p0.x,
        p0.y,
        p0.depth,
        r,
        g,
        b,
      );
      offset = this.writeFaceVertex(
        data,
        offset,
        p1.x,
        p1.y,
        p1.depth,
        r,
        g,
        b,
      );
      offset = this.writeFaceVertex(
        data,
        offset,
        p2.x,
        p2.y,
        p2.depth,
        r,
        g,
        b,
      );
    }

    gl.bindVertexArray(this.faceVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.faceVBO);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(null);
  }

  private writeFaceVertex(
    data: Float32Array,
    offset: number,
    x: number,
    y: number,
    depth: number,
    r: number,
    g: number,
    b: number,
  ): number {
    data[offset++] = x;
    data[offset++] = y;
    data[offset++] = depth;
    data[offset++] = r;
    data[offset++] = g;
    data[offset++] = b;
    return offset;
  }

  drawPolylines(polylines: RenderedPolyline[], count: number): void {
    if (count === 0) return;

    const gl = this.gl;
    const surface = gl.canvas;

    gl.viewport(0, 0, surface.width, surface.height);

    gl.useProgram(this.lineProgram);
    if (this.uLineResolution) {
      gl.uniform2f(this.uLineResolution, surface.width, surface.height);
    }

    gl.bindVertexArray(this.lineVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVBO);

    // We’ll draw each polyline separately to honor lineWidth and color.
    let polyline: RenderedPolyline;
    for (let i = 0; i < count; i++) {
      polyline = polylines[i];
      if (polyline.points.length < 2) continue;

      // Parse cssColor "rgb(r,g,b)"
      let rr = 1,
        gg = 1,
        bb = 1;
      const m = polyline.cssColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (m) {
        rr = Number(m[1]) / 255;
        gg = Number(m[2]) / 255;
        bb = Number(m[3]) / 255;
      }

      // One vertex per ScreenPoint
      const n = polyline.points.length;
      const data = new Float32Array(n * 6);
      let offset = 0;

      for (let i = 0; i < n; i++) {
        const p = polyline.points[i];
        data[offset++] = p.x;
        data[offset++] = p.y;
        data[offset++] = p.depth;
        data[offset++] = rr;
        data[offset++] = gg;
        data[offset++] = bb;
      }

      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

      // WebGL2 core line width is effectively 1 on most platforms;
      // setting gl.lineWidth may not have visible effect, but we call it anyway.
      gl.lineWidth(polyline.lineWidth);

      gl.drawArrays(gl.LINE_STRIP, 0, n);
    }

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(null);
  }

  drawSegments(segments: RenderedSegment[], count: number): void {
    if (count === 0) return;

    const gl = this.gl;
    const surface = gl.canvas;

    gl.viewport(0, 0, surface.width, surface.height);

    gl.useProgram(this.lineProgram);
    if (this.uLineResolution) {
      gl.uniform2f(this.uLineResolution, surface.width, surface.height);
    }

    gl.bindVertexArray(this.lineVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVBO);

    const data = new Float32Array(2 * 6);

    let segment: RenderedSegment;
    let start: ScreenPoint, end: ScreenPoint;
    for (let i = 0; i < count; i++) {
      segment = segments[i];
      start = segment.start;
      end = segment.end;

      let rr = 1,
        gg = 1,
        bb = 1;
      const m = segment.cssColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (m) {
        rr = Number(m[1]) / 255;
        gg = Number(m[2]) / 255;
        bb = Number(m[3]) / 255;
      }

      // start vertex
      data[0] = start.x;
      data[1] = start.y;
      data[2] = start.depth;
      data[3] = rr;
      data[4] = gg;
      data[5] = bb;

      // end vertex
      data[6] = end.x;
      data[7] = end.y;
      data[8] = end.depth;
      data[9] = rr;
      data[10] = gg;
      data[11] = bb;

      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

      // WebGL2 core line width is effectively 1 on most platforms;
      // setting gl.lineWidth may not have visible effect, but we call it anyway.
      gl.lineWidth(segment.lineWidth);
      gl.drawArrays(gl.LINES, 0, 2);
    }

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(null);
  }

  drawBodyLabels(labels: RenderedBodyLabel[]): void {
    // No-op for now. You can keep using a Canvas2D overlay for labels,
    // or later implement label rendering in a separate adapter.
    void labels;
  }

  drawHud(hud: HudGrid): void {
    // No-op for now. Same comment as drawBodyLabels.
    void hud;
  }

  measureText(text: string, font: string): TextMetrics {
    void text;
    void font;

    return {
      width: 0,
    } as TextMetrics;
  }
}
