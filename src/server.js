const express = require('express');
const fs = require('fs');
const { exec } = require('child_process');
const crypto = require('crypto');

const app = express();
app.use(express.json());

app.post('/api/execute', (req, res) => {
    const { sourceCode, inputData } = req.body;
    
    // 1. Generate a unique ID for this execution run
    const runId = crypto.randomUUID();
    const tempDir = `./temp/${runId}`;
    
    // 2. Create a temporary folder for this specific run
    fs.mkdirSync(tempDir, { recursive: true });
    
    // 3. Write the C++ code and the test case input to files
    fs.writeFileSync(`${tempDir}/solution.cpp`, sourceCode);
    fs.writeFileSync(`${tempDir}/input.txt`, inputData);

    // Proceed to Step 3 (Execution)
});

// This command does three things:
// 1. Compiles the C++ file into an executable named 'app'
// 2. If compilation succeeds (&&), it runs './app' and feeds it input.txt
// 3. We wrap it in 'time' to get execution duration
const compileAndRunCmd = `g++ solution.cpp -o app && time ./app < input.txt`;

// The Docker command with severe security restrictions
const dockerCmd = `docker run --rm \
    --name ${runId} \
    --network none \
    --memory="256m" \
    --cpus="0.5" \
    -v ${__dirname}/temp/${runId}:/sandbox \
    cpp-sandbox \
    sh -c "${compileAndRunCmd}"`;

exec(dockerCmd, { timeout: 5000 }, (error, stdout, stderr) => {
    // 4. Clean up the temporary folder immediately so your drive doesn't fill up
    fs.rmSync(tempDir, { recursive: true, force: true });

    if (error) {
        if (error.killed) {
            return res.json({ status: "Time Limit Exceeded", error: "Execution took longer than 5 seconds." });
        }
        // This usually means a compilation error or runtime crash
        return res.json({ status: "Error", details: stderr });
    }

    // 5. Send the output and timing data back to the frontend
    res.json({ 
        status: "Success", 
        output: stdout,
        metrics: stderr // The 'time' command outputs to stderr in Linux
    });
});