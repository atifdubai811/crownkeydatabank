const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

const campaignQueue = new Queue('campaign', { connection });

module.exports = { campaignQueue, connection };
