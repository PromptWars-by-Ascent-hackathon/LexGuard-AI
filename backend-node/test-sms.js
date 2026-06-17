import { sendLimitAlertSMS } from './src/services/smsService.js';
import dotenv from 'dotenv';
dotenv.config();

async function runTest() {
    console.log("Triggering simulated SMS alert...");
    // Simulating moving from Key 1 (index 0) to Key 2 (index 1) out of 3 keys
    // And sending to the user's phone number +12605255728
    try {
        await sendLimitAlertSMS(1, 3, "+919063163226");
        console.log("SMS sent successfully!");
    } catch (e) {
        console.error("SMS failed:", e);
    }
}

runTest();
