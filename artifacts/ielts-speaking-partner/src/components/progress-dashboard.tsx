import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { DisplayMessage } from '@/hooks/use-ielts-conversation';

interface ProgressDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: DisplayMessage[];
}

export function ProgressDashboard({ open, onOpenChange, messages }: ProgressDashboardProps) {
  const scoredTurns = messages.filter((m) => m.bandScores);

  const chartData = scoredTurns.map((m, i) => ({
    turn: i + 1,
    overall: m.bandScores!.overall,
    fluency: m.bandScores!.fluency,
    lexicalResource: m.bandScores!.lexicalResource,
    grammaticalRange: m.bandScores!.grammaticalRange,
    pronunciation: m.bandScores!.pronunciation,
  }));

  const average =
    scoredTurns.length > 0
      ? scoredTurns.reduce((sum, m) => sum + m.bandScores!.overall, 0) / scoredTurns.length
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#2A3B4C]">
            <TrendingUp size={20} className="text-[#E86A4C]" />
            My Progress
          </DialogTitle>
          <DialogDescription>
            Your estimated overall band score across this session.
          </DialogDescription>
        </DialogHeader>

        {chartData.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            Answer a few questions to see your band score trend here.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#2A3B4C]">{average.toFixed(1)}</span>
              <span className="text-sm text-gray-500">average overall band score ({chartData.length} turn{chartData.length === 1 ? '' : 's'})</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ece3" />
                  <XAxis
                    dataKey="turn"
                    tick={{ fontSize: 12, fill: '#5A6C7D' }}
                    label={{ value: 'Turn', position: 'insideBottom', offset: -2, fontSize: 12, fill: '#5A6C7D' }}
                  />
                  <YAxis domain={[0, 9]} tick={{ fontSize: 12, fill: '#5A6C7D' }} />
                  <Tooltip
                    formatter={(value: number) => value.toFixed(1)}
                    contentStyle={{ borderRadius: 12, border: '1px solid #f0ece3', fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="overall" name="Overall" stroke="#E86A4C" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
