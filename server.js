const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const twilio = require('twilio');
const nodemailer = require('nodemailer');
const app = express();
const port = 3000;

// Twilio Configuration
const twilioClient = twilio(
    'ACf60f450f29fabf5d4dd01680f2052f48',  // Your Account SID
    '84d51f29f32f4a9c8f653dc0966d6ba6'     // Your Auth Token
);
const twilioPhoneNumber = '+14787395985';

// Email Configuration (using Gmail SMTP)
const emailTransporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com',  // Your Gmail
        pass: 'your-app-password'      // Your App Password
    }
});

// Alternative: EmailJS Configuration (uncomment to use EmailJS instead)
/*
const emailjs = require('emailjs-com');
const EMAILJS_CONFIG = {
    serviceId: 'your_service_id',
    templateId: 'your_template_id',  
    publicKey: 'your_public_key'
};
*/

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

        const twilioResponse = await twilioClient.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: transaction.phone
        });

        console.log('✅ SMS sent via Twilio. SID:', twilioResponse.sid);
        return { success: true, sid: twilioResponse.sid };
    } catch (error) {
        console.error('❌ Twilio SMS error:', error.message);
        return { success: false, error: error.message };
    }
}

// Send Email Alert
async function sendEmailAlert(transaction) {
    try {
        const riskLevel = transaction.riskScore >= 60 ? 'HIGH RISK' : 
                         transaction.riskScore >= 30 ? 'MEDIUM RISK' : 'LOW RISK';
        
        const emailSubject = `🚨 Fraud Detection Alert - ${riskLevel} - Transaction $${transaction.amount}`;
        
        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; color: #333; }
                    .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .alert { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 10px 0; border-radius: 5px; }
                    .transaction-details { background: #f8f9fa; padding: 15px; border-radius: 5px; }
                    .footer { background: #e9ecef; padding: 15px; text-align: center; font-size: 12px; color: #6c757d; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🔍 Fraud Detection System</h1>
                    <p>Security Alert Notification</p>
                </div>
                <div class="content">
                    <div class="alert">
                        <h2>🚨 ${riskLevel} TRANSACTION DETECTED</h2>
                        <p>Risk Score: <strong>${transaction.riskScore}%</strong></p>
                    </div>
                    
                    <div class="transaction-details">
                        <h3>Transaction Details</h3>
                        <p><strong>Account Number:</strong> ${transaction.accNo}</p>
                        <p><strong>Amount:</strong> $${transaction.amount.toLocaleString()}</p>
                        <p><strong>Location:</strong> ${transaction.location}</p>
                        <p><strong>Timestamp:</strong> ${new Date(transaction.timestamp * 1000).toLocaleString()}</p>
                        <p><strong>Status:</strong> ${transaction.status}</p>
                    </div>
                    
                    <h3>Security Alerts</h3>
                    <ul>
                        ${transaction.alerts.map(alert => `<li>${alert}</li>`).join('')}
                    </ul>
                    
                    <h3>Recommended Actions</h3>
                    <p>
                        ${transaction.riskScore >= 60 ? 
                            '• IMMEDIATE: Freeze account and contact customer<br>• Investigate for potential fraud' : 
                         transaction.riskScore >= 30 ? 
                            '• REVIEW: Verify transaction with customer<br>• Monitor account for suspicious activity' : 
                            '• MONITOR: No immediate action required'}
                    </p>
                </div>
                <div class="footer">
                    <p>This is an automated alert from Fraud Detection System. Please do not reply to this email.</p>
                    <p>If you believe this is an error, please contact security immediately.</p>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: '"Fraud Detection System" <security@fraudsystem.com>',
            to: transaction.email,
            subject: emailSubject,
            html: emailHtml
        };

        const emailResponse = await emailTransporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully. Message ID:', emailResponse.messageId);
        return { success: true, messageId: emailResponse.messageId };
    } catch (error) {
        console.error('❌ Email sending error:', error.message);
        return { success: false, error: error.message };
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

        const result = await twilioClient.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: phoneNumber
        });

        res.json({ success: true, sid: result.sid, message: 'SMS sent successfully' });
    } catch (error) {
        console.error('SMS error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/send-email', async (req, res) => {
    try {
        const { email, subject, message } = req.body;
        
        if (!email || !subject || !message) {
            return res.status(400).json({ success: false, error: 'Email, subject, and message are required' });
        }

        const mailOptions = {
            from: '"Fraud Detection System" <security@fraudsystem.com>',
            to: email,
            subject: subject,
            html: message
        };

        const result = await emailTransporter.sendMail(mailOptions);
        res.json({ success: true, messageId: result.messageId, message: 'Email sent successfully' });
    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
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
    console.log('🔧 API: http://localhost:3000/api/process-transaction');
    console.log('📱 Twilio SMS: Active');
    console.log('📧 Email Alerts: Active');
});
