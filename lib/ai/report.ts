import { hasTextAI, openaiChatText } from "./openai";
import type { ReportInput } from "@/lib/domain/report";

/**
 * Optional AI-written weekly battle report (Level 3). Called once when a
 * week's result page first renders without a stored AI report; the caller
 * stores the output so it is never regenerated. Only structured, minimal
 * data is sent — names, scores and totals, never raw logs.
 */
export async function generateAIBattleReport(
  input: ReportInput & { foodNames: { name: string; count: number }[] },
): Promise<string | null> {
  if (!hasTextAI()) return null;
  try {
    const facts = {
      challenge: input.challenge.name,
      challengeDescription: input.challenge.description,
      standings: input.standings.map((s) => ({
        name: s.name,
        score: s.score,
        rank: s.rank,
        winner: s.winner,
      })),
      familyTotal: Math.round(input.familyTotal * 10) / 10,
      familyTarget: input.familyTarget,
      topFoods: input.foodNames.slice(0, 5),
    };
    const text = await openaiChatText({
      system:
        "You write a very short, affectionate, funny weekly report for a private family fruit-and-veg game called Broccoli Battle. Three to five sentences, family-safe, playful, never mean, never preachy about health, no emoji spam (at most one), British English. Mention the champion, one runner-up detail, the family total, and one amusing observation. Do not invent facts beyond the data given.",
      user: JSON.stringify(facts),
    });
    return text.length > 20 && text.length < 1500 ? text : null;
  } catch {
    return null;
  }
}
