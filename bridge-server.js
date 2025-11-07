const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const twilio = require('twilio');

const app = express();
app.use(cors());
app.use(express.json());

// Twilio configuration
const accountSid = 'ACf60f450f29fabf5d4dd0f680f2052f48';
const authToken = '27b218e9132e0e79d54b30051aed8a48';
const twilioPhone = '+14787395985';
const client = twilio(accountSid, authToken);

// Path to your compiled C program
const C_PROGRAM_PATH = './fraudbackend';

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'Bridge server running - C backend connected' });
});

// Process transaction using C backend
app.post('/api/process-transaction', (req, res) => {
    const { accNo, amount, location, mobileNumber, emailAddress } = req.body;

    // Validate inputs
    if (!accNo || !amount || !location || !mobileNumber || !emailAddress) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Execute C program
    const command = `"${C_PROGRAM_PATH}" ${accNo} ${amount} "${location}" "${mobileNumber}" "${emailAddress}"`;
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error('C program error:', error);
            return res.status(500).json({ success: false, error: 'Backend processing failed' });
        }

        if (stderr) {
            console.error('C program stderr:', stderr);
        }

        try {
            // Parse JSON output from C program
            const result = JSON.parse(stdout);
            res.json(result);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.log('C program output:', stdout);
            res.status(500).json({ success: false, error: 'Invalid response from backend' });
        }
    });
});

// Real SMS sending endpoint
app.post('/api/send-sms', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;

        console.log('📱 Attempting to send SMS to:', phoneNumber);
        
        // Validate phone number
        if (!phoneNumber.startsWith('+')) {
            return res.status(400).json({ 
                success: false, 
                error: 'Phone number must include country code (e.g., +1XXXXXXXXXX)' 
            });
        }

        // Send real SMS using Twilio
        const twilioResponse = await client.messages.create({
            body: message,
            from: twilioPhone,
            to: phoneNumber
        });

        console.log('✅ SMS sent successfully:', twilioResponse.sid);
        
        res.json({ 
            success: true, 
            message: 'SMS sent successfully',
            sid: twilioResponse.sid
        });
    } catch (error) {
        console.error('❌ SMS sending failed:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Test Twilio endpoint
app.get('/api/test-twilio', async (req, res) => {
    try {
        // Just check if Twilio client can be initialized
        await client.messages.list({ limit: 1 });
        res.json({ success: true, message: 'Twilio service is active' });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Bridge server running on http://localhost:${PORT}`);
    console.log(`📱 Connected to C backend: ${C_PROGRAM_PATH}`);
    console.log(`💳 Twilio configured for real SMS`);
});
