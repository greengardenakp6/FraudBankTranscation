const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const twilio = require('twilio');
const axios = require('axios');
const app = express();
const port = 3000;

// Twilio Configuration - REAL CREDENTIALS ONLY
const twilioClient = twilio(
    'ACf60f450f29fabf5d4dd01680f2052f48',  // Your Twilio Account SID
    '84d51f29f32f4a9c8f653dc0966d6ba6'     // Your Twilio Auth Token
);
const twilioPhoneNumber = '+14787395985'; // Your Twilio phone number

// EmailJS Configuration - REAL CREDENTIALS ONLY
const EMAILJS_CONFIG = {
    serviceId: 'akash',      // Your EmailJS service ID
    templateId: 'AKASH',     // Your EmailJS template ID  
    publicKey: 'CaMVUkQYox6o96Q29'        // Your EmailJS public key
};

// Middleware
app.use(express.json());
app.use(express.static('.'));
app.use(express.urlencoded({ extended: true }));

// Check if C backend exists
if (!fs.existsSync('./fraudbackend')) {
    console.log('❌ C backend not found. Please compile fraudbackend.c first.');
    console.log('Run: gcc -o fraudbackend fraudbackend.c');
}

// Phone Number Validation for REAL SMS
function validateAndFormatPhoneNumber(phone) {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    console.log('📱 Original phone:', phone, 'Cleaned:', cleaned);
    
    // Handle Indian numbers specifically
    if (cleaned.startsWith('91') && cleaned.length === 12) {
        // +919994247213 format
        return '+' + cleaned;
    }
    else if (cleaned.startsWith('91') && cleaned.length === 10) {
        // 919994247213 format (without +)
        return '+91' + cleaned;
    }
    else if (cleaned.length === 10) {
        // 10-digit Indian number without 91
        return '+91' + cleaned;
    }
    else if (phone.startsWith('+')) {
        // Already in international format
        return phone;
    }
    else if (cleaned.length === 12) {
        // Assume it's international without +
        return '+' + cleaned;
    }
    
    // Default return with + if not already present
    return phone.startsWith('+') ? phone : '+' + cleaned;
}

// REAL SMS Alert Function - NO MOCK
async function sendRealSMS(phoneNumber, message) {
    try {
        console.log('📱 Starting REAL SMS sending process...');
        
        // Format phone number
        const formattedPhone = validateAndFormatPhoneNumber(phoneNumber);
        console.log('📱 Formatted phone:', formattedPhone);
        
        // Verify Twilio credentials first
        console.log('🔐 Verifying Twilio credentials...');
        const account = await twilioClient.api.accounts(twilioClient.accountSid).fetch();
        console.log('✅ Twilio account verified:', account.friendlyName);
        
        // Send REAL SMS via Twilio
        console.log('🚀 Sending REAL SMS via Twilio...');
        const twilioResponse = await twilioClient.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: formattedPhone
        });

        console.log('✅ REAL SMS sent successfully!');
        console.log('📱 Twilio SID:', twilioResponse.sid);
        console.log('📱 Status:', twilioResponse.status);
        console.log('📱 To:', formattedPhone);
        
        return {
            success: true,
            sid: twilioResponse.sid,
            status: twilioResponse.status,
            service: 'twilio',
            message: 'Real SMS sent successfully via Twilio',
            formattedPhone: formattedPhone
        };
        
    } catch (error) {
        console.error('❌ REAL SMS failed:', error);
        
        // Detailed error handling - NO MOCK FALLBACK
        if (error.code === 20003) {
            console.error('🔑 Twilio Authentication Error - Check Account SID and Auth Token');
            return {
                success: false,
                error: 'Twilio authentication failed. Please check your Account SID and Auth Token.',
                code: error.code,
                service: 'twilio'
            };
        }
        else if (error.code === 21211) {
            console.error('📞 Invalid phone number format');
            return {
                success: false,
                error: 'Invalid phone number format. Please use: +919994247213',
                code: error.code,
                service: 'twilio'
            };
        }
        else if (error.code === 21408) {
            console.error('🚫 Twilio trial account restriction');
            return {
                success: false,
                error: 'Twilio trial account can only send to verified numbers. Please verify your phone number in Twilio console.',
                code: error.code,
                service: 'twilio'
            };
        }
        else {
            console.error('❌ Unknown Twilio error:', error.message);
            return {
                success: false,
                error: error.message,
                code: error.code,
                service: 'twilio'
            };
        }
    }
}

// REAL Email Alert Function - NO MOCK
async function sendRealEmail(transaction) {
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

This is an automated REAL alert from Fraud Detection System.
            `.trim()
        };

        console.log('📧 Attempting to send REAL email via EmailJS to:', transaction.email);
        
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
                },
                timeout: 10000
            }
        );

        console.log('✅ REAL email sent via EmailJS. Status:', emailjsResponse.status);
        return { 
            success: true, 
            messageId: emailjsResponse.data,
            service: 'emailjs',
            message: 'Real email sent successfully via EmailJS'
        };
    } catch (error) {
        console.error('❌ REAL Email failed:', error.response?.data || error.message);
        
        // NO MOCK FALLBACK - return error only
        if (error.response?.status === 400) {
            console.error('🔑 EmailJS configuration error. Please check your Service ID, Template ID, and Public Key.');
            return {
                success: false,
                error: 'EmailJS configuration error. Please check your credentials.',
                service: 'emailjs'
            };
        }

        return { 
            success: false, 
            error: error.response?.data || error.message,
            service: 'emailjs'
        };
    }
}

// Send both SMS and Email alerts - REAL ONLY
async function sendRealAlerts(transaction) {
    console.log('\n🚨 ========== SENDING REAL-TIME ALERTS ==========');
    console.log('📊 Transaction Risk Score:', transaction.riskScore);
    
    const results = {
        sms: null,
        email: null
    };
    
    // Send REAL SMS for medium and high risk (≥ 30)
    if (transaction.riskScore >= 30) {
        console.log('📱 Sending REAL SMS alert (risk ≥ 30)...');
        
        const riskLevel = transaction.riskScore >= 60 ? 'HIGH RISK' : 'MEDIUM RISK';
        const smsMessage = `🚨 FRAUD ALERT: Transaction $${transaction.amount} at ${transaction.location}. Risk: ${transaction.riskScore}% (${riskLevel}). Account: ${transaction.accNo}. Timestamp: ${new Date(transaction.timestamp * 1000).toLocaleString()}. Please verify immediately.`;

        results.sms = await sendRealSMS(transaction.phone, smsMessage);
    } else {
        console.log('📱 Skipping SMS (risk < 30)');
    }
    
    // Send REAL email for all suspicious transactions (≥ 20)
    if (transaction.riskScore >= 20) {
        console.log('📧 Sending REAL email alert (risk ≥ 20)...');
        results.email = await sendRealEmail(transaction);
    } else {
        console.log('📧 Skipping email (risk < 20)');
    }
    
    console.log('✅ REAL Alert sending completed');
    console.log('============================================\n');
    return results;
}

// API endpoint to call C backend - REAL ONLY
app.post('/api/process-transaction', async (req, res) => {
    const { accNo, amount, location, mobileNumber, emailAddress } = req.body;
    
    console.log(`\n=== PROCESSING TRANSACTION ===`);
    console.log(`Account: ${accNo}, Amount: $${amount}, Location: ${location}`);
    console.log(`Mobile: ${mobileNumber}, Email: ${emailAddress}`);
    
    // Check if C backend exists
    if (!fs.existsSync('./fraudbackend')) {
        console.log('❌ C backend not found');
        return res.status(500).json({ 
            success: false, 
            error: 'C backend not found. Please compile fraudbackend.c first.' 
        });
    }

    // Execute the C program
    const command = `./fraudbackend ${accNo} ${amount} "${location}" "${mobileNumber}" "${emailAddress}"`;
    
    exec(command, async (error, stdout, stderr) => {
        if (error) {
            console.error('❌ C backend error:', error);
            return res.status(500).json({ 
                success: false, 
                error: 'C backend execution failed. Please check if fraudbackend is compiled.' 
            });
        }
        
        try {
            // Parse the JSON output from C program
            const result = JSON.parse(stdout);
            console.log('✅ C backend result - Risk Score:', result.transaction.riskScore);
            
            // Send REAL alerts for suspicious transactions - NO MOCK
            if (result.transaction.riskScore >= 20) {
                console.log('🚨 Sending REAL alerts for suspicious transaction...');
                const alertResults = await sendRealAlerts(result.transaction);
                result.alertResults = alertResults;
            }
            
            res.json(result);
        } catch (parseError) {
            console.error('❌ Parse error:', parseError);
            res.status(500).json({ 
                success: false, 
                error: 'Invalid response from C backend' 
            });
        }
    });
});

// Manual SMS endpoint - REAL ONLY
app.post('/api/send-sms', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        
        if (!phoneNumber || !message) {
            return res.status(400).json({ success: false, error: 'Phone number and message are required' });
        }

        console.log('\n📱 ========== MANUAL REAL SMS REQUEST ==========');
        console.log('To:', phoneNumber);
        console.log('Message:', message);

        // Send REAL SMS - NO MOCK
        const result = await sendRealSMS(phoneNumber, message);
        
        if (result.success) {
            console.log('✅ Manual REAL SMS sent successfully!');
            res.json(result);
        } else {
            console.log('❌ Manual REAL SMS failed');
            res.status(500).json(result);
        }
        
    } catch (error) {
        console.error('❌ Manual REAL SMS error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            service: 'twilio'
        });
    }
});

// Manual Email endpoint - REAL ONLY
app.post('/api/send-email', async (req, res) => {
    try {
        const { email, subject, message } = req.body;
        
        if (!email || !subject || !message) {
            return res.status(400).json({ success: false, error: 'Email, subject, and message are required' });
        }

        console.log('\n📧 ========== MANUAL REAL EMAIL REQUEST ==========');
        console.log('To:', email);
        console.log('Subject:', subject);

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
                },
                timeout: 10000
            }
        );

        console.log('✅ Manual REAL email sent successfully!');
        res.json({ 
            success: true, 
            messageId: emailjsResponse.data,
            message: 'Real email sent successfully via EmailJS',
            service: 'emailjs'
        });
    } catch (error) {
        console.error('❌ Manual REAL Email error:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            error: error.response?.data || error.message,
            service: 'emailjs'
        });
    }
});

// Test endpoints for service status - REAL ONLY
app.get('/api/test-backend', (req, res) => {
    if (!fs.existsSync('./fraudbackend')) {
        return res.json({ 
            success: false, 
            service: 'backend', 
            status: 'inactive',
            error: 'C backend not found. Please compile fraudbackend.c first.'
        });
    }
    
    res.json({ 
        success: true, 
        service: 'backend', 
        status: 'active',
        message: 'C backend is available'
    });
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
            account: account.friendlyName,
            message: 'Twilio credentials are valid and working'
        });
    } catch (error) {
        console.error('❌ Twilio test failed:', error.message);
        res.json({ 
            success: false, 
            service: 'sms', 
            status: 'inactive',
            error: error.message,
            provider: 'twilio',
            message: 'Twilio authentication failed. Check your Account SID and Auth Token.'
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
            provider: 'emailjs',
            message: 'EmailJS credentials are valid'
        });
    } catch (error) {
        console.error('❌ EmailJS test failed:', error.message);
        res.json({ 
            success: false, 
            service: 'email', 
            status: 'inactive',
            error: error.message,
            provider: 'emailjs',
            message: 'EmailJS configuration error. Check your Service ID, Template ID, and Public Key.'
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
        },
        alertThresholds: {
            sms: 30,
            email: 20,
            highRisk: 60
        },
        mode: 'REAL-TIME ONLY - NO MOCK SERVICES'
    });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            backend: 'unknown',
            sms: 'unknown',
            email: 'unknown'
        }
    };

    // Check backend
    health.services.backend = fs.existsSync('./fraudbackend') ? 'active' : 'inactive';

    // Check SMS
    try {
        await twilioClient.api.accounts(twilioClient.accountSid).fetch();
        health.services.sms = 'active';
    } catch (error) {
        health.services.sms = 'inactive';
    }

    // Check Email
    try {
        await axios.get(`https://api.emailjs.com/api/v1.0/domain/check?user_id=${EMAILJS_CONFIG.publicKey}`);
        health.services.email = 'active';
    } catch (error) {
        health.services.email = 'inactive';
    }

    // Overall status
    if (health.services.backend === 'inactive' || health.services.sms === 'inactive' || health.services.email === 'inactive') {
        health.status = 'degraded';
    }

    res.json(health);
});

// Root endpoint
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '404.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`\n🚀 Fraud Detection System Server running at http://localhost:${port}`);
    console.log('📊 Frontend: http://localhost:3000');
    console.log('\n🔧 REAL-TIME SERVICES CONFIGURED:');
    console.log('   - Twilio Account SID: ACf60f450f29fabf5d4dd01680f2052f48');
    console.log('   - Twilio Phone: +14787395985');
    console.log('   - EmailJS Service: akash');
    console.log('\n🚨 MODE: REAL-TIME ONLY - NO MOCK SERVICES');
    console.log('   - SMS: Real Twilio only');
    console.log('   - Email: Real EmailJS only');
    console.log('   - Backend: Real C backend only');
    console.log('\n💡 To test REAL services:');
    console.log('   1. Process transaction with amount > $50,000');
    console.log('   2. Use phone: +919994247213 (verified number)');
    console.log('   3. Check server console for detailed REAL service logs');
});
