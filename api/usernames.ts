// api/usernames.ts

export const config = {
  runtime: 'edge',
};

export const POST = async ({ request }: { request: Request }) => {
  try {
    const body = await request.json();
    const clientAddresses: string[] | undefined = body.addresses;

    if (!clientAddresses || !Array.isArray(clientAddresses)) {
      return new Response(JSON.stringify({ error: 'Addresses must be an array.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (clientAddresses.length === 0) {
      // Return an empty map if no addresses are provided, 
      // consistent with client expecting a map.
      return new Response(JSON.stringify({}), {
        status: 200, 
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in /api/usernames:', error);
    let errorMessage = 'Internal server error';
    let statusCode = 500;

    if (error instanceof SyntaxError && error.message.toLowerCase().includes("json")) {
        errorMessage = "Invalid JSON in request body";
        statusCode = 400;
    } else if (error.message) {
        errorMessage = error.message;
    }
    
    return new Response(JSON.stringify({ error: errorMessage, details: error.message }), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}; 