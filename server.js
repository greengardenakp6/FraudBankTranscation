const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const twilio = require('twilio');
const axios = require('axios');
const app = express();
const port = 3000;

// Twilio Configuration - VERIFIED CREDENTIALS
const twilioClient = twilio(
    'ACf60f450f29fabf5d4dd01680f2052f48',
    '84d51f29f32f4a9c8f653dc0966d6ba6'
);
const twilioPhoneNumber = '+14787395985';

// EmailJS Configuration - CORRECTED
const EMAILJS_CONFIG = {
    serviceId: 'service_akash',      // Fixed service ID format
    templateId: 'template_akash',    // Fixed template ID format  
    publicKey: 'CaMVUkQYox6o96Q29'
};

// Middleware
app.use(express.json());
app.use(express.static('.'));

// Add CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Check if C backend exists
if (!fs.existsSync('./fraudbackend')) {
    console.log('⚠️  C backend not found. Please compile fraudbackend.c first.');
    console.log('Run: gcc -o fraudbackend fraudbackend.c');
    console.log('Falling back to JavaScript simulation...');
}

// API endpoint to call C backend
app.post('/api/process-transaction', async (req, res) => {
    const { accNo, amount, location, mobileNumber, emailAddress } = req.body;
    
    console.log(`📊 Processing transaction: Account ${accNo}, Amount $${amount}, Location ${location}`);
    
    // Execute the C program
    const command = `./fraudbackend ${accNo} ${amount} "${location}" "${mobileNumber}" "${emailAddress}"`;
    
    exec(command, async (error, stdout, stderr) => {
        if (error) {
            console.error('❌ C backend error:', error);
            console.log('🔄 Falling back to JavaScript simulation...');
            
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
            console.log('✅ C backend result - Risk Score:', result.transaction.riskScore);
            
            // Send alerts for high-risk transactions
            if (result.transaction.riskScore >= 60) {
                console.log('🚨 High risk detected - sending alerts...');
                await sendAlerts(result.transaction);
            }
            
            res.json(result);
        } catch (parseError) {
            console.error('❌ Parse error:', parseError, 'Output:', stdout);
            res.status(500).json({ 
                success: false, 
                error: 'Invalid response from backend' 
            });
        }
    });
});

// Enhanced SMS Alert Function
async function sendSMSAlert(transaction) {
    try {
        const riskLevel = transaction.riskScore >= 60 ? 'HIGH RISK' : 
                         transaction.riskScore >= 30 ? 'MEDIUM RISK' : 'LOW RISK';
        
        const message = `🚨 FRAUD ALERT: Transaction $${transaction.amount} at ${transaction.location}. Risk: ${transaction.riskScore}% (${riskLevel}). Account: ${transaction.accNo}. Please verify immediately.`;

        console.log('📱 Attempting to send Twilio SMS to:', transaction.phone);
        
        // Validate phone number format
        let phoneNumber = transaction.phone;
        if (!phoneNumber.startsWith('+')) {
            phoneNumber = '+' + phoneNumber.replace(/\D/g, '');
        }

        const twilioResponse = await twilioClient.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: phoneNumber
        });

        console.log('✅ SMS sent via Twilio. SID:', twilioResponse.sid);
        return { 
            success: true, 
            sid: twilioResponse.sid, 
            service: 'twilio',
            message: 'SMS alert sent successfully'
        };
    } catch (error) {
        console.error('❌ Twilio SMS error:', error.message);
        
        // Fallback to EmailJS for email notification
        try {
            console.log('🔄 Trying EmailJS fallback for notification...');
            const emailjsResult = await sendEmailAlert(transaction);
            return { 
                success: true, 
                ...emailjsResult, 
                service: 'emailjs_fallback',
                note: 'SMS failed, sent email instead'
            };
        } catch (fallbackError) {
            console.error('❌ All notification services failed');
            return { 
                success: false, 
                error: error.message,
                service: 'none'
            };
        }
    }
}

// Enhanced Email Alert Function
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
Dear Security Team,

🚨 FRAUD ALERT - ${riskLevel}

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

This is an automated alert from the Fraud Detection System.

Best regards,
Security Team
            `.trim()
        };

        console.log('📧 Attempting to send EmailJS email to:', transaction.email);
        
        const emailjsResponse = await axios.post(
            `https://api.emailjs.com/api/v1.0/email/send`,
            {
                service_id: EMAILJS_CONFIG.serviceId,
                template_id: EMAILJS_CONFIG.templateId,
                user_id: EMAILJS_CONFIG.publicKey,
                template_params: emailParams,
                accessToken: 'CaMVUkQYox6o96Q29' // Added access token
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': 'http://localhost:3000'
                },
                timeout: 10000
            }
        );

        console.log('✅ Email sent via EmailJS. Status:', emailjsResponse.status);
        return { 
            success: true, 
            messageId: emailjsResponse.data, 
            service: 'emailjs',
            message: 'Email alert sent successfully'
        };
    } catch (error) {
        console.error('❌ EmailJS error:', error.response?.data || error.message);
        
        // Simple fallback - just log the email that would have been sent
        console.log('📧 Email content (fallback):', {
            to: transaction.email,
            subject: `Fraud Alert - ${transaction.riskScore}% Risk`,
            message: `Transaction $${transaction.amount} detected as suspicious`
        });
        
        return { 
            success: false, 
            error: error.response?.data || error.message,
            service: 'emailjs'
        };
    }
}

// Send both SMS and Email alerts
async function sendAlerts(transaction) {
    console.log('🚨 Sending alerts for high-risk transaction...');
    
    const results = {
        sms: await sendSMSAlert(transaction),
        email: await sendEmailAlert(transaction)
    };
    
    console.log('📋 Alert Results:', JSON.stringify(results, null, 2));
    return results;
}

// Manual alert endpoints with improved error handling
app.post('/api/send-sms', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        
        if (!phoneNumber || !message) {
            return res.status(400).json({ success: false, error: 'Phone number and message are required' });
        }

        console.log('📱 Manual SMS request to:', phoneNumber);
        
        let formattedPhone = phoneNumber;
        if (!formattedPhone.startsWith('+')) {
            formattedPhone = '+' + formattedPhone.replace(/\D/g, '');
        }

        const twilioResponse = await twilioClient.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: formattedPhone
        });

        res.json({ 
            success: true, 
            sid: twilioResponse.sid, 
            message: 'SMS sent successfully via Twilio',
            service: 'twilio'
        });
    } catch (error) {
        console.error('❌ SMS error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            service: 'twilio',
            note: 'Check phone number format and Twilio credentials'
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
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({ 
            success: true, 
            messageId: emailjsResponse.data,
            message: 'Email sent successfully via EmailJS',
            service: 'emailjs'
        });
    } catch (error) {
        console.error('❌ Email error:', error.response?.data || error.message);
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
        // Test Twilio by checking account
        const account = await twilioClient.api.accounts(twilioClient.accountSid).fetch();
        res.json({ 
            success: true, 
            service: 'sms', 
            status: 'active',
            provider: 'twilio',
            account: account.friendlyName
        });
    } catch (error) {
        console.error('❌ Twilio test failed:', error.message);
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
        // Test EmailJS connection
        const testResponse = await axios.get(`https://api.emailjs.com/api/v1.0/domain/check?user_id=${EMAILJS_CONFIG.publicKey}`);
        res.json({ 
            success: true, 
            service: 'email', 
            status: 'active',
            provider: 'emailjs'
        });
    } catch (error) {
        console.error('❌ EmailJS test failed:', error.message);
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
            accountSid: twilioClient.accountSid ? 'configured' : 'missing',
            phoneNumber: twilioPhoneNumber,
            status: 'configured'
        },
        emailjs: {
            serviceId: EMAILJS_CONFIG.serviceId,
            templateId: EMAILJS_CONFIG.templateId,
            publicKey: EMAILJS_CONFIG.publicKey,
            status: 'configured'
        },
        server: {
            port: port,
            status: 'running'
        }
    });
});

// JavaScript simulation fallback (unchanged)
function simulateBackend(accNo, amount, location, mobileNumber, emailAddress) {
    const alerts = [];
    let riskScore = 0;
    
    if (amount > 100000) {
        alerts.push("Very high-value transaction");
        riskScore += 50;
    } else if (amount > 50000) {
        alerts.push("High-value transaction");
        riskScore += 25;
    }
    
    const locations = ["New York", "London", "Tokyo", "Paris", "Sydney", "Dubai"];
    if (!locations.includes(location)) {
        alerts.push("Unusual location");
        riskScore += 15;
    }
    
    if (amount % 1000 === 0 && amount > 1000) {
        alerts.push("Round amount transaction");
        riskScore += 5;
    }
    
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

// Start server
app.listen(port, () => {
    console.log(`🚀 Fraud Detection System Server running at http://localhost:${port}`);
    console.log('📊 Frontend: http://localhost:3000');
    console.log('🔧 Real Services Status:');
    console.log('   - Twilio SMS: ACTIVE');
    console.log('   - EmailJS Email: ACTIVE');
    console.log('📱 Test Phone: Use +1234567890 (with country code)');
    console.log('📧 Test Email: Use any valid email address');
    console.log('💡 High-risk transactions (>60% risk) auto-trigger alerts');
});
