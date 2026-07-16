const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// ROUTE 1: GET /api/problems
// Fetches a list of all problems to display on the frontend dashboard
router.get('/', async (req, res) => {
  try {
    const problems = await prisma.problem.findMany({
      select: {
        id: true,
        title: true,
        difficulty: true,
        // Notice we don't fetch test cases here to save bandwidth
      }
    });
    res.json({ status: 'Success', data: problems });
  } catch (error) {
    res.status(500).json({ status: 'Error', message: 'Database failed' });
  }
});

// ROUTE 2: GET /api/problems/:id
// Fetches a specific problem AND its public test cases for the code editor
router.get('/:id', async (req, res) => {
  try {
    const problem = await prisma.problem.findUnique({
      where: { 
        id: req.params.id 
      },
      include: {
        // Only fetch test cases that are NOT hidden so users can't cheat
        testCases: {
          where: { isHidden: false },
          select: { input: true, expected: true }
        }
      }
    });

    if (!problem) {
      return res.status(404).json({ status: 'Error', message: 'Problem not found' });
    }

    res.json({ status: 'Success', data: problem });
  } catch (error) {
    res.status(500).json({ status: 'Error', message: 'Database failed' });
  }
});

module.exports = router;