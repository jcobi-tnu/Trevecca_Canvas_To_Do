// Canvas API Helper - Routes all Canvas API calls through Cloudflare Worker

import log from 'loglevel';

const logger = log.getLogger('Canvas');

const PROXY_URL = process.env.CANVAS_TOKEN_PROXY_URL || 'https://canvas-todo-oauth-proxy.tnuappdev.workers.dev/';

export async function callCanvasAPI({
    canvasBaseUrl,
    endpoint,
    accessToken,
    method = 'GET',
    body = null
}) {
  try {
    const response = await fetch(`${PROXY_URL}api/proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        canvasBaseUrl,
        endpoint,
        method,
        body,
        accessToken
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Canvas API error: ${error.error || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    logger.error('Canvas API call failed:', error);
    throw error;
  }
}