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
    console.log('Received request body:', JSON.stringify(req.body, null, 2));
    
    const {
      mode = 'form',
      merchantId = process.env.MERCHANT_ID || "TESTMIDtesting00",
      username = process.env.MASTERCARD_USERNAME || "merchant.TESTMIDtesting00",
      password = process.env.MASTERCARD_PASSWORD || "9233298fcaa1c01f578759954343aca1",
      apiBaseUrl = process.env.MASTERCARD_API_BASE_URL || "https://mtf.gateway.mastercard.com",
      apiVersion = process.env.API_VERSION || "73"
    } = req.body;

    let postData;

    if (mode === 'json' && req.body.jsonPayload) {
      // JSON Mode - Use the complete payload provided by the user
      console.log('Using JSON mode with custom payload');
      postData = req.body.jsonPayload;
      
      // Replace ORDER_PLACEHOLDER with actual generated order ID if present
      if (typeof postData === 'object' && postData.order && postData.order.id === 'ORDER_PLACEHOLDER') {
        postData.order.id = `ORDER_${Date.now()}`;
      }
      
      // If it's a string (shouldn't happen with current frontend, but just in case)
      if (typeof postData === 'string') {
        const orderid = `ORDER_${Date.now()}`;
        postData = postData.replace('"ORDER_PLACEHOLDER"', `"${orderid}"`);
        postData = JSON.parse(postData);
      }
      
      console.log('Final JSON payload:', JSON.stringify(postData, null, 2));
      
    } else {
      // Form Mode - Build payload from individual form fields
      console.log('Using form mode with provided/default values');
      
      const orderid = req.body.orderId || `ORDER_${Date.now()}`;
      const {
        merchantName = process.env.MERCHANT_NAME || "JK Enterprises LLC",
        merchantUrl = process.env.MERCHANT_URL || "https://microsoft.com/",
        currency = process.env.CURRENCY || "USD",
        amount = process.env.DEFAULT_AMOUNT || "99.00",
        description = process.env.ORDER_DESCRIPTION || "Goods and Services",
        returnUrl = process.env.RETURN_URL || "https://hosted-checkout-embedded-page.vercel.app/ReceiptPage"
      } = req.body;

      postData = {
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
      
      console.log('Generated form payload:', JSON.stringify(postData, null, 2));
    }

    // Validate required fields
    if (!postData.apiOperation) {
      throw new Error('apiOperation is required in the payload');
    }
    
    if (!postData.order || !postData.order.amount) {
      throw new Error('order.amount is required in the payload');
    }

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
    console.log('Using auth for merchant:', merchantId);
    console.log('Request headers:', {
      ...axiosConfig.headers,
      'Authorization': 'Basic [HIDDEN]' // Don't log the actual auth token
    });
    
    const response = await axios.post(apiUrl, postData, axiosConfig);
    
    console.log("✅ SUCCESS - Session created:", response.data.session.id);
    console.log("Response status:", response.status);
    console.log("Full response data:", JSON.stringify(response.data, null, 2));
    
    const sessionId = response.data.session.id;

    // Send back just the session ID as expected by the frontend
    res.send(sessionId);
    
  } catch (error) {
    console.error("❌ ERROR occurred:");
    
    if (error.response) {
      // The request was made and the server responded with an error status code
      console.error("HTTP Status:", error.response.status);
      console.error("Response Headers:", error.response.headers);
      console.error("Error Response Data:", JSON.stringify(error.response.data, null, 2));
      
      // Send detailed error back to frontend
      res.status(error.response.status).json({ 
        error: "Mastercard API Error", 
        status: error.response.status,
        details: error.response.data,
        message: error.response.data?.error?.explanation || error.response.data?.message || 'Unknown API error'
      });
      
    } else if (error.request) {
      // The request was made but no response was received
      console.error("Network Error - No response received");
      console.error("Request details:", error.request);
      res.status(500).json({ 
        error: "Network Error", 
        details: "No response received from Mastercard API. Please check your internet connection and API endpoint."
      });
      
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error("Request Setup Error:", error.message);
      console.error("Error stack:", error.stack);
      res.status(500).json({ 
        error: "Request Configuration Error", 
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
    port: port,
    environment: {
      nodeVersion: process.version,
      platform: process.platform
    }
  });
});

// Test endpoint to validate configuration without making API call
app.post('/validate-config', (req, res) => {
  const {
    mode = 'form',
    merchantId,
    username,
    password,
    apiBaseUrl,
    apiVersion,
    jsonPayload
  } = req.body;

  const validation = {
    merchantId: merchantId ? '✅ Provided' : '❌ Missing',
    username: username ? '✅ Provided' : '❌ Missing',
    password: password ? '✅ Provided (hidden)' : '❌ Missing',
    apiBaseUrl: apiBaseUrl || 'Using default',
    apiVersion: apiVersion || 'Using default',
    mode: mode
  };

  if (mode === 'json') {
    validation.jsonPayload = jsonPayload ? '✅ Provided' : '❌ Missing';
    
    if (jsonPayload) {
      try {
        const parsed = typeof jsonPayload === 'string' ? JSON.parse(jsonPayload) : jsonPayload;
        validation.jsonValidation = '✅ Valid JSON';
        validation.hasApiOperation = parsed.apiOperation ? '✅ Has apiOperation' : '❌ Missing apiOperation';
        validation.hasOrderAmount = parsed.order?.amount ? '✅ Has order.amount' : '❌ Missing order.amount';
      } catch (e) {
        validation.jsonValidation = `❌ Invalid JSON: ${e.message}`;
      }
    }
  }

  const constructedApiUrl = `${apiBaseUrl || 'https://mtf.gateway.mastercard.com'}/api/rest/version/${apiVersion || '73'}/merchant/${merchantId || 'MERCHANT_ID'}/session`;

  res.json({
    message: 'Configuration validation completed',
    mode: mode,
    validation: validation,
    constructedApiUrl: constructedApiUrl,
    ready: validation.merchantId.includes('✅') && 
           validation.username.includes('✅') && 
           validation.password.includes('✅') &&
           (mode === 'form' || (mode === 'json' && validation.jsonPayload?.includes('✅')))
  });
});

// Endpoint to test different JSON payloads
app.post('/test-payload', (req, res) => {
  const { jsonPayload } = req.body;
  
  try {
    const parsed = typeof jsonPayload === 'string' ? JSON.parse(jsonPayload) : jsonPayload;
    
    // Replace ORDER_PLACEHOLDER with actual generated order ID if present
    if (parsed.order && parsed.order.id === 'ORDER_PLACEHOLDER') {
      parsed.order.id = `ORDER_${Date.now()}`;
    }
    
    // Analyze the payload
    const analysis = {
      isValid: true,
      structure: {
        apiOperation: parsed.apiOperation || 'Missing',
        checkoutMode: parsed.checkoutMode || 'Missing',
        hasInteraction: !!parsed.interaction,
        hasOrder: !!parsed.order,
        hasMerchant: !!parsed.interaction?.merchant
      },
      order: parsed.order ? {
        id: parsed.order.id,
        amount: parsed.order.amount,
        currency: parsed.order.currency,
        description: parsed.order.description
      } : null,
      interaction: parsed.interaction ? {
        operation: parsed.interaction.operation,
        returnUrl: parsed.interaction.returnUrl,
        merchantName: parsed.interaction.merchant?.name,
        merchantUrl: parsed.interaction.merchant?.url
      } : null,
      warnings: [],
      errors: []
    };
    
    // Validate required fields
    if (!parsed.apiOperation) {
      analysis.errors.push('apiOperation is required');
    }
    if (!parsed.order?.amount) {
      analysis.errors.push('order.amount is required');
    }
    if (!parsed.order?.currency) {
      analysis.warnings.push('order.currency not specified - may default to USD');
    }
    if (!parsed.interaction?.returnUrl) {
      analysis.warnings.push('interaction.returnUrl not specified - user may not be redirected after payment');
    }
    
    analysis.isValid = analysis.errors.length === 0;
    
    res.json({
      message: 'Payload analysis completed',
      processedPayload: parsed,
      analysis: analysis
    });
    
  } catch (e) {
    res.status(400).json({
      error: 'Invalid JSON payload',
      details: e.message
    });
  }
});

app.listen(port, () => {
  console.log('🚀='.repeat(50));
  console.log('🚀 Mastercard Checkout API Server is running!');
  console.log('🚀='.repeat(50));
  console.log(`📡 Main endpoint: http://localhost:${port}/`);
  console.log(`🏥 Health check: http://localhost:${port}/health`);
  console.log(`✅ Config validation: http://localhost:${port}/validate-config`);
  console.log(`🧪 Payload testing: http://localhost:${port}/test-payload`);
  console.log('');
  console.log('📋 Environment Configuration:');
  console.log(`   MERCHANT_ID: ${process.env.MERCHANT_ID || 'Not set (will use request data)'}`);
  console.log(`   API_VERSION: ${process.env.API_VERSION || 'Not set (will use default: 73)'}`);
  console.log(`   API_BASE_URL: ${process.env.MASTERCARD_API_BASE_URL || 'Not set (will use default)'}`);
  console.log('');
  console.log('🔧 Supported Modes:');
  console.log('   📝 Form Mode: Simple form-based configuration');
  console.log('   🎛️  JSON Mode: Advanced custom JSON payload');
  console.log('');
  console.log('💡 Ready to accept requests!');
  console.log('='.repeat(60));
});