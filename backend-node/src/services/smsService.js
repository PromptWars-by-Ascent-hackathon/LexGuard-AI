import twilio from 'twilio';

export async function sendLimitAlertSMS(keyIndex, totalKeys, userPhone) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const targetNumber = userPhone || process.env.TARGET_PHONE_NUMBER || '9063163226';

    if (!accountSid || !authToken || accountSid === 'your_twilio_sid') {
        console.warn(`[SMS] Twilio not configured. Would have sent SMS to ${targetNumber}: API Key limit reached. Switching to key ${keyIndex + 1} of ${totalKeys}`);
        return;
    }

    try {
        const client = twilio(accountSid, authToken);
        await client.messages.create({
            body: `LexGuard Alert: Gemini API limit reached! Rotated to key ${keyIndex + 1} of ${totalKeys}.`,
            from: fromNumber,
            to: targetNumber
        });
        console.log(`[SMS] Alert sent successfully to ${targetNumber}`);
    } catch (err) {
        console.error('[SMS] Failed to send alert via Twilio:', err.message);
    }
}

export async function sendAdminLoginAlert(newUserName, newUserEmail) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const targetNumber = process.env.TARGET_PHONE_NUMBER || '9063163226'; // Admin's verified number

    if (!accountSid || !authToken || !targetNumber || accountSid === 'your_twilio_sid') {
        console.warn(`[SMS] Twilio not configured. Would have sent admin alert to ${targetNumber}`);
        return;
    }

    try {
        const client = twilio(accountSid, authToken);
        const msgBody = `Admin Alert: A new user (${newUserName || newUserEmail}) just logged into LexGuard AI!`;
        await client.messages.create({
            body: msgBody,
            from: fromNumber,
            to: targetNumber
        });
        console.log(`[SMS] Admin alert sent successfully to ${targetNumber}`);
    } catch (err) {
        console.error('[SMS] Failed to send admin alert via Twilio:', err.message);
    }
}
