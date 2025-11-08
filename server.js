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
    timestamp: new Date().toISOString(),
    services: {
      twilio: 'Active',
      email: 'Active',
      server: 'Running on port ' + PORT
    }
  });
});

// SMS sending endpoint
app.post('/api/send-sms', async (req, res) => {
  try {
    const { to, message, transactionId } = req.body;

    console.log('📱 Received SMS request:', { to, transactionId, messageLength: message.length });

    // Validate required fields
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
        error: 'Phone number must include country code (e.g., +91...)'
      });
    }

    // Send SMS using Twilio
    const twilioResponse = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });

    console.log('✅ SMS sent successfully:', {
      to: to,
      transactionId: transactionId,
      sid: twilioResponse.sid,
      status: twilioResponse.status,
      timestamp: new Date().toLocaleString()
    });

    res.json({
      success: true,
      message: 'SMS sent successfully',
      sid: twilioResponse.sid,
      status: twilioResponse.status,
      to: to,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error sending SMS:', error);
    
    // Provide helpful error messages
    let errorMessage = error.message;
    if (error.code === 21211) {
      errorMessage = 'Invalid phone number format';
    } else if (error.code === 21408) {
      errorMessage = 'Twilio phone number not verified for this region';
    } else if (error.code === 21610) {
      errorMessage = 'Phone number is not SMS capable';
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
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

    console.log('💳 Processing transaction:', { accNo, amount, location, mobileNumber });

    // Validate input
    if (!accNo || !amount || !location || !mobileNumber || !emailAddress) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Simulate fraud detection logic
    const fraudResult = simulateFraudDetection({
      accNo, amount, location, mobileNumber, emailAddress
    });

    // Send SMS for high-risk transactions
    if (fraudResult.riskScore >= 60) {
      const smsMessage = `🚨 FRAUD ALERT: Transaction $${amount} at ${location}. Risk: ${fraudResult.riskScore}%. Account: ${accNo}. Please verify immediately.`;
      
      try {
        const smsResult = await client.messages.create({
          body: smsMessage,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: mobileNumber
        });
        
        console.log('✅ Auto-alert SMS sent:', {
          to: mobileNumber,
          riskScore: fraudResult.riskScore,
          sid: smsResult.sid
        });
        
        fraudResult.autoAlertSent = true;
        fraudResult.alertSID = smsResult.sid;
      } catch (smsError) {
        console.error('❌ Failed to send auto-alert SMS:', smsError);
        fraudResult.autoAlertSent = false;
        fraudResult.alertError = smsError.message;
      }
    }

    const transactionResponse = {
      success: true,
      transaction: {
        id: Date.now(),
        accNo: parseInt(accNo),
        amount: parseFloat(amount),
        location: location,
        mobileNumber: mobileNumber,
        emailAddress: emailAddress,
        timestamp: new Date().toISOString(),
        riskScore: fraudResult.riskScore,
        status: fraudResult.isSuspicious ? 'suspicious' : 'clean',
        alerts: fraudResult.alerts,
        autoAlertSent: fraudResult.autoAlertSent,
        alertSID: fraudResult.alertSID
      },
      fraudDetection: {
        riskLevel: fraudResult.riskScore >= 60 ? 'high' : fraudResult.riskScore >= 30 ? 'medium' : 'low',
        recommendation: fraudResult.riskScore >= 60 ? 'Immediate action required' : 
                        fraudResult.riskScore >= 30 ? 'Review recommended' : 'No action needed'
      }
    };

    console.log('✅ Transaction processed:', {
      transactionId: transactionResponse.transaction.id,
      riskScore: fraudResult.riskScore,
      status: transactionResponse.transaction.status
    });

    res.json(transactionResponse);

  } catch (error) {
    console.error('❌ Error processing transaction:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get transaction history
app.get('/api/transactions', (req, res) => {
  // In a real app, this would fetch from database
  res.json({
    success: true,
    transactions: [],
    message: 'Transaction history endpoint'
  });
});

// Get account information
app.get('/api/accounts/:accNo', (req, res) => {
  const { accNo } = req.params;
  
  // Mock account data - in real app, fetch from database
  const accounts = [
    { accNo: 100, name: "Alice Smith", balance: 150000, type: "Premium" },
    { accNo: 101, name: "Bob Johnson", balance: 75000, type: "Standard" },
    { accNo: 102, name: "Carol Davis", balance: 250000, type: "Business" },
    { accNo: 103, name: "David Wilson", balance: 50000, type: "Standard" },
    { accNo: 104, name: "Eva Brown", balance: 300000, type: "Premium" },
    { accNo: 105, name: "Raj Sharma", balance: 180000, type: "Premium", country: "India" },
    { accNo: 106, name: "Priya Patel", balance: 220000, type: "Business", country: "India" },
    { accNo: 107, name: "Amit Kumar", balance: 95000, type: "Standard", country: "India" },
    { accNo: 108, name: "Anjali Singh", balance: 350000, type: "Premium", country: "India" },
    { accNo: 109, name: "Vikram Mehta", balance: 120000, type: "Business", country: "India" }
  ];

  const account = accounts.find(acc => acc.accNo === parseInt(accNo));
  
  if (!account) {
    return res.status(404).json({
      success: false,
      error: 'Account not found'
    });
  }

  res.json({
    success: true,
    account: account
  });
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

  // International transaction check
  const internationalLocations = ['London', 'Tokyo', 'Paris', 'Sydney', 'Dubai'];
  if (internationalLocations.includes(transaction.location) && transaction.amount > 25000) {
    alerts.push("International high-value transaction");
    riskScore += 15;
  }

  // Round amount check
  if (transaction.amount % 1000 === 0 && transaction.amount > 1000) {
    alerts.push("Round amount transaction - common in fraudulent transactions");
    riskScore += 10;
  }

  // Time-based check (evening/night transactions)
  const currentHour = new Date().getHours();
  if ((currentHour >= 20 || currentHour <= 6) && transaction.amount > 25000) {
    alerts.push("Unusual transaction time");
    riskScore += 10;
  }

  if (alerts.length === 0) {
    alerts.push("No fraud patterns detected");
  }

  return {
    alerts: alerts,
    riskScore: Math.min(riskScore, 100),
    isSuspicious: riskScore > 20,
    autoAlertSent: false
  };
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /api/health',
      'POST /api/send-sms',
      'POST /api/process-transaction',
      'GET /api/transactions',
      'GET /api/accounts/:accNo'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Fraud Detection Backend Server Started');
  console.log('📍 Port:', PORT);
  console.log('📱 Twilio Phone:', process.env.TWILIO_PHONE_NUMBER);
  console.log('🌐 Environment:', process.env.NODE_ENV || 'development');
  console.log('✅ API Endpoints:');
  console.log('   GET  /api/health');
  console.log('   POST /api/send-sms');
  console.log('   POST /api/process-transaction');
  console.log('   GET  /api/transactions');
  console.log('   GET  /api/accounts/:accNo');
  console.log('📧 Ready to send REAL SMS via Twilio!');
});
