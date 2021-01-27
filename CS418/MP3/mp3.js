/**
 * @file Environment Mapping in WebGL MP 3 CS 418
 * @author Kajetan Haas
 */
 /** @global Map storing whether keys are pressed */
 var currentlyPressedKeys = {};

/** @global The WebGL context */
var gl;

/** @global The HTML5 canvas we draw on */
var canvas;

/** @global Teapot Shader object */
var teapotShader;

/** @global Skybox Shader object */
var skyboxShader;


/** @global An array storing the teapot vertices */
var teaVertices;

/** @global An array storing the teapot face indices */
var teaFaces;

/** @global An array storing the teapot normals */
var teaNormals;

/** @global Whether the teapot model has been successfully loaded yet */
var modelLoaded = false;

/** @global The current rotation of the camera around the origin */
var currentRotation = Math.PI/2;

/** @global How fast to rotate the camera */
const rotationSpeed = 0.8;

// mesh buffers
/** @global The WebGL buffer holding the teapot vertices*/
var teaVertexPositionBuffer;

/** @global The WebGL buffer holding the teapot triangle indices*/
var teaIndexBuffer;

/** @global The WebGL buffer holding the teapot normals*/
var teaVertexNormalBuffer;

/** @global The WebGL buffer holding the skybox vertices*/
var skyVertexPositionBuffer;

/** @global The WebGL buffer holding the skybox triangle indices*/
var skyIndexBuffer;

/** @global The WebGL buffer holding the london cubemap texture */
var londonTexture;

/** @global The WebGL buffer holding the park cubemap texture */
var parkTexture;

/** @global time of last tick */
var previousTime = 0;

/** @global The Modelview matrix */
var mvMatrix = glMatrix.mat4.create();

/** @global The Projection matrix */
var pMatrix = glMatrix.mat4.create();

/** @global The Normal matrix */
var nMatrix = glMatrix.mat3.create();

// View parameters
/** @global Location of the camera in world coordinates */
var eyePt = glMatrix.vec3.fromValues(0.0,0.5,10.0);
/** @global Direction of the view in world coordinates */
var viewDir = glMatrix.vec3.fromValues(0.0,0.0,-1.0);
/** @global Up vector for view matrix creation, in world coordinates */
var up = glMatrix.vec3.fromValues(0.0,1.0,0.0);
/** @global Location of a point along viewDir in world coordinates */
var viewPt = glMatrix.vec3.fromValues(0.0,0.0,0.0);


/** @global Array of cube vertices for skybox */
const cubeVertices = [
  // Front face
  -1.0, -1.0,  1.0,
   1.0, -1.0,  1.0,
   1.0,  1.0,  1.0,
  -1.0,  1.0,  1.0,

  // Back face
  -1.0, -1.0, -1.0,
  -1.0,  1.0, -1.0,
   1.0,  1.0, -1.0,
   1.0, -1.0, -1.0,

  // Top face
  -1.0,  1.0, -1.0,
  -1.0,  1.0,  1.0,
   1.0,  1.0,  1.0,
   1.0,  1.0, -1.0,

  // Bottom face
  -1.0, -1.0, -1.0,
   1.0, -1.0, -1.0,
   1.0, -1.0,  1.0,
  -1.0, -1.0,  1.0,

  // Right face
   1.0, -1.0, -1.0,
   1.0,  1.0, -1.0,
   1.0,  1.0,  1.0,
   1.0, -1.0,  1.0,

  // Left face
  -1.0, -1.0, -1.0,
  -1.0, -1.0,  1.0,
  -1.0,  1.0,  1.0,
  -1.0,  1.0, -1.0,
];

/** @global Array of cube face indices for skybox */
const cubeIndices = [
  0,  1,  2,      0,  2,  3,    // front
  4,  5,  6,      4,  6,  7,    // back
  8,  9,  10,     8,  10, 11,   // top
  12, 13, 14,     12, 14, 15,   // bottom
  16, 17, 18,     16, 18, 19,   // right
  20, 21, 22,     20, 22, 23,   // left
];


/**
 * Creates a context for WebGL
 * @param {element} canvas WebGL canvas
 * @return {Object} WebGL context
 */
function createGLContext(canvas) {
  var names = ["webgl", "experimental-webgl"];
  var context = null;
  for (var i=0; i < names.length; i++) {
    try {
      context = canvas.getContext(names[i]);
    } catch(e) {}
    if (context) {
      break;
    }
  }
  if (context) {
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } else {
    alert("Failed to create WebGL context!");
  }
  return context;
}


/**
 * Startup function called from html code to start program.
 */
function startup() {
  canvas = document.getElementById("myGLCanvas");
  gl = createGLContext(canvas);

  document.onkeydown = handleKeyDown;
  document.onkeyup = handleKeyUp;



  // Get extension for 4 byte integer indices for drwElements
  var ext = gl.getExtension('OES_element_index_uint');
  if (ext ==null){
      alert("OES_element_index_uint is unsupported by your browser and terrain generation cannot proceed.");
  }

  // initialize teapot shader
  teaShader = new Shader();
  teaShader.load( "teapot-shader-vert", "teapot-shader-frag" );

  // initialize shader
  skyShader = new Shader();
  skyShader.load( "skybox-shader-vert", "skybox-shader-frag" );


  // calls setupBuffers() after teapot is laoded
  setupMesh("res/models/teapot.obj");


  // load cubemap textures
  londonTexture = setupTexture("res/images/london", ".png", 512);
  // parkTexture = setupTexture("res/images/park", ".jpg", 1024);
  parkTexture = setupTexture("res/images/street", ".jpg", 1024);



  // Enable vertex attributes
  teaAttribVertPos = teaShader.getAttributeLocation("aVertexPosition");
  teaAttribVertNormal = teaShader.getAttributeLocation("aVertexNormal");
  gl.enableVertexAttribArray( teaAttribVertNormal );
  gl.enableVertexAttribArray( teaAttribVertPos );


  skyAttribVertPos = skyShader.getAttributeLocation("aVertexPosition");
  gl.enableVertexAttribArray( skyAttribVertPos );

  gl.clearColor(0.1, 0.1, 0.1, 1.0);
  gl.enable(gl.DEPTH_TEST);

  tick();
}


/**
 * Event handler for key up events
 * @param {object} event key up event
 */
 function handleKeyUp(event) {
  // console.log("Key Up: ", event.key, " code: ", event.code );
  currentlyPressedKeys[event.key] = false;
}

/**
 *  Event handler for key up events
 * @param {object} event key down event
 */
function handleKeyDown(event) {
  currentlyPressedKeys[event.key] = true;
}

/**
 * get file data and parse mesh
 * @param {string} file path name for obj file
 */
function setupMesh(file) {

  meshPromise = asyncGetFile(file);

  meshPromise.then((retrievedText) => {
    parseMesh(retrievedText);
    console.log("got mesh!");
  }).catch(
    (reason) => {
      console.log("handle rejected promise:" + reason );
    }
  )
}

/**
 * Convert mesh file data to WebGL buffers
 * @param {string} data OBJ file data
 */
function parseMesh(data) {
  // console.log(data);
  var lines = data.split('\n');
  // console.log(lines[0]);
  teaVertices = [];
  teaFaces = [];
  teaNormals = [];
  // Parse vertices and face indices
  for ( var i = 0; i < lines.length; i++ ) {
    elements = lines[i].split(/\b\s+(?!$)/);

    if ( elements[0] == "v" ) {
      var a = parseFloat(elements[1]);
      var b = parseFloat(elements[2]);
      var c = parseFloat(elements[3]);
      teaVertices.push(a);
      teaVertices.push(b);
      teaVertices.push(c);
      teaNormals.push(0);
      teaNormals.push(0);
      teaNormals.push(0);
    } else if ( elements[0] == "f" ){
      var a = parseInt(elements[1]);
      var b = parseInt(elements[2]);
      var c = parseInt(elements[3]);
      teaFaces.push(a-1);
      teaFaces.push(b-1);
      teaFaces.push(c-1);
    }
  }

  // Calculate normals
  for ( var i = 0; i < teaFaces.length; i+=3) {

    let v1Index = 3*teaFaces[i];
    let v2Index = 3*teaFaces[i+1];
    let v3Index = 3*teaFaces[i+2];
    let v1 = glMatrix.vec3.fromValues( teaVertices[v1Index], teaVertices[v1Index +1], teaVertices[v1Index+2] );
    let v2 = glMatrix.vec3.fromValues( teaVertices[v2Index], teaVertices[v2Index +1 ], teaVertices[v2Index+2] );
    let v3 = glMatrix.vec3.fromValues( teaVertices[v3Index], teaVertices[v3Index +1 ], teaVertices[v3Index+2] );

    var norm = glMatrix.vec3.create();
    var a = glMatrix.vec3.create();
    var b = glMatrix.vec3.create();

    glMatrix.vec3.sub(a, v2, v1);
    glMatrix.vec3.sub(b, v3, v1);

    glMatrix.vec3.cross(norm, a, b);

    teaNormals[v1Index] += norm[0];
    teaNormals[v1Index+1] += norm[1];
    teaNormals[v1Index+2] += norm[2];

    teaNormals[v2Index] += norm[0];
    teaNormals[v2Index+1] += norm[1];
    teaNormals[v2Index+2] += norm[2];

    teaNormals[v3Index] += norm[0];
    teaNormals[v3Index+1] += norm[1];
    teaNormals[v3Index+2] += norm[2];


  }

  // normalize normal vectors
  for ( var i  =0; i < teaNormals.length; i += 3) {
    let norm = glMatrix.vec3.fromValues( teaNormals[i], teaNormals[i +1], teaNormals[i+2] );
    glMatrix.vec3.normalize(norm, norm);
    teaNormals[i] = norm[0];
    teaNormals[i+1] = norm[1];
    teaNormals[i+2] = norm[2];
  }


  setupBuffers();
  modelLoaded = true;
}

/**
 * asynchrounously read file data
 * @param {string} file file path
 */
function asyncGetFile(file) {
  console.log("Getting File!");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", file);
    xhr.onload = () => resolve(xhr.responseText);
    xhr.onerror = () => reject(xhr.statusText);
    xhr.send();
    // console.log("Made Promise!");
  })
}

/**
 * read in cubemap image files and create a WebGL cubemap
 * @param {string} path path to folder with cubemap images
 * @param {string} extension image files extension
 * @param {number} size square dimensions of image
 * @return {object} WebGL cubemap texture object
 */
function setupTexture(path, extension, size) {
  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

  const faceInfos = [
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      url: path + '/pos-x' + extension,
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      url: path + '/neg-x' + extension,
    },
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
      url: path + '/pos-y' + extension,
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      url: path + '/neg-y' + extension,
    },
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
      url: path + '/pos-z' + extension,
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
      url: path + '/neg-z' + extension,
    },
  ];

  faceInfos.forEach((faceInfo) => {
    const {target, url} = faceInfo;

    // Upload the canvas to the cubemap face.
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = size;
    const height = size;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;

    // setup each face so it's immediately renderable
    gl.texImage2D(target, level, internalFormat, width, height, 0, format, type, null);

    // Asynchronously load an image
    const image = new Image();
    image.src = url;
    image.addEventListener('load', function() {
      // Now that the image has loaded upload it to the texture.
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
      gl.texImage2D(target, level, internalFormat, format, type, image);
      gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    });
  });
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  // gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);

  return texture;

}

/**
 * Set up WebGL buffers and prepare for rendering
 */
function setupBuffers() {


  ///////////////////
  // Skybox buffers
  ///////////////////

  // Set up position buffer
  skyVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, skyVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cubeVertices), gl.DYNAMIC_DRAW);
  skyVertexPositionBuffer.itemSize = 3;
  skyVertexPositionBuffer.numItems = Math.floor(cubeVertices.length / 3);

  // Specify faces of the skybox
  skyIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skyIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeIndices), gl.DYNAMIC_DRAW);
  skyIndexBuffer.itemSize = 1;
  skyIndexBuffer.numItems = cubeIndices.length;


  ///////////////////
  // Teapot buffers
  ///////////////////
  teaVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, teaVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(teaVertices), gl.DYNAMIC_DRAW);
  teaVertexPositionBuffer.itemSize = 3;
  teaVertexPositionBuffer.numberOfItems = Math.floor(teaVertices.length / 3);


  // Specify normals to be able to do lighting calculations
  teaVertexNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, teaVertexNormalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(teaNormals), gl.DYNAMIC_DRAW);
  teaVertexNormalBuffer.itemSize = 3;
  teaVertexNormalBuffer.numItems =  Math.floor(teaNormals.length / 3);

  // Specify faces of the teapot
  teaIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, teaIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(teaFaces), gl.DYNAMIC_DRAW);
  teaIndexBuffer.itemSize = 1;
  teaIndexBuffer.numItems = teaFaces.length;
}


/**
 * Interpolates between two values with a paremeter t
 * @param {number} x initial value when t=0
 * @param {number} y value when t=1
 * @param {number} t progress parameter
 * @return {number} interpolated value
 */
function interp( x, y, t) {
  t = Math.pow( Math.min(Math.max(t, 0), 1), 1.5);
  return y*t + x*(1-t);
}


/**
 * Draw call that draws block I and applies matrix transformations to model and draws model in frame
 * @param {number} time current time
 */
function draw( time ) {
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


  var delta = time - previousTime;


    // We'll use perspective
  glMatrix.mat4.perspective(pMatrix, degToRad(45),
                   gl.viewportWidth / gl.viewportHeight,
                   0.1, 200.0);


  glMatrix.vec3.add(viewPt, eyePt, viewDir);
  glMatrix.mat4.lookAt(mvMatrix, eyePt, viewPt, up);


  eyePt[0] = 1.0 * Math.cos(currentRotation);
  eyePt[2] = 1.0 * Math.sin(currentRotation);

  // Acceleration inputs
  if ( currentlyPressedKeys["d"] == true ) {
    currentRotation -= rotationSpeed*delta;
  }

  if ( currentlyPressedKeys["a"] == true ) {
    currentRotation += rotationSpeed*delta;
  }

  viewDir = glMatrix.vec3.scale( viewDir, eyePt, -1)


  ////////////////////
  // TEAPOT RENDERING
  ////////////////////

  teaShader.use();

  var uEyePos = teaShader.getUniform("uEyePos");
  gl.uniform3fv(uEyePos, eyePt);

  var uMVMatrix = teaShader.getUniform( "uMVMatrix");
  gl.uniformMatrix4fv(uMVMatrix, false, mvMatrix);

  var uPMatrix = teaShader.getUniform( "uPMatrix");
  gl.uniformMatrix4fv(uPMatrix, false, pMatrix);

  let uNMatrix = teaShader.getUniform( "uNMatrix");
  glMatrix.mat3.fromMat4(nMatrix,mvMatrix);
  glMatrix.mat3.transpose(nMatrix,nMatrix);
  glMatrix.mat3.invert(nMatrix,nMatrix);
  gl.uniformMatrix3fv(uNMatrix, false, nMatrix);

  var uTexture = teaShader.getUniform("uTexture");
  gl.uniform1i(uTexture, 0);

  attribVertPos = teaShader.getAttributeLocation("aVertexPosition");
  attribVertNormal = teaShader.getAttributeLocation("aVertexNormal");

  // bind vertex positions
  gl.bindBuffer(gl.ARRAY_BUFFER, teaVertexPositionBuffer);
  gl.vertexAttribPointer( attribVertPos, teaVertexPositionBuffer.itemSize,
                   gl.FLOAT, false, 0, 0);

   // Bind normal buffer
   gl.bindBuffer(gl.ARRAY_BUFFER, teaVertexNormalBuffer);
   gl.vertexAttribPointer(attribVertNormal, 3,
                   gl.FLOAT, false, 0, 0);

  //Draw Teapot
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, teaIndexBuffer);
  gl.drawElements(gl.TRIANGLES, teaFaces.length, gl.UNSIGNED_SHORT, 0);


  ////////////////////
  // SKYBOX rendering
  ////////////////////

  skyShader.use();

  // Change cubemap  based on radio buttons
  // var uTexture = skyShader.getUniform("uTexture");
  var buttons = document.getElementsByName('cubemap');

  for(i = 0; i < buttons.length; i++) {
    if(buttons[i].checked && buttons[i].id == "london") {
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, londonTexture);

    } else if (buttons[i].checked && buttons[i].id == "park") {
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, parkTexture);

    }
  }

  var uMVMatrix = skyShader.getUniform( "uMVMatrix");
  gl.uniformMatrix4fv(uMVMatrix, false, mvMatrix);

  var uPMatrix = skyShader.getUniform( "uPMatrix");
  gl.uniformMatrix4fv(uPMatrix, false, pMatrix);


  // Tell the shader to use texture unit 0 for u_texture
  var uTexture = skyShader.getUniform("uTexture");
  gl.uniform1i(uTexture, 0);

  var uEyePos = skyShader.getUniform("uEyePos");
  gl.uniform3fv(uEyePos, eyePt);


  attribVertPos = skyShader.getAttributeLocation("aVertexPosition");

  // bind vertex positions
  gl.bindBuffer(gl.ARRAY_BUFFER, skyVertexPositionBuffer);
  gl.vertexAttribPointer( attribVertPos, skyVertexPositionBuffer.itemSize,
                   gl.FLOAT, false, 0, 0);

  //Draw skybox
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skyIndexBuffer);
  gl.drawElements(gl.TRIANGLES, skyIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);


}

/**
 * Translates degrees to radians
 * @param {Number} degrees Degree input to function
 * @return {Number} The radians that correspond to the degree input
 */
function degToRad(degrees) {
        return degrees * Math.PI / 180;
}


/**
 * Tick called for every animation frame.
 * @param {number} now current time in ms
 */
function tick(now) {
    requestAnimFrame(tick);
    now *= 0.001;


    // Change shading mode based on radio buttons
    teaShader.use();
    var uShadingMethod = teaShader.getUniform("uShadingMethod");
    var buttons = document.getElementsByName('shading');

    for(i = 0; i < buttons.length; i++) {
      if(buttons[i].checked && buttons[i].id == "phong") {
        gl.uniform1f(uShadingMethod, 1.0);
      } else if (buttons[i].checked && buttons[i].id === "reflect") {
        gl.uniform1f(uShadingMethod, 2.0);
      } else if (buttons[i].checked && buttons[i].id == "refract") {
        gl.uniform1f(uShadingMethod, 3.0);
      }
    }

    // prevent NaNs
    if ( !now ) { now = 0; }
    if (modelLoaded) {
      draw(now);
    }
    previousTime = now;
}
