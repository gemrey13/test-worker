export type MatchStatus = 'exact_match' | 'tolerance_match' | 'discrepancy' | 'unmatched'

export type MatchResult = {
  pos?: any
  grab?: any
  variance: number
  status: MatchStatus
}

export type ReconcileFilters = {
  branch?: string // grab_name
  fromDate?: string
  toDate?: string
  preset?: 'today'
}

export type GroupedReconcileResults = {
  branch: string
  date: string
  items: MatchResult[]
}[]
