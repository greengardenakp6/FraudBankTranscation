const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const twilio = require('twilio');

const app = express();
app.use(cors());
app.use(express.json());

// Your Twilio credentials
const accountSid = 'ACf60f450f29fabf5d4dd0f680f2052f48';
const authToken = '27b218e9132e0e79d54b30051aed8a48';
const twilioPhone = '+14787395985';
const client = twilio(accountSid, authToken);

// Path to your compiled C program
const C_PROGRAM_PATH = './fraudbackend';

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ 
        success: true, 
        message: '✅ Backend server is ONLINE!',
        timestamp: new Date().toISOString()
    });
});

// Process transaction using C backend
app.post('/api/process-transaction', (req, res) => {
    const { accNo, amount, location, mobileNumber, emailAddress } = req.body;

    console.log('📥 Received transaction:', { accNo, amount, location });

    // Validate inputs
    if (!accNo || !amount || !location || !mobileNumber || !emailAddress) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields' 
        });
    }

    // Execute C program with proper escaping for special characters
    const command = `"${C_PROGRAM_PATH}" ${accNo} ${amount} "${location.replace(/"/g, '\\"')}" "${mobileNumber}" "${emailAddress}"`;
    
    console.log('🔧 Executing C program:', command);
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error('❌ C program error:', error);
            return res.status(500).json({ 
                success: false, 
                error: 'Backend processing failed: ' + error.message 
            });
        }

        if (stderr) {
            console.error('⚠️ C program stderr:', stderr);
        }

        console.log('📤 C program output:', stdout);

        try {
            // Parse JSON output from C program
            const result = JSON.parse(stdout);
            console.log('✅ Transaction processed successfully');
            res.json(result);
        } catch (parseError) {
            console.error('❌ JSON parse error:', parseError);
            console.log('📄 Raw C program output:', stdout);
            res.status(500).json({ 
                success: false, 
                error: 'Invalid response from backend: ' + parseError.message,
                rawOutput: stdout
            });
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
        res.json({ 
            success: true, 
            message: 'Twilio service is active and ready to send SMS' 
        });
    } catch (error) {
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        services: {
            cBackend: 'available',
            twilio: 'configured',
            server: 'running'
        }
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log('🚀 ==========================================');
    console.log('🚀 FRAUD DETECTION BACKEND SERVER STARTED');
    console.log('🚀 ==========================================');
    console.log(`📍 Server running on: http://localhost:${PORT}`);
    console.log(`🔧 C Backend: ${C_PROGRAM_PATH}`);
    console.log(`📱 Twilio Phone: ${twilioPhone}`);
    console.log('✅ Endpoints available:');
    console.log(`   GET  http://localhost:${PORT}/api/test`);
    console.log(`   GET  http://localhost:${PORT}/api/health`);
    console.log(`   GET  http://localhost:${PORT}/api/test-twilio`);
    console.log(`   POST http://localhost:${PORT}/api/process-transaction`);
    console.log(`   POST http://localhost:${PORT}/api/send-sms`);
    console.log('🚀 ==========================================');
});
