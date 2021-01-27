/**
 * @file Rendering Animations in WebGL
 * @author Kajetan Haas
 */

/** @global The WebGL context */
var gl;

/** @global The HTML5 canvas we draw on */
var canvas;

/** @global Shader object */
var shader;

/** @global The WebGL buffer holding the fill of I */
var innerVertexPositionBuffer;

/** @global The WebGL buffer holding the outline of I */
var outerVertexPositionBuffer;

/** @global time of last tick */
var previousTime = 0;

/** @global current rotation of I */
var currentRotation = 0;

/** @global Value used to generate scale of I. Input to a sin function for smooth animation */
var currentScale = 0;

/** @global Model View Matrix mat4*/
var mvMatrix;

/** @global Dimension of grid, or number of sqrt(circles) */
var gridSize = 10;

/** @global 2D array of current circle positions*/
var grid = [];

/** @global 2D array of where circles will be after movement*/
var nextGrid = [];

/** @global 2D array of directions that circles will move in*/
var gridDirs = [];

/** @global Progress of circle motion*/
var movementProgress = 0;

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


  setupBuffers();
  setupGrid();
  // console.log(grid);

  shader = new Shader();
  shader.load( "shader-vert", "shader-frag" );

  mvMatrix = mat4.create();




  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);

  tick();
}

/**
 * Generates vertices in the shape of a circle in the [-1,1] range
 * @return {number} array of vertices
 */
function generateCircle() {
  var sections = 16;
  var verts = [];
    for ( var i = 0; i < sections; i++ ) {
      verts.push( 0.0 );
      verts.push( 0.0 );
      verts.push( 0.0 );

      verts.push( Math.cos( i * Math.PI * 2 / sections ) );
      verts.push( Math.sin( i * Math.PI * 2 / sections ) );
      verts.push( 0 );

      verts.push( Math.cos( (i+1) * Math.PI * 2 / sections ) );
      verts.push( Math.sin( (i+1) * Math.PI * 2 / sections ) );
      verts.push( 0 );
    }
    return verts;
}

/**
 * Generates an array of vertices in the shape of the block I. Must be called twice for outline and fill.
 * @param {number=} border how far to inset the vertices, should be 0 for outline and 0.05309734513 *2 for fill
 * @param {number=} time The current time.
 * @param {number=} intensity The intensity of the sine wave animation
 * @return {number} array of vertices in the shape of an I.
 */
function generateI(border=0.05309734513 *2, time = 0, sineIntensity = 0.2 ) {

  var heightRatio = 226/327;

  var borderX = border;
  var borderY = border * heightRatio;

  // var borderY = 0;
  var topHeight = 0.2691131498*2;
  var topOffset = 0.1896024465 * 2;
  var midWidth = 0.5575221239;
  var midHeight = 0.4556574924;

  var blockVertices = [
          // top left corner
         -1.0 + borderX,      1.0 - borderY,  0.0,
         -1.0 + borderX,      midHeight + borderY, 0.0,
         -midWidth + borderX, midHeight + borderY, 0.0,

          // top left middle tri
          -1.0 + borderX,      1.0 - borderY,  0.0,
          -midWidth + borderX, midHeight + borderY, 0.0,
           1.0 - borderX,    1.0 - borderY,  0.0,

         // top right middle tri
         -midWidth + borderX, midHeight + borderY, 0.0,
          midWidth - borderX, midHeight + borderY, 0.0,
          1.0 - borderX,    1.0 - borderY,  0.0,

          // top right corner
          1.0 - borderX,      1.0 - borderY,  0.0,
          1.0 - borderX,      midHeight + borderY, 0.0,
          midWidth - borderX, midHeight + borderY, 0.0,

          // middle left tri
          -midWidth + borderX,  midHeight + borderY,  0.0,
          -midWidth + borderX, -midHeight - borderY,  0.0,
           midWidth - borderX, -midHeight - borderY,  0.0,

          // middle right tri
          -midWidth + borderX,  midHeight + borderY,  0.0,
           midWidth - borderX,  midHeight + borderY,  0.0,
           midWidth - borderX, -midHeight - borderY,  0.0,

           // bottom left corner
          -1.0 + borderX,      -1.0 + borderY,  0.0,
          -1.0 + borderX,      -midHeight - borderY, 0.0,
          -midWidth + borderX, -midHeight - borderY, 0.0,

          // bottom left middle tri
          -1.0 + borderX,      -1.0 + borderY,  0.0,
          -midWidth + borderX, -midHeight - borderY, 0.0,
           1.0 - borderX,    -1.0 + borderY,  0.0,

         // bottom right middle tri
         -midWidth + borderX, -midHeight - borderY, 0.0,
          midWidth - borderX, -midHeight - borderY, 0.0,
          1.0 - borderX,    -1.0 + borderY,  0.0,

          // bottom right corner
          1.0 - borderX,      -1.0 + borderY,  0.0,
          1.0 - borderX,      -midHeight - borderY, 0.0,
          midWidth - borderX, -midHeight - borderY, 0.0,
  ];


  // scale blockVertices to proper proportion
  for ( var i = 0; i < blockVertices.length; i+=3 ) {
    blockVertices[i] *= heightRatio;
    blockVertices[i] += Math.sin(blockVertices[i+1] + time) * sineIntensity;
    // blockVertices[i] *= blockVertices[i] * blockVertices[i];
    // blockVertices[i] *= heightRatio;

  }
  return blockVertices;
}

/**
 * Sets up 2D array of grid values, for whether there is a circle there or not.
 * Also calls generateDirs() to generate movement pattern
 */
function setupGrid() {
  for ( var i = 0; i < gridSize; i++ ) {
    grid.push([]);
    gridDirs.push([]);
    nextGrid.push([]);
    for ( var j = 0; j < gridSize; j++ ) {
      grid[i].push( Math.round(  Math.random() - 0 ));
      nextGrid[i].push( grid[i][j] );

      // gridDirs[i].push( Math.round(  Math.random()*4 - 1 ));
      gridDirs[i].push(-1);
    }
  }

  generateDirs();
}


/**
 * Sets up 2D array of direction values for movement pattern.
 * Randomly checks directions, so that circles can move into a vacant square.
 * -1 = no movement
 *  0 = up
 *  1 = right
 *  2 = down
 *  3 = left
 */
function generateDirs() {

  // copy nextGrid into grid
  for ( var i = 0; i < gridSize; i++ ) {
    for ( var j = 0; j < gridSize; j++ ) {
      grid[i][j] = nextGrid[i][j];
    }
  }

  for ( var i = 0; i < gridSize; i++ ) {
    for ( var j = 0; j < gridSize; j++ ) {

      if ( grid[i][j] == 0 ) continue;

      var startDir = Math.round(Math.random() * 3);
      // console.log(startDir);
      var dirsChecked = 0;

      gridDirs[i][j] = -1;


      while ( dirsChecked < 4 ) {
        var dirIndex = (startDir + dirsChecked) % 4;
        // console.log(dirIndex);

        if ( dirIndex == 0 ) {
          if ( j < gridSize - 1 && nextGrid[i][j + 1] == 0  ) {
            gridDirs[i][j] = 0;
            nextGrid[i][j + 1] = 1;
            nextGrid[i][j] = 0;
            break;
          }
          dirsChecked += 1;
          dirIndex = (startDir + dirsChecked) % 4;
        }
        if ( dirIndex == 1 ) {
          if ( i < gridSize - 1 && nextGrid[i+1][j] == 0 ) {
            gridDirs[i][j] = 1;
            nextGrid[i+1][j] = 1;
            nextGrid[i][j] = 0;

            break;
          }
          dirsChecked += 1;
          dirIndex = (startDir + dirsChecked) % 4;
        }
        if ( dirIndex == 2 )  {
          if ( j > 0 && nextGrid[i][j-1] == 0 ) {
            gridDirs[i][j] = 2;
            nextGrid[i][j-1] = 1;
            nextGrid[i][j] = 0;

            break;
          }
          dirsChecked += 1;
          dirIndex = (startDir + dirsChecked) % 4;
        }
        if ( dirIndex == 3 )  {
          if ( i > 0 && nextGrid[i-1][j] == 0 ) {
            gridDirs[i][j] = 3;
            nextGrid[i-1][j] = 1;
            nextGrid[i][j] = 0;

            break;
          }
          dirsChecked += 1;
          dirIndex = (startDir + dirsChecked) % 4;
        }
      }
    }
  }


}


/**
 * Set up WebGL buffers and prepare for rendering
 */
function setupBuffers() {

  var innerBlockVertices = generateI();
  var outerBlockVertices = generateI(0);


  // Set up buffer for fill
  innerVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, innerVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(innerBlockVertices), gl.DYNAMIC_DRAW);
  innerVertexPositionBuffer.itemSize = 3;
  innerVertexPositionBuffer.numberOfItems = Math.floor(innerBlockVertices.length / 3);


  // Set up buffer for outline
  outerVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, outerVertexPositionBuffer);

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(outerBlockVertices), gl.DYNAMIC_DRAW);
  outerVertexPositionBuffer.itemSize = 3;
  outerVertexPositionBuffer.numberOfItems = Math.floor(outerBlockVertices.length / 3);

  // Set up buffer for circle
  circleVertices = generateCircle();

  circleVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, circleVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(circleVertices), gl.DYNAMIC_DRAW);
  circleVertexPositionBuffer.itemSize = 3;
  circleVertexPositionBuffer.numberOfItems = Math.floor(circleVertices.length / 3);

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
function drawI( time ) {
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


  var delta = time - previousTime;
  // console.log(delta);

  let outlineColor = new Array(0.07, 0.16, 0.29, 1);
  let fillColor = new Array(0.91, 0.29, 0.15, 1);

  let uColorLoc = shader.getUniform( "uColor");
  gl.uniform4fv(uColorLoc, fillColor);


  // get values from HTML sliders
  var rotSpeed = document.getElementById("I-rot-speed").value / 100;
  var waveIntensity = document.getElementById("wave-intensity").value / 100;
  var scaleIntensity = document.getElementById("scale-intensity").value / 100;
  var overallScale = document.getElementById("overall-scale").value / 100;

  // Calculate new rotation
  currentRotation += Math.PI * rotSpeed * 0.2 * delta;
  mat4.fromZRotation( mvMatrix, currentRotation );


  // increment current scale and recalculate scale vector
  currentScale += delta;
  var scaleVec = vec3.fromValues( 1*overallScale,  (1+ Math.sin(currentScale) * scaleIntensity) * overallScale , 1);
  mat4.scale( mvMatrix, mvMatrix, scaleVec );


  gl.uniformMatrix4fv(shader.getUniform( "uModelMat"), false, mvMatrix);

  attribVertPos = shader.getAttributeLocation("aVertexPosition");
  gl.bindBuffer(gl.ARRAY_BUFFER, innerVertexPositionBuffer);


  // update data
  var innerBlockVertices = generateI( border=0.05309734513 *2, time=time, intensity=waveIntensity );
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(innerBlockVertices), gl.DYNAMIC_DRAW);


  gl.vertexAttribPointer( attribVertPos, innerVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, innerVertexPositionBuffer.numberOfItems);



  gl.uniform4fv(uColorLoc, outlineColor );

  // attribVertPos = shader.getAttributeLocation("aVertexPosition");
  gl.bindBuffer(gl.ARRAY_BUFFER, outerVertexPositionBuffer);

  // update data
  var outerBlockVertices = generateI(0, time=time, intensity=waveIntensity);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(outerBlockVertices), gl.DYNAMIC_DRAW);


  gl.vertexAttribPointer( attribVertPos, outerVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, outerVertexPositionBuffer.numberOfItems);
}


/**
 * Returns a new grid index given a grid position and a movement direction
 * @param {number} pos current position
 * @param {number} dir movement direction
 * @return {number} new position
 */
function coordFromDir( pos, dir ) {
  // return pos;
  if ( dir == -1 )     {return [pos[0], pos[1]];}
  else if ( dir == 0 ) {return [pos[0], pos[1] + 1];}
  else if ( dir == 1 ) {return [pos[0] + 1, pos[1]];}
  else if ( dir == 2 ) {return [pos[0], pos[1]-1];}
  else if ( dir == 3 ) {return [pos[0] - 1, pos[1]];}
}

/**
 * Draw call that draws grid of circles moving by applying matrix transformations to model and draws model in frame
 * @param {number} time current time
 */
function drawOther(time) {
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var delta = time - previousTime;

  movementProgress += delta * 0.5;

  if ( movementProgress >= 1 ) {
    generateDirs();
    movementProgress = 0;
  }

  mvMatrix = mat4.create();


  let uColorLoc = shader.getUniform( "uColor");
  let color = new Array(1, 1, 1, 1);

  gl.uniform4fv(uColorLoc, color);


  // translate(mvMatrix, mvMatrix, v)


  attribVertPos = shader.getAttributeLocation("aVertexPosition");


  for ( var i = 0; i < gridSize; i++ ) {
    for ( var j = 0; j < gridSize; j++ ) {
      if ( grid[i][j] ) {
        // if ( 1 ) {

        var pos = [i, j];
        var newPos = coordFromDir( pos, gridDirs[i][j] );

        var interpPos = [ interp(pos[0], newPos[0], movementProgress), interp(pos[1], newPos[1], movementProgress) ];
        // var interpPos = [ newPos[0], newPos[1] ];


        var transVec = vec3.fromValues( ((2*interpPos[0] +1)/gridSize) - 1 , ((2*interpPos[1]+1)/gridSize) - 1, 0);
        var transMatrix = mat4.create();


        //
        mat4.translate(transMatrix, mvMatrix, transVec);

        // var rotMatrix = mat4.create();
        // mat4.fromZRotation( rotMatrix, interp(0, Math.PI * 2, movementProgress) );
        // mat4.mul(transMatrix, transMatrix, rotMatrix );


        var scaleAmount = 0.5/gridSize;
        var scaleVec = vec3.fromValues( scaleAmount,  scaleAmount, 1);
        mat4.scale( transMatrix, transMatrix, scaleVec );


        gl.uniformMatrix4fv(shader.getUniform( "uModelMat"), false, transMatrix);


        let color = new Array(interpPos[0]/gridSize, interpPos[1]/gridSize, 1, 1);

        gl.uniform4fv(uColorLoc, color);

        // Draw circle
        gl.bindBuffer(gl.ARRAY_BUFFER, circleVertexPositionBuffer);
        gl.vertexAttribPointer( attribVertPos, circleVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, circleVertexPositionBuffer.numberOfItems);
      }
    }
  }
  return;
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

    var radios = document.getElementsByName('render-mode');

    if (radios[0].checked) {
      drawI(now);
    } else {
      drawOther(now);
    }
    previousTime = now;
}
