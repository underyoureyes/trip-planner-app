import type { SupabaseClient } from '@supabase/supabase-js'

// claude-sonnet-4-6 pricing (USD per token)
const INPUT_COST_PER_TOKEN  = 3.00  / 1_000_000
const OUTPUT_COST_PER_TOKEN = 15.00 / 1_000_000

export function calcCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN
}

export interface RecordUsageOpts {
  userId:       string
  tripId?:      string | null
  endpoint:     string
  inputTokens:  number
  outputTokens: number
}

export async function recordUsage(
  supabase: SupabaseClient,
  opts: RecordUsageOpts
): Promise<void> {
  const cost_usd = calcCost(opts.inputTokens, opts.outputTokens)
  await supabase.from('api_usage').insert({
    user_id:       opts.userId,
    trip_id:       opts.tripId ?? null,
    endpoint:      opts.endpoint,
    input_tokens:  opts.inputTokens,
    output_tokens: opts.outputTokens,
    cost_usd,
  })
}

export interface UsageSummary {
  total_cost_usd:   number
  total_input:      number
  total_output:     number
  by_endpoint:      Record<string, { cost_usd: number; calls: number }>
}

export function aggregateUsage(
  rows: { endpoint: string; input_tokens: number; output_tokens: number; cost_usd: number }[]
): UsageSummary {
  const summary: UsageSummary = { total_cost_usd: 0, total_input: 0, total_output: 0, by_endpoint: {} }
  for (const row of rows) {
    summary.total_cost_usd += Number(row.cost_usd)
    summary.total_input    += row.input_tokens
    summary.total_output   += row.output_tokens
    if (!summary.by_endpoint[row.endpoint]) summary.by_endpoint[row.endpoint] = { cost_usd: 0, calls: 0 }
    summary.by_endpoint[row.endpoint].cost_usd += Number(row.cost_usd)
    summary.by_endpoint[row.endpoint].calls    += 1
  }
  return summary
}
