const express = require('express');
const fs = require('fs');
const { exec } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { GoogleGenAI } = require('@google/genai');

// Load environment variables from .env
require('dotenv').config();

const problemsRouter = require('./routes/problems'); 

const app = express();
const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();

// Initialize Gemini
const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);

app.use(express.json());
app.use('/api/problems', problemsRouter);

app.post('/api/execute', async (req, res) => { // <-- Made this async
    const { sourceCode, inputData, problemId } = req.body; // <-- Added problemId
    
    if (!sourceCode) return res.status(400).json({ status: "Error", message: "Source code is required." });

    // 1. Fetch expected constraints from the database (Phase 2 integration)
    let expectedTime = "Unknown";
    let expectedSpace = "Unknown";
    if (problemId) {
        try {
            const problem = await prisma.problem.findUnique({ where: { id: problemId } });
            if (problem) {
                expectedTime = problem.expectedTime;
                expectedSpace = problem.expectedSpace;
            }
        } catch (dbError) {
            console.error("Database lookup failed:", dbError);
        }
    }

    const runId = crypto.randomUUID();
    const tempDir = path.join(__dirname, '..', 'temp', runId);
    
    try {
        fs.mkdirSync(tempDir, { recursive: true });
        fs.writeFileSync(path.join(tempDir, 'solution.cpp'), sourceCode);
        fs.writeFileSync(path.join(tempDir, 'input.txt'), inputData || "");
    } catch (fsError) {
        return res.status(500).json({ status: "Error", message: "Failed to write files." });
    }

    const compileAndRunCmd = `g++ solution.cpp -o app && time ./app < input.txt`;
    const absoluteTempPath = path.resolve(tempDir).replace(/\\/g, '/'); 
    
    const dockerCmd = `docker run --rm \
        --name ${runId} \
        --network none \
        --memory="256m" \
        --cpus="0.5" \
        -v "${absoluteTempPath}:/sandbox" \
        cpp-sandbox \
        sh -c "${compileAndRunCmd}"`;

    exec(dockerCmd, { timeout: 10000, cwd: tempDir }, async (error, stdout, stderr) => {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}

        let executionStatus = "Success";
        if (error) {
            executionStatus = error.killed ? "Time Limit Exceeded" : "Runtime/Compilation Error";
        }

        // 2. The AI Mentor Prompt Template (Phase 3 Integration)

        let aiFeedback = "AI Feedback unavailable.";
        try {
            const response = await ai.models.generateContent({
                model: "gemini-3.5-flash", // Use a supported model from their new registry
                contents: `
                    You are a strict, senior C++ technical interviewer. A candidate has submitted a solution to an algorithmic problem.
                    
                    Expected Time Complexity: ${expectedTime}
                    Expected Space Complexity: ${expectedSpace}
                    Execution Status: ${executionStatus}
                    GNU Time Metrics: ${stderr || "None"}
                    
                    Candidate's C++ Code:
                    ${sourceCode}

                    Instructions:
                    1. If the code has a syntax error, briefly explain what went wrong.
                    2. If the code works, analyze its time and space complexity. 
                    3. If their complexity is worse than the expected complexity, give them a hint on how to optimize it, but DO NOT write the code for them.
                    4. Keep your response under 4 sentences. Be direct and professional.
                `,
            });
            aiFeedback = response.text;
        } catch (aiError) {
            console.error("Gemini AI Error:", aiError);
        }
        // ... existing code ...

        // 3. Send everything back to the user
        res.json({ 
            status: executionStatus, 
            output: stdout || error?.message,
            metrics: stderr,
            aiMentor: aiFeedback // <-- The AI speaks!
        });
    });
});

app.listen(PORT, () => console.log(`Server running smoothly on http://localhost:${PORT}`));