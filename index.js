const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require("crypto");
const http = require('http');
const https = require('https');
require('dotenv').config(); // Load environment variables

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3005;

app.post('/', async (req, res) => {
  try {
    console.log('Received request body:', req.body);
    
    const trxid = crypto.randomBytes(16).toString("hex");
    const orderid = req.body.orderId || crypto.randomBytes(16).toString("hex");
    
    // Extract configuration from request body or fall back to environment variables
    const {
      merchantId = process.env.MERCHANT_ID || "TESTMIDtesting00",
      username = process.env.MASTERCARD_USERNAME || "merchant.TESTMIDtesting00",
      password = process.env.MASTERCARD_PASSWORD || "9233298fcaa1c01f578759954343aca1",
      merchantName = process.env.MERCHANT_NAME || "JK Enterprises LLC",
      merchantUrl = process.env.MERCHANT_URL || "https://microsoft.com/",
      currency = process.env.CURRENCY || "USD",
      amount = process.env.DEFAULT_AMOUNT || "99.00",
      description = process.env.ORDER_DESCRIPTION || "Goods and Services",
      returnUrl = process.env.RETURN_URL || "https://hosted-checkout-embedded-page.vercel.app/ReceiptPage",
      apiBaseUrl = process.env.MASTERCARD_API_BASE_URL || "https://mtf.gateway.mastercard.com",
      apiVersion = process.env.API_VERSION || "73"
    } = req.body;

    console.log('Using configuration:', {
      merchantId: merchantId,
      merchantName: merchantName,
      merchantUrl: merchantUrl,
      currency: currency,
      amount: amount,
      description: description,
      returnUrl: returnUrl,
      apiBaseUrl: apiBaseUrl,
      apiVersion: apiVersion,
      orderId: orderid
    });
    
    // Create the payment session request body
    const postData = {
      "apiOperation": "INITIATE_CHECKOUT",
      "checkoutMode": "WEBSITE",
      "interaction": {
        "operation": "PURCHASE",
        "merchant": { 
          "name": merchantName,
          "url": merchantUrl
        },
        "returnUrl": returnUrl
      },
      "order": {
        "currency": currency,
        "amount": amount,
        "id": orderid,
        "description": description
      }
    };

    console.log('Request payload:', JSON.stringify(postData, null, 2));

    // Create the Basic Auth token from username and password
    const authToken = Buffer.from(`${username}:${password}`).toString('base64');
    
    const axiosConfig = {
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        "Access-Control-Allow-Origin": "*",
        'Authorization': `Basic ${authToken}`,
        "Accept": "application/json"
      }
    };

    // Construct the API URL
    const apiUrl = `${apiBaseUrl}/api/rest/version/${apiVersion}/merchant/${merchantId}/session`;
    console.log('Making request to:', apiUrl);
    
    const response = await axios.post(apiUrl, postData, axiosConfig);
    
    console.log("RESPONSE RECEIVED Create: ", response.data.session.id);
    console.log("Full response:", JSON.stringify(response.data, null, 2));
    
    const sessionId = response.data.session.id;

    res.send(sessionId);
  } catch (error) {
    console.error("Error details:");
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error("Status:", error.response.status);
      console.error("Headers:", error.response.headers);
      console.error("Data:", error.response.data);
      res.status(error.response.status).json({ 
        error: "API Error", 
        details: error.response.data,
        status: error.response.status
      });
    } else if (error.request) {
      // The request was made but no response was received
      console.error("Request:", error.request);
      res.status(500).json({ 
        error: "Network Error", 
        details: "No response received from Mastercard API"
      });
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error("Error:", error.message);
      res.status(500).json({ 
        error: "Request Error", 
        details: error.message
      });
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    port: port 
  });
});

// Test endpoint to verify configuration
app.post('/test-config', (req, res) => {
  const {
    merchantId,
    username,
    password,
    apiBaseUrl,
    apiVersion
  } = req.body;

  res.json({
    message: 'Configuration received successfully',
    config: {
      merchantId: merchantId ? '✓ Provided' : '✗ Missing',
      username: username ? '✓ Provided' : '✗ Missing',
      password: password ? '✓ Provided (hidden)' : '✗ Missing',
      apiBaseUrl: apiBaseUrl || 'Using default',
      apiVersion: apiVersion || 'Using default'
    },
    constructedApiUrl: `${apiBaseUrl || 'https://mtf.gateway.mastercard.com'}/api/rest/version/${apiVersion || '73'}/merchant/${merchantId || 'MERCHANT_ID'}/session`
  });
});

app.listen(port, () => {
  console.log(`🚀 Mastercard Checkout API Server running at http://localhost:${port}`);
  console.log(`📋 Health check available at http://localhost:${port}/health`);
  console.log(`🧪 Test config endpoint at http://localhost:${port}/test-config`);
  console.log('');
  console.log('Environment variables loaded:');
  console.log(`- MERCHANT_ID: ${process.env.MERCHANT_ID || 'Not set (using default)'}`);
  console.log(`- API_VERSION: ${process.env.API_VERSION || 'Not set (using default)'}`);
  console.log(`- MASTERCARD_API_BASE_URL: ${process.env.MASTERCARD_API_BASE_URL || 'Not set (using default)'}`);
});