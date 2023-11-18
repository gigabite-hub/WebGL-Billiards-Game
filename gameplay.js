const canvas = document.getElementById('billiardsCanvas');
const gl = canvas.getContext('webgl');

if (!gl) {
    console.error('Unable to initialize WebGL. Your browser may not support it.');
}

// Vertex shader program
const vsSource = `
    attribute vec4 aVertexPosition;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    void main(void) {
        gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
            }
    `;

// Fragment shader program
const fsSource = `
    precision mediump float;
    void main(void) {
        gl_FragColor = vec4(0.0, 0.5, 0.0, 1.0); // Green color for the table
            }
    `;

function initShaderProgram(gl, vsSource, fsSource) {
    // Create shaders
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    // Create shader program
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
}

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

const programInfo = {
    program: shaderProgram,
    attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
    },
    uniformLocations: {
        projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
        modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
    },
};

// Define the table vertices
const tableVertices = new Float32Array([
    0.0, 0.0,
    84.0, 0.0,
    84.0, 56.0,
    0.0, 56.0,
]);

// Define the pocket positions and radius
const pockets = [
    { x: 2, y: 2, radius: 2 },
    { x: 82, y: 2, radius: 2 },
    { x: 82, y: 54, radius: 2 },
    { x: 2, y: 54, radius: 2 },
];

// Define the initial positions and velocities of the balls
const cueBall = {
    x: 70,
    y: 28,
    radius: 1,
    velocity: { x: -2, y: 1 }, // Adjust initial velocity as needed
};

const frontBalls = [
    { x: 40, y: 28, radius: 1, velocity: { x: 1, y: 0 } },
    { x: 42, y: 27, radius: 1, velocity: { x: 1, y: 0.5 } },
    { x: 42, y: 29, radius: 1, velocity: { x: 1, y: -0.5 } },
];

const allBalls = [cueBall, ...frontBalls];

// Add the remaining 12 balls with random positions and velocities
for (let i = 0; i < 12; i++) {
    allBalls.push({
        x: Math.random() * 70, // Adjust the range as needed
        y: Math.random() * 56, // Adjust the range as needed
        radius: 1,
        velocity: { x: Math.random() - 0.5, y: Math.random() - 0.5 }, // Adjust initial velocity as needed
    });
}

// Define drag force parameters
const dragCoefficient = 0.05; // Adjust the drag coefficient as needed

// Create buffers for table and pockets
const tableBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, tableBuffer);
gl.bufferData(gl.ARRAY_BUFFER, tableVertices, gl.STATIC_DRAW);

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1.0, -1.0,
    1.0, -1.0,
    1.0, 1.0,
    -1.0, 1.0,
]), gl.STATIC_DRAW);

// Set up the attribute pointer for the position buffer
gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 2, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

// Use the shader program
gl.useProgram(programInfo.program);

// Set the clear color to black
gl.clearColor(0.0, 0.0, 0.0, 1.0);

// Set up the projection matrix
const projectionMatrix = mat4.create();
mat4.ortho(projectionMatrix, 0, canvas.width, 0, canvas.height, -1.0, 1.0);
gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);

// Set up the model-view matrix
const modelViewMatrix = mat4.create();
mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, 0]);
gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);

// Draw the table
gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

// Draw the pockets
pockets.forEach((pocket) => {
    drawCircle(pocket.x, pocket.y, pocket.radius);
});

// Run the animation loop
function animate() {
    // Apply drag force to all balls
    allBalls.forEach(applyDragForce);

    // Update positions and handle collisions for all balls
    allBalls.forEach(updateAndCheckCollision);

    // Clear the canvas
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw the table
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

    // Draw the pockets
    pockets.forEach((pocket) => {
        drawCircle(pocket.x, pocket.y, pocket.radius);
    });

    // Draw all the balls
    allBalls.forEach((ball) => {
        drawCircle(ball.x, ball.y, ball.radius);
    });

    // Request the next frame
    requestAnimationFrame(animate);
}

// Start the animation loop
animate();

// Function to update ball positions and handle collisions
function updateAndCheckCollision(ball) {
    // Update ball position based on velocity
    ball.x += ball.velocity.x;
    ball.y += ball.velocity.y;

    // Check for collisions with the cushions
    handleCushionCollision(ball);

    // Check for collisions with the pockets
    handlePocketCollision(ball);

    // Check for collisions with other balls
    handleBallCollisions(ball, allBalls);
}

// Function to handle cushion collisions for a ball
function handleCushionCollision(ball) {
    if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) {
        // Reverse the x-component of velocity
        ball.velocity.x *= -1;
    }

    if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
        // Reverse the y-component of velocity
        ball.velocity.y *= -1;
    }
}

// Function to handle collisions with the pockets for a ball
function handlePocketCollision(ball) {
    pockets.forEach((pocket) => {
        const distance = Math.sqrt((ball.x - pocket.x) ** 2 + (ball.y - pocket.y) ** 2);

        if (distance < ball.radius + pocket.radius) {
            // Ball has fallen into the pocket
            resetBall(ball); // Reset the ball to its initial position
        }
    });
}

// Function to handle collisions between balls
function handleBallCollisions(ball, otherBalls) {
    otherBalls.forEach((otherBall) => {
        if (ball !== otherBall) {
            const distance = Math.sqrt((ball.x - otherBall.x) ** 2 + (ball.y - otherBall.y) ** 2);

            if (distance < ball.radius + otherBall.radius) {
                // Collision detected, calculate new velocities
                const angle = Math.atan2(otherBall.y - ball.y, otherBall.x - ball.x);
                const magnitude1 = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2);
                const magnitude2 = Math.sqrt(otherBall.velocity.x ** 2 + otherBall.velocity.y ** 2);

                const newVelocity1 = {
                    x: magnitude1 * Math.cos(angle),
                    y: magnitude1 * Math.sin(angle),
                };

                const newVelocity2 = {
                    x: magnitude2 * Math.cos(angle + Math.PI),
                    y: magnitude2 * Math.sin(angle + Math.PI),
                };

                ball.velocity = newVelocity1;
                otherBall.velocity = newVelocity2;
            }
        }
    });
}

// Function to apply drag force to a ball
function applyDragForce(ball) {
    const dragForceX = -dragCoefficient * ball.velocity.x;
    const dragForceY = -dragCoefficient * ball.velocity.y;

    // Uncomment the next two lines to apply the drag force
    ball.velocity.x += dragForceX;
    ball.velocity.y += dragForceY;
}

// Function to draw a circle
function drawCircle(x, y, radius) {
    const numSegments = 32;
    const angleIncrement = (2 * Math.PI) / numSegments;

    const circleVertices = [];

    for (let i = 0; i < numSegments; i++) {
        const angle = i * angleIncrement;
        const vx = x + radius * Math.cos(angle);
        const vy = y + radius * Math.sin(angle);
        circleVertices.push(vx, vy);
    }

    const circleBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, circleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(circleVertices), gl.STATIC_DRAW);

    gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    gl.drawArrays(gl.LINE_LOOP, 0, numSegments);
}

// Function to reset a ball to its initial position
function resetBall(ball) {
    // For simplicity, reset the ball to its initial position
    ball.x = ball === cueBall ? 70 : 60;
    ball.y = 28;
    ball.velocity = { x: Math.random() - 0.5, y: Math.random() - 0.5 }; // Adjust initial velocity as needed
}