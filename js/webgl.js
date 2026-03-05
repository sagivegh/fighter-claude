// ─── WebGL Post-Processing Layer ────────────────────────────────────────────
// Uploads the offscreen Canvas 2D as a texture each frame and applies:
//   Pass 1 – Bloom extract (luminance threshold)
//   Pass 2 – Gaussian blur H+V (half-res)
//   Pass 3 – Composite: chromatic aberration + bloom add + CRT scanlines +
//             vignette + warm colour grade
//
// Falls back gracefully to showing the Canvas 2D directly if WebGL is absent.

const WebGLFX = (() => {
  let gl, glCanvas, src2DCanvas;
  let progExtract, progBlurH, progBlurV, progComposite;
  let fbBright, fbBlurA, fbBlurB;
  let quadBuf;
  let enabled = false;

  // ── Shared vertex shader ─────────────────────────────────────────────────
  const VS = `
    attribute vec2 aPos;
    varying   vec2 vUV;
    void main() {
      vUV = aPos * 0.5 + 0.5;
      vUV.y = 1.0 - vUV.y;   // flip Y (canvas top=0 vs GL bottom=0)
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  // ── Bloom-extract fragment shader ────────────────────────────────────────
  const FS_EXTRACT = `
    precision mediump float;
    uniform sampler2D uTex;
    varying vec2 vUV;
    void main() {
      vec4 c = texture2D(uTex, vUV);
      float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      float bright = smoothstep(0.50, 0.70, lum);
      gl_FragColor = vec4(c.rgb * bright, 1.0);
    }
  `;

  // ── Gaussian blur fragment shader (reused for H and V) ───────────────────
  // uDir = vec2(1/w, 0) for horizontal, vec2(0, 1/h) for vertical
  const FS_BLUR = `
    precision mediump float;
    uniform sampler2D uTex;
    uniform vec2      uDir;
    varying vec2      vUV;
    void main() {
      // 9-tap Gaussian weights
      float w[9];
      w[0]=0.0625; w[1]=0.109375; w[2]=0.171875; w[3]=0.203125; w[4]=0.109375;
      w[5]=0.109375; w[6]=0.171875; w[7]=0.109375; w[8]=0.0625;
      vec4 col = vec4(0.0);
      for (int i = 0; i < 9; i++) {
        float offset = float(i - 4);
        col += texture2D(uTex, vUV + uDir * offset) * w[i];
      }
      gl_FragColor = col;
    }
  `;

  // ── Composite fragment shader ─────────────────────────────────────────────
  const FS_COMPOSITE = `
    precision mediump float;
    uniform sampler2D uGame;
    uniform sampler2D uBloom;
    uniform float     uTime;
    uniform vec2      uRes;      // canvas width, height
    varying vec2      vUV;

    const float CA  = 0.003;     // chromatic aberration offset
    const float PI  = 3.14159265;

    void main() {
      // Chromatic aberration: offset R and B channels slightly
      vec2 dir = vUV - vec2(0.5);
      vec4 colR = texture2D(uGame, vUV + dir * CA);
      vec4 colG = texture2D(uGame, vUV);
      vec4 colB = texture2D(uGame, vUV - dir * CA);
      vec3 game  = vec3(colR.r, colG.g, colB.b);

      // Add bloom
      vec3 bloom = texture2D(uBloom, vUV).rgb * 0.85;
      vec3 col = game + bloom;

      // CRT scanlines: darken every other pixel row
      float scanline = 0.88 + 0.12 * sin(vUV.y * uRes.y * PI);
      col *= scanline;

      // Vignette
      float vx = vUV.x * (1.0 - vUV.x);
      float vy = vUV.y * (1.0 - vUV.y);
      float vign = pow(vx * vy * 16.0, 0.30);
      col *= vign;

      // Warm colour grade: boost red, reduce blue
      col.r *= 1.06;
      col.b *= 0.92;

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _compileShader(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('WebGLFX shader error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function _makeProgram(vsrc, fsrc) {
    const vs = _compileShader(vsrc, gl.VERTEX_SHADER);
    const fs = _compileShader(fsrc, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('WebGLFX link error:', gl.getProgramInfoLog(p));
      return null;
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return p;
  }

  // Create an FBO + texture of given dimensions
  function _makeFBO(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return { fb, tex };
  }

  // Bind a texture to a uniform sampler slot
  function _bindTex(prog, name, tex, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(prog, name), unit);
  }

  // Upload the 2D canvas to a WebGL texture
  let texGame = null;
  function _uploadCanvas() {
    if (!texGame) {
      texGame = gl.createTexture();
    }
    gl.bindTexture(gl.TEXTURE_2D, texGame);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src2DCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  // Draw a full-screen quad using the given program + uniforms callback
  function _drawQuad(prog, setUniforms) {
    gl.useProgram(prog);

    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    if (setUniforms) setUniforms(prog);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(aPos);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function init(canvas2D) {
    src2DCanvas = canvas2D;
    const W = canvas2D.width;
    const H = canvas2D.height;

    // Create the visible WebGL canvas, same size + same CSS position as gameCanvas
    glCanvas = document.createElement('canvas');
    glCanvas.id = 'glCanvas';
    glCanvas.width  = W;
    glCanvas.height = H;
    // Copy inline styles from the 2D canvas so CSS rules still apply to it
    glCanvas.style.cssText = canvas2D.style.cssText;
    glCanvas.style.pointerEvents = 'none'; // let touches fall through to gameCanvas
    canvas2D.parentNode.insertBefore(glCanvas, canvas2D.nextSibling);

    // Hide the 2D canvas visually but keep pointer events so touch input still works
    canvas2D.style.position = 'absolute';
    canvas2D.style.opacity = '0';
    canvas2D.style.pointerEvents = 'auto';

    // Get WebGL context
    gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
    if (!gl) {
      console.warn('WebGLFX: WebGL not available – falling back to Canvas 2D.');
      canvas2D.style.opacity = '1';
      glCanvas.remove();
      glCanvas = null;
      return;
    }

    // Build shaders
    progExtract   = _makeProgram(VS, FS_EXTRACT);
    progBlurH     = _makeProgram(VS, FS_BLUR);
    progBlurV     = _makeProgram(VS, FS_BLUR);
    progComposite = _makeProgram(VS, FS_COMPOSITE);

    if (!progExtract || !progBlurH || !progBlurV || !progComposite) {
      console.warn('WebGLFX: shader compilation failed – falling back to Canvas 2D.');
      canvas2D.style.opacity = '1';
      glCanvas.remove();
      glCanvas = null;
      gl = null;
      return;
    }

    // Full-screen quad (two triangles)
    // prettier-ignore
    const verts = new Float32Array([
      -1, -1,   1, -1,  -1,  1,
      -1,  1,   1, -1,   1,  1,
    ]);
    quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    // FBOs: full-res for extract, half-res for blur passes
    fbBright = _makeFBO(W,     H);
    fbBlurA  = _makeFBO(W / 2, H / 2);
    fbBlurB  = _makeFBO(W / 2, H / 2);

    enabled = true;
  }

  function render(timeMs) {
    if (!enabled || !gl) return;

    const W = src2DCanvas.width;
    const H = src2DCanvas.height;

    // Upload latest Canvas 2D frame as a texture
    _uploadCanvas();

    // ── Pass 1: Bloom extract → fbBright ─────────────────────────────────
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbBright.fb);
    gl.viewport(0, 0, W, H);
    _drawQuad(progExtract, (p) => {
      _bindTex(p, 'uTex', texGame, 0);
    });

    // ── Pass 2a: Horizontal blur (full→half) → fbBlurA ──────────────────
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbBlurA.fb);
    gl.viewport(0, 0, W / 2, H / 2);
    _drawQuad(progBlurH, (p) => {
      _bindTex(p, 'uTex', fbBright.tex, 0);
      gl.uniform2f(gl.getUniformLocation(p, 'uDir'), 1.0 / W, 0.0);
    });

    // ── Pass 2b: Vertical blur → fbBlurB ─────────────────────────────────
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbBlurB.fb);
    gl.viewport(0, 0, W / 2, H / 2);
    _drawQuad(progBlurV, (p) => {
      _bindTex(p, 'uTex', fbBlurA.tex, 0);
      gl.uniform2f(gl.getUniformLocation(p, 'uDir'), 0.0, 1.0 / H);
    });

    // ── Pass 3: Composite to screen ───────────────────────────────────────
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    _drawQuad(progComposite, (p) => {
      _bindTex(p, 'uGame',  texGame,      0);
      _bindTex(p, 'uBloom', fbBlurB.tex,  1);
      gl.uniform1f(gl.getUniformLocation(p, 'uTime'), timeMs * 0.001);
      gl.uniform2f(gl.getUniformLocation(p, 'uRes'),  W, H);
    });
  }

  return { init, render };
})();
