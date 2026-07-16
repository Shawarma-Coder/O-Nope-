const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// This script populates your database with an initial problem so you have data to test with.
async function main() {
  console.log('Seeding database...');

  // Create the classic "Two Sum" problem along with 3 test cases
  const twoSum = await prisma.problem.create({
    data: {
      title: 'Two Sum',
      description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
      difficulty: 'Easy',
      expectedTime: 'O(N)',
      expectedSpace: 'O(N)',
      testCases: {
        create: [
          {
            input: '4\n2 7 11 15\n9', // 4 elements. Array: [2,7,11,15]. Target: 9
            expected: '0 1',           // Indices 0 and 1
            isHidden: false
          },
          {
            input: '3\n3 2 4\n6',      // 3 elements. Array: [3,2,4]. Target: 6
            expected: '1 2',
            isHidden: false
          },
          {
            input: '2\n3 3\n6',        // HIDDEN TEST CASE
            expected: '0 1',
            isHidden: true
          }
        ]
      }
    }
  });

  console.log(`Created Problem: ${twoSum.title} with ID: ${twoSum.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });