import BotCard from '@/components/BotCard';
import type { Bot } from '@/types';

async function getBots(): Promise<Bot[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/bots`, {
    cache: 'no-store',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch bots');
  }
  
  return response.json();
}

export default async function BotsPage() {
  const bots = await getBots();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Bot Team Overview
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor all bot activities and status
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bots.map((bot) => (
          <BotCard key={bot.id} bot={bot} />
        ))}
      </div>
    </div>
  );
}
