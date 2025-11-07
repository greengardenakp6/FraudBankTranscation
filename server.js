const express = require('express');
const twilio = require('twilio');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Twilio Configuration - YOUR ACTUAL CREDENTIALS
const twilioClient = twilio(
    'ACf60f450f29fabf5d4dd01680f2052f48',  // Your Account SID
    '27b218e9132e0e79d54b30051aed8a48'     // Your Auth Token
);
const twilioPhoneNumber = '+14787395985'; // Your Twilio phone number

// EmailJS Configuration - YOUR ACTUAL CREDENTIALS
const EMAILJS_CONFIG = {
    serviceId: 'service_akash',
    templateId: 'template_akash', 
    publicKey: 'CaMVUkQYox6o96Q29'
};

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Backend is running',
        services: {
            twilio: 'active',
            emailjs: 'active'
        }
    });
});

// Test Twilio service
app.get('/api/test-twilio', async (req, res) => {
    try {
        const account = await twilioClient.api.accounts(twilioClient.accountSid).fetch();
        res.json({ 
            success: true, 
            service: 'twilio', 
            status: 'active',
            account: account.friendlyName
        });
    } catch (error) {
        res.json({ 
            success: false, 
            service: 'twilio', 
            status: 'inactive',
            error: error.message
        });
    }
});

// Test EmailJS service
app.get('/api/test-emailjs', async (req, res) => {
    try {
        const testResponse = await axios.get(`https://api.emailjs.com/api/v1.0/domain/check?user_id=${EMAILJS_CONFIG.publicKey}`);
        res.json({ 
            success: true, 
            service: 'emailjs', 
            status: 'active'
        });
    } catch (error) {
        res.json({ 
            success: false, 
            service: 'emailjs', 
            status: 'inactive',
            error: error.message
        });
    }
});

// Process transaction endpoint
app.post('/api/process-transaction', (req, res) => {
    const { accNo, amount, location, mobileNumber, emailAddress } = req.body;
    
    console.log(`🔍 Processing transaction: Account ${accNo}, Amount $${amount}, Location ${location}`);
    
    // Enhanced fraud detection
    const alerts = [];
    let riskScore = 0;

    // High value checks
    if (amount > 100000) {
        alerts.push("🚨 Very high-value transaction");
        riskScore += 50;
    } else if (amount > 50000) {
        alerts.push("⚠️ High-value transaction");
        riskScore += 25;
    }

    // Location-based checks
    if (location === "Tokyo" && amount > 30000) {
        alerts.push("🌍 Unusual international transaction pattern");
        riskScore += 20;
    }

    // Round amount check
    if (amount % 1000 === 0 && amount > 1000) {
        alerts.push("💰 Round amount transaction");
        riskScore += 10;
    }

    const status = riskScore > 20 ? "suspicious" : "clean";
    
    if (alerts.length === 0) {
        alerts.push("✅ No fraud detected");
    }

    const result = {
        success: true,
        transaction: {
            id: Date.now(),
            accNo: parseInt(accNo),
            amount: parseFloat(amount),
            location: location,
            timestamp: Math.floor(Date.now() / 1000),
            riskScore: Math.min(riskScore, 100),
            status: status,
            remainingBalance: 100000 - amount,
            alerts: alerts,
            phone: mobileNumber,
            email: emailAddress
        }
    };

    console.log('✅ Transaction processed:', result);
    res.json(result);
});

// Send REAL SMS via Twilio
app.post('/api/send-sms', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        
        if (!phoneNumber || !message) {
            return res.status(400).json({ success: false, error: 'Phone number and message are required' });
        }

        console.log('📱 Sending REAL Twilio SMS to:', phoneNumber);
        console.log('💬 Message:', message);
        
        const twilioResponse = await twilioClient.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: phoneNumber
        });

        console.log('✅ SMS sent successfully. SID:', twilioResponse.sid);

        res.json({ 
            success: true, 
            sid: twilioResponse.sid, 
            message: 'REAL SMS sent successfully to your phone via Twilio',
            service: 'twilio'
        });
    } catch (error) {
        console.error('❌ Twilio error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            service: 'twilio'
        });
    }
});

// Send REAL Email via EmailJS
app.post('/api/send-email', async (req, res) => {
    try {
        const { email, subject, message } = req.body;
        
        if (!email || !subject || !message) {
            return res.status(400).json({ success: false, error: 'Email, subject, and message are required' });
        }

        console.log('📧 Sending REAL EmailJS email to:', email);
        
        const emailParams = {
            to_email: email,
            to_name: 'Security Team',
            from_name: 'Fraud Detection System',
            subject: subject,
            message: message,
            reply_to: 'noreply@fraudsystem.com'
        };

        const emailjsResponse = await axios.post(
            `https://api.emailjs.com/api/v1.0/email/send`,
            {
                service_id: EMAILJS_CONFIG.serviceId,
                template_id: EMAILJS_CONFIG.templateId,
                user_id: EMAILJS_CONFIG.publicKey,
                template_params: emailParams
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Email sent successfully via EmailJS');

        res.json({ 
            success: true, 
            messageId: emailjsResponse.data,
            message: 'REAL Email sent successfully via EmailJS',
            service: 'emailjs'
        });
    } catch (error) {
        console.error('❌ EmailJS error:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            error: error.response?.data || error.message,
            service: 'emailjs'
        });
    }
});

// Auto-alert endpoint for high-risk transactions
app.post('/api/send-auto-alerts', async (req, res) => {
    try {
        const { transaction } = req.body;
        
        console.log('🚨 Sending auto-alerts for high-risk transaction:', transaction.id);

        const results = {
            sms: { sent: false },
            email: { sent: false }
        };

        // Send SMS alert
        if (transaction.phone) {
            try {
                const smsMessage = `🚨 FRAUD ALERT: Transaction $${transaction.amount} at ${transaction.location}. Risk: ${transaction.riskScore}%. Account: ${transaction.accNo}. Please verify immediately.`;
                
                const smsResponse = await twilioClient.messages.create({
                    body: smsMessage,
                    from: twilioPhoneNumber,
                    to: transaction.phone
                });
                
                results.sms = { sent: true, sid: smsResponse.sid };
                console.log('✅ Auto-SMS sent:', smsResponse.sid);
            } catch (smsError) {
                console.error('❌ Auto-SMS failed:', smsError.message);
                results.sms = { sent: false, error: smsError.message };
            }
        }

        // Send Email alert
        if (transaction.email) {
            try {
                const emailParams = {
                    to_email: transaction.email,
                    to_name: 'Security Team',
                    from_name: 'Fraud Detection System',
                    subject: `🚨 Fraud Alert - Transaction $${transaction.amount}`,
                    message: `High-risk transaction detected:\n\nAccount: ${transaction.accNo}\nAmount: $${transaction.amount}\nLocation: ${transaction.location}\nRisk Score: ${transaction.riskScore}%\n\nPlease review immediately.`
                };

                await axios.post(
                    `https://api.emailjs.com/api/v1.0/email/send`,
                    {
                        service_id: EMAILJS_CONFIG.serviceId,
                        template_id: EMAILJS_CONFIG.templateId,
                        user_id: EMAILJS_CONFIG.publicKey,
                        template_params: emailParams
                    }
                );
                
                results.email = { sent: true };
                console.log('✅ Auto-Email sent');
            } catch (emailError) {
                console.error('❌ Auto-Email failed:', emailError.message);
                results.email = { sent: false, error: emailError.message };
            }
        }

        res.json({ 
            success: true, 
            message: 'Auto-alerts processed',
            results: results
        });
    } catch (error) {
        console.error('❌ Auto-alerts error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message
        });
    }
});

// Service configuration endpoint
app.get('/api/services/config', (req, res) => {
    res.json({
        twilio: {
            accountSid: 'ACf60f450f29fabf5d4dd01680f2052f48',
            phoneNumber: '+14787395985',
            status: 'active'
        },
        emailjs: {
            serviceId: 'service_akash',
            templateId: 'template_akash',
            publicKey: 'CaMVUkQYox6o96Q29',
            status: 'active'
        },
        system: {
            name: 'Fraud Detection System',
            version: '2.0',
            status: 'operational'
        }
    });
});

app.listen(port, () => {
    console.log(`\n🚀 Fraud Detection System Backend running at http://localhost:${port}`);
    console.log('📊 Frontend: http://localhost:3000');
    console.log('\n✅ REAL SERVICES CONFIGURED:');
    console.log('   📱 Twilio SMS: ACTIVE');
    console.log('   📧 EmailJS: ACTIVE');
    console.log('\n💡 Test the system:');
    console.log('   - Process transaction with $75,000+ amount');
    console.log('   - Enter YOUR real phone number');
    console.log('   - Check your phone for REAL SMS alerts');
    console.log('\n🔧 Service Endpoints:');
    console.log('   - POST /api/process-transaction');
    console.log('   - POST /api/send-sms');
    console.log('   - POST /api/send-email');
    console.log('   - GET  /api/services/config');
});
