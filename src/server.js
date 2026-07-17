const express = require('express');
const fs = require('fs');
const { exec } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const problemsRouter = require('./routes/problems'); // Importing Phase 2 Routes

const app = express();
const PORT = 5000;

app.use(express.json());

// 1. Mount Phase 2 Database Routes
app.use('/api/problems', problemsRouter);

// 2. Core Execution Endpoint (Phase 1)
app.post('/api/execute', (req, res) => {
    const { sourceCode, inputData } = req.body;
    
    if (!sourceCode) {
        return res.status(400).json({ status: "Error", message: "Source code is required." });
    }
    
    // Generate a unique ID and paths for this execution run
    const runId = crypto.randomUUID();
    const tempDir = path.join(__dirname, '..', 'temp', runId);
    
    try {
        // Create a temporary folder for this specific run
        fs.mkdirSync(tempDir, { recursive: true });
        
        // Write the C++ code and the test case input to files
        fs.writeFileSync(path.join(tempDir, 'solution.cpp'), sourceCode);
        fs.writeFileSync(path.join(tempDir, 'input.txt'), inputData || "");
    } catch (fsError) {
        return res.status(500).json({ status: "Error", message: "Failed to initialize files on disk." });
    }

    // Inside Linux container: compile, feed input.txt via stdin, time the binary execution
    const compileAndRunCmd = `g++ solution.cpp -o app && time ./app < input.txt`;

    // The Docker command with security constraints
    // ADDED: Fix Windows backslashes so Docker doesn't get confused by the path
    const absoluteTempPath = path.resolve(tempDir).replace(/\\/g, '/'); 
    
    const dockerCmd = `docker run --rm \
        --name ${runId} \
        --network none \
        --memory="256m" \
        --cpus="0.5" \
        -v "${absoluteTempPath}:/sandbox" \
        cpp-sandbox \
        sh -c "${compileAndRunCmd}"`;

    // CHANGED: Increased timeout from 5000 to 10000ms to allow WSL2 to "wake up"
    exec(dockerCmd, { timeout: 10000, cwd: tempDir }, (error, stdout, stderr) => {
        
        // Cleanup: Obliterate the temporary folder immediately to save disk space
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
            console.error(`Failed to clean up folder: ${tempDir}`, cleanupError);
        }

        // Handle timeouts or structural shell errors
        if (error) {
            if (error.killed) {
                return res.json({ 
                    status: "Time Limit Exceeded", 
                    error: "Your code ran for longer than the 10-second constraint allowed." 
                });
            }
            // Compilation errors or crashes output to stderr
            return res.json({ status: "Runtime/Compilation Error", details: stderr || error.message });
        }

        // Execution succeeded! Return standard output along with execution metrics
        res.json({ 
            status: "Success", 
            output: stdout,
            metrics: stderr // The GNU 'time' command outputs statistics to stderr
        });
    });
});

// Start the backend web server
app.listen(PORT, () => {
    console.log(`Server running smoothly on http://localhost:${PORT}`);
});