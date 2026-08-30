import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Procedure } from '../models/index.js';

// Load environment variables from .env
dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/zenith_copilot';

async function seedDatabase(): Promise<void> {
  try {
    console.log('🌱 Connecting to MongoDB for database seeding...');
    console.log(`📍 Connection URI: ${MONGODB_URI}`);

    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected successfully.');

    const procedureTitle = 'RO Water Purifier - Sediment Filter Replacement';

    // Remove any previous instance of this standard test procedure to avoid duplicates
    await Procedure.deleteMany({ title: procedureTitle });

    // Define the Standard Test Procedure Document
    const testProcedureData = {
      title: procedureTitle,
      description:
        'Standard procedure to safely replace the inline sediment filter of a domestic RO unit.',
      is_custom: false,
      steps: [
        {
          step_number: 1,
          instruction_text:
            'Turn off the main power switch and close the water inlet valve.',
          safety_warning:
            'Do not touch the 24V adapter with wet hands to prevent electric shock.',
        },
        {
          step_number: 2,
          instruction_text:
            'Remove the front plastic cover of the RO machine to access the filters.',
        },
        {
          step_number: 3,
          instruction_text:
            'Locate the Sediment Filter. Press the small blue collet ring inward and pull the 1/4" pipe out.',
        },
        {
          step_number: 4,
          instruction_text:
            'Insert the new Sediment filter. Ensure the flow arrow on the sticker is pointing TOWARDS the booster pump.',
        },
        {
          step_number: 5,
          instruction_text:
            'Push the pipes firmly into the new filter and attach the blue locking clips to secure the joint.',
        },
      ],
    };

    console.log('📝 Inserting Standard Test Procedure into database...');
    const procedure = await Procedure.create(testProcedureData);

    console.log('\n======================================================');
    console.log('🎉 Standard Test Procedure Seeded Successfully!');
    console.log(`📌 Procedure Title: ${procedure.title}`);
    console.log(`🆔 Procedure _id:   ${procedure._id}`);
    console.log(`📋 Total Steps:     ${procedure.steps.length}`);
    console.log('======================================================\n');
  } catch (error: any) {
    console.error('❌ Error during database seeding:', error.message || error);
    process.exit(1);
  } finally {
    console.log('🔌 Disconnecting from MongoDB gracefully...');
    await mongoose.disconnect();
    console.log('👋 Database connection closed. Exiting process.');
    process.exit(0);
  }
}

seedDatabase();
