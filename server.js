const express = require('express');
const twilio = require('twilio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// YOUR ACTUAL TWILIO CREDENTIALS
const accountSid = 'ACf60f450f29fabf5d4dd01680f2052f48';
const authToken = '23e740f40d9a83da528c411d10133e4f';
const twilioPhone = '+14787395985';

const client = twilio(accountSid, authToken);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Fraud Detection SMS Service is RUNNING with REAL Twilio',
        timestamp: new Date().toISOString(),
        twilio: 'ACTIVE - REAL SMS ENABLED'
    });
});

// REAL SMS endpoint
app.post('/send-sms', async (req, res) => {
    try {
        const { to, message, transactionId } = req.body;

        console.log('📱 REAL SMS Request:', { to, message });

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

        console.log(`📱 Sending REAL SMS to: ${to}`);
        console.log(`Message: ${message}`);

        // Send REAL SMS via Twilio
        const twilioResponse = await client.messages.create({
            body: message,
            from: twilioPhone,
            to: to
        });

        console.log('✅ REAL SMS sent successfully:', twilioResponse.sid);
        console.log('✅ Message status:', twilioResponse.status);

        res.json({
            success: true,
            message: 'REAL SMS sent successfully! Check your phone.',
            sid: twilioResponse.sid,
            status: twilioResponse.status,
            to: to,
            timestamp: new Date().toISOString(),
            from: twilioPhone
        });

    } catch (error) {
        console.error('❌ REAL SMS failed:', error);
        
        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code,
            details: 'Check your Twilio credentials and phone number format'
        });
    }
});

// Test SMS endpoint
app.post('/test-sms', async (req, res) => {
    try {
        const { to } = req.body;
        
        if (!to) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        const testMessage = `🚨 REAL SMS TEST: Fraud Detection System is WORKING! Time: ${new Date().toLocaleString()}`;
        
        console.log(`🧪 Sending REAL test SMS to: ${to}`);
        
        const twilioResponse = await client.messages.create({
            body: testMessage,
            from: twilioPhone,
            to: to
        });

        res.json({
            success: true,
            message: 'REAL Test SMS sent successfully! Check your phone.',
            sid: twilioResponse.sid,
            status: twilioResponse.status,
            to: to,
            from: twilioPhone
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
    console.log(`🚀 REAL SMS Backend running on port ${PORT}`);
    console.log(`📱 Twilio Account: ${accountSid}`);
    console.log(`📱 Twilio Phone: ${twilioPhone}`);
    console.log(`✅ REAL SMS SERVICE ACTIVE`);
    console.log(`🌐 Health: http://localhost:${PORT}/health`);
});
