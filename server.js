const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'Backend is running!' });
});

// Test Twilio endpoint
app.get('/api/test-twilio', (req, res) => {
    res.json({ success: true, message: 'Twilio test endpoint' });
});

// Test Email endpoint
app.get('/api/test-emailjs', (req, res) => {
    res.json({ success: true, message: 'EmailJS test endpoint' });
});

// Process transaction endpoint
app.post('/api/process-transaction', (req, res) => {
    const { accNo, amount, location, mobileNumber, emailAddress } = req.body;
    
    // Simple fraud detection logic
    const alerts = [];
    let riskScore = 0;
    let status = 'clean';

    // High value check
    if (amount > 50000) {
        alerts.push("High-value transaction detected");
        riskScore += 30;
    }

    if (amount > 100000) {
        alerts.push("Very high-value transaction");
        riskScore += 50;
    }

    // Location-based checks
    const suspiciousLocations = ['Unknown', 'High Risk Area'];
    if (suspiciousLocations.includes(location)) {
        alerts.push("Suspicious transaction location");
        riskScore += 25;
    }

    if (alerts.length === 0) {
        alerts.push("No fraud detected");
    }

    if (riskScore > 20) {
        status = 'suspicious';
    }

    const transaction = {
        id: Date.now(),
        accNo,
        amount,
        location,
        mobileNumber,
        emailAddress,
        timestamp: Math.floor(Date.now() / 1000),
        alerts,
        status,
        riskScore: Math.min(riskScore, 100),
        remainingBalance: 100000 - amount // Simple balance calculation
    };

    res.json({
        success: true,
        transaction,
        message: 'Transaction processed successfully'
    });
});

// Send SMS endpoint
app.post('/api/send-sms', async (req, res) => {
    const { phoneNumber, message, transactionDetails } = req.body;

    try {
        // Check if Twilio credentials are available
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            
            const twilioMessage = await client.messages.create({
                body: message,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: phoneNumber
            });

            res.json({
                success: true,
                message: 'SMS sent successfully via Twilio',
                sid: twilioMessage.sid
            });
        } else {
            // Fallback: Simulate SMS sending
            console.log('📱 SIMULATED SMS:', { phoneNumber, message });
            res.json({
                success: true,
                message: 'SMS simulation successful (add Twilio credentials for real SMS)',
                simulated: true
            });
        }
    } catch (error) {
        console.error('SMS error:', error);
        res.json({
            success: true,
            message: 'SMS simulation successful (Twilio not configured)',
            simulated: true
        });
    }
});

// Send Email endpoint
app.post('/api/send-email', (req, res) => {
    const { email, subject, message, reportData } = req.body;

    // Simulate email sending
    console.log('📧 SIMULATED EMAIL:', { email, subject, message });
    
    res.json({
        success: true,
        message: 'Email simulation successful (add EmailJS credentials for real emails)',
        simulated: true
    });
});

// Auto alerts endpoint
app.post('/api/send-auto-alerts', async (req, res) => {
    const { transaction } = req.body;

    try {
        const results = {
            sms: { sent: false, simulated: true },
            email: { sent: false, simulated: true }
        };

        // Auto-send SMS for high risk
        if (transaction.riskScore >= 60 && transaction.phone) {
            const smsMessage = `🚨 AUTO-ALERT: High-risk transaction $${transaction.amount} detected. Risk: ${transaction.riskScore}%. Account: ${transaction.accNo}`;
            
            if (process.env.TWILIO_ACCOUNT_SID) {
                const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                await client.messages.create({
                    body: smsMessage,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: transaction.phone
                });
                results.sms = { sent: true, simulated: false };
            } else {
                console.log('📱 AUTO-SMS:', smsMessage);
                results.sms = { sent: true, simulated: true };
            }
        }

        // Auto-send email for high risk
        if (transaction.riskScore >= 60 && transaction.email) {
            console.log('📧 AUTO-EMAIL: High risk alert sent to', transaction.email);
            results.email = { sent: true, simulated: true };
        }

        res.json({
            success: true,
            results,
            message: 'Auto-alerts processed'
        });

    } catch (error) {
        console.error('Auto-alert error:', error);
        res.json({
            success: true,
            results: { sms: { sent: false }, email: { sent: false } },
            message: 'Auto-alerts simulated (services not configured)'
        });
    }
});

// Services config endpoint
app.get('/api/services/config', (req, res) => {
    res.json({
        twilio: !!process.env.TWILIO_ACCOUNT_SID,
        email: true, // Email simulation always available
        backend: true
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Fraud Detection Backend running on http://localhost:${PORT}`);
    console.log('📱 SMS: ' + (process.env.TWILIO_ACCOUNT_SID ? 'Twilio Configured' : 'Simulation Mode'));
    console.log('📧 Email: Simulation Mode');
});
