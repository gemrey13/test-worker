import { useEffect, useState } from 'react'

type FilterState = {
  branch?: string
  fromDate?: string
  toDate?: string
}

type MatchResult = {
  pos?: any
  grab?: any
  variance: number
  status: string
}

const TestComponent = () => {
  const [branches, setBranches] = useState<string[]>([])
  const [filters, setFilters] = useState<FilterState>({})
  const [results, setResults] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<any[]>([])

  // 🔹 Load branch options
  useEffect(() => {
    window.api.getBranches().then(setBranches)
  }, [])

  // 🔹 Handlers
  const updateFilter = (key: keyof FilterState, value?: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }))
  }

  const handleRunRecon = async () => {
    setLoading(true)

    try {
      const results = await window.api.run(filters)

      if (!results || results.length === 0) {
        alert('No reconciliation results found.')
        setRows([])
        return
      }

      const mapped = results.map((r: any) => ({
        pos_amount: r.pos?.grschrg ?? '',
        pos_cusno: r.pos?.cusno ?? '',
        pos_branch_name: r.pos?.branch_name ?? '',
        pos_date: r.pos ? new Date(r.pos.orddate).toLocaleDateString('en-US') : '',
        grab_amount: r.grab?.amount ?? '',
        grab_booking_id: r.grab?.booking_id ?? '',
        grab_store_name: r.grab?.store_name ?? '',
        grab_date: r.grab ? new Date(r.grab.created_on).toLocaleDateString('en-US') : '',
        variance: r.variance,
        status: r.status
      }))

      setRows(mapped)
    } finally {
      setLoading(false)
    }
  }

  const runToday = async () => {
    setLoading(true)
    try {
      const data = await window.api.run({ preset: 'today', branch: filters.branch })
      setResults(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>Reconciliation Test</h2>

      {/* 🔹 Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <label>Branch</label>
          <select
            value={filters.branch ?? ''}
            onChange={(e) => updateFilter('branch', e.target.value)}
          >
            <option value="">All</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>From</label>
          <input
            type="date"
            value={filters.fromDate ?? ''}
            onChange={(e) => updateFilter('fromDate', e.target.value)}
          />
        </div>

        <div>
          <label>To</label>
          <input
            type="date"
            value={filters.toDate ?? ''}
            onChange={(e) => updateFilter('toDate', e.target.value)}
          />
        </div>

        <button onClick={handleRunRecon} disabled={loading}>
          {loading ? 'Running…' : 'Run'}
        </button>

        <button onClick={runToday} disabled={loading}>
          Today
        </button>
      </div>

      {/* 🔹 Summary */}
      <div>
        <strong>Results:</strong> {results.length}
      </div>

      {/* 🔹 Results Table */}
      <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid #ddd' }}>
        <table width="100%" cellPadding={6}>
          <thead>
            <tr>
              <th>Status</th>
              <th>POS Amount</th>
              <th>Grab Amount</th>
              <th>Variance</th>
              <th>POS Branch</th>
              <th>Grab Store</th>
              <th>POS Date</th>
              <th>Grab Date</th>
              <th>CUSNO</th>
              <th>Booking ID</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.status}</td>
                <td>{r.pos_amount}</td>
                <td>{r.grab_amount}</td>
                <td>{r.variance}</td>
                <td>{r.pos_branch_name}</td>
                <td>{r.grab_store_name}</td>
                <td>{r.pos_date}</td>
                <td>{r.grab_date}</td>
                <td>{r.pos_cusno}</td>
                <td>{r.grab_booking_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default TestComponent
