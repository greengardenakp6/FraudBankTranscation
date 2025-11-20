const express = require('express');
const twilio = require('twilio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Twilio configuration - ADD YOUR REAL CREDENTIALS HERE
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'ACf60f450f29fabf5d4dd01680f2052f48';
const authToken = process.env.TWILIO_AUTH_TOKEN || '614f4f07bfff3587434f76ae4be21d25';
const twilioPhone = process.env.TWILIO_PHONE_NUMBER || '‪+14787395985‬';

const client = twilio(accountSid, authToken);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'Fraud Detection SMS Service',
        timestamp: new Date().toISOString(),
        twilio: 'Active'
    });
});

// SMS sending endpoint
app.post('/send-sms', async (req, res) => {
    try {
        const { to, message, transactionId } = req.body;

        console.log('📱 Received SMS request:', { to, transactionId });

        // Validate input
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

        console.log(📱 Attempting to send SMS to: ${to});
        console.log(📝 Message: ${message});

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
            status: twilioResponse.status,
            to: to
        });

    } catch (error) {
        console.error('❌ SMS sending failed:', error.message);
        
        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code
        });
    }
});

// Test endpoint
app.post('/test-sms', async (req, res) => {
    try {
        const { to } = req.body;
        const testMessage = "🚨 TEST: Fraud Detection System is working! Real SMS alerts are active.";

        const twilioResponse = await client.messages.create({
            body: testMessage,
            from: twilioPhone,
            to: to || '‪+919876543210‬' /
        });

        res.json({
            success: true,
            message: 'Test SMS sent successfully',
            sid: twilioResponse.sid
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log('🚀 Fraud Detection SMS Server running on port ${PORT}');
    console.log('📞 Twilio SMS Service: ACTIVE');
    console.log('🌐 Health check: http://localhost:${PORT}/health');
});
