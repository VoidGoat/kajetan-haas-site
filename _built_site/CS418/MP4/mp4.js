/**
 * @file Physics Simulation in WebGL MP 4 CS 418
 * @author Kajetan Haas
 */
 /** @global Map storing whether keys are pressed */
 var currentlyPressedKeys = {};

/** @global The WebGL context */
var gl;

/** @global The HTML5 canvas we draw on */
var canvas;

/** @global Phong Shader object for spheres*/
var phongShader;

/** @global The current rotation of the camera around the origin */
var currentRotation = Math.PI/2;

/** @global How fast to rotate the camera */
const rotationSpeed = 0.8;

// mesh buffers
/** @global The WebGL buffer holding the teapot vertices*/
var sphereVertexPositionBuffer;

/** @global The WebGL buffer holding the teapot normals*/
var sphereVertexNormalBuffer;

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
var eyePt = glMatrix.vec3.fromValues(0.0,0.0,4.0);
/** @global Direction of the view in world coordinates */
var viewDir = glMatrix.vec3.fromValues(0.0,0.0,-1.0);
/** @global Up vector for view matrix creation, in world coordinates */
var up = glMatrix.vec3.fromValues(0.0,1.0,0.0);
/** @global Location of a point along viewDir in world coordinates */
var viewPt = glMatrix.vec3.fromValues(0.0,0.0,0.0);


// Sphere variables
/** @global How many spheres are currently in the scene */
var sphereCount = 0;

/** @global How many spheres to start with */
let initialSphereCount = 100;

/** @global How many spheres to add with a button press */
let sphereAddCount = 10;

/** @global Distance that the camera should orbit around the scene */
let cameraDistance = 4.0;

/** @global List of 3D sphere positions represented as lists of size 3 */
var spherePositions = [];

/** @global List of 3D sphere velocities represented as lists of size 3 */
var sphereVelocities = [];

/** @global List of sphere colors represented as lists of size 3 */
var sphereColors = [];

/** @global List of sphere radii */
var sphereRadii = [];

/**
 * Get random float in range
 * @param {number} min min value
 * @param {number} max max value
 * @return {number} random value in range
 */
function randomInRange(min, max) {
  return Math.random()*(max-min) + min;
}

/**
 * Add 'count' spheres to scene at random
 * @param {number} count How many spheres to add
 */
function addSpheres(count) {
  let posMin = -1.0;
  let posMax = 1.0
  let velMin = -3.0;
  let velMax = 3.0;

  let colMin = 0.0;
  let colMax = 1.0;

  let radMin = 0.05;
  let radMax = 0.2;

  sphereCount += count;

  for (var i = 0; i < count; i++) {
    let radii = randomInRange(radMin, radMax);
    sphereRadii.push( radii);

    spherePositions.push( [randomInRange(posMin+radii, posMax-radii),randomInRange(posMin+radii, posMax-radii),randomInRange(posMin+radii, posMax-radii)] );
    sphereVelocities.push( [randomInRange(velMin, velMax),randomInRange(velMin, velMax),randomInRange(velMin, velMax)] );
    sphereColors.push( [randomInRange(colMin, colMax),randomInRange(colMin, colMax),randomInRange(colMin, colMax)] );
  }
}

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

  // initialize sphere shader
  sphereShader = new Shader();
  sphereShader.load( "sphere-shader-vert", "sphere-shader-frag" );

  setupBuffers();

  addSpheres(initialSphereCount);

  // Enable vertex attributes
  sphereAttribVertPos = sphereShader.getAttributeLocation("aVertexPosition");
  sphereAttribVertNormal = sphereShader.getAttributeLocation("aVertexNormal");
  gl.enableVertexAttribArray( sphereAttribVertNormal );
  gl.enableVertexAttribArray( sphereAttribVertPos );


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
 * Event handler for key up events
 * @param {object} event key down event
 */
function handleKeyDown(event) {
  currentlyPressedKeys[event.key] = true;
}


/**
 * Add vertex to array
 * @param {glMatrix.vec3} v vertex to add to array
 * @param {array} vArray array of vertices
 */
function pushVertex(v, vArray) {
 for(i=0;i<3;i++) {
     vArray.push(v[i]);
 }
}

/**
 * Recursively subdivides triangle to generate vertices and normals
 * @param {glMatrix.vec3} a Position 1
 * @param {glMatrix.vec3} b position 2
 * @param {glMatrix.vec3} c position 3
 * @param {number} numSubDivs number of subdivisions to do
 * @param {array} vertexArray array to fill with normals
 * @param {array} normalArray array to fill with normals
 * @return {number} number of triangles generated
 */
function sphDivideTriangle(a, b, c, numSubDivs, vertexArray, normalArray) {
    if (numSubDivs>0)
    {
        var numT=0;

        var ab =  glMatrix.vec4.create();
        glMatrix.vec4.lerp(ab,a,b,0.5);
        glMatrix.vec4.normalize(ab,ab);

        var ac =  glMatrix.vec4.create();
        glMatrix.vec4.lerp(ac,a,c,0.5);
        glMatrix.vec4.normalize(ac,ac);

        var bc =  glMatrix.vec4.create();
        glMatrix.vec4.lerp(bc,b,c,0.5);
        glMatrix.vec4.normalize(bc,bc);

        numT+=sphDivideTriangle(a,ab,ac,numSubDivs-1, vertexArray, normalArray);
        numT+=sphDivideTriangle(ab,b,bc,numSubDivs-1, vertexArray, normalArray);
        numT+=sphDivideTriangle(bc,c,ac,numSubDivs-1, vertexArray, normalArray);
        numT+=sphDivideTriangle(ab,bc,ac,numSubDivs-1, vertexArray, normalArray);
        return numT;
    }
    else
    {
        // Add 3 vertices to the array

        pushVertex(a,vertexArray);
        pushVertex(b,vertexArray);
        pushVertex(c,vertexArray);

        //normals are the same as the vertices for a sphere

        pushVertex(a,normalArray);
        pushVertex(b,normalArray);
        pushVertex(c,normalArray);

        return 1;

    }
}

/**
 * Recursively subdivides sphere to generate vertices and normals
 * @param {number} numSubDivs How many times to subdivide sphere
 * @param {array} vertexArray array to fill with vertex positions
 * @param {array} normalArray array to fill with normals
 * @return {number} number of triangles generated
 */
function sphereFromSubdivision(numSubDivs, vertexArray, normalArray) {
    var numT=0;
    var a = glMatrix.vec4.fromValues(0.0,0.0,-1.0,0);
    var b = glMatrix.vec4.fromValues(0.0,0.942809,0.333333,0);
    var c = glMatrix.vec4.fromValues(-0.816497,-0.471405,0.333333,0);
    var d = glMatrix.vec4.fromValues(0.816497,-0.471405,0.333333,0);

    numT+=sphDivideTriangle(a,b,c,numSubDivs, vertexArray, normalArray);
    numT+=sphDivideTriangle(d,c,b,numSubDivs, vertexArray, normalArray);
    numT+=sphDivideTriangle(a,d,b,numSubDivs, vertexArray, normalArray);
    numT+=sphDivideTriangle(a,c,d,numSubDivs, vertexArray, normalArray);
    return numT;
}

/**
 * Set up WebGL buffers and prepare for rendering
 */
function setupBuffers() {


  var sphereVertices=[];
  var sphereNormals=[];
  var numT = sphereFromSubdivision(5, sphereVertices, sphereNormals);
  console.log(numT);
  console.log(sphereNormals);


  ///////////////////
  // Sphere buffers
  ///////////////////
  sphereVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereVertices), gl.DYNAMIC_DRAW);
  sphereVertexPositionBuffer.itemSize = 3;
  sphereVertexPositionBuffer.numItems = Math.floor(sphereVertices.length / 3);


  // Specify normals to be able to do lighting calculations
  sphereVertexNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereNormals), gl.DYNAMIC_DRAW);
  sphereVertexNormalBuffer.itemSize = 3;
  sphereVertexNormalBuffer.numItems =  Math.floor(sphereNormals.length / 3);
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
 * Updates position and velocity of all spheres
 */
function physicsUpdate() {
  // var delta = time - previousTime;
  var delta = 0.01666666667;
  // var delta = 0.01;

  let drag = Math.pow(0.4, delta);

  // console.log(sphereVelocities[0][1]);

  for (var i = 0; i < sphereCount; i++ ) {
    // Update Positions
    spherePositions[i][0] += delta * sphereVelocities[i][0];
    spherePositions[i][1] += delta * sphereVelocities[i][1];
    spherePositions[i][2] += delta * sphereVelocities[i][2];

    // Gravity
    sphereVelocities[i][1] += delta * -5;

    // Drag
    sphereVelocities[i][0] *= drag;
    sphereVelocities[i][1] *= drag;
    sphereVelocities[i][2] *= drag;

    // -Y Wall Collision
    if ( spherePositions[i][1] - sphereRadii[i] - delta*sphereVelocities[i][1] < -1.0 ) {

      // Freeze spheres when their velocity is low to prevent them from bouncing forever
      if ( Math.abs(sphereVelocities[i][1]) < 0.7 ) sphereVelocities[i][1] = 0.0;
      sphereVelocities[i][1] *= -1;

      // reduce velocity slightly on impact
      sphereVelocities[i][1] *= 0.7;

      spherePositions[i][1] =  -1.0 + sphereRadii[i];

    }
    // +Y Wall Collision
    if ( spherePositions[i][1] + sphereRadii[i] + delta*sphereVelocities[i][1] > 1.0 ) {
      sphereVelocities[i][1] *= -1;
      spherePositions[i][1] =  1.0 - sphereRadii[i];
    }

    // -X Wall Collision
    if ( spherePositions[i][0] - sphereRadii[i] - delta*sphereVelocities[i][0] < -1.0 ) {
      sphereVelocities[i][0] *= -1;
      spherePositions[i][0] =  -1.0 + sphereRadii[i];
    }
    // +X Wall Collision
    if ( spherePositions[i][0] + sphereRadii[i] + delta*sphereVelocities[i][0] > 1.0 ) {
      sphereVelocities[i][0] *= -1;
      spherePositions[i][0] =  1.0 - sphereRadii[i];
    }
    // -Z Wall Collision
    if ( spherePositions[i][2] - sphereRadii[i] - delta*sphereVelocities[i][2] < -1.0 ) {
      sphereVelocities[i][2] *= -1;
      spherePositions[i][2] =  -1.0 + sphereRadii[i];
    }
    // +Z Wall Collision
    if ( spherePositions[i][2] + sphereRadii[i] + delta*sphereVelocities[i][2] > 1.0 ) {
      sphereVelocities[i][2] *= -1;
      spherePositions[i][2] =  1.0 - sphereRadii[i];
    }

  }
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


  eyePt[0] = cameraDistance * Math.cos(currentRotation);
  eyePt[2] = cameraDistance * Math.sin(currentRotation);

  // Keyboard Inputs
  if ( currentlyPressedKeys["d"] == true ) {
    currentRotation -= rotationSpeed*delta;
  }

  if ( currentlyPressedKeys["a"] == true ) {
    currentRotation += rotationSpeed*delta;
  }

  if ( currentlyPressedKeys["r"] == true ) {
    addSpheres(sphereAddCount);
    currentlyPressedKeys["r"] = false;
  }
  if ( currentlyPressedKeys["c"] == true ) {
    sphereCount = 0;
    spherePositions = [];
    sphereRadii = [];
    sphereVelocities = [];
    sphereColors = [];
  }

  viewDir = glMatrix.vec3.scale( viewDir, eyePt, -1)


  ////////////////////
  // SPHERE RENDERING
  ////////////////////

  sphereShader.use();

  var uColor = sphereShader.getUniform("uColor");


  var uEyePos = sphereShader.getUniform("uEyePos");
  gl.uniform3fv(uEyePos, eyePt);

  var uMVMatrix = sphereShader.getUniform( "uMVMatrix");
  gl.uniformMatrix4fv(uMVMatrix, false, mvMatrix);

  var uPMatrix = sphereShader.getUniform( "uPMatrix");
  gl.uniformMatrix4fv(uPMatrix, false, pMatrix);

  let uNMatrix = sphereShader.getUniform( "uNMatrix");
  glMatrix.mat3.fromMat4(nMatrix,mvMatrix);
  glMatrix.mat3.transpose(nMatrix,nMatrix);
  glMatrix.mat3.invert(nMatrix,nMatrix);
  gl.uniformMatrix3fv(uNMatrix, false, nMatrix);


  attribVertPos = sphereShader.getAttributeLocation("aVertexPosition");
  attribVertNormal = sphereShader.getAttributeLocation("aVertexNormal");

  gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);
  gl.vertexAttribPointer(attribVertPos, sphereVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

  // Bind normal buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
  gl.vertexAttribPointer(attribVertNormal, sphereVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);




  // render all spheres
  for ( var i = 0; i < sphereCount; i++ ) {

    let radii = sphereRadii[i];
    var scaleVector = glMatrix.vec3.fromValues(radii, radii, radii);
    var scaleMatrix = glMatrix.mat4.create();

    var transVector = glMatrix.vec3.fromValues(spherePositions[i][0], spherePositions[i][1], spherePositions[i][2]);
    var transMatrix = glMatrix.mat4.create();

    var adjustedMV = glMatrix.mat4.create();


    glMatrix.mat4.fromTranslation(transMatrix, transVector);
    glMatrix.mat4.mul(adjustedMV, mvMatrix, transMatrix );

    glMatrix.mat4.fromScaling(scaleMatrix, scaleVector);
    glMatrix.mat4.mul(adjustedMV, adjustedMV, scaleMatrix );

    gl.uniformMatrix4fv(uMVMatrix, false, adjustedMV);

    var colorVector = glMatrix.vec3.fromValues(sphereColors[i][0], sphereColors[i][1], sphereColors[i][2]);
    gl.uniform3fv(uColor, colorVector);

    gl.drawArrays(gl.TRIANGLES, 0, sphereVertexPositionBuffer.numItems);

  }
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

    // prevent NaNs
    if ( !now ) { now = 0; }

    draw(now);

    physicsUpdate();

    previousTime = now;
}
