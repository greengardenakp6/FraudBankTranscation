const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const twilio = require('twilio');
const axios = require('axios');
const app = express();
const port = 3000;

// Twilio Configuration - USE YOUR ACTUAL CREDENTIALS
const twilioClient = twilio(
    'ACf60f450f29fabf5d4dd01680f2052f48',  // Your Account SID from HTML
    '84d51f29f32f4a9c8f653dc0966d6ba6'     // Your Auth Token from HTML
);
const twilioPhoneNumber = '+14787395985'; // Your Twilio phone number

// EmailJS Configuration
const EMAILJS_CONFIG = {
    serviceId: 'akash',      // Replace with your EmailJS service ID
    templateId: 'AKASH',    // Replace with your EmailJS template ID
    publicKey: 'CaMVUkQYox6o96Q29'     // Replace with your EmailJS public key
};

// Middleware
app.use(express.json());
app.use(express.static('.'));

// Check if C backend exists
if (!fs.existsSync('./fraudbackend')) {
    console.log('⚠️  C backend not found. Please compile fraudbackend.c first.');
    console.log('Run: gcc -o fraudbackend fraudbackend.c');
    console.log('Falling back to JavaScript simulation...');
}

// API endpoint to call C backend
app.post('/api/process-transaction', async (req, res) => {
    const { accNo, amount, location, mobileNumber, emailAddress } = req.body;
    
    console.log(`Processing transaction: Account ${accNo}, Amount $${amount}, Location ${location}`);
    
    // Execute the C program
    const command = `./fraudbackend ${accNo} ${amount} "${location}" "${mobileNumber}" "${emailAddress}"`;
    
    exec(command, async (error, stdout, stderr) => {
        if (error) {
            console.error('C backend error:', error);
            console.log('Falling back to JavaScript simulation...');
            
            // Fallback to JavaScript simulation
            const jsResult = simulateBackend(accNo, amount, location, mobileNumber, emailAddress);
            
            // Send alerts for high-risk transactions
            if (jsResult.transaction.riskScore >= 60) {
                await sendAlerts(jsResult.transaction);
            }
            
            return res.json(jsResult);
        }
        
        try {
            // Parse the JSON output from C program
            const result = JSON.parse(stdout);
            console.log('C backend result:', result);
            
            // Send alerts for high-risk transactions
            if (result.transaction.riskScore >= 60) {
                await sendAlerts(result.transaction);
            }
            
            res.json(result);
        } catch (parseError) {
            console.error('Parse error:', parseError, 'Output:', stdout);
            res.status(500).json({ 
                success: false, 
                error: 'Invalid response from backend' 
            });
        }
    });
});

// Send SMS Alert via Twilio
async function sendSMSAlert(transaction) {
    try {
        const riskLevel = transaction.riskScore >= 60 ? 'HIGH RISK' : 
                         transaction.riskScore >= 30 ? 'MEDIUM RISK' : 'LOW RISK';
        
        const message = `🚨 FRAUD ALERT: Transaction $${transaction.amount} at ${transaction.location}. Risk: ${transaction.riskScore}% (${riskLevel}). Account: ${transaction.accNo}. Timestamp: ${new Date(transaction.timestamp * 1000).toLocaleString()}. Please verify immediately.`;

        console.log('📱 Attempting to send Twilio SMS to:', transaction.phone);
        
        const twilioResponse = await twilioClient.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: transaction.phone
        });

        console.log('✅ SMS sent via Twilio. SID:', twilioResponse.sid);
        return { success: true, sid: twilioResponse.sid, service: 'twilio' };
    } catch (error) {
        console.error('❌ Twilio SMS error:', error.message);
        
        // Fallback to EmailJS for SMS (if Twilio fails)
        try {
            console.log('🔄 Trying EmailJS SMS fallback...');
            const emailjsResult = await sendEmailJSAlert(transaction, 'sms');
            return { success: true, ...emailjsResult, service: 'emailjs_fallback' };
        } catch (fallbackError) {
            console.error('❌ All SMS services failed');
            return { success: false, error: error.message };
        }
    }
}

// Send Email Alert via EmailJS
async function sendEmailAlert(transaction) {
    try {
        const riskLevel = transaction.riskScore >= 60 ? 'HIGH RISK' : 
                         transaction.riskScore >= 30 ? 'MEDIUM RISK' : 'LOW RISK';
        
        const emailParams = {
            to_email: transaction.email,
            to_name: 'Security Team',
            from_name: 'Fraud Detection System',
            subject: `🚨 Fraud Detection Alert - ${riskLevel} - Transaction $${transaction.amount}`,
            message: `
TRANSACTION DETAILS:
• Account Number: ${transaction.accNo}
• Amount: $${transaction.amount.toLocaleString()}
• Location: ${transaction.location}
• Timestamp: ${new Date(transaction.timestamp * 1000).toLocaleString()}
• Risk Score: ${transaction.riskScore}% (${riskLevel})
• Status: ${transaction.status}

SECURITY ALERTS:
${transaction.alerts.map(alert => `• ${alert}`).join('\n')}

RECOMMENDED ACTIONS:
${transaction.riskScore >= 60 ? 
    '• IMMEDIATE: Freeze account and contact customer\n• Investigate for potential fraud' : 
transaction.riskScore >= 30 ? 
    '• REVIEW: Verify transaction with customer\n• Monitor account for suspicious activity' : 
    '• MONITOR: No immediate action required'}

This is an automated alert from Fraud Detection System.
            `.trim()
        };

        console.log('📧 Attempting to send EmailJS email to:', transaction.email);
        
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

        console.log('✅ Email sent via EmailJS. Status:', emailjsResponse.status);
        return { success: true, messageId: emailjsResponse.data, service: 'emailjs' };
    } catch (error) {
        console.error('❌ EmailJS error:', error.response?.data || error.message);
        return { success: false, error: error.response?.data || error.message };
    }
}

// EmailJS fallback for SMS
async function sendEmailJSAlert(transaction, type = 'email') {
    try {
        const riskLevel = transaction.riskScore >= 60 ? 'HIGH RISK' : 
                         transaction.riskScore >= 30 ? 'MEDIUM RISK' : 'LOW RISK';
        
        const message = type === 'sms' ? 
            `🚨 FRAUD ALERT: Transaction $${transaction.amount} at ${transaction.location}. Risk: ${transaction.riskScore}% (${riskLevel}). Account: ${transaction.accNo}.` :
            `Fraud Alert Details: Account ${transaction.accNo}, Amount $${transaction.amount}, Risk ${transaction.riskScore}%`;

        const emailParams = {
            to_email: type === 'sms' ? transaction.phone + '@sms.gateway' : transaction.email,
            to_name: 'Security Team',
            from_name: 'Fraud Detection System',
            subject: `🚨 Fraud Alert - ${riskLevel}`,
            message: message
        };

        const response = await axios.post(
            `https://api.emailjs.com/api/v1.0/email/send`,
            {
                service_id: EMAILJS_CONFIG.serviceId,
                template_id: EMAILJS_CONFIG.templateId,
                user_id: EMAILJS_CONFIG.publicKey,
                template_params: emailParams
            }
        );

        return { success: true, messageId: response.data };
    } catch (error) {
        throw new Error('EmailJS fallback failed: ' + error.message);
    }
}

// Send both SMS and Email alerts
async function sendAlerts(transaction) {
    console.log('🚨 Sending alerts for high-risk transaction...');
    
    const smsResult = await sendSMSAlert(transaction);
    const emailResult = await sendEmailAlert(transaction);
    
    return {
        sms: smsResult,
        email: emailResult
    };
}

// Manual alert endpoints
app.post('/api/send-sms', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        
        if (!phoneNumber || !message) {
            return res.status(400).json({ success: false, error: 'Phone number and message are required' });
        }

        console.log('📱 Manual SMS request to:', phoneNumber);
        
        const twilioResponse = await twilioClient.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: phoneNumber
        });

        res.json({ 
            success: true, 
            sid: twilioResponse.sid, 
            message: 'SMS sent successfully via Twilio',
            service: 'twilio'
        });
    } catch (error) {
        console.error('SMS error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            service: 'twilio'
        });
    }
});

app.post('/api/send-email', async (req, res) => {
    try {
        const { email, subject, message } = req.body;
        
        if (!email || !subject || !message) {
            return res.status(400).json({ success: false, error: 'Email, subject, and message are required' });
        }

        console.log('📧 Manual Email request to:', email);
        
        const emailParams = {
            to_email: email,
            to_name: 'Recipient',
            from_name: 'Fraud Detection System',
            subject: subject,
            message: message
        };

        const emailjsResponse = await axios.post(
            `https://api.emailjs.com/api/v1.0/email/send`,
            {
                service_id: EMAILJS_CONFIG.serviceId,
                template_id: EMAILJS_CONFIG.templateId,
                user_id: EMAILJS_CONFIG.publicKey,
                template_params: emailParams
            }
        );

        res.json({ 
            success: true, 
            messageId: emailjsResponse.data,
            message: 'Email sent successfully via EmailJS',
            service: 'emailjs'
        });
    } catch (error) {
        console.error('Email error:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            error: error.response?.data || error.message,
            service: 'emailjs'
        });
    }
});

// Test endpoints for service status
app.get('/api/test-backend', (req, res) => {
    res.json({ success: true, service: 'backend', status: 'active' });
});

app.get('/api/test-sms', async (req, res) => {
    try {
        // Test Twilio by checking account balance
        const account = await twilioClient.api.accounts(twilioClient.accountSid).fetch();
        res.json({ 
            success: true, 
            service: 'sms', 
            status: 'active',
            provider: 'twilio',
            account: account.friendlyName
        });
    } catch (error) {
        res.json({ 
            success: false, 
            service: 'sms', 
            status: 'inactive',
            error: error.message,
            provider: 'twilio'
        });
    }
});

app.get('/api/test-email', async (req, res) => {
    try {
        // Test EmailJS by making a simple request
        const testResponse = await axios.get(`https://api.emailjs.com/api/v1.0/domain/check?user_id=${EMAILJS_CONFIG.publicKey}`);
        res.json({ 
            success: true, 
            service: 'email', 
            status: 'active',
            provider: 'emailjs'
        });
    } catch (error) {
        res.json({ 
            success: false, 
            service: 'email', 
            status: 'inactive',
            error: error.message,
            provider: 'emailjs'
        });
    }
});

// Service configuration endpoint
app.get('/api/services/config', (req, res) => {
    res.json({
        twilio: {
            accountSid: twilioClient.accountSid,
            phoneNumber: twilioPhoneNumber,
            status: 'configured'
        },
        emailjs: {
            serviceId: EMAILJS_CONFIG.serviceId,
            templateId: EMAILJS_CONFIG.templateId,
            publicKey: EMAILJS_CONFIG.publicKey,
            status: 'configured'
        }
    });
});

// JavaScript simulation fallback
function simulateBackend(accNo, amount, location, mobileNumber, emailAddress) {
    const alerts = [];
    let riskScore = 0;
    
    // High-value transaction checks
    if (amount > 100000) {
        alerts.push("Very high-value transaction");
        riskScore += 50;
    } else if (amount > 50000) {
        alerts.push("High-value transaction");
        riskScore += 25;
    }
    
    // Location-based checks
    const locations = ["New York", "London", "Tokyo", "Paris", "Sydney", "Dubai"];
    if (!locations.includes(location)) {
        alerts.push("Unusual location");
        riskScore += 15;
    }
    
    // Round amount check
    if (amount % 1000 === 0 && amount > 1000) {
        alerts.push("Round amount transaction");
        riskScore += 5;
    }
    
    // Determine status
    const status = riskScore > 20 ? "suspicious" : "clean";
    
    if (alerts.length === 0) {
        alerts.push("No fraud detected");
    }
    
    return {
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
            phone: mobileNumber,
            email: emailAddress,
            alerts: alerts
        }
    };
}

app.listen(port, () => {
    console.log(`🚀 Fraud Detection System Server running at http://localhost:${port}`);
    console.log('📊 Frontend: http://localhost:3000');
    console.log('🔧 Real Services Configuration:');
    console.log('   - Twilio SMS: ACTIVE');
    console.log('   - EmailJS Email: ACTIVE');
    console.log('💡 Make sure your Twilio and EmailJS credentials are correct!');
});
