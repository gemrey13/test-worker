import { JSX } from 'react'
import * as XLSX from 'xlsx'

export default function App(): JSX.Element {
  return (
    <div style={{ padding: 20 }}>
      <h1>Electron Vite Node Worker</h1>

      <Test />
    </div>
  )
}

function Test() {
  const handleImport = async () => {
    const result = await window.api.startImport()
    console.log(result)
    alert(`Imported ${result.totalInserted} records`)
  }

  const handleImportGrab = async () => {
    const result = await window.api.startImportGrab()
    console.log(result)
    alert(`Imported ${result.totalInserted} records`)
  }

  const handleRunRecon = async () => {
    const results = await window.api.runRecon()

    if (!results || results.length === 0) {
      alert('No reconciliation results found.')
      return
    }

    // 🔹 Map all rows to readable format
    const mapped = results.map((r) => ({
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

    // 🔹 Split by status for separate sheets
    const exactMatches = mapped.filter((r) => r.status === 'exact_match')
    const toleranceMatches = mapped.filter((r) => r.status === 'tolerance_match')
    const unmatched = mapped.filter((r) => r.status === 'unmatched')

    // 🔹 Create workbook
    const workbook = XLSX.utils.book_new()

    if (exactMatches.length > 0) {
      const wsExact = XLSX.utils.json_to_sheet(exactMatches)
      XLSX.utils.book_append_sheet(workbook, wsExact, 'Exact Matches')
    }

    if (toleranceMatches.length > 0) {
      const wsTolerance = XLSX.utils.json_to_sheet(toleranceMatches)
      XLSX.utils.book_append_sheet(workbook, wsTolerance, 'Tolerance Matches')
    }

    if (unmatched.length > 0) {
      const wsUnmatched = XLSX.utils.json_to_sheet(unmatched)
      XLSX.utils.book_append_sheet(workbook, wsUnmatched, 'Unmatched')
    }

    // 🔹 Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })

    // 🔹 Create Blob and trigger download
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `reconciliation_${Date.now()}.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    alert(
      `Recon completed.\nExact: ${exactMatches.length}, Tolerance: ${toleranceMatches.length}, Unmatched: ${unmatched.length}`
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <div>
        <h1>POS Importer</h1>
        <button onClick={handleImport}>Start Import</button>
      </div>

      <div>
        <h1>GRAB Importer</h1>
        <button onClick={handleImportGrab}>Start Import GRAB</button>
      </div>

      <div>
        <h1>Test Recon</h1>
        <button onClick={handleRunRecon}>Export Multi-Sheet Excel</button>
      </div>
    </div>
  )
}
