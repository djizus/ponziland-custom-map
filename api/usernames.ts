// api/usernames.ts

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    const body = await request.json();
    const clientAddresses: string[] | undefined = body.addresses;

    if (!clientAddresses || !Array.isArray(clientAddresses)) {
      return new Response(JSON.stringify({ error: 'Addresses must be an array.' }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    
    if (clientAddresses.length === 0) {
      // Return an empty map if no addresses are provided, 
      // consistent with client expecting a map.
      return new Response(JSON.stringify({}), {
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Fetch usernames for the client-provided addresses from Socialink
    const socialinkResponse = await fetch("https://socialink.ponzi.land/api/user/lookup", {
      method: "POST",
      headers: {
        "accept": "application/json", 
        "content-type": "application/json",
      },
      body: JSON.stringify({ addresses: clientAddresses }), // Pass client addresses to Socialink
    });

    if (!socialinkResponse.ok) {
      const errorText = await socialinkResponse.text();
      console.error('Socialink API error:', socialinkResponse.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to fetch usernames from Socialink', details: errorText }), {
        status: socialinkResponse.status,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const usernameDataFromSocialink: Array<{ username: string; address: string }> = await socialinkResponse.json();
    
    const usernameMap: Record<string, string> = {};
    usernameDataFromSocialink.forEach(item => {
      if (item.address && item.username) {
        // Use address directly from Socialink response
        usernameMap[item.address.toLowerCase()] = item.username; // Use toLowerCase for case-insensitive matching if needed by Socialink or consistent keying
      }
    });

    return new Response(JSON.stringify(usernameMap), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error: any) {
    // Standardized API error handling
    const timestamp = new Date().toISOString();
    let errorMessage = 'Internal server error';
    let statusCode = 500;

    if (error instanceof SyntaxError && error.message.toLowerCase().includes("json")) {
        errorMessage = "Invalid JSON in request body";
        statusCode = 400;
    } else if (error.message) {
        errorMessage = error.message;
    }

    console.error(`[${timestamp}] [API_USERNAMES] ${errorMessage}`, {
      error,
      statusCode,
      requestMethod: 'POST', // We know it's POST from the function logic
    });
    
    return new Response(JSON.stringify({ 
      error: errorMessage, 
      timestamp,
      details: undefined // Edge runtime doesn't have process.env access in the same way
    }), {
      status: statusCode,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}; 