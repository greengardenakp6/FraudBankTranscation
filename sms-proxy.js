const express = require('express');
const cors = require('cors');
const twilio = require('twilio');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Your Twilio credentials
const TWILIO_CONFIG = {
    accountSid: 'ACf60f450f29fabf5d4dd0f680f2052f48',
    authToken: '27b218e9132e0e79d54b30051aed8a48',
    phoneNumber: '+14787395985'
};

// SMS Proxy endpoint
app.post('/api/send-sms', async (req, res) => {
    const { phoneNumber, message } = req.body;

    try {
        const client = twilio(TWILIO_CONFIG.accountSid, TWILIO_CONFIG.authToken);
        
        const twilioMessage = await client.messages.create({
            body: message,
            from: TWILIO_CONFIG.phoneNumber,
            to: phoneNumber
        });

        res.json({
            success: true,
            message: 'SMS sent successfully via Twilio',
            sid: twilioMessage.sid
        });
    } catch (error) {
        console.error('Twilio error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'SMS Proxy is running!' });
});

app.listen(PORT, () => {
    console.log(`📱 SMS Proxy running on http://localhost:${PORT}`);
});
