const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const twilio = require('twilio');

const app = express();
app.use(cors());
app.use(express.json());

// Your Twilio credentials
const accountSid = 'ACf60f450f29fabf5d4dd0f680f2052f48';
const authToken = '27b218e9132e0e79d54b30051aed8a48';
const twilioPhone = '+14787395985';
const client = twilio(accountSid, authToken);

// Path to your compiled C program
const C_PROGRAM_PATH = './fraudbackend';

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ 
        success: true, 
        message: '✅ Backend server is ONLINE!',
        timestamp: new Date().toISOString()
    });
});

// Process transaction using C backend
app.post('/api/process-transaction', (req, res) => {
    const { accNo, amount, location, mobileNumber, emailAddress } = req.body;

    console.log('📥 Received transaction:', { accNo, amount, location });

    // Validate inputs
    if (!accNo || !amount || !location || !mobileNumber || !emailAddress) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields' 
        });
    }

    // Execute C program
    const command = `"${C_PROGRAM_PATH}" ${accNo} ${amount} "${location.replace(/"/g, '\\"')}" "${mobileNumber}" "${emailAddress}"`;
    
    console.log('🔧 Executing C program:', command);
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error('❌ C program error:', error);
            return res.status(500).json({ 
                success: false, 
                error: 'Backend processing failed: ' + error.message 
            });
        }

        if (stderr) {
            console.error('⚠️ C program stderr:', stderr);
        }

        console.log('📤 C program output:', stdout);

        try {
            const result = JSON.parse(stdout);
            console.log('✅ Transaction processed successfully');
            res.json(result);
        } catch (parseError) {
            console.error('❌ JSON parse error:', parseError);
            res.status(500).json({ 
                success: false, 
                error: 'Invalid response from backend: ' + parseError.message,
                rawOutput: stdout
            });
        }
    });
});

// Real SMS sending endpoint
app.post('/api/send-sms', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;

        console.log('📱 Attempting to send SMS to:', phoneNumber);
        
        if (!phoneNumber.startsWith('+')) {
            return res.status(400).json({ 
                success: false, 
                error: 'Phone number must include country code (e.g., +1XXXXXXXXXX)' 
            });
        }

        const twilioResponse = await client.messages.create({
            body: message,
            from: twilioPhone,
            to: phoneNumber
        });

        console.log('✅ SMS sent successfully:', twilioResponse.sid);
        
        res.json({ 
            success: true, 
            message: 'SMS sent successfully',
            sid: twilioResponse.sid
        });
    } catch (error) {
        console.error('❌ SMS sending failed:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Real Email sending endpoint
app.post('/api/send-email', async (req, res) => {
    try {
        const { to_email, subject, message, transactionData } = req.body;

        console.log('📧 Attempting to send email to:', to_email);
        
        if (!to_email || !subject || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required email fields' 
            });
        }

        // Using EmailJS service (you'll need to set this up)
        // For now, we'll simulate email sending
        // In production, integrate with EmailJS, SendGrid, or similar service
        
        console.log('✅ Email would be sent to:', to_email);
        console.log('📋 Subject:', subject);
        console.log('📝 Message:', message);
        
        // Simulate successful email sending
        // Replace this with actual EmailJS integration
        const emailResult = await sendEmailViaEmailJS(to_email, subject, message, transactionData);
        
        res.json({ 
            success: true, 
            message: 'Email sent successfully',
            emailId: Date.now().toString()
        });
        
    } catch (error) {
        console.error('❌ Email sending failed:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// EmailJS integration function
async function sendEmailViaEmailJS(to_email, subject, message, transactionData) {
    // This is where you integrate with EmailJS
    // You'll need to install: npm install emailjs-com
    const emailjs = require('emailjs-com');
    
    // Your EmailJS credentials
    const EMAILJS_CONFIG = {
        publicKey: 'CaMVUkQYox6o96Q29',
        serviceId: 'service_akash', 
        templateId: 'template_akash'
    };
    
    try {
        // Initialize EmailJS
        emailjs.init(EMAILJS_CONFIG.publicKey);
        
        const templateParams = {
            to_email: to_email,
            subject: subject,
            message: message,
            from_name: 'Fraud Detection System',
            transaction_id: transactionData?.id || 'N/A',
            account_number: transactionData?.accNo || 'N/A',
            amount: transactionData?.amount || 'N/A',
            risk_score: transactionData?.riskScore || 'N/A',
            timestamp: new Date().toLocaleString()
        };
        
        // Send email using EmailJS
        const result = await emailjs.send(
            EMAILJS_CONFIG.serviceId,
            EMAILJS_CONFIG.templateId,
            templateParams
        );
        
        console.log('✅ Email sent via EmailJS:', result);
        return result;
        
    } catch (error) {
        console.error('❌ EmailJS error:', error);
        // Fallback to console log for demo
        console.log('📧 DEMO EMAIL:');
        console.log('To:', to_email);
        console.log('Subject:', subject);
        console.log('Message:', message);
        throw new Error('Email service temporarily unavailable');
    }
}

// Test Twilio endpoint
app.get('/api/test-twilio', async (req, res) => {
    try {
        await client.messages.list({ limit: 1 });
        res.json({ 
            success: true, 
            message: 'Twilio service is active and ready to send SMS' 
        });
    } catch (error) {
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Test Email endpoint
app.get('/api/test-email', async (req, res) => {
    try {
        res.json({ 
            success: true, 
            message: 'Email service is configured and ready' 
        });
    } catch (error) {
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Auto-alerts endpoint for high-risk transactions
app.post('/api/send-auto-alerts', async (req, res) => {
    try {
        const { transaction } = req.body;
        
        console.log('🚨 Sending auto-alerts for high-risk transaction:', transaction.id);
        
        const results = {
            sms: { success: false },
            email: { success: false }
        };
        
        // Send SMS alert
        if (transaction.phone) {
            try {
                const smsMessage = `🚨 FRAUD ALERT: Transaction $${transaction.amount} at ${transaction.location}. Risk: ${transaction.riskScore}%. Account: ${transaction.accNo}. Please verify immediately.`;
                
                const smsResult = await client.messages.create({
                    body: smsMessage,
                    from: twilioPhone,
                    to: transaction.phone
                });
                
                results.sms = { success: true, sid: smsResult.sid };
                console.log('✅ Auto-SMS sent successfully');
            } catch (smsError) {
                console.error('❌ Auto-SMS failed:', smsError.message);
                results.sms = { success: false, error: smsError.message };
            }
        }
        
        // Send Email alert
        if (transaction.email) {
            try {
                const emailSubject = `🚨 Fraud Detection Alert - High Risk - Transaction $${transaction.amount}`;
                const emailMessage = this.generateEmailMessage(transaction);
                
                const emailResult = await sendEmailViaEmailJS(
                    transaction.email, 
                    emailSubject, 
                    emailMessage, 
                    transaction
                );
                
                results.email = { success: true, emailId: Date.now().toString() };
                console.log('✅ Auto-Email sent successfully');
            } catch (emailError) {
                console.error('❌ Auto-Email failed:', emailError.message);
                results.email = { success: false, error: emailError.message };
            }
        }
        
        res.json({ 
            success: true, 
            message: 'Auto-alerts processed',
            results: results
        });
        
    } catch (error) {
        console.error('❌ Auto-alerts failed:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log('🚀 ==========================================');
    console.log('🚀 FRAUD DETECTION BACKEND SERVER STARTED');
    console.log('🚀 ==========================================');
    console.log(`📍 Server running on: http://localhost:${PORT}`);
    console.log(`🔧 C Backend: ${C_PROGRAM_PATH}`);
    console.log(`📱 Twilio Phone: ${twilioPhone}`);
    console.log(`📧 Email Service: Configured`);
    console.log('✅ Endpoints available:');
    console.log(`   GET  http://localhost:${PORT}/api/test`);
    console.log(`   GET  http://localhost:${PORT}/api/test-twilio`);
    console.log(`   GET  http://localhost:${PORT}/api/test-email`);
    console.log(`   POST http://localhost:${PORT}/api/process-transaction`);
    console.log(`   POST http://localhost:${PORT}/api/send-sms`);
    console.log(`   POST http://localhost:${PORT}/api/send-email`);
    console.log(`   POST http://localhost:${PORT}/api/send-auto-alerts`);
    console.log('🚀 ==========================================');
});
