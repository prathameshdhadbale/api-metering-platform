
import {
  getUsageSummary,
  getDailyUsage,
  getUsageByApiKey,
  getUsageByEndpoint,
  getRecentUsage
} from './analytics.service.js';

export async function usageSummary(req, res) {
  try {
    const summary = await getUsageSummary(req.userId);
    return res.status(200).json({ summary });
  } catch (error) {
    console.error('Failed to fetch usage summary:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function dailyUsage(req, res) {
  try {
    const days = Number(req.query.days ?? 7);

    if (!Number.isInteger(days) || days < 1 || days > 90) {
      return res.status(400).json({
        error: 'days must be an integer between 1 and 90'
      });
    }

    const dailyUsage = await getDailyUsage(req.userId, days);
    return res.status(200).json({ dailyUsage });
  } catch (error) {
    console.error('Failed to fetch daily usage:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function usageByApiKey(req, res) {
  try {
    const apiKeys = await getUsageByApiKey(req.userId);
    return res.status(200).json({ apiKeys });
  } catch (error) {
    console.error('Failed to fetch usage by API key:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function usageByEndpoint(req, res) {
  try {
    const endpoints = await getUsageByEndpoint(req.userId);
    return res.status(200).json({ endpoints });
  } catch (error) {
    console.error('Failed to fetch usage by endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function recentUsage(req, res) {
  try {
    const limit = Number(req.query.limit ?? 10);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return res.status(400).json({ error: 'limit must be an integer between 1 and 50' });
    }
    return res.status(200).json({ activity: await getRecentUsage(req.userId, limit) });
  } catch (error) {
    console.error('Failed to fetch recent usage:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
