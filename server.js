const express = require('express');
const cors = require('cors');
const twilio = require('twilio');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - Important for Render
app.use(cors({
    origin: ['https://greengardenakp6.github.io/FraudBankTranscation/', 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));
app.use(express.json());

// Twilio client - uses environment variables from Render
const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// Health check endpoint
app.get('/api/health', (req, res) => {
    console.log('✅ Health check received from:', req.get('origin'));
    res.json({ 
        status: 'OK', 
        message: 'Fraud Detection Backend running on Render',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        services: {
            twilio: 'Active',
            server: 'Render'
        }
    });
});

// SMS endpoint
app.post('/api/send-sms', async (req, res) => {
    try {
        const { to, message } = req.body;

        console.log('📱 Received SMS request for:', to);

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
                error: 'Phone number must include country code (e.g., +91...)'
            });
        }

        // Send REAL SMS via Twilio
        const twilioResponse = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: to
        });

        console.log('✅ REAL SMS sent successfully:', {
            to: to,
            sid: twilioResponse.sid,
            status: twilioResponse.status
        });

        res.json({
            success: true,
            message: 'REAL SMS sent successfully!',
            sid: twilioResponse.sid,
            status: twilioResponse.status,
            to: to
        });

    } catch (error) {
        console.error('❌ SMS error:', error);
        
        // User-friendly error messages
        let errorMessage = error.message;
        if (error.code === 21211) errorMessage = 'Invalid phone number format';
        if (error.code === 21408) errorMessage = 'Phone number not verified. Please verify in Twilio console.';
        if (error.code === 21610) errorMessage = 'Phone number is not SMS capable';

        res.status(500).json({
            success: false,
            error: errorMessage,
            code: error.code
        });
    }
});

// Transaction processing endpoint
app.post('/api/process-transaction', async (req, res) => {
    try {
        const { accNo, amount, location, mobileNumber, emailAddress } = req.body;

        console.log('💳 Processing transaction:', { accNo, amount, location });

        // Fraud detection logic
        const alerts = [];
        let riskScore = 0;

        if (amount > 100000) {
            alerts.push("Very high-value transaction");
            riskScore += 50;
        } else if (amount > 50000) {
            alerts.push("High-value transaction");
            riskScore += 25;
        }

        if (alerts.length === 0) {
            alerts.push("No fraud detected");
        }

        const transaction = {
            id: Date.now(),
            accNo: parseInt(accNo),
            amount: parseFloat(amount),
            location: location,
            mobileNumber: mobileNumber,
            emailAddress: emailAddress,
            timestamp: new Date().toISOString(),
            riskScore: Math.min(riskScore, 100),
            status: riskScore > 20 ? 'suspicious' : 'clean',
            alerts: alerts
        };

        res.json({
            success: true,
            transaction: transaction,
            fraudDetection: {
                riskLevel: riskScore >= 60 ? 'high' : riskScore >= 30 ? 'medium' : 'low'
            }
        });

    } catch (error) {
        console.error('❌ Transaction error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Fraud Detection API',
        endpoints: {
            health: 'GET /api/health',
            sendSMS: 'POST /api/send-sms',
            processTransaction: 'POST /api/process-transaction'
        },
        documentation: 'See /api/health for service status'
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('=================================');
    console.log('🚀 Fraud Detection Backend');
    console.log('📍 Running on Render');
    console.log('📡 Port:', PORT);
    console.log('🌐 Environment:', process.env.NODE_ENV || 'production');
    console.log('📱 Twilio: Ready for REAL SMS');
    console.log('=================================');
});
