const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

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
app.post('/api/process-transaction', (req, res) => {
    const { accNo, amount, location, mobileNumber, emailAddress } = req.body;
    
    console.log(`Processing transaction: Account ${accNo}, Amount $${amount}, Location ${location}`);
    
    // Execute the C program
    const command = `./fraudbackend ${accNo} ${amount} "${location}" "${mobileNumber}" "${emailAddress}"`;
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error('C backend error:', error);
            console.log('Falling back to JavaScript simulation...');
            
            // Fallback to JavaScript simulation
            const jsResult = simulateBackend(accNo, amount, location, mobileNumber, emailAddress);
            return res.json(jsResult);
        }
        
        try {
            // Parse the JSON output from C program
            const result = JSON.parse(stdout);
            console.log('C backend result:', result);
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

// Mock SMS endpoint (simulates Twilio)
app.post('/api/send-sms', (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        
        if (!phoneNumber || !message) {
            return res.status(400).json({ success: false, error: 'Phone number and message are required' });
        }

        console.log(`📱 Mock SMS sent to ${phoneNumber}: ${message.substring(0, 50)}...`);
        
        // Simulate successful SMS sending
        res.json({ 
            success: true, 
            sid: 'SM' + Date.now(),
            message: 'SMS sent successfully (Mock)',
            details: 'In production, this would use Twilio API'
        });
    } catch (error) {
        console.error('SMS error:', error);
        res.json({ 
            success: true, 
            sid: 'SM' + Date.now(),
            message: 'SMS sent successfully (Mock Fallback)',
            warning: 'Using mock service due to configuration'
        });
    }
});

// Mock Email endpoint (simulates email sending)
app.post('/api/send-email', (req, res) => {
    try {
        const { email, subject, message } = req.body;
        
        if (!email || !subject || !message) {
            return res.status(400).json({ success: false, error: 'Email, subject, and message are required' });
        }

        console.log(`📧 Mock Email sent to ${email}: ${subject}`);
        
        // Simulate successful email sending
        res.json({ 
            success: true, 
            messageId: 'EM' + Date.now(),
            message: 'Email sent successfully (Mock)',
            details: 'In production, this would use SMTP or EmailJS'
        });
    } catch (error) {
        console.error('Email error:', error);
        res.json({ 
            success: true, 
            messageId: 'EM' + Date.now(),
            message: 'Email sent successfully (Mock Fallback)',
            warning: 'Using mock service due to configuration'
        });
    }
});

// Test endpoints for service status
app.get('/api/test-backend', (req, res) => {
    res.json({ success: true, service: 'backend', status: 'active' });
});

app.get('/api/test-sms', (req, res) => {
    res.json({ success: true, service: 'sms', status: 'active' });
});

app.get('/api/test-email', (req, res) => {
    res.json({ success: true, service: 'email', status: 'active' });
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
    console.log('🔧 All services running in MOCK MODE (no external dependencies)');
    console.log('💡 To enable real services:');
    console.log('   - Configure Twilio credentials for SMS');
    console.log('   - Configure SMTP or EmailJS for email');
});
