import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface GameResult {
  playerName: string;
  email: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  mode: string;
  isBirthday: boolean;
}

export async function sendResultsEmail(result: GameResult): Promise<void> {
  const subject = result.isBirthday
    ? `⚾ Happy Birthday! Your Peck's Per Nine Score: ${result.score} runs!`
    : `⚾ Your Peck's Per Nine Score: ${result.score} runs!`;

  const battingAvg = Math.round((result.correctAnswers / result.totalQuestions) * 1000)
    .toString()
    .padStart(3, '0');

  await resend.emails.send({
    from: 'trivia@peckspernine.com',
    to: result.email,
    subject,
    html: `
      <div style="font-family: Georgia, serif; background: #1a1a2e; color: #F5E642; padding: 40px; max-width: 600px; margin: 0 auto; border: 3px solid #F5E642;">
        ${result.isBirthday ? `<h1 style="color: #FFD700; text-align: center; font-size: 28px;">⚾ HAPPY BIRTHDAY, ${result.playerName}! ⚾</h1>` : ''}
        <h1 style="color: #F5E642; text-align: center; font-size: 24px;">PECK'S PER NINE</h1>
        <h2 style="text-align: center; color: #FFFFFF;">FINAL SCORECARD</h2>
        <div style="background: rgba(255,255,255,0.1); padding: 20px; margin: 20px 0; border-left: 4px solid #FFD700;">
          <p><strong>RUNS SCORED:</strong> ${result.score}</p>
          <p><strong>HITS:</strong> ${result.correctAnswers} / ${result.totalQuestions}</p>
          <p><strong>BATTING AVERAGE:</strong> .${battingAvg}</p>
          <p><strong>GAME MODE:</strong> ${result.mode}</p>
        </div>
        <p style="text-align: center; color: #aaa; font-size: 12px;">Play again at peckspernine.com</p>
      </div>
    `,
  });
}
