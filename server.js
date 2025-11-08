const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Fraud Detection Backend is running',
    timestamp: new Date().toISOString(),
    services: { twilio: 'Active' }
  });
});

// SMS endpoint
app.post('/api/send-sms', async (req, res) => {
  try {
    const { to, message } = req.body;

    console.log('📱 Sending SMS to:', to);

    // Send REAL SMS
    const twilioResponse = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });

    console.log('✅ SMS sent successfully:', twilioResponse.sid);

    res.json({
      success: true,
      message: 'SMS sent successfully',
      sid: twilioResponse.sid,
      status: twilioResponse.status
    });

  } catch (error) {
    console.error('❌ SMS error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log('🚀 Backend running on port', PORT);
  console.log('📱 Twilio Ready for REAL SMS');
});
