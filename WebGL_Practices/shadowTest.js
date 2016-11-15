
var gl;

var xAxis = 0;
var yAxis = 1;
var zAxis = 2;

var eyetheta = 0;
var eyePhi = 0;
var eyeRadius = 3;


var axis = 0;
var theta = [ 0, 0, 0 ];
var paused = 0;
var depthTest = 1;

// event handlers for mouse input (borrowed from "Learning WebGL" lesson 11)
var mouseDown = false;
var lastMouseX = null;
var lastMouseY = null;



var moonRotationMatrix = mat4();

function handleMouseDown(event) {
    mouseDown = true;
    lastMouseX = event.clientX;
	lastMouseY = event.clientY;
}

function handleMouseUp(event) {
    mouseDown = false;
}

function handleMouseWheel(event)
{
	if (event.wheelDelta < 0) eyeRadius += 0.05;
	else if (event.wheelDelta > 0 ) eyeRadius -= 0.05;
}



function handleMouseMove(event) {
    if (!mouseDown) {
      return;
    }

    var newX = event.clientX;
    var newY = event.clientY;



    if (newX > lastMouseX)
    	eyetheta += 0.01;
    else if (newX < lastMouseX)
    	eyetheta -= 0.01;
    if (newY > lastMouseY && eyePhi < Math.PI*85.0/180.0)
    	eyePhi += 0.01;
    else if (newY < lastMouseY && eyePhi > Math.PI*(-15.0)/180)
    	eyePhi -= 0.01;

    // var deltaX = newX - lastMouseX;
    // var newRotationMatrix = rotate(deltaX/10, 0, 1, 0);

    // var deltaY = newY - lastMouseY;
    // newRotationMatrix = mult(rotate(deltaY/10, 1, 0, 0), newRotationMatrix);

    // moonRotationMatrix = mult(newRotationMatrix, moonRotationMatrix);

    lastMouseX = newX
    lastMouseY = newY;
}

// event handlers for button clicks
function rotateX() {
	paused = 0;
    axis = xAxis;
};
function rotateY() {
	paused = 0;
	axis = yAxis;
};
function rotateZ() {
	paused = 0;
	axis = zAxis;
};

// Shader Variables
var program;
var shadowProgram;

// ModelView and Projection matrices
var modelingLoc, viewingLoc, projectionLoc, eyePositionLoc, shadowViewingLoc, samplerLoc;
var modeling, viewing, projection;
var vPosition, vColor, vNormal;

// shadow MVP LOC
var smLoc, svLoc, spLoc;
var sviewing;
var depthTexture,framebuffer;
var size = 256;
var shadowvPosition;

var numVertices  = 0;

var pointsArray = [];
var colorsArray = [];
var normalsArray = [];

var planePointsArray = [];
var planeColorsArray = [];
var planeNormalsArray = [];

var eyePosition   = vec4( 0.0, 0.0, -3.0, 1.0 );
var lightPosition = vec4( 10.0, 10.0, 0.0, 1.0 );

var materialAmbient = vec4( 0.0, 0.0, 0.0, 1.0 );
var materialDiffuse = vec4( 0.8, 0.8, 0.8, 1.0);
var materialSpecular = vec4( 0.8, 0.8, 0.8, 1.0 );
var materialShininess = 12.0;

function spherePoint(theta, phi)
{
	var V = vec4(Math.cos(theta)*Math.cos(phi), Math.sin(phi), Math.sin(theta)*Math.cos(phi), 0.0);
	var smallV = scalev(0.5, V); // scale the sphere to the range of [-0.5, 0.5]
	smallV[3] = 1.0;
	normalize(V, 1);
	pointsArray.push(smallV);
	normalsArray.push(V);
	colorsArray.push(vec4(1.0, 0.0, 0.0, 1.0));
}

function sphere()
{
	var step = 15;
	var rP1, rP2, rT1, rT2;
	var phi, theta, lastPhi=-90, lastTheta=0;
	
	numVertices = 0;
	
	for (phi=-90+step; phi<=90; phi+=step) {
		rP1 = lastPhi / 180.0 * Math.PI;
		rP2 = phi / 180.0 * Math.PI;

		for (theta=step; theta<=360; theta+=step) {
			rT1 = lastTheta / 180.0 * Math.PI;
			rT2 = theta / 180.0 * Math.PI;
			
			// first triangle, may be skipped for the south pole
			if (lastPhi != -90) {
				spherePoint(rT1, rP1, pointsArray, colorsArray, normalsArray);
				spherePoint(rT2, rP1, pointsArray, colorsArray, normalsArray);
				spherePoint(rT1, rP2, pointsArray, colorsArray, normalsArray);
				numVertices += 3;
			}
			
			// second triangle, may be skipped for the north pole
			if (phi != 90) {
				spherePoint(rT2, rP2, pointsArray, colorsArray, normalsArray);
				spherePoint(rT1, rP2, pointsArray, colorsArray, normalsArray);
				spherePoint(rT2, rP1, pointsArray, colorsArray, normalsArray);
				numVertices += 3;
			}
			lastTheta = theta;
		}			
		lastPhi = phi;		
	}
}
function plane()
{
	var i;	
	pointsArray.push(vec4(15 , -1.5 , -15 , 1.0));
	pointsArray.push(vec4(-15 , -1.5 , -15 , 1.0));
	pointsArray.push(vec4(15, -1.5 , 15 , 1.0));
	pointsArray.push(vec4(-15 , -1.5 , -15 , 1.0));
	pointsArray.push(vec4(15 , -1.5 , 15 , 1.0));
	pointsArray.push(vec4(-15 , -1.5 , 15 , 1.0));

	for (i = 0 ; i<6;i++)
	{
		normalsArray.push(vec4(0.0 , 1.0, 0.0, 0.0));
		
		colorsArray.push(vec4(1.0, 0.25, 0.0, 1.0));
	}
	numVertices += 6;
}


window.onload = function init()
{
    var canvas = document.getElementById( "gl-canvas" );
    
    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    //
    //  Configure WebGL
    //
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );
    
    //  Load shaders and initialize attribute buffers
    
    program = initShaders( gl, "vertex-shader", "fragment-shader" );
    shadowProgram = initShaders(gl, "RTT-vertex", "RTT-fragment");
    gl.useProgram( program );

	// Generate pointsArray[], colorsArray[] and normalsArray[] from vertices[] and vertexColors[].
	// We don't use indices and ELEMENT_ARRAY_BUFFER (as in previous example)
	// because we need to assign different face normals to shared vertices.
	//colorCube();
	sphere();
    plane();
    // vertex array attribute buffer
    
    var vBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(pointsArray), gl.STATIC_DRAW );

    vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 4, gl.FLOAT, false, 0, 0 );
    //gl.enableVertexAttribArray( vPosition );

    // color array atrribute buffer
    
    var cBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(colorsArray), gl.STATIC_DRAW );

    vColor = gl.getAttribLocation( program, "vColor" );
    gl.vertexAttribPointer( vColor, 4, gl.FLOAT, false, 0, 0 );
    //gl.enableVertexAttribArray( vColor );

    // normal array atrribute buffer

    var nBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, nBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(normalsArray), gl.STATIC_DRAW );
    
    vNormal = gl.getAttribLocation( program, "vNormal" );
    gl.vertexAttribPointer( vNormal, 4, gl.FLOAT, false, 0, 0 );
    //gl.enableVertexAttribArray( vNormal );


    //shadow buffers
    gl.useProgram(shadowProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    shadowvPosition = gl.getAttribLocation( shadowProgram, "vPosition");
    gl.vertexAttribPointer(shadowvPosition, 4, gl.FLOAT, false ,0 ,0 );
    



    // shadow framebuffer
    // Query the extension
	var depthTextureExt = gl.getExtension("WEBKIT_WEBGL_depth_texture"); // Or browser-appropriate prefix
	if(!depthTextureExt) { doSomeFallbackInstead(); return; }


	// Create a color texture
	var colorTexture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, colorTexture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

	// Create the depth texture
	depthTexture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, depthTexture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);

	framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);





	// uniform variables in shaders
    modelingLoc   = gl.getUniformLocation(program, "modelingMatrix"); 
    viewingLoc    = gl.getUniformLocation(program, "viewingMatrix"); 
    projectionLoc = gl.getUniformLocation(program, "projectionMatrix"); 
    eyePositionLoc = gl.getUniformLocation(program, "eyePosition");
    shadowViewingLoc = gl.getUniformLocation(program, "sviewingMatrix");
    samplerLoc = gl.getUniformLocation(program, "shadowSampler");

    gl.useProgram(program);
    gl.uniform4fv( gl.getUniformLocation(program, "lightPosition"), 
       flatten(lightPosition) );
    gl.uniform4fv( gl.getUniformLocation(program, "materialAmbient"),
       flatten(materialAmbient));
    gl.uniform4fv( gl.getUniformLocation(program, "materialDiffuse"),
       flatten(materialDiffuse) );
    gl.uniform4fv( gl.getUniformLocation(program, "materialSpecular"), 
       flatten(materialSpecular) );	       
    gl.uniform1f( gl.getUniformLocation(program, "shininess"), materialShininess);

    gl.useProgram(shadowProgram);
    // uniform variables in shadow shader
    smLoc = gl.getUniformLocation(shadowProgram, "modelingMatrix");
    svLoc = gl.getUniformLocation(shadowProgram, "viewingMatrix");
    spLoc = gl.getUniformLocation(shadowProgram, "projectionMatrix");




	// event handlers for mouse input (borrowed from "Learning WebGL" lesson 11)
	canvas.onmousedown = handleMouseDown;
    document.onmouseup = handleMouseUp;
    document.onmousemove = handleMouseMove;
    document.onmousewheel = handleMouseWheel;

    render();
};

function render() {
	if (depthTest) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
	modeling = translate(0,0,0);
	projection = perspective(60, 1.0, 1.0, 30.0);
	gl.useProgram(shadowProgram)
	gl.bindTexture(gl.TEXTURE_2D, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

	gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
	// render Shadow
	sviewing = lookAt(vec3(lightPosition), [0,0,0], [0,1,0]);

	gl.enableVertexAttribArray(shadowvPosition);

	gl.uniformMatrix4fv( smLoc,   0, flatten(modeling) );
    gl.uniformMatrix4fv( svLoc,    0, flatten(sviewing) );
	gl.uniformMatrix4fv( spLoc, 0, flatten(projection) );


	gl.drawArrays(gl.TRIANGLES, 0, numVertices);


	// modeling = mult(rotate(theta[xAxis], 1, 0, 0),
	//                mult(rotate(theta[yAxis], 0, 1, 0),rotate(theta[zAxis], 0, 0, 1)));

	// if (paused)	modeling = moonRotationMatrix;
	gl.useProgram(program);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	gl.enableVertexAttribArray( vPosition );
	gl.enableVertexAttribArray( vColor );
	gl.enableVertexAttribArray( vNormal );

	eyePosition = vec4(Math.cos(eyePhi)*Math.cos(eyetheta)*eyeRadius,
						Math.sin(eyePhi)*eyeRadius,
						Math.cos(eyePhi)*Math.sin(eyetheta)*eyeRadius);


	
	viewing = lookAt(vec3(eyePosition), [0,0,0], [0,1,0]);



    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

    //if (! paused) theta[axis] += 2.0;


	// uniform in shader
    gl.uniform4fv( eyePositionLoc , flatten(eyePosition) );
    gl.bindTexture(gl.TEXTURE_2D,depthTexture);
    gl.uniform1i(samplerLoc,false);
    gl.uniformMatrix4fv( shadowViewingLoc, 0, flatten(sviewing));
    gl.uniformMatrix4fv( modelingLoc,   0, flatten(modeling) );
    gl.uniformMatrix4fv( viewingLoc,    0, flatten(viewing) );
	gl.uniformMatrix4fv( projectionLoc, 0, flatten(projection) );
  
    gl.drawArrays( gl.TRIANGLES, 0, numVertices );

    requestAnimFrame( render );

}
