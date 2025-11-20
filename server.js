const express = require('express');
const twilio = require('twilio');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'ACf60f450f29fabf5d4dd01680f2052f48';
const authToken = process.env.TWILIO_AUTH_TOKEN || '614f4f07bfff3587434f76ae4be21d25';
const twilioPhone = process.env.TWILIO_PHONE_NUMBER || '+14787395985';

const client = twilio(accountSid, authToken);

// Email configuration - ADD YOUR EMAIL CREDENTIALS HERE
const emailConfig = {
    service: 'gmail', // or 'outlook', 'yahoo', etc.
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com', // YOUR EMAIL
        pass: process.env.EMAIL_PASSWORD || 'your-app-password' // YOUR APP PASSWORD
    }
};

// Create email transporter
const emailTransporter = nodemailer.createTransport(emailConfig);

// Verify email configuration
emailTransporter.verify((error, success) => {
    if (error) {
        console.log('❌ Email configuration error:', error);
    } else {
        console.log('✅ Email server is ready to send messages');
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'Fraud Detection Alert Service',
        timestamp: new Date().toISOString(),
        twilio: 'Active',
        email: 'Active'
    });
});

// SMS sending endpoint
app.post('/send-sms', async (req, res) => {
    try {
        const { to, message, transactionId } = req.body;

        console.log('📱 Received SMS request:', { to, transactionId });

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
                error: 'Phone number must include country code (e.g., +91 for India)'
            });
        }

        console.log(`📱 Attempting to send SMS to: ${to}`);
        console.log(`📝 Message: ${message}`);

        // Send SMS via Twilio
        const twilioResponse = await client.messages.create({
            body: message,
            from: twilioPhone,
            to: to
        });

        console.log('✅ SMS sent successfully:', twilioResponse.sid);

        res.json({
            success: true,
            message: 'SMS sent successfully',
            sid: twilioResponse.sid,
            status: twilioResponse.status,
            to: to
        });

    } catch (error) {
        console.error('❌ SMS sending failed:', error.message);
        
        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code
        });
    }
});

// REAL EMAIL SENDING ENDPOINT
app.post('/send-email', async (req, res) => {
    try {
        const { to, subject, message, transactionData } = req.body;

        console.log('📧 Received Email request:', { to, subject });

        // Validate input
        if (!to || !subject || !message) {
            return res.status(400).json({
                success: false,
                error: 'Email, subject, and message are required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email address format'
            });
        }

        console.log(`📧 Attempting to send email to: ${to}`);
        console.log(`📋 Subject: ${subject}`);

        // Create email content
        const emailContent = {
            from: emailConfig.auth.user, // Your email as sender
            to: to, // Recipient email
            subject: subject,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; }
                        .alert-box { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 15px 0; }
                        .transaction-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #3498db; }
                        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🚨 Fraud Detection System</h1>
                            <p>Security Alert Notification</p>
                        </div>
                        <div class="content">
                            <div class="alert-box">
                                <h3>🔍 Security Alert</h3>
                                <p>${message}</p>
                            </div>
                            ${transactionData ? `
                            <div class="transaction-details">
                                <h3>📊 Transaction Details</h3>
                                <p><strong>Transaction ID:</strong> ${transactionData.id || 'N/A'}</p>
                                <p><strong>Account:</strong> ${transactionData.accNo || 'N/A'}</p>
                                <p><strong>Amount:</strong> $${transactionData.amount ? transactionData.amount.toLocaleString() : 'N/A'}</p>
                                <p><strong>Location:</strong> ${transactionData.location || 'N/A'}</p>
                                <p><strong>Risk Score:</strong> ${transactionData.riskScore || 'N/A'}%</p>
                                <p><strong>Status:</strong> ${transactionData.status || 'N/A'}</p>
                                <p><strong>Timestamp:</strong> ${transactionData.timestamp || new Date().toLocaleString()}</p>
                            </div>
                            ` : ''}
                            <div class="footer">
                                <p>This is an automated message from Fraud Detection System.</p>
                                <p>Please do not reply to this email.</p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `${subject}\n\n${message}\n\n${transactionData ? `Transaction Details:\n- ID: ${transactionData.id}\n- Account: ${transactionData.accNo}\n- Amount: $${transactionData.amount}\n- Location: ${transactionData.location}\n- Risk: ${transactionData.riskScore}%\n- Status: ${transactionData.status}` : ''}\n\nThis is an automated message. Please do not reply.`
        };

        // Send email
        const emailResponse = await emailTransporter.sendMail(emailContent);

        console.log('✅ Email sent successfully:', emailResponse.messageId);

        res.json({
            success: true,
            message: 'Email sent successfully',
            messageId: emailResponse.messageId,
            to: to,
            subject: subject
        });

    } catch (error) {
        console.error('❌ Email sending failed:', error.message);
        
        res.status(500).json({
            success: false,
            error: error.message,
            details: 'Check your email configuration and credentials'
        });
    }
});

// COMBINED ALERT ENDPOINT - Sends both SMS and Email
app.post('/send-alerts', async (req, res) => {
    try {
        const { sms, email, transactionData } = req.body;

        console.log('🚨 Sending combined alerts for transaction:', transactionData?.id);

        const results = {
            sms: { success: false },
            email: { success: false }
        };

        // Send SMS if provided
        if (sms && sms.to && sms.message) {
            try {
                const smsResult = await client.messages.create({
                    body: sms.message,
                    from: twilioPhone,
                    to: sms.to
                });
                results.sms = { 
                    success: true, 
                    sid: smsResult.sid,
                    to: sms.to
                };
                console.log('✅ SMS alert sent successfully');
            } catch (smsError) {
                console.error('❌ SMS alert failed:', smsError.message);
                results.sms = { 
                    success: false, 
                    error: smsError.message 
                };
            }
        }

        // Send Email if provided
        if (email && email.to && email.subject && email.message) {
            try {
                const emailContent = {
                    from: emailConfig.auth.user,
                    to: email.to,
                    subject: email.subject,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
                                <h1>🚨 Fraud Detection Alert</h1>
                            </div>
                            <div style="background: #f8f9fa; padding: 20px;">
                                <div style="background: white; padding: 20px; border-radius: 5px; margin: 15px 0;">
                                    <h3>${email.subject}</h3>
                                    <p>${email.message}</p>
                                </div>
                                ${transactionData ? `
                                <div style="background: #fff3cd; padding: 15px; border-radius: 5px;">
                                    <h4>📊 Transaction Details</h4>
                                    <p><strong>ID:</strong> ${transactionData.id}</p>
                                    <p><strong>Account:</strong> ${transactionData.accNo}</p>
                                    <p><strong>Amount:</strong> $${transactionData.amount?.toLocaleString()}</p>
                                    <p><strong>Risk Score:</strong> ${transactionData.riskScore}%</p>
                                    <p><strong>Status:</strong> ${transactionData.status}</p>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    `
                };

                const emailResult = await emailTransporter.sendMail(emailContent);
                results.email = { 
                    success: true, 
                    messageId: emailResult.messageId,
                    to: email.to
                };
                console.log('✅ Email alert sent successfully');
            } catch (emailError) {
                console.error('❌ Email alert failed:', emailError.message);
                results.email = { 
                    success: false, 
                    error: emailError.message 
                };
            }
        }

        res.json({
            success: true,
            message: 'Alerts processed',
            results: results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Combined alerts failed:', error.message);
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
        const testMessage = "🚨 TEST: Fraud Detection System is working! Real SMS alerts are active.";

        const twilioResponse = await client.messages.create({
            body: testMessage,
            from: twilioPhone,
            to: to || '+919876543210' // Default test number
        });

        res.json({
            success: true,
            message: 'Test SMS sent successfully',
            sid: twilioResponse.sid
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
        const { to } = req.body;
        const testEmail = to || 'test@example.com';

        const testContent = {
            from: emailConfig.auth.user,
            to: testEmail,
            subject: '🚨 TEST: Fraud Detection System - Email Service',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
                        <h1>✅ Email Service Test</h1>
                    </div>
                    <div style="background: #f8f9fa; padding: 20px;">
                        <div style="background: white; padding: 20px; border-radius: 5px;">
                            <h3>Fraud Detection System</h3>
                            <p>This is a test email to verify that the email notification system is working correctly.</p>
                            <p><strong>Status:</strong> ✅ ACTIVE</p>
                            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            `
        };

        const emailResponse = await emailTransporter.sendMail(testContent);

        res.json({
            success: true,
            message: 'Test email sent successfully',
            messageId: emailResponse.messageId,
            to: testEmail
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Fraud Detection Alert Server running on port ${PORT}`);
    console.log(`📞 Twilio SMS Service: ACTIVE`);
    console.log(`📧 Email Notification Service: ACTIVE`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`✉️  Email configured from: ${emailConfig.auth.user}`);
});
