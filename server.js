const express = require('express');
const twilio = require('twilio');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// YOUR TWILIO CREDENTIALS
const accountSid = 'ACf60f450f29fabf5d4dd01680f2052f48';
const authToken = '23e740f40d9a83da528c411d10133e4f';
const twilioPhone = '+14787395985';
const client = twilio(accountSid, authToken);

// YOUR EMAILJS CREDENTIALS
const emailjsConfig = {
    serviceId: 'service_akash',
    templateId: 'template_akash', 
    publicKey: 'CaMVUkQYox6o96Q29',
    baseURL: 'https://api.emailjs.com/api/v1.0/email/send'
};

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Fraud Detection Service - REAL SMS & EMAIL',
        timestamp: new Date().toISOString(),
        services: {
            sms: 'ACTIVE - Twilio',
            email: 'ACTIVE - EmailJS'
        }
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

        if (!to.startsWith('+')) {
            return res.status(400).json({
                success: false,
                error: 'Phone number must include country code (e.g., +91 for India)'
            });
        }

        console.log(`📱 Sending REAL SMS to: ${to}`);

        // Send REAL SMS via Twilio
        const twilioResponse = await client.messages.create({
            body: message,
            from: twilioPhone,
            to: to
        });

        console.log('✅ REAL SMS sent successfully:', twilioResponse.sid);

        res.json({
            success: true,
            message: 'REAL SMS sent successfully! Check your phone.',
            sid: twilioResponse.sid,
            status: twilioResponse.status,
            to: to,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ REAL SMS failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// REAL EMAIL endpoint
app.post('/send-email', async (req, res) => {
    try {
        const { to_email, subject, message, transaction_data } = req.body;

        console.log('📧 REAL EMAIL Request:', { to_email, subject });

        if (!to_email || !subject || !message) {
            return res.status(400).json({
                success: false,
                error: 'Email, subject and message are required'
            });
        }

        // Prepare EmailJS template parameters
        const templateParams = {
            to_email: to_email,
            subject: subject,
            message: message,
            from_name: 'Fraud Detection System',
            transaction_id: transaction_data?.id || 'N/A',
            account_number: transaction_data?.accNo || 'N/A',
            amount: transaction_data?.amount || 'N/A',
            risk_score: transaction_data?.riskScore || 'N/A',
            timestamp: new Date().toLocaleString()
        };

        console.log('📧 Sending REAL Email to:', to_email);

        // Send REAL Email via EmailJS
        const emailResponse = await axios.post(emailjsConfig.baseURL, {
            service_id: emailjsConfig.serviceId,
            template_id: emailjsConfig.templateId,
            user_id: emailjsConfig.publicKey,
            template_params: templateParams,
            accessToken: emailjsConfig.publicKey
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'https://your-domain.com'
            }
        });

        console.log('✅ REAL Email sent successfully:', emailResponse.status);

        res.json({
            success: true,
            message: 'REAL Email sent successfully! Check your inbox.',
            status: emailResponse.status,
            to: to_email,
            subject: subject,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ REAL Email failed:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data || error.message
        });
    }
});

// Send both SMS & Email for fraud alerts
app.post('/send-alert', async (req, res) => {
    try {
        const { 
            phone, 
            email, 
            transaction_data,
            sms_message,
            email_subject,
            email_message 
        } = req.body;

        console.log('🚨 SENDING COMBINED ALERT:', { phone, email });

        const results = {
            sms: null,
            email: null
        };

        // Send SMS
        if (phone && sms_message) {
            try {
                const smsResponse = await client.messages.create({
                    body: sms_message,
                    from: twilioPhone,
                    to: phone
                });
                results.sms = { success: true, sid: smsResponse.sid };
            } catch (smsError) {
                results.sms = { success: false, error: smsError.message };
            }
        }

        // Send Email
        if (email && email_subject && email_message) {
            try {
                const templateParams = {
                    to_email: email,
                    subject: email_subject,
                    message: email_message,
                    from_name: 'Fraud Detection System',
                    transaction_id: transaction_data?.id || 'N/A',
                    timestamp: new Date().toLocaleString()
                };

                const emailResponse = await axios.post(emailjsConfig.baseURL, {
                    service_id: emailjsConfig.serviceId,
                    template_id: emailjsConfig.templateId,
                    user_id: emailjsConfig.publicKey,
                    template_params: templateParams
                });

                results.email = { success: true, status: emailResponse.status };
            } catch (emailError) {
                results.email = { success: false, error: emailError.message };
            }
        }

        res.json({
            success: true,
            message: 'Alert processing completed',
            results: results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Combined alert failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test endpoints
app.post('/test-sms', async (req, res) => {
    try {
        const { to } = req.body;
        
        const testMessage = `🚨 REAL SMS TEST: Fraud Detection System - ${new Date().toLocaleString()}`;
        
        const twilioResponse = await client.messages.create({
            body: testMessage,
            from: twilioPhone,
            to: to
        });

        res.json({
            success: true,
            message: 'REAL Test SMS sent! Check your phone.',
            sid: twilioResponse.sid,
            to: to
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/test-email', async (req, res) => {
    try {
        const { to_email } = req.body;

        const templateParams = {
            to_email: to_email,
            subject: '🚨 TEST: Fraud Detection System - REAL EMAIL',
            message: `This is a REAL email test from Fraud Detection System.\n\nTime: ${new Date().toLocaleString()}\nStatus: SYSTEM WORKING\n\nYou will receive this email for high-risk transactions.`,
            from_name: 'Fraud Detection System',
            timestamp: new Date().toLocaleString()
        };

        const emailResponse = await axios.post(emailjsConfig.baseURL, {
            service_id: emailjsConfig.serviceId,
            template_id: emailjsConfig.templateId,
            user_id: emailjsConfig.publicKey,
            template_params: templateParams
        });

        res.json({
            success: true,
            message: 'REAL Test Email sent! Check your inbox.',
            status: emailResponse.status,
            to: to_email
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.response?.data || error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Fraud Detection Service running on port ${PORT}`);
    console.log(`📱 SMS: ACTIVE (Twilio)`);
    console.log(`📧 EMAIL: ACTIVE (EmailJS)`);
    console.log(`✅ BOTH SERVICES READY FOR REAL ALERTS`);
});
