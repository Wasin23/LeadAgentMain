exports.handler = async (event, context) => {
  try {
    // Get tracking ID from path parameter or query parameter
    let trackingId = event.queryStringParameters?.email_id;
    
    if (!trackingId) {
      // Extract from path (e.g., /track/click/abc123)
      const pathParts = event.path.split('/');
      trackingId = pathParts[pathParts.length - 1];
    }
    
    const redirectUrl = event.queryStringParameters?.url;
    
    console.log('Click tracking:', { trackingId, redirectUrl, path: event.path, query: event.queryStringParameters });
    
    if (!trackingId || !redirectUrl) {
      return {
        statusCode: 400,
        body: 'Missing parameters'
      };
    }

    // Store to Zilliz
    try {
      const { MilvusClient } = require('@zilliz/milvus2-sdk-node');
      
      if (process.env.ZILLIZ_ENDPOINT && process.env.ZILLIZ_TOKEN) {
        const client = new MilvusClient({
          address: process.env.ZILLIZ_ENDPOINT,
          token: process.env.ZILLIZ_TOKEN
        });

        // Extract user ID and agent ID from tracking ID for proper attribution
        const extractIdsFromTrackingId = (trackingId) => {
          if (!trackingId) return { userId: null, agentId: null };
          // Format: tracking-{userId}_{agentId}_{timestamp}_{hash}
          const match = trackingId.match(/tracking-([a-f0-9-]+)_([^_]+)_/);
          return match ? { userId: match[1], agentId: match[2] } : { userId: null, agentId: null };
        };
        
        const { userId, agentId } = extractIdsFromTrackingId(trackingId);
        
        const data = [{
          tracking_id: trackingId,
          user_id: userId || 'unknown',
          agent_id: agentId || 'unknown',
          event_type: 'link_click',
          timestamp: new Date().toISOString(),
          user_agent: event.headers['user-agent'] || 'Unknown',
          ip_address: event.headers['x-forwarded-for'] || 'Unknown',
          clicked_url: redirectUrl,
          email_address: 'Unknown',
          recipient: 'Unknown',
          processed: false,
          dummy_vector: [0.0, 0.0]
        }];

        await client.insert({
          collection_name: 'email_tracking_events',
          data: data
        });
      }
    } catch (e) {
      console.log('Zilliz error:', e);
    }

    // Redirect
    return {
      statusCode: 302,
      headers: {
        'Location': redirectUrl,
        'Cache-Control': 'no-cache'
      }
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: 'Error'
    };
  }
};
