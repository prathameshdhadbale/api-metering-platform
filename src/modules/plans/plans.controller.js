import { listPlans } from './plans.service.js';

export async function getPlans(req, res) {
  try {
    return res.status(200).json({ plans: await listPlans() });
  } catch (error) {
    console.error('Plan listing failed:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
