/*
    Copyright (c) <2012-2015> Ed Angel and Dave Shreiner
    Code sample for CSCI 2408 Computer Graphics Fall 2022 
    (c)2022 by Araz Yusubov 
    DISCLAIMER: All code examples we will look at are quick hacks intended to present working prototypes.
    Hence they do not follow best practice of programming or software engineering.    
*/
"use strict";
// The purpose of "use strict" is to indicate that the code should be executed in "strict mode".
// With strict mode, you can not, for example, use undeclared variables.

var canvas;
var gl;

var fileopen;
var checkbox;

// An Object instance to load and display a 3D model
var model;

// An array for storing all triangle vertices
var triangleVertices;
var triangleColors;

var matrixCTM = mat4();
var martixCTMLocation;

// Animation parameter
var delay = 1000;

var bufferVertexId;
var bufferColorId;
var vPosition;
var vColor;

window.onload = init;
window.onkeydown = onKeyDown;

// Object class to load and display a 3D model
class Object {
    // Normalized light vector to calculate shades
    lightVector;
    // Tranformation parameters
    scaleFactor;
    rotateY;
    rotateX;
    rotateZ;
    // Rendering parameters
    setPainter;
    setCulling;
    renderMode;
    // Arrays to store vertices and faces
    vertices;
    faces;
    // Array to store transformed vertices
    #vertices;
    // File reader to read OBJ files
    filereader;
    // Callback function to be called after loading ended
    onloadend;

    #onFileLoadEnd(e) {
        console.log("onLoadEnd... Begin");
        // Read object specifications from the file
        var lines = e.target.result.split('\n');
        // Clear all the previous vertex and face data
        this.vertices = [];
        this.#vertices = [];
        this.faces = [];
        // Fetch the  and face data from the file
        for (var i = 0; i < lines.length; i++) {
            //var parts = lines[i].split(' ');
            var parts = lines[i].trim().split(/\s+/); // Split by multiple spaces
            switch (parts[0]) {
                case 'v': // Add a new vertex
                    // this would lose context here and point at the filereader if bind not used
                    this.vertices.push([Number(parts[1]), Number(parts[2]), Number(parts[3])]);
                    break;
                case 'f': // Add a new face i.e. triangle(s)
                case 'fo': // Face outline (fo) is deprecated
                    var face = [];
                    face.push(Number(parts[1]-1));
                    // Create trangle fans for all polygons
                    for (var j = 3; j < parts.length; j++) {
                        face = [];
                        face.push(Number(parts[1]-1));
                        face.push(Number(parts[j-1]-1));
                        face.push(Number(parts[j-0]-1));
                        this.faces.push(face);
                    }
                    break;
            } 
        }
        console.log("onLoadEnd... End");
        // Call the callback function
        if (typeof this.onloadend == "function") {
            this.onloadend();
        }
    }

    constructor() {
        this.vertices = new Array();
        this.faces = new Array();
        this.#vertices = new Array();
        this.filereader = new FileReader();
        this.scaleFactor = 1;
        this.rotateY = 0;
        this.rotateX = 0;
        this.rotateZ = 0;
        this.lightVector = [-1, 0, 0];
        this.setPainter = false;
        this.setCulling = false;
        this.renderMode = 'fill'
        // Once the OBJ file is loaded draw it on the canvas
        this.filereader.onloadend = this.#onFileLoadEnd.bind(this);
    }

    LoadFromFile(filename) {
        this.filereader.readAsText(filename);
    }
    
}

// Main program section

// Define vertices and colors for a default tetrahedron
var vTetra = [
    vec4( 0.0,-0.5, 0.5, 1.0),
    vec4(-0.5,-0.5,-0.5, 1.0),
    vec4( 0.5,-0.5,-0.5, 1.0),
    vec4( 0.0, 0.5, 0.0, 1.0)
]

var cTetra = [
    vec4( 1.0, 0.0, 0.0, 1.0),
    vec4( 0.0, 1.0, 0.0, 1.0),
    vec4( 0.0, 0.0, 1.0, 1.0)
]

function init() {
    // Get reference to the file input
    fileopen = document.getElementById("file-open");
    if (fileopen) {
        //Set a listener for the selected file change event
        fileopen.onchange = onFileChange;
        console.log("init... Okay");
    }
    // Get reference to the Culling checkbox
    checkbox = document.getElementById("culling-toggle");
    checkbox.onchange = onCheckChange;
    checkbox = document.getElementById("painter-toggle");
    checkbox.onchange = onCheckChange;
    // Get reference to the rendering mode radio boxe
    document.getElementById("line-toggle").onchange = onRadioChange;
    document.getElementById("fill-toggle").onchange = onRadioChange;
    document.getElementById("flat-toggle").onchange = onRadioChange;
    // Create an object to load 3D models
    model = new Object();
    model.onloadend = onLoadEnd;

    // Get reference to the WebGL context of the canvas
    canvas = document.getElementById( "gl-canvas" );

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    //
    //  Configure WebGL
    //

    // Sets the viewport, which specifies the affine transformation of x and y 
    // from normalized device coordinates to window coordinates. 
    //gl.viewport( 0, 0, canvas.width, canvas.height );

    // Set the color value used when clearing color buffers.
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );

    //  Load shaders and initialize attribute buffers
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    // Define homogeneous coordinates for each vertex.
    triangleVertices = [
        vTetra[0], vTetra[1], vTetra[2],
        vTetra[1], vTetra[3], vTetra[2],
        vTetra[0], vTetra[2], vTetra[3],
        vTetra[0], vTetra[3], vTetra[1],
    ];

    triangleColors = [
        cTetra[0], cTetra[1], cTetra[2],
        cTetra[0], cTetra[1], cTetra[2],
        cTetra[0], cTetra[1], cTetra[2],
        cTetra[0], cTetra[1], cTetra[2]
    ]
   
    // Load the vertex data into the GPU.

    // Create and initialize a WebGL buffer storing data.
    bufferVertexId = gl.createBuffer();
    
    // Bind the given WebGL buffer to the ARRAY_BUFFER target as a buffer containing vertex attributes. 
    gl.bindBuffer( gl.ARRAY_BUFFER, bufferVertexId );

    // Initialize and create the buffer object's data store.
    gl.bufferData( gl.ARRAY_BUFFER, flatten(triangleVertices), gl.STATIC_DRAW );

    // Associate our shader variables with our data buffer.

    // Get the location of an attribute variable in the WebGL program.
    vPosition = gl.getAttribLocation( program, "vPosition" );

    // Bind the buffer to a generic vertex attribute of the current vertex buffer object (VBO).
    gl.vertexAttribPointer( vPosition, 4, gl.FLOAT, false, 0, 0 );

    // Turn on the generic vertex attribute array at the specified index into the list of attribute arrays. 
    gl.enableVertexAttribArray( vPosition );

    // Get the location(s) of the uniform variable(s) which is part of the WebGL program.
    martixCTMLocation = gl.getUniformLocation(program, "ctm");

    // Load the color data into the GPU.
    bufferColorId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferColorId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(triangleColors), gl.STATIC_DRAW);
    
    // Associate our shader variable with our data buffer.
    vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);    

    // Tell the browser that you wish to perform an animation 
    // and requests that the browser calls render to update an animation before the next repaint.
    render();
    //window.requestAnimationFrame(render);
};


function render() {
    // Clear color buffer to preset values.
    //gl.clear( gl.COLOR_BUFFER_BIT );
    //gl.clear( gl.DEPTH_BUFFER_BIT );
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


    // Activate culling of polygons.
    if (model.setCulling) {
        gl.enable(gl.CULL_FACE)
        gl.cullFace(gl.FRONT);
    } else {
        gl.disable(gl.CULL_FACE);
    }

    if (model.setPainter) {
        gl.enable(gl.DEPTH_TEST)
    } else {
        gl.disable(gl.DEPTH_TEST);
    }

    // Update the current transformation matrix.
    // Start with identity matrix.
    matrixCTM = mat4();
    // Apply uniform scaling.
    matrixCTM = mult(matrixCTM, scalem(model.scaleFactor, model.scaleFactor, model.scaleFactor));
    // Apply rotations
    //matrixCTM = mult(matrixCTM, rotate(model.rotateX, vec3(1.0, 0.0, 0.0)));
    matrixCTM = mult(matrixCTM, rotateX(model.rotateX));
    matrixCTM = mult(matrixCTM, rotateY(model.rotateY));
    matrixCTM = mult(matrixCTM, rotateZ(model.rotateZ));

    // Specify value of uniform variable.
    gl.uniformMatrix4fv(martixCTMLocation, false, flatten(matrixCTM));

    // Render primitives from array data.
    switch (model.renderMode) {
        case 'line':
            gl.drawArrays( gl.LINES, 0, triangleVertices.length );
            break;
        default:
            gl.drawArrays( gl.TRIANGLES, 0, triangleVertices.length );
            break;
    }

    // Tell the browser that you wish to perform an animation.
    //window.requestAnimationFrame(render);
    /*
    setTimeout(
        function () {
            window.requestAnimationFrame(render)
        }, delay
    );
    */
}

function onFileChange(e) {
    console.log("onFileChange... Begin");
    // Get the name of the selected file
    const files = fileopen.files;
    // Get the file name extension (pop removes the last element in the array)
    let fileext = files[0].name.split('.').pop().toLowerCase();
    if (fileext == "obj") {
        model.LoadFromFile(files[0]);
    }
    console.log("onFileChange... End");
}

function onCheckChange(e) {
    console.log("onCheckChange... Begin");
    // Remember the status of the checkbox
    console.log(e.target.id, e.target.checked);
    switch (e.target.id) {
        case 'painter-toggle': 
            model.setPainter = e.target.checked;
            break;
        case 'culling-toggle': 
            model.setCulling = e.target.checked;
            break;
    } 
    render();
    console.log("onCheckChange... End");
}

function onRadioChange(e) {
    console.log("onRadioChange... Begin");
    // Remember the status of the checkbox
    console.log(e.target.id, e.target.checked, e.target.value);
    if (e.target.checked) {
        model.renderMode = e.target.value;
    } 
    render();
    console.log("onRadioChange... End");
}

function onLoadEnd() {
    // Update the triangle data from the model
    triangleVertices = [];
    triangleColors = [];
    for (var i = 0; i < model.faces.length; i++) {
        let face = model.faces[i];
        for (var j=0; j < 3; j++) {
            let v = model.vertices[face[j]];
            triangleVertices.push(vec4(v[0], v[1], v[2], 1.0));
        }
        triangleColors.push(cTetra[0], cTetra[1], cTetra[2]);
    }
    
    // Bind the given WebGL buffer to the ARRAY_BUFFER target as a buffer containing vertex attributes. 
    gl.bindBuffer( gl.ARRAY_BUFFER, bufferVertexId );
    // Initialize and create the buffer object's data store.
    gl.bufferData( gl.ARRAY_BUFFER, flatten(triangleVertices), gl.STATIC_DRAW );

    // Load the vertex color data into the GPU.
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferColorId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(triangleColors), gl.STATIC_DRAW);

    // Render the canvas
    render();
}

function onKeyDown(e) {
    //console.log("onKeyDown..." + e.key);
    switch (e.key) {
        // Uniformly scale the model up/down
        case '+': 
            model.scaleFactor *= 1.1;
            break;
        case '-': 
            model.scaleFactor /= 1.1;
            break;
        case 'ArrowRight':
            model.rotateY += 1.0;
            break;
        case 'ArrowLeft':
            model.rotateY -= 1.0;
            break;
        case 'ArrowUp':
            model.rotateX += 1.0;
            break;
        case 'ArrowDown':
            model.rotateX -= 1.0;
            break;
        case 'PageUp':
            model.rotateZ += 1.0;
            break;
        case 'PageDown':
            model.rotateZ -= 1.0;
            break;
    }
    render();
}
