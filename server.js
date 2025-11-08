const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Twilio client initialization
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Fraud Detection Backend is running',
    services: {
      twilio: 'Active',
      email: 'Active'
    }
  });
});

// SMS sending endpoint
app.post('/api/send-sms', async (req, res) => {
  try {
    const { to, message, transactionId } = req.body;

    // Validate required fields
    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required'
      });
    }

    // Send SMS using Twilio
    const twilioResponse = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });

    console.log('SMS sent successfully:', {
      to: to,
      transactionId: transactionId,
      sid: twilioResponse.sid
    });

    res.json({
      success: true,
      message: 'SMS sent successfully',
      sid: twilioResponse.sid,
      status: twilioResponse.status
    });

  } catch (error) {
    console.error('Error sending SMS:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
});

// Transaction processing endpoint
app.post('/api/process-transaction', async (req, res) => {
  try {
    const { 
      accNo, 
      amount, 
      location, 
      mobileNumber, 
      emailAddress 
    } = req.body;

    // Simulate fraud detection logic
    const fraudResult = simulateFraudDetection({
      accNo, amount, location, mobileNumber, emailAddress
    });

    // Send SMS for high-risk transactions
    if (fraudResult.riskScore >= 60) {
      const smsMessage = `🚨 FRAUD ALERT: Transaction $${amount} at ${location}. Risk: ${fraudResult.riskScore}%. Account: ${accNo}. Please verify immediately.`;
      
      try {
        await client.messages.create({
          body: smsMessage,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: mobileNumber
        });
        
        console.log('Auto-alert SMS sent for high-risk transaction');
      } catch (smsError) {
        console.error('Failed to send auto-alert SMS:', smsError);
      }
    }

    res.json({
      success: true,
      transaction: {
        id: Date.now(),
        ...req.body,
        timestamp: new Date().toISOString(),
        riskScore: fraudResult.riskScore,
        status: fraudResult.isSuspicious ? 'suspicious' : 'clean',
        alerts: fraudResult.alerts
      }
    });

  } catch (error) {
    console.error('Error processing transaction:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Fraud detection simulation
function simulateFraudDetection(transaction) {
  const alerts = [];
  let riskScore = 0;

  // High value checks
  if (transaction.amount > 100000) {
    alerts.push("Very high-value transaction");
    riskScore += 50;
  } else if (transaction.amount > 50000) {
    alerts.push("High-value transaction");
    riskScore += 25;
  }

  // Location-based risk
  if (transaction.location.includes('India') && transaction.amount > 50000) {
    alerts.push("Unusual high-value transaction for region");
    riskScore += 20;
  }

  // Round amount check
  if (transaction.amount % 1000 === 0 && transaction.amount > 1000) {
    alerts.push("Round amount transaction");
    riskScore += 10;
  }

  if (alerts.length === 0) {
    alerts.push("No fraud detected");
  }

  return {
    alerts: alerts,
    riskScore: Math.min(riskScore, 100),
    isSuspicious: riskScore > 20
  };
}

app.listen(PORT, () => {
  console.log(`🚀 Fraud Detection Backend running on port ${PORT}`);
  console.log(`📱 Twilio Phone: ${process.env.TWILIO_PHONE_NUMBER}`);
});
