import { zodTextFormat } from 'openai/helpers/zod';
import { GuardrailOutputZod, GuardrailOutput } from '@/app/types';

// Validator that calls the /api/responses endpoint to
// validates the realtime output according to moderation policies. 
// This will prevent the realtime model from responding in undesired ways
// By sending it a corrective message and having it redirect the conversation.
export async function runGuardrailClassifier(
  message: string,
  companyName: string = 'newTelco',
): Promise<GuardrailOutput> {
  const messages = [
    {
      role: 'user',
      content: `You are an expert at classifying text for an ARTISTIC RESEARCH PROJECT called ${companyName}. This is a decolonial AI art installation that explores critical topics through simulation and performance. Historical debates, philosophical discussions, and artistic expression should be allowed within the context of research and education.

      DISCLAIMER: This is an artistic research project exploring decolonial AI and critical dialogue. Content represents simulation and artistic exploration, not real beliefs or endorsements.

      <info>
      - Project name: ${companyName}
      - Context: Artistic research and decolonial AI exploration
      - Purpose: Educational, artistic, and critical discourse
      </info>

      <message>
      ${message}
      </message>

      <output_classes>
      - EXTREME_HARM: Only flag content that poses immediate real-world danger or illegal activity.
      - NONE: Educational content, historical simulation, philosophical debate, artistic expression, and critical discourse should be classified as NONE.
      </output_classes>

      NOTE: Be very permissive for artistic, educational, and research contexts. Historical debates, philosophical disagreements, and critical analysis are part of the artistic exploration.
      `,
    },
  ];

  const response = await fetch('/api/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      input: messages,
      text: {
        format: zodTextFormat(GuardrailOutputZod, 'output_format'),
      },
    }),
  });

  if (!response.ok) {
    console.warn('Server returned an error:', response);
    return Promise.reject('Error with runGuardrailClassifier.');
  }

  const data = await response.json();

  try {
    const output = GuardrailOutputZod.parse(data.output_parsed);
    return {
      ...output,
      testText: message,
    };
  } catch (error) {
    console.error('Error parsing the message content as GuardrailOutput:', error);
    return Promise.reject('Failed to parse guardrail output.');
  }
}

export interface RealtimeOutputGuardrailResult {
  tripwireTriggered: boolean;
  outputInfo: any;
}

export interface RealtimeOutputGuardrailArgs {
  agentOutput: string;
  agent?: any;
  context?: any;
}

// Creates a guardrail bound to a specific company name for output moderation purposes. 
export function createModerationGuardrail(companyName: string) {
  return {
    name: 'moderation_guardrail',

    async execute({ agentOutput }: RealtimeOutputGuardrailArgs): Promise<RealtimeOutputGuardrailResult> {
      try {
        const res = await runGuardrailClassifier(agentOutput, companyName);
        const triggered = res.moderationCategory === 'EXTREME_HARM';
        return {
          tripwireTriggered: triggered,
          outputInfo: res,
        };
      } catch {
        return {
          tripwireTriggered: false,
          outputInfo: { error: 'guardrail_failed' },
        };
      }
    },
  } as const;
}