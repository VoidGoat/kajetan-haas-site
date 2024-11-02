/**
 * Stores all shader variables and implements helper methods for working with WebGL shaders.
 */
class Shader {
  /**
   * Sets up variables, might be unnecessary
   */
  constructor() {
    this.vertShader;
    this.fragShader;
    this.program;
  }

  /**
   * Compiles a shader from the DOM
   * @param {string} id the id of the DOM element
   * @return {number} The id value of the compiled shader returned by WebGL
   */
  loadFromDOM(id) {

    var shaderScript = document.getElementById(id);

    // If we don't find an element with the specified id
    // we do an early exit
    if (!shaderScript) {
      return null;
    }

    // Loop through the children for the found DOM element and
    // build up the shader source code as a string
    var shaderSource = "";
    var currentChild = shaderScript.firstChild;
    while (currentChild) {
      if (currentChild.nodeType == 3) { // 3 corresponds to TEXT_NODE
        shaderSource += currentChild.textContent;
      }
      currentChild = currentChild.nextSibling;
    }

    var shader;
    if (shaderScript.type == "x-shader/x-fragment") {
      shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex") {
      shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
      return null;
    }

    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert(gl.getShaderInfoLog(shader));
      return null;
    }

    return shader;
  }

  /**
   * Loads, compiles, and links a vertex and fragment shader
   * @param {string} vertShader the id of the vert shader DOM element
   * @param {string} fragShader the id of the frag shader DOM element
   */
  load( vertShader, fragShader) {
    this.vertShader = this.loadFromDOM(vertShader);
    this.fragShader = this.loadFromDOM(fragShader);

    this.setup();
  }

  /**
   * Links and uses a shader
   */
  setup() {
    this.program = gl.createProgram();
    gl.attachShader(this.program, this.vertShader);
    gl.attachShader(this.program, this.fragShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      alert("Failed to setup shaders");
    }

    gl.useProgram(this.program);

    // Remove this line later when you know how to
    gl.enableVertexAttribArray( this.getAttributeLocation("aVertexPosition") );

  }

  /**
   * Get the location of a named attribute in the shader from WebGL.
   * @param {string} attribName name of an attribute in the shader
   * @return {number} attribute location returned by WebGL
   */
  getAttributeLocation(attribName) {
    return gl.getAttribLocation(this.program, attribName);
  }

  /**
   * Get the location of a uniform in the shader from WebGL.
   * @param {string} name name of an uniform in the shader
   * @return {number} uniform location returned by WebGL
   */
  getUniform(name) {
    return gl.getUniformLocation(this.program, name );
  }


  // enableAttribute( attributeName ) {
  //
  // }
}
