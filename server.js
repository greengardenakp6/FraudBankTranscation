const express = require('express');
const twilio = require('twilio');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Twilio Configuration - REPLACE WITH YOUR ACTUAL CREDENTIALS
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'ACf60f450f29fabf5d4dd01680f2052f48';
const authToken = process.env.TWILIO_AUTH_TOKEN || '614f4f07bfff3587434f76ae4be21d25';
const twilioPhone = process.env.TWILIO_PHONE_NUMBER || '+1234567890';

const client = twilio(accountSid, authToken);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Fraud Detection SMS Service is running',
        timestamp: new Date().toISOString(),
        twilio: accountSid ? 'Configured' : 'Not configured'
    });
});

// SMS endpoint
app.post('/send-sms', async (req, res) => {
    try {
        const { to, message, transactionId } = req.body;

        console.log('📱 Received SMS request:', { to, message, transactionId });

        if (!to || !message) {
            return res.status(400).json({
                success: false,
                error: 'Phone number and message are required'
            });
        }

        // Validate phone number format
        if (!to.startsWith('+')) {
            return res.status(400).json({
                success: false,
                error: 'Phone number must include country code (e.g., +91 for India)'
            });
        }

        console.log(`📱 Sending SMS to: ${to}`);
        console.log(`Message: ${message}`);

        // Send SMS via Twilio
        const twilioResponse = await client.messages.create({
            body: message,
            from: twilioPhone,
            to: to
        });

        console.log('✅ SMS sent successfully:', twilioResponse.sid);

        res.json({
            success: true,
            message: 'SMS sent successfully',
            sid: twilioResponse.sid,
            to: to,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ SMS error:', error);
        
        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code,
            message: 'Failed to send SMS. Please check Twilio credentials.'
        });
    }
});

// Test endpoint
app.post('/test-sms', async (req, res) => {
    try {
        const { to } = req.body;
        
        if (!to) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        const testMessage = `🚨 TEST: Fraud Detection System is working! Time: ${new Date().toLocaleString()}`;
        
        console.log(`🧪 Sending test SMS to: ${to}`);
        
        const twilioResponse = await client.messages.create({
            body: testMessage,
            from: twilioPhone,
            to: to
        });

        res.json({
            success: true,
            message: 'Test SMS sent successfully',
            sid: twilioResponse.sid,
            to: to
        });

    } catch (error) {
        console.error('Test SMS error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Fraud Detection SMS Service running on port ${PORT}`);
    console.log(`📱 Health check: http://localhost:${PORT}/health`);
    console.log(`📱 Twilio Status: ${accountSid ? 'Configured' : 'NOT CONFIGURED - SMS will fail'}`);
});
