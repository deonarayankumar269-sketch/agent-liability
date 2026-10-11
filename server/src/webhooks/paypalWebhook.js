import { config } from '../config.js';
import { paypal } from '../services/paypalClient.js';
import { handleDisputeCreated, handleDisputeResolved } from '../services/disputeService.js';

// mounted with express.raw, req.body is a Buffer here
export async function paypalWebhook(req, res) {
  let event;
  try {
    event = JSON.parse(Buffer.from(req.body).toString('utf8'));
  } catch {
    return res.status(400).send('invalid json');
  }

  if (config.paypal.webhookId && !paypal.simulated) {
    let ok = false;
    try {
      ok = await paypal.verifyWebhook(req.headers, event);
    } catch (err) {
      console.error('[webhook] verify call failed:', err.message);
    }
    if (!ok) return res.status(401).send('signature verification failed');
  } else if (!config.paypal.allowUnsignedWebhooks) {
    return res.status(401).send('set PAYPAL_WEBHOOK_ID to accept webhooks');
  }

  res.status(200).send('OK'); // answer first, paypal retries on slow responses

  try {
    const id = event.resource?.dispute_id;
    if (event.event_type === 'CUSTOMER.DISPUTE.CREATED' && id) await handleDisputeCreated(id);
    else if (event.event_type === 'CUSTOMER.DISPUTE.RESOLVED' && id) await handleDisputeResolved(id, event.resource);
    else console.log('[webhook] ignored', event.event_type);
  } catch (err) {
    console.error('[webhook] handler failed:', err);
  }
}
