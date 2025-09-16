// Netlify Function to forward tracking data to desktop app
exports.handler = async (event, context) => {
  // Only handle POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Handle preflight CORS requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: ''
    };
  }

  try {
    // Parse the tracking data
    const trackingData = JSON.parse(event.body || '{}');
    
    console.log('📧 Netlify Function received tracking data:', trackingData);

    // Try to forward to desktop app (localhost)
    try {
      const response = await fetch('http://localhost:8080/api/webhooks/email-open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trackingData)
      });

      if (response.ok) {
        console.log('✅ Successfully forwarded to desktop app');
        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ 
            success: true, 
            message: 'Tracking data forwarded to desktop app' 
          })
        };
      } else {
        console.log('⚠️ Desktop app responded with error:', response.status);
      }
    } catch (error) {
      console.log('❌ Could not reach desktop app:', error.message);
    }

    // If desktop app is not reachable, still log the tracking data
    console.log('📝 Logging tracking data (desktop app not available)');
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Tracking data logged (desktop app not reachable)' 
      })
    };

  } catch (error) {
    console.error('❌ Error processing tracking data:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        success: false, 
        error: error.message 
      })
    };
  }
};
